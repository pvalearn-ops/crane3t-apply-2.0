/**
 * 三噸以下起重機申請網頁 — AI 解析轉送服務（Google Apps Script → Google Gemini API）
 * ------------------------------------------------------------
 * 網頁把文件影像／PDF、提示詞與 JSON Schema 送到這裡，由本程式帶上 Gemini API Key
 * 呼叫 Gemini generateContent，再把結果回傳網頁。API Key 只存在 Apps Script，不會出現在使用者瀏覽器。
 *
 * 必要的「指令碼屬性」（專案設定 → 指令碼屬性）：
 *   GEMINI_API_KEY   Gemini API Key（於 Google AI Studio https://aistudio.google.com/apikey 申請）
 *   ACCESS_TOKEN     自訂存取碼；網頁「AI 設定」需填入相同的值才能使用（防止他人盜用額度）
 * 選用：
 *   MODEL            預設 gemini-3.1-flash-lite
 *   THINKING         minimal / low / medium / high，預設 low（越高越準、越慢）
 *   DAILY_LIMIT      每日 AI 解析次數上限（台灣時間每日 0 點重置），預設 500；填 0 表示不限制
 *
 * 部署方式見同資料夾「部署說明.md」。
 */

const DEFAULT_MODEL = 'gemini-3.1-flash-lite';
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';
const ALLOWED_TASKS = ['docs', 'chart'];
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'];
const MAX_FILES = 12;
const DEFAULT_DAILY_LIMIT = 500;
const TZ = 'Asia/Taipei';

function doGet() {
  return out_({ ok: true, service: 'crane3t-ai', model: prop_('MODEL') || DEFAULT_MODEL });
}

function doPost(e) {
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const key = prop_('GEMINI_API_KEY');
    const token = prop_('ACCESS_TOKEN');
    if (!key) return out_({ ok: false, error: 'Apps Script 尚未設定指令碼屬性 GEMINI_API_KEY。' });
    if (!token) return out_({ ok: false, error: 'Apps Script 尚未設定指令碼屬性 ACCESS_TOKEN（存取碼），為安全起見拒絕服務。' });
    if (req.token !== token) return out_({ ok: false, error: '存取碼錯誤，請確認網頁「AI 設定」中的存取碼。' });

    const model = prop_('MODEL') || DEFAULT_MODEL;
    if (req.action === 'ping') return out_(Object.assign({ ok: true, model: model }, usage_()));
    if (req.action !== 'extract') return out_({ ok: false, error: '不支援的動作。' });
    if (ALLOWED_TASKS.indexOf(req.task) < 0) return out_({ ok: false, error: '不支援的解析任務。' });
    if (typeof req.prompt !== 'string' || !req.prompt || !req.schema || typeof req.schema !== 'object') return out_({ ok: false, error: '缺少提示詞或 Schema。' });
    const files = Array.isArray(req.files) ? req.files : [];
    if (!files.length) return out_({ ok: false, error: '沒有附件。' });
    if (files.length > MAX_FILES) return out_({ ok: false, error: '附件超過 ' + MAX_FILES + ' 個，請分次解析。' });

    // 每日次數上限（只計算實際呼叫 Gemini 的解析請求）
    const quota = takeQuota_();
    if (!quota.ok) return out_({ ok: false, error: '今日 AI 解析次數已達上限（' + quota.limit + ' 次），請明日再試或改用手動填寫。', used: quota.used, limit: quota.limit });

    const parts = [];
    for (const f of files) {
      if (ALLOWED_TYPES.indexOf(f.media_type) < 0 || typeof f.data !== 'string') return out_({ ok: false, error: '不支援的檔案格式：' + f.media_type });
      parts.push({ text: '【附件：' + String(f.label || '').slice(0, 50) + '】' });
      parts.push({ inlineData: { mimeType: f.media_type, data: f.data } });
    }
    parts.push({ text: req.prompt });

    const body = {
      contents: [{ role: 'user', parts: parts }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: toGeminiSchema_(req.schema),
        temperature: 0,
        maxOutputTokens: 16000,
        thinkingConfig: { thinkingLevel: prop_('THINKING') || 'low' }
      }
    };

    let res = callApi_(key, model, body);
    // 若模型不接受思考等級設定，改用模型預設值重試一次
    if (res.code === 400 && /thinking/i.test(res.errorText)) { delete body.generationConfig.thinkingConfig; res = callApi_(key, model, body); }
    if (res.code !== 200) return out_({ ok: false, error: 'Gemini API 錯誤（HTTP ' + res.code + '）：' + res.errorText });

    const r = res.json || {};
    if (r.promptFeedback && r.promptFeedback.blockReason) return out_({ ok: false, error: 'AI 拒絕處理此請求（' + r.promptFeedback.blockReason + '），請改用手動填寫。' });
    const cand = (r.candidates || [])[0];
    if (!cand) return out_({ ok: false, error: 'AI 沒有回傳結果。' });
    if (cand.finishReason === 'MAX_TOKENS') return out_({ ok: false, error: '回覆過長被截斷，請減少附件或分次解析。' });
    if (cand.finishReason && cand.finishReason !== 'STOP') return out_({ ok: false, error: 'AI 未完成回覆（' + cand.finishReason + '），請改用手動填寫。' });
    const text = ((cand.content && cand.content.parts) || []).filter(function (p) { return p.text && !p.thought; }).map(function (p) { return p.text; }).join('');
    return out_({ ok: true, text: text, model: r.modelVersion || model, usage: r.usageMetadata, used: quota.used, limit: quota.limit });
  } catch (err) {
    return out_({ ok: false, error: String(err && err.message || err) });
  }
}

/* Gemini responseSchema 採 OpenAPI 子集：移除不支援的 additionalProperties 等關鍵字 */
function toGeminiSchema_(s) {
  if (Array.isArray(s)) return s.map(toGeminiSchema_);
  if (!s || typeof s !== 'object') return s;
  const o = {};
  Object.keys(s).forEach(function (k) {
    if (k === 'additionalProperties' || k === '$schema') return;
    o[k] = (k === 'properties')
      ? Object.keys(s.properties).reduce(function (a, p) { a[p] = toGeminiSchema_(s.properties[p]); return a; }, {})
      : toGeminiSchema_(s[k]);
  });
  return o;
}

function callApi_(key, model, body) {
  const r = UrlFetchApp.fetch(API_BASE + encodeURIComponent(model) + ':generateContent', {
    method: 'post', contentType: 'application/json', headers: { 'x-goog-api-key': key },
    payload: JSON.stringify(body), muteHttpExceptions: true
  });
  const code = r.getResponseCode();
  let json = null, errorText = '';
  try { json = JSON.parse(r.getContentText()); } catch (e) { errorText = r.getContentText().slice(0, 300); }
  if (code !== 200 && json && json.error) errorText = json.error.message || JSON.stringify(json.error);
  return { code: code, json: json, errorText: errorText };
}

/* ---------- 每日計數器（指令碼屬性 COUNT_yyyy-MM-dd） ---------- */
function dailyLimit_() { const v = prop_('DAILY_LIMIT'); return v === null || v === '' ? DEFAULT_DAILY_LIMIT : Number(v); }
function todayKey_() { return 'COUNT_' + Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }
function usage_() {
  const limit = dailyLimit_(), used = Number(prop_(todayKey_()) || 0);
  return { used: used, limit: limit, remaining: limit > 0 ? Math.max(0, limit - used) : null };
}
/* 取用一次額度；以鎖避免同時多筆請求造成計數錯誤 */
function takeQuota_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const props = PropertiesService.getScriptProperties(), key = todayKey_(), limit = dailyLimit_();
    const used = Number(props.getProperty(key) || 0);
    if (limit > 0 && used >= limit) return { ok: false, used: used, limit: limit };
    props.setProperty(key, String(used + 1));
    // 清除 7 天前的計數
    const keep = {}; for (let i = 0; i < 7; i++) keep['COUNT_' + Utilities.formatDate(new Date(Date.now() - i * 86400000), TZ, 'yyyy-MM-dd')] = 1;
    props.getKeys().forEach(function (k) { if (/^COUNT_/.test(k) && !keep[k]) props.deleteProperty(k); });
    return { ok: true, used: used + 1, limit: limit };
  } finally { lock.releaseLock(); }
}

/** 在 Apps Script 編輯器手動執行：查看今日使用次數 */
function showUsage() { Logger.log(JSON.stringify(usage_())); }

function prop_(k) { return PropertiesService.getScriptProperties().getProperty(k); }
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/** 在 Apps Script 編輯器手動執行，可確認 API Key 與模型是否可用 */
function testApiKey() {
  const res = callApi_(prop_('GEMINI_API_KEY'), prop_('MODEL') || DEFAULT_MODEL, { contents: [{ role: 'user', parts: [{ text: '只回覆 OK' }] }] });
  Logger.log(res.code + ' ' + (res.json && res.json.candidates ? JSON.stringify(res.json.candidates[0].content) : res.errorText));
}
