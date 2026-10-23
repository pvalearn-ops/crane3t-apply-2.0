/* ============================================================
   申請案主控台 UI
   ============================================================ */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const N = Calc.num;
const fmt = (v, d = 2) => (typeof v === 'number' && isFinite(v)) ? v.toFixed(d) : '—';
const app = $('#app');

let cur = null;        // 目前申請案
let curFiles = [];     // 目前申請案的檔案
let saveTimer = null;

/* ---------------- 上傳欄位定義 ---------------- */
const SLOTS = {
  bizReg:         { label: '營利事業登記證', desc: '或公司／商業登記資料（供 AI 擷取公司名稱、統編、地址）', ai: true },
  ownerCert:      { label: '車主聯', desc: '車籍資料：車號、總重、空重、軸距、輪距、長寬高', ai: true, req: true },
  license:        { label: '行照', desc: '申請文件附件用（不需 AI 解析）', req: true },
  origChart:      { label: '原廠荷重性能表', desc: '機身貼紙、說明書或型錄頁面；外伸撐座最大張出之表', ai: true, multi: true },
  sitePhoto:      { label: '機具現場照片', desc: '可上傳多張（正面、側面、伸臂全伸、銘牌等），產出 PDF 時依序附上', multi: true, image: true, req: true },
  hookPhoto:      { label: '吊鉤照片', desc: '需可辨識吊鉤刻印荷重', req: true },
  materialCert:   { label: '鋼索材質證明', desc: '載明標準破斷荷重之鋼索材質證明書（可上傳多個檔案）；勾選「無鋼索材質證明」者免附', multi: true },
  setupProof:     { label: '設置時間證明', desc: '進口報單、購買發票、其他購買證明或切結書（可上傳多個檔案）', multi: true, req: true },
  platformReport: { label: '搭乘設備簽證報告', desc: '搭乘設備之簽證報告（可上傳多個檔案）', multi: true, req: true },
  other:          { label: '其他附件', desc: '其他輔助資料', multi: true }
};
const S6_SLOTS = ['sitePhoto', 'hookPhoto', 'license', 'materialCert', 'setupProof', 'platformReport', 'other'];

/* ---------------- 文件需求一覽（主文件第六節） ---------------- */
const ITEMS = [
  { no: 1, id: 'apply', name: '檢查申請書', page: 'doc-apply' },
  { no: 2, id: 'spec', name: '明細表', page: 'doc-spec' },
  { no: 3, id: 'drawing', name: '組配圖或相當圖件（工程圖標註尺寸及照片）', page: 'doc-drawing' },
  { no: 4, id: 'site', name: '設置場所平面圖及基礎概要', free: true },
  { no: 5, id: 'fix', name: '設置固定方式', free: true },
  { no: 6, id: 'calc', name: '強度計算書或相當證明文件', page: 'doc-boom' },
  { no: 7, id: 'material', name: '結構材料材質證明書或相當證明文件', page: 'doc-setup' },
  { no: 8, id: 'setup', name: '設置時間相關證明文件', page: 'doc-setup' },
  { no: 9, id: 'selfcheck', name: '自行檢查紀錄', page: 'doc-selfcheck' },
  { no: 10, id: 'grade', name: '吊升裝置等之等級及作業係數確認', free: true },
  { no: 11, id: 'fee', name: '檢查規費', page: 'step5' }
];

const SUBPAGES = {
  'doc-boom':      { title: '6. 伸臂強度計算書', src: '伸臂強度/伸臂強度計算書.html', q: '&view=doc', tip: '本計算書依 S3 輸入產生（A4 列印版）；修改數值請回 S3 伸臂強度計算。' },
  'doc-apply':     { title: '1. 檢查申請書', src: '申請書/index.html', tip: '填完按頁面下方按鈕產生 Word 檔。' },
  'doc-spec':      { title: '2. 明細表', src: '明細表/移動式起重機明細表.html', tip: '請核對各欄位，未帶入的規格可直接在表上補填。' },
  'doc-rope':      { title: '6. 鋼索及吊鉤強度計算書', src: '鋼索吊鉤計算/鋼索吊鉤計算.html', tip: '鋼索、吊鉤尺寸取自 S5，吊升荷重取自 S4；請確認判定結果為「合格」。' },
  'doc-stab':      { title: '6. 安定度計算書', src: '安定度/安定度計算.html', tip: '本頁數據由 S4 計算產生，請確認後列印。修改量測值請回 S2 後重新套用，避免兩邊不一致。' },
  'doc-chart':     { title: '6. 荷重表（新）', src: '荷重表/index.html', tip: '本表由 S4 反算結果帶入（吊升荷重，含吊具）；每一格皆同時符合伸臂強度與安定度。' },
  'doc-selfcheck': { title: '9. 自行檢查紀錄', src: '自行檢查紀錄表/移動式起重機自行檢查紀錄.html', tip: '表頭與規格已帶入；請依實際檢查結果點選「結果」欄（按一下 V，再按一下 /）。' }
};
const STEP_PAGES = ['step1', 'step2', 'step3', 'step4', 'step5', 'step6'];
const SUB_VER = '20261023o';   // 子頁面版本（更新子頁面後調整，避免瀏覽器使用舊快取）

/* ---------------- 路徑工具 ---------------- */
const getP = (o, p) => p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
function setP(o, p, v) { const ks = p.split('.'); let a = o; ks.slice(0, -1).forEach(k => { if (a[k] == null) a[k] = {}; a = a[k]; }); a[ks[ks.length - 1]] = v; }

function touch() {
  if (!cur) return;
  if (cur.appliedAt && STEP_PAGES.includes(parseHash().page)) cur.needReapply = true;
  $('#saveState').textContent = '儲存中…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 250);
}
function flush() {
  clearTimeout(saveTimer); saveTimer = null;
  if (!cur) return;
  if (Store.save(cur)) $('#saveState').textContent = '✔ 已自動儲存 ' + new Date().toLocaleTimeString('zh-TW', { hour12: false });
}
window.addEventListener('beforeunload', () => { if (saveTimer) flush(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && saveTimer) flush(); });
window.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'case-saved' && cur && e.data.caseId === cur.id) {
    $('#saveState').textContent = '✔ 子頁面已自動儲存 ' + new Date().toLocaleTimeString('zh-TW', { hour12: false });
    if (String(e.data.key).startsWith('file:')) refreshFiles().then(renderNav);
    else renderNav();
    if (e.data.key === 'boomStrength_result') { const b = $('#boomStat'); if (b) b.innerHTML = boomStatHtml(); }
    if (e.data.key === 'boomStrength_limits' && cur.hasChart === false) computeResult();   // 強度上限更新 → 重算 S4 → 回寫 S3 荷重點
    if (e.data.key === 'boomStrength_limits' && cur.appliedAt && !cur.needReapply) { cur.needReapply = true; flush(); renderNav(); }
  }
});

/* 欄位 HTML */
function F(path, label, o = {}) {
  const v = getP(cur, path); const val = v == null ? '' : v;
  const ai = (cur.aiFilled || []).includes(path) ? ' ai-filled' : '';
  const miss = o.req && (val === '' || val == null) ? ' missing' : '';
  const pre = o.preset !== undefined && val !== '' && String(val) === String(o.preset);   // 仍為系統預帶值
  const cls = `${ai}${miss}${pre && !ai ? ' est-val' : ''}`.trim();
  const input = o.type === 'select'
    ? `<select data-k="${path}" class="${cls}">${o.options.map(x => `<option value="${esc(x[0])}" ${String(val) === String(x[0]) ? 'selected' : ''}>${esc(x[1])}</option>`).join('')}</select>`
    : o.type === 'textarea' ? `<textarea data-k="${path}" rows="${o.rows || 3}" class="${cls}" placeholder="${esc(o.ph || '')}">${esc(val)}</textarea>`
    : `<input data-k="${path}" type="${o.type === 'date' || o.type === 'month' ? o.type : 'text'}" ${o.num ? 'inputmode="decimal"' : ''} value="${esc(val)}" placeholder="${esc(o.ph || '')}" class="${cls}">`;
  return `<label class="field"><span>${esc(label)}${o.req ? ' <b class="req">*</b>' : ''}${pre ? ' <span class="tag est">預帶</span>' : ''}</span>${o.unit ? `<div class="unit-in">${input}<em>${esc(o.unit)}</em></div>` : input}${o.hint ? `<small>${o.hint}</small>` : ''}</label>`;
}
function bind(root, onChange) {
  $$('[data-k]', root).forEach(el => {
    const ev = el.tagName === 'SELECT' || el.type === 'checkbox' || el.type === 'radio' ? 'change' : 'input';
    el.addEventListener(ev, () => {
      const p = el.dataset.k;
      const v = el.type === 'checkbox' ? el.checked : el.value;
      setP(cur, p, v);
      if (cur.aiFilled) cur.aiFilled = cur.aiFilled.filter(x => x !== p);
      el.classList.remove('ai-filled'); el.classList.remove('est-val');
      if (el.classList.contains('missing') && v !== '') el.classList.remove('missing');
      touch();
      onChange && onChange(p, v);
    });
  });
}

/* ---------------- 路由 ---------------- */
function parseHash() { const h = new URLSearchParams(location.hash.slice(1)); return { caseId: h.get('case'), page: h.get('p') || 'overview' }; }
function go(caseId, page) { location.hash = caseId ? 'case=' + encodeURIComponent(caseId) + (page ? '&p=' + page : '') : ''; }
window.addEventListener('hashchange', route);

async function route() {
  if (saveTimer) flush();
  if (!Store.agreed()) { renderList(); openTerms(true); return; }
  const { caseId, page } = parseHash();
  if (!caseId) { cur = null; renderList(); return; }
  if (!cur || cur.id !== caseId) {
    cur = Store.get(caseId);
    if (!cur) { alert('找不到此申請案，可能已被刪除。'); go(); return; }
    migrateHookMm(cur);
    syncStagesFromChart(cur);
    await refreshFiles();
    await migratePhotos(cur);
  }
  renderCase(page);
}
/* 舊版案件之吊鉤尺寸為 cm：一次換算為 mm */
function migrateHookMm(c) {
  if (c.docs.hook_unit === 'mm') return;
  ['hook_d', 'hook_B1', 'hook_b1', 'hook_h1', 'hook_B2', 'hook_b2', 'hook_h2'].forEach(k => { const v = N(c.docs[k]); if (v > 0) c.docs[k] = String(Math.round(v * 100) / 10); });
  c.docs.hook_unit = 'mm'; Store.save(c);
}
/* 舊版案件之正面／側面／伸臂全伸照（photo1～3）移入「機具現場照片」 */
async function migratePhotos(c) {
  const old = curFiles.filter(f => /^photo[123]$/.test(f.slot));
  if (!old.length) return;
  for (const f of old) { await Store.filePut(c.id, 'sitePhoto#' + f.slot, f.name, f.type, f.dataUrl); await Store.fileDel(c.id, f.slot); }
  await refreshFiles();
}
/* 工程圖預覽（尺寸套印） */
function renderDrawings(root) {
  const v = Drawings.valuesOf(cur);
  $$('img[data-drawing]', root).forEach(img => Drawings.render(img.dataset.drawing, v[img.dataset.drawing]).then(u => { img.src = u; }).catch(e => { img.alt = e.message; }));
}
async function refreshFiles() { curFiles = cur ? await Store.filesOf(cur.id) : []; }

/* ============================================================
   責任說明 / API Key / 匯出
   ============================================================ */
function openTerms(force) {
  const m = $('#termsModal');
  $('#chkAgree').checked = Store.agreed();
  $('#btnTermsAgree').disabled = !$('#chkAgree').checked;
  $('#btnTermsClose').style.display = force ? 'none' : '';
  m.dataset.force = force ? '1' : '';
  if (!m.open) m.showModal();
}
$('#chkAgree').addEventListener('change', e => { $('#btnTermsAgree').disabled = !e.target.checked; });
$('#btnTermsAgree').addEventListener('click', () => { Store.setAgreed(); $('#termsModal').close(); route(); });
$('#btnTermsClose').addEventListener('click', () => $('#termsModal').close());
$('#termsModal').addEventListener('cancel', e => { if ($('#termsModal').dataset.force) e.preventDefault(); });
$('#btnShowTerms').addEventListener('click', () => openTerms(false));

let exportId = null;
function openExport(id) {
  exportId = id; $('#chkExportRisk').checked = false; $('#btnExportGo').disabled = true; $('#exportModal').showModal();
}
$('#chkExportRisk').addEventListener('change', e => { $('#btnExportGo').disabled = !e.target.checked; });
$('#btnExportCancel').addEventListener('click', () => $('#exportModal').close());
$('#btnExportGo').addEventListener('click', async () => {
  if (saveTimer) flush();
  const data = await Store.exportCase(exportId, $('#chkExportFiles').checked);
  const c = Store.get(exportId);
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `起重機申請案_${(c && (c.company.name || c.name)) || '未命名'}_${new Date().toISOString().slice(0, 10)}.json`;
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  $('#exportModal').close();
});
$('#fileImportCase').addEventListener('change', async (e) => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  if (!confirm('匯入前請確認檔案來源可信。系統不驗證匯入內容之真偽，匯入後請重新核對所有資料。\n確定匯入「' + f.name + '」？')) return;
  try { const c = await Store.importCase(JSON.parse(await f.text())); alert('已匯入為新申請案：' + c.name); renderList(); }
  catch (err) { alert('匯入失敗：' + err.message); }
});

/* ============================================================
   申請案清單
   ============================================================ */
function renderList() {
  const list = Store.list();
  app.innerHTML = `
  <section class="card">
    <div class="hero">
      <div>
        <h2>📁 我的申請案</h2>
        <p class="hint">每台機具建立一個申請案。所有輸入會<b>即時自動儲存</b>在本瀏覽器，關閉網頁後回來可繼續。可複製舊案快速建立相同車型的新案。</p>
      </div>
      <div class="btn-row">
        <button class="btn btn-primary" id="btnNew">➕ 建立申請案</button>
        <button class="btn btn-outline" id="btnImport">📂 匯入備份檔</button>
      </div>
    </div>
    <div class="callout info">
      <b>申請流程：</b>S1 上傳證件與原廠荷重性能表（可 AI 解析）→ S2 基本資料、搭乘設備與機具量測 → S3 伸臂強度計算 → S4 以伸臂強度與安定度檢討荷重性能曲線 →
      S5 申請文件資料 → S6 照片上傳 → 按「套用到申請文件」→ 逐份檢視、微調申請文件並產出 PDF。
    </div>
    ${list.length ? `<div class="case-grid">${list.map(m => {
      const c = Store.get(m.id); const pr = c ? progressOf(c, null) : { pct: 0, done: 0, total: 0 };
      return `<div class="case-card">
        <div class="title">${esc(m.name)}</div>
        <div class="meta">${esc(m.company || '（尚未填公司）')} ‧ ${esc(m.plate || '無車號')}</div>
        <div class="meta">最後更新：${new Date(m.updatedAt).toLocaleString('zh-TW', { hour12: false })}</div>
        <div class="progress"><i style="width:${pr.pct}%"></i></div>
        <div class="meta">文件進度 ${pr.done}/${pr.total}${c && c.result && c.result.ok ? ` ‧ 吊升荷重 <b>${c.result.liftT.toFixed(2)} t</b>` : ''}</div>
        <div class="btn-row">
          <button class="btn btn-primary" data-open="${m.id}">開啟</button>
          <button class="btn btn-outline" data-dup="${m.id}">📄 複製</button>
          <button class="btn btn-outline" data-exp="${m.id}">💾 匯出</button>
          <button class="btn btn-danger-outline" data-del="${m.id}">🗑 刪除</button>
        </div>
      </div>`; }).join('')}</div>`
    : `<div class="empty"><div style="font-size:3rem">🗂️</div><p>尚無申請案，請按「建立申請案」開始。</p></div>`}
  </section>`;
  $('#btnNew').onclick = () => {
    const name = prompt('申請案名稱（例如車號或機具型號）：', '申請案 ' + new Date().toLocaleDateString('zh-TW'));
    if (name === null) return;
    const c = Store.create(name.trim() || undefined); go(c.id, 'step1');
  };
  $('#btnImport').onclick = () => $('#fileImportCase').click();
  $$('[data-open]').forEach(b => b.onclick = () => go(b.dataset.open, 'overview'));
  $$('[data-dup]').forEach(b => b.onclick = async () => {
    const src = Store.get(b.dataset.dup);
    if (!confirm('複製「' + src.name + '」的全部資料（含照片）為新申請案？\n複製後請務必修改車號、車籍等該車專屬資料。')) return;
    await Store.duplicate(b.dataset.dup); renderList();
  });
  $$('[data-exp]').forEach(b => b.onclick = () => openExport(b.dataset.exp));
  $$('[data-del]').forEach(b => b.onclick = async () => {
    const c = Store.get(b.dataset.del);
    if (!confirm('確定永久刪除「' + c.name + '」？此動作無法復原，建議先匯出備份。')) return;
    await Store.remove(b.dataset.del); renderList();
  });
}

/* ============================================================
   狀態計算
   ============================================================ */
const hasFile = (slot, files) => (files || curFiles).some(f => f.slot === slot || f.slot.startsWith(slot + '#'));
const countFile = (slot, files) => (files || curFiles).filter(f => f.slot === slot || f.slot.startsWith(slot + '#')).length;

function itemParts(c, it, files) {
  const sub = (k) => Store.subGet(c.id, k);
  const r = c.result && c.result.ok ? c.result : null;
  const capKg = r ? r.maxVal : NaN;
  const fileOk = (s) => files ? hasFile(s, files) : null;
  const rh = () => sub('crane3t_rope_hook_result');
  switch (it.id) {
    case 'apply': { const d = sub('apply_form_draft'); return [{ label: '申請書已填寫（事業單位、吊升荷重）', ok: !!(d && d.values && d.values.company && d.values.load) }]; }
    case 'spec': { const d = sub('crane_form_draft'); return [{ label: '明細表基本資料', ok: !!(d && d.company_name) }, { label: '荷重性能／吊升荷重已帶入', ok: !!(d && d.lifting_capacity) }]; }
    case 'drawing': {
      const dv = Drawings.valuesOf(c);
      return [
        { label: '正面工程圖（外伸撐座全伸寬度標註）', ok: isFinite(dv.front) },
        { label: '側面工程圖（前輪中心至旋轉中心距離標註）', ok: isFinite(dv.side) },
        { label: '機具現場照片', ok: fileOk('sitePhoto') },
        { label: '吊鉤照片', ok: fileOk('hookPhoto') },
        { label: '車主聯', ok: fileOk('ownerCert') },
        { label: '行照', ok: fileOk('license') }
      ];
    }
    case 'calc': return [
      { label: '伸臂強度計算書（超過容許應力之荷重點已於荷重表下調）', ok: boomOk(c) },
      { label: '鋼索強度計算（安全係數合格）', ok: !!(rh() && rh().wireOk) },
      { label: '吊鉤強度計算（安全係數合格）', ok: !!(rh() && rh().hookOk) },
      { label: '鋼索吊鉤計算書之額定荷重與 S4 荷重表一致', ok: ropeHookSynced(c) },
      { label: '安定度計算（荷重表反算）', ok: !!r && Object.values(r.checks).every(x => x.ok) && Object.keys(r.checks).length === 3 },
      { label: '荷重表已套用至各文件', ok: !!(r && c.appliedAt && !c.needReapply) }
    ];
    case 'material': return [c.docs.rope_nocert
      ? { label: '無鋼索材質證明：破斷荷重採最低強度 d²/20（公噸）', ok: N(c.docs.rope_d) > 0 }
      : { label: '鋼索標準破斷荷重（依鋼索材質證明）', ok: ropeStdKg(c.docs) > 0 }]
      .concat(c.docs.rope_nocert ? [] : [{ label: '鋼索材質證明（上傳）', ok: fileOk('materialCert') }]);
    case 'setup': return [{ label: '進口報單／購買發票／購買證明或切結書', ok: fileOk('setupProof') }, { label: '搭乘設備簽證報告', ok: fileOk('platformReport') }];
    case 'selfcheck': { const st = sub('crane_self_inspection_status'); return [{ label: `自行檢查紀錄已逐項點選檢查結果（${st ? st.filled + '/' + st.total : '尚未開啟'}）`, ok: !!(st && st.total > 0 && st.filled >= st.total) }]; }
    case 'fee': return [{ label: '檢查費金額（郵局匯票／即期支票郵寄至代檢機構）', ok: N(c.fee && c.fee.amount) > 0 }];
  }
  return [];
}
function itemState(c, it, files) {
  if (it.free) return { st: 'free', parts: [] };
  const parts = itemParts(c, it, files);
  if (c.manual && c.manual[it.id]) return { st: 'done', parts, manual: true };
  const known = parts.filter(p => p.ok !== null);
  const okN = known.filter(p => p.ok).length;
  return { st: known.length && okN === parts.length ? 'done' : okN ? 'part' : 'todo', parts };
}
function progressOf(c, files) {
  const its = ITEMS.filter(i => !i.free);
  const done = its.filter(i => itemState(c, i, files).st === 'done').length;
  return { done, total: its.length, pct: Math.round(done / its.length * 100) };
}
const PILL = { done: '<span class="pill done">完成</span>', part: '<span class="pill part">進行中</span>', todo: '<span class="pill todo">未完成</span>', free: '<span class="pill free">免附</span>' };

/* ============================================================
   申請案工作區
   ============================================================ */
const S5_REQ = { 'docs.rope_d': '鋼索直徑', 'docs.rope_n': '鋼索掛數', 'docs.hook_d': '吊鉤開口直徑 d',
  'docs.hook_B1': '吊鉤 B1', 'docs.hook_b1': '吊鉤 b1', 'docs.hook_h1': '吊鉤 h1', 'docs.hook_B2': '吊鉤 B2', 'docs.hook_b2': '吊鉤 b2', 'docs.hook_h2': '吊鉤 h2' };
/* S2 尚缺項目（S3 伸臂強度屬下一步，不列入） */
function s2Missing(c) {
  const m = [];
  if (!c.company.name) m.push('S2-1 事業單位名稱');
  if (!c.site.county) m.push('S2-1 設置地址或受檢地點（縣市）');
  if (!c.vehicle.plate) m.push('S2-2 車牌號碼');
  [['front_track_cm', '前輪距'], ['rear_track_cm', '後輪距'], ['height_cm', '車高']].forEach(([k, l]) => { if (!(N(c.vehicle[k]) > 0)) m.push('S2-2 ' + l); });
  if (c.hasChart !== true && c.hasChart !== false) m.push('S1 機型或荷重性能表來源');
  else (Calc.compute(c).miss || []).filter(x => !/^S3/.test(x)).forEach(x => m.push(x));
  return Array.from(new Set(m));
}
function refreshS2Miss(pane) {
  const mb = $('#s2Miss', pane); if (!mb) return; const ms = s2Missing(cur);
  mb.className = 'callout ' + (ms.length ? 'warn' : 'ok'); mb.innerHTML = ms.length ? '<b>S2 尚缺：</b>' + esc(ms.join('、')) : 'S2 必填資料已完成。';
}
function s4Missing(c) {
  const m = Object.entries(S5_REQ).filter(([p]) => { const v = getP(c, p); return v === '' || v == null; }).map(x => x[1]);
  if (!c.docs.rope_nocert && !(N(c.docs.rope_pbreak) > 0)) m.splice(2, 0, '鋼索標準破斷荷重');
  return m;
}
function s5Missing(c, files) {
  const st = (c.boom.stages_m || []).filter(x => N(x) > 0).length;
  const req = (k) => SLOTS[k].req || (k === 'materialCert' && !c.docs.rope_nocert);   // 有填標準破斷荷重者須附材質證明
  return S6_SLOTS.filter(req).filter(k => !hasFile(k, files)).map(k => SLOTS[k].label);
}
/* S4 計算：每次取用都以目前輸入重算，輸入未變則保留原計算時間 */
function computeResult() {
  const r = Calc.compute(cur);
  writeFinalChart(r);
  if (!r.ok) { cur.result = null; return r; }
  const sig = inputSig(cur);
  cur.result = Object.assign({}, r, { sig, computedAt: (cur.result && cur.result.sig === sig) ? cur.result.computedAt : r.computedAt });
  return r;
}
/* S4 最終荷重表（伸臂強度、安定度、原吊升荷重取小值）：無荷重性能表時，S3 伸臂強度計算書之荷重點採用此表 */
function writeFinalChart(r) {
  const v = r && r.ok ? { booms: r.booms, cells: r.cells.map(row => row.map(x => x && x.val > 0 ? [x.val, x.r] : null)) } : null;
  if (JSON.stringify(Store.subGet(cur.id, 'final_chart')) !== JSON.stringify(v)) Store.subSet(cur.id, 'final_chart', v);
}
function stepState(step) {
  if (step === 'step1') { const chosen = cur.hasChart === true || cur.hasChart === false; return chosen && N(cur.crane.orig_capacity_t) > 0 && (cur.hasChart === false || (cur.origChart.booms.length && !chartIssues(cur.origChart).list.length)) ? 'done' : (chosen || curFiles.length ? 'part' : 'todo'); }
  if (step === 'step2') return s2Missing(cur).length === 0 ? 'done' : (cur.company.name || cur.vehicle.plate || cur.platform.weight_kg ? 'part' : 'todo');
  if (step === 'step3') { const b = boomRes(cur); return b && b.has ? (b.valid ? 'done' : 'part') : (Store.subGet(cur.id, 'boomStrengthCalc.v1') ? 'part' : 'todo'); }
  if (step === 'step4') { const r = Calc.compute(cur); return r.ok ? (Object.values(r.checks).every(x => x.ok) ? 'done' : 'part') : 'todo'; }
  if (step === 'step5') { const m = s4Missing(cur).length; return m === 0 ? 'done' : m < Object.keys(S5_REQ).length ? 'part' : 'todo'; }
  if (step === 'step6') { const m = s5Missing(cur, curFiles).length; return m === 0 ? 'done' : S6_SLOTS.some(k => hasFile(k, curFiles)) ? 'part' : 'todo'; }
  if (step === 'rope') { const x = Store.subGet(cur.id, 'crane3t_rope_hook_result'); const ok = x && x.hookOk && x.wireOk && ropeHookSynced(cur); return ok ? 'done' : (x ? 'part' : 'todo'); }
  return null;
}
const readyToApply = () => ['step1', 'step2', 'step3', 'step4', 'step5'].every(k => stepState(k) === 'done');
function navHtml(page) {
  const s = (st) => st ? PILL[st] : '';
  const link = (p, no, label, st) => `<a href="#case=${cur.id}&p=${p}" class="${page === p ? 'active' : ''}"><span class="no">${no}</span><span>${label}</span><span class="st">${s(st)}</span></a>`;
  const its = Object.fromEntries(ITEMS.map(i => [i.id, itemState(cur, i, curFiles).st]));
  const ready = readyToApply();
  const applyBox = `<div class="apply-box">
      <button class="btn btn-primary" id="btnApplyNav" ${ready ? '' : 'disabled'}>${cur.appliedAt ? '🔄 重新套用到申請文件' : '✅ 套用到申請文件'}</button>
      <small>${!ready ? '尚未完成：' + ['step1', 'step2', 'step3', 'step4', 'step5'].filter(k => stepState(k) !== 'done').map(k => 'S' + k.slice(4)).join('、') + '<br>完成 S1～S5 後即可套用' : cur.appliedAt ? (cur.needReapply ? '<b style="color:var(--ng)">S1～S6 資料已變更，請重新套用</b>' : '已套用 ' + new Date(cur.appliedAt).toLocaleString('zh-TW', { hour12: false })) + '<br>再按一次＝以 S1～S6 最新資料重新帶入各文件' : '尚未套用；套用後才會產生申請文件'}</small>
    </div>`;
  return `
    ${link('overview', '📋', '文件清單總覽')}
    <div class="grp">準備步驟</div>
    ${link('step1', 'S1', '上傳證件與荷重性能表', stepState('step1'))}
    ${link('step2', 'S2', '基本資料與機具量測', stepState('step2'))}
    ${link('step3', 'S3', '伸臂強度計算', stepState('step3'))}
    ${link('step4', 'S4', '荷重表反算（強度＋安定度）', stepState('step4'))}
    ${link('step5', 'S5', '申請文件資料', stepState('step5'))}
    ${link('step6', 'S6', '照片與證明文件上傳', stepState('step6'))}
    ${applyBox}
    <div class="grp">申請文件</div>
    ${cur.appliedAt ? `
    ${link('doc-apply', '1', '檢查申請書', its.apply)}
    ${link('doc-spec', '2', '明細表', its.spec)}
    ${link('doc-drawing', '3', '組配圖', its.drawing)}
    ${link('doc-boom', '6', '伸臂強度計算書', stepState('step3'))}
    ${link('doc-rope', '6', '鋼索／吊鉤強度計算書', stepState('rope'))}
    ${link('doc-stab', '6', '安定度計算書')}
    ${link('doc-chart', '6', '荷重表（新）')}
    ${link('doc-setup', '7', '材質證明／設置時間證明', its.setup === 'done' && its.material === 'done' ? 'done' : its.setup === 'todo' && its.material === 'todo' ? 'todo' : 'part')}
    ${link('doc-selfcheck', '9', '自行檢查紀錄', its.selfcheck)}` : '<p class="hint" style="padding:4px 12px">按上方「套用到申請文件」後，申請文件會出現在這裡供檢視與修改。</p>'}`;
}
function renderNav() {
  const n = $('.ws-nav'); if (!n || !cur) return;
  n.innerHTML = navHtml(parseHash().page);
  const b = $('#btnApplyNav', n); if (b) b.onclick = () => applyToDocs();
}

function renderCase(page) {
  app.innerHTML = `
  <div class="ws-head no-print">
    <button class="btn btn-outline" id="btnBack">← 申請案清單</button>
    <input class="case-name" id="caseName" value="${esc(cur.name)}" title="點擊修改申請案名稱">
    <button class="btn btn-primary" id="btnPdfCur">📑 產出完整申請資料 PDF</button>
    <button class="btn btn-outline" id="btnExportCur">💾 匯出備份</button>
  </div>
  <div class="ws">
    <nav class="ws-nav no-print"></nav>
    <section id="pane"></section>
  </div>`;
  $('#btnBack').onclick = () => go();
  $('#caseName').oninput = (e) => { cur.name = e.target.value; touch(); };
  $('#btnExportCur').onclick = () => { flush(); openExport(cur.id); };
  $('#btnPdfCur').onclick = () => { flush(); openPdfModal(); };
  const pane = $('#pane');
  renderNav();
  const R = { overview: pOverview, step1: pStep1, step2: pStep2, step3: pStep3, step4: pStep4, step5: pStep5, step6: pStep6, 'doc-attach': pAttach, 'doc-drawing': (p) => pAttach(p, 'drawing'), 'doc-setup': (p) => pAttach(p, 'setup'), 'doc-photo': (p) => pAttach(p, 'drawing'), uploads: pStep6, fee: pStep5 };
  if (SUBPAGES[page]) pSub(pane, page);
  else (R[page] || pOverview)(pane);
  window.scrollTo(0, 0);
}

/* ---------------- 總覽 ---------------- */
function pOverview(pane) {
  const pr = progressOf(cur, curFiles);
  const r = cur.result && cur.result.ok ? cur.result : null;
  pane.innerHTML = `
  <div class="card">
    <h2>📋 文件需求一覽 <span class="pill ${pr.done === pr.total ? 'done' : 'part'}">${pr.done}/${pr.total} 完成</span></h2>
    <div class="progress" style="margin-bottom:12px"><i style="width:${pr.pct}%"></i></div>
    ${r ? `<div class="callout ok">核定吊升荷重（申請值，含吊具）：<b class="big-num">${r.liftT.toFixed(2)}</b> 公噸　＝ 新荷重表最大值（同時符合伸臂強度與安定度）</div>`
        : `<div class="callout warn">尚未完成荷重表反算。請依序完成「準備步驟」S1 → S6，再按左側「套用到申請文件」。</div>`}
    <table class="doc-table">
      <thead><tr><th>項次</th><th>名稱</th><th>實際檢附項目</th><th>狀態</th><th></th></tr></thead>
      <tbody>${ITEMS.map(it => { const s = itemState(cur, it, curFiles); return `<tr>
        <td class="no">${it.no}</td>
        <td><b>${esc(it.name)}</b></td>
        <td>${it.free ? '<span class="hint">免付</span>' : `<ul>${s.parts.map(p => `<li class="${p.ok === null ? 'na' : p.ok ? 'ok' : 'no'}">${esc(p.label)}</li>`).join('')}</ul>`}
          ${!it.free ? `<label class="hint" style="display:flex;gap:6px;align-items:center;margin-top:4px"><input type="checkbox" data-manual="${it.id}" ${cur.manual[it.id] ? 'checked' : ''}> 已自行確認完成（手動標記）</label>` : ''}</td>
        <td>${PILL[s.st]}</td>
        <td>${it.page ? `<a class="btn btn-outline" style="padding:5px 10px;font-size:.8rem" href="#case=${cur.id}&p=${it.page}">前往 →</a>` : ''}</td>
      </tr>`; }).join('')}</tbody>
    </table>
  </div>`;
  $$('[data-manual]', pane).forEach(el => el.onchange = () => { cur.manual[el.dataset.manual] = el.checked; touch(); pOverview(pane); renderNav(); });
}

/* ---------------- 上傳元件 ---------------- */
function readFileAsDataUrl(file) {
  return new Promise((res, rej) => {
    if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
      if (file.size > 20 * 1024 * 1024) return rej(new Error('PDF 超過 20MB'));
      const fr = new FileReader(); fr.onload = () => res(String(fr.result).replace(/^data:[^;,]*;/, 'data:application/pdf;')); fr.onerror = () => rej(fr.error); fr.readAsDataURL(file); return;
    }
    if (!file.type.startsWith('image/')) return rej(new Error('僅支援圖片或 PDF'));
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 2000; let { width: w, height: h } = img; const s = Math.min(1, max / Math.max(w, h));
      const cv = document.createElement('canvas'); cv.width = Math.round(w * s); cv.height = Math.round(h * s);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url);
      res(cv.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => rej(new Error('無法讀取圖片（HEIC 格式請先轉成 JPG）'));
    img.src = url;
  });
}
function uploadCard(slot) {
  const d = SLOTS[slot]; const fs = curFiles.filter(f => f.slot === slot || f.slot.startsWith(slot + '#'));
  return `<div class="up ${fs.length ? 'has' : ''}" data-slot="${slot}">
    <div class="t">${esc(d.label)}${d.req ? ' <b class="req">*</b>' : ''}</div>
    <div class="d">${esc(d.desc || '')}</div>
    <div class="thumbs">${fs.map(f => `<div class="thumb${d.step ? ' annot' : ''}" data-view="${esc(f.slot)}" title="${d.step ? '點擊開啟標註功能' : esc(f.name)}">${d.step ? '<span class="annot-tag">✏️ 標註</span>' : ''}${f.type === 'application/pdf' ? '📄<br>PDF' : `<img src="${f.dataUrl}">`}<button data-rm="${esc(f.slot)}" title="刪除">✕</button></div>`).join('')}</div>
    <label class="btn btn-outline">📎 ${fs.length && !d.multi ? '更換' : d.image ? '選擇照片／拍照' : '選擇檔案／拍照（圖片或 PDF）'}<input type="file" accept="${d.image ? 'image/*' : 'image/*,application/pdf'}" ${d.multi ? 'multiple' : ''} hidden></label>
  </div>`;
}
function bindUploads(root, after) {
  $$('.up', root).forEach(box => {
    const slot = box.dataset.slot; const d = SLOTS[slot];
    $('input[type=file]', box).onchange = async (e) => {
      const files = Array.from(e.target.files); e.target.value = '';
      for (const f of files) {
        try {
          const data = await readFileAsDataUrl(f);
          const key = d.multi ? slot + '#' + Date.now() + Math.random().toString(36).slice(2, 5) : slot;
          await Store.filePut(cur.id, key, f.name, data.startsWith('data:application/pdf') ? 'application/pdf' : 'image/jpeg', data);
        } catch (err) { alert(f.name + '：' + err.message); }
      }
      await refreshFiles(); touch(); after && after(); renderNav();
    };
    $$('[data-rm]', box).forEach(b => b.onclick = async (e) => {
      e.stopPropagation(); if (!confirm('刪除這個檔案？')) return;
      await Store.fileDel(cur.id, b.dataset.rm); await refreshFiles(); after && after(); renderNav();
    });
    $$('[data-view]', box).forEach(t => t.onclick = () => {
      const f = curFiles.find(x => x.slot === t.dataset.view); if (!f) return;
      if (d.step) openPhotoEditor(d.step, after); else openPreview(f);
    });
  });
}

/* ---------------- S1：上傳證件與原廠荷重性能表 ---------------- */
const uncertainOf = (task) => { const u = cur.aiUncertain; return Array.isArray(u) ? (task === 'docs' ? u : []) : ((u || {})[task] || []); };
function aiBlock(task, hint) {
  const u = uncertainOf(task);
  return `<div class="btn-row">
      <button class="btn btn-primary" data-ai="${task}">🤖 AI 自動解析</button>
      <span class="hint" data-ai-status="${task}">${esc(hint || '')}</span>
    </div>
    ${u.length ? `<div class="callout warn"><b>AI 無法確定的欄位：</b><ul>${u.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}`;
}
function pStep1(pane) {
  const fb = fallbackOf(cur);
  pane.innerHTML = `
  <div class="card">
    <h2>S1-1　上傳證件（選填，供 AI 解析）</h2>
    <div class="callout info">本步驟上傳車主現有的資料：營利事業登記證、車主聯，並選擇起重機型號（決定原廠荷重性能表與伸臂強度資料是否齊全；搭乘設備簽證報告請在 S6 上傳）。<br>
      <b>AI 解析為選用功能</b>：擷取的公司、車籍資料會填入 <b>S2</b>（以<span style="background:#fefce8;border:1px solid #facc15;padding:0 4px">黃底</span>標示，請到 S2 逐項核對）；
      也可以不使用 AI，直接到 S2 人工輸入。<br>
      <span style="color:#b45309">⚠ AI 解析使用 Google Gemini，文件內容會上傳至 Gemini 判讀（詳見「責任說明」）；如有顧慮，請勿使用 AI 解析。</span>行照與其他照片請在 S6 上傳。</div>
    <div class="uploads">${['bizReg', 'ownerCert'].map(uploadCard).join('')}</div>
    ${aiBlock('docs')}
  </div>
  <div class="card" id="chartCard">
    <h2>S1-2　機型與原廠資料完整度</h2>
    <p class="hint">下列為資料庫已收錄的機型，依資料完整度排序。<b>型號必須與機具銘牌完全一致</b>才可選用（尾碼不同，例如 URA506 與 URA506WY，構造略有差異，視為不同機型）。
      選用後，荷重性能表會帶入 <b>S1-3</b>、伸臂強度資料帶入 <b>S3</b>；❌ 的項目需自行量測或輸入。資料庫沒有符合的型號時，請改用列表最下方的方式。</p>
    ${catalogHtml()}
    ${fb === 'ai' ? `<div class="seg-body"><h3 style="margin-top:0">上傳原廠荷重性能表＋AI 判讀</h3><div class="uploads">${uploadCard('origChart')}</div>${aiBlock('chart', '只解析荷重性能表，結果填入 S1-3 荷重性能表與起重機型號')}</div>` : ''}
    ${completenessHtml()}
  </div>
  ${s13Html()}
  <div class="btn-row"><a class="btn btn-primary" href="#case=${cur.id}&p=step2">下一步：S2 基本資料與機具量測 →</a></div>`;
  bind(pane);
  const rerender = () => { const y = window.scrollY; pStep1(pane); window.scrollTo(0, y); };
  bindUploads(pane, rerender);
  if (cur.hasChart) renderChartEditor($('#chartEditor', pane));
  bindS13(pane, rerender);
  $$('[data-pick]', pane).forEach(b => b.onclick = () => { if (pickModel(b.dataset.pick)) { rerender(); renderNav(); } });
  $$('[data-fb]', pane).forEach(b => b.onclick = () => {
    const v = b.dataset.fb;
    cur.hasChart = v !== 'none'; cur.chartSource = v === 'none' ? '' : v; cur.crane.dbModel = '';
    touch(); flush(); rerender(); renderNav();
  });

  const SLOT_OF = { docs: ['bizReg', 'ownerCert'], chart: ['origChart'] };
  $$('[data-ai]', pane).forEach(btn => btn.onclick = async () => {
    const task = btn.dataset.ai;
    const files = curFiles.filter(f => SLOT_OF[task].some(s => f.slot === s || f.slot.startsWith(s + '#')))
      .map(f => ({ label: SLOTS[f.slot.split('#')[0]].label, dataUrl: f.dataUrl, type: f.type }));
    if (!files.length) { alert(task === 'chart' ? '請先上傳荷重性能表。' : '請先上傳營利事業登記證或車主聯。'); return; }
    if (!(await confirmAiUse(files))) return;
    const st = $(`[data-ai-status=${task}]`, pane); btn.disabled = true;
    try {
      const res = await AI.extract(task, files, (m) => st.textContent = m);
      applyAi(task, res); rerender();
      const st2 = $(`[data-ai-status=${task}]`, pane); if (st2) st2.innerHTML = task === 'docs' ? `✔ 解析完成，結果已填入 S2，<a href="#case=${cur.id}&p=step2">前往 S2 核對黃底欄位 →</a>` : '✔ 解析完成，請於下方 S1-3 逐格核對荷重性能表';
    }
    catch (e) { st.textContent = ''; alert('AI 解析失敗：' + (e.message || e) + '\n可改用手動模式或直接填寫。'); }
    finally { btn.disabled = false; }
  });
}

/* S1-3：伸臂各段長度一律由此決定（有荷重表＝表頭各欄；無荷重表＝實測輸入） */
function s13Html() {
  if (cur.hasChart !== true && cur.hasChart !== false) return '';
  if (!cur.hasChart && !cur.boom.stages_m.length) cur.boom.stages_m = ['', ''];
  const stages = cur.boom.stages_m;
  return `<div class="card">
    <h2>S1-3　荷重性能表與伸臂資料</h2>
    ${cur.hasChart ? `<p class="hint">來源：${cur.chartSource === 'ai' ? 'AI 判讀（請務必逐格核對）' : cur.chartSource === 'manual' ? '自行輸入' : '資料庫 ' + esc(cur.crane.dbModel || '')}。
      <b>表頭各欄伸臂長度即為各伸出狀態之伸臂總長</b>（由全縮到全伸），S2～S4 一律以此為準；此表亦為 S4 荷重表反算之上限（原廠值）及 S3 伸臂強度計算之荷重點。</p>
    <div id="chartEditor"></div>`
    : `<p class="hint">沒有荷重性能表：請實測<b>每一個伸出狀態時的伸臂總長</b>（由全縮到全伸，單位 m），例如 5 節伸臂：3.15、5.15、7.05、8.95、10.85。</p>
    <div class="stage-list">${stages.map((v, i) => `<label class="field"><span>${i === 0 ? '全縮（第1節）' : '伸出至第 ' + (i + 1) + ' 節'}</span><div class="unit-in"><input data-st="${i}" value="${esc(v)}" inputmode="decimal" class="${N(v) > 0 ? '' : 'missing'}"><em>m</em></div></label>`).join('')}
      <button class="btn btn-outline" id="stAdd">➕</button><button class="btn btn-danger-outline" id="stDel">➖</button></div>`}
    <div class="fgrid" style="margin-top:12px">
      ${F('crane.orig_capacity_t', '吊升荷重', { unit: '公噸', num: true, req: true, hint: '依銘牌或原廠荷重性能表之最大吊升荷重；新荷重表各值不超過此值，並用於推估伸臂重量' })}
      ${F('boom.numCyl', '油壓缸支數（逐節伸出）', { num: true, ph: String(Math.floor(stages.length / 2)), hint: '依序伸出的節數；同步伸縮者不計。不確定可留空（預設 節數÷2）' })}
      ${cur.hasChart ? '' : F('stab.Wh', '吊具組（吊鉤）重量 Wh', { unit: 'kg', num: true, req: true, hint: '秤重或銘牌；荷重表數值含吊具重量' })}
    </div>
    ${cur.hasChart ? '' : secTableHtml(stages.length)}
  </div>`;
}
/* 無荷重性能表：伸臂臨界斷面（S3 依此反算伸臂強度可承受之荷重表） */
function secDefaults() { return { B: '', H: '', tt: '', ts: '', tb: '', at: 15, ab: 15, fold: false, dtL: 3.5, dtT: 0.3, dbL: 3.5, dbT: 0.3 }; }
const SEC_SHAPES = [['rect', '四角形', '4,3 22,3 22,27 4,27'], ['pent', '五角形（下 V）', '4,3 22,3 22,22 13,28 4,22'], ['hex', '六角形（上下 V）', '13,1 22,5 22,24 13,29 4,24 4,5']];
/* 無荷重性能表：伸臂臨界斷面（版面同伸臂強度計算書 ③；只顯示該形狀用得到的欄位） */
function secTableHtml(n) {
  const bs = cur.boomSec || (cur.boomSec = { shape: 'hex', secs: [] });
  // 舊案件：S3 已輸入之斷面帶回 S1-3
  if (!bs.secs.some(x => x && N(x.B) > 0)) {
    const st = Store.subGet(cur.id, 'boomStrengthCalc.v1');
    if (st && st.src === 'self' && st.booms.some(b => N(b.sec.B) > 0)) { bs.shape = st.shape || 'hex'; bs.secs = st.booms.map(b => Object.assign(secDefaults(), b.sec)); }
  }
  while (bs.secs.length < n) bs.secs.push(secDefaults());
  const L = 'ABCDEFGHIJKLMNOPQRST', sh = bs.shape || 'hex';
  const fld = (i, k, label, unit) => { const v = bs.secs[i][k]; const req = ['B', 'H', 'tt', 'ts', 'tb'].includes(k);
    return `<div class="sf"><label>${label}</label><input data-sec="${i},${k}" inputmode="decimal" value="${esc(v == null ? '' : v)}" class="${req && !(N(v) > 0) ? 'missing' : ''}"><span>${unit}</span></div>`; };
  return `<h3>伸臂臨界斷面（無荷重性能表：S3 依此反算伸臂強度可承受之荷重表）</h3>
    <div class="sec-shapes">${SEC_SHAPES.map(([k, t, pts]) => `<button type="button" class="shape-btn ${sh === k ? 'on' : ''}" data-shape="${k}"><svg width="26" height="30"><polygon points="${pts}" fill="none" stroke="currentColor" stroke-width="2"/></svg>${t}</button>`).join('')}
      <span class="hint">所有斷面共用同一形狀。尺寸單位：cm；B、H 為外緣尺寸。圖面與斷面性質同 S3 伸臂強度計算書。</span></div>
    <div class="sec-cards">${Array.from({ length: n }, (_, i) => { const x = bs.secs[i]; return `<div class="sec-card">
      <div class="draw" id="hsv-${i}"></div>
      <div class="inp"><h4>斷面 ${L[i]}-${L[i]}　<small>伸臂(${i + 1})</small></h4>
        ${fld(i, 'B', '寬 B', 'cm')}${fld(i, 'H', '高 H', 'cm')}
        ${sh === 'hex' ? fld(i, 'at', '上傾角 α上', '°') : ''}${sh !== 'rect' ? fld(i, 'ab', '下傾角 α下', '°') : ''}
        ${fld(i, 'tt', '上板厚 t上', 'cm')}${fld(i, 'ts', '側板厚 t側', 'cm')}${fld(i, 'tb', '下板厚 t下', 'cm')}
        <label class="sf-check"><input type="checkbox" data-sec="${i},fold" ${x.fold ? 'checked' : ''}> 側板內折</label>
        ${x.fold ? fld(i, 'dtL', '上內折 長', 'cm') + fld(i, 'dtT', '上內折 厚', 'cm') + fld(i, 'dbL', '下內折 長', 'cm') + fld(i, 'dbT', '下內折 厚', 'cm') : '<div class="hint">無內折（單純薄殼）</div>'}
        <div id="hsp-${i}"></div></div></div>`; }).join('')}</div>`;
}
/* 斷面圖與斷面性質：與伸臂強度計算書同一套程式（boom-geo.js） */
function renderSecPreview(pane) {
  if (!window.BoomGeo || !cur.boomSec || !$('#hsv-0', pane)) return;
  const n = (cur.boom.stages_m || []).length, sh = cur.boomSec.shape || 'hex';
  const num = (v) => { const x = parseFloat(v); return isFinite(x) ? x : null; };
  const ps = cur.boomSec.secs.slice(0, n).map(x => { const q = {}; ['B', 'H', 'tt', 'ts', 'tb', 'at', 'ab', 'dtL', 'dtT', 'dbL', 'dbT'].forEach(k => q[k] = num(x[k])); q.fold = !!x.fold; return q; });
  const geos = ps.map(q => BoomGeo.secGeom(sh, q)), sc = BoomGeo.drawingScale(geos);
  const fx = (v, d) => isFinite(v) ? Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
  geos.forEach((g, k) => {
    const dv = $('#hsv-' + k, pane), pv = $('#hsp-' + k, pane);
    if (dv) dv.innerHTML = BoomGeo.drawSection(k, g, sc, '', 'hp' + k, ps[k]);
    if (pv) pv.innerHTML = g.err ? '' : `<table class="sec-props">
      <tr><td>斷面積 A</td><td>${fx(g.A, 2)}</td><td>cm²</td></tr>
      <tr><td>e₁ / e₂ / e<sub>y</sub></td><td>${fx(g.e1, 2)} / ${fx(g.e2, 2)} / ${fx(g.ey, 2)}</td><td>cm</td></tr>
      <tr><td>I<sub>x</sub> / I<sub>y</sub></td><td>${fx(g.Ix, 1)} / ${fx(g.Iy, 1)}</td><td>cm⁴</td></tr>
      <tr><td>Z<sub>x1</sub> / Z<sub>x2</sub> / Z<sub>y</sub></td><td>${fx(g.Zx1, 1)} / ${fx(g.Zx2, 1)} / ${fx(g.Zy, 1)}</td><td>cm³</td></tr>
      <tr><td>k<sub>x</sub> / k<sub>y</sub></td><td>${fx(g.kx, 2)} / ${fx(g.ky, 2)}</td><td>cm</td></tr></table>`;
  });
}
/* 各節伸臂單位長重量 w（kg/cm）= 斷面積 A × 7.85×10⁻³（同伸臂強度計算書）
   斷面來源：無荷重表取 S1-3 斷面；有荷重表取 S3 自行輸入之斷面。任一節缺斷面即回傳 null（改用經驗式） */
function secUnitW(c) {
  if (!window.BoomGeo) return null;
  const n = (c.boom.stages_m || []).map(N).filter(x => x > 0).length;
  let shape, secs;
  const st = Store.subGet(c.id, 'boomStrengthCalc.v1');
  if (c.hasChart === false && c.boomSec && c.boomSec.secs.some(x => x && N(x.B) > 0)) { shape = c.boomSec.shape; secs = c.boomSec.secs; }
  else if (st && st.src === 'self' && (st.booms || []).some(b => b.sec && N(b.sec.B) > 0)) { shape = st.shape; secs = st.booms.map(b => b.sec || {}); }
  else return null;
  if (!n || secs.length < n) return null;
  const num = (v) => { const x = parseFloat(v); return isFinite(x) ? x : null; };
  const w = secs.slice(0, n).map(x => { const q = {}; ['B', 'H', 'tt', 'ts', 'tb', 'at', 'ab', 'dtL', 'dtT', 'dbL', 'dbT'].forEach(k => q[k] = num(x[k])); q.fold = !!x.fold;
    const g = BoomGeo.secGeom(shape || 'hex', q); return g && !g.err && g.A > 0 ? g.A * 7.85e-3 : NaN; });
  return w.every(x => x > 0) ? w : null;
}
Calc.setUnitW(secUnitW);
let secPrevT = null;
function bindS13(pane, rerender) {
  $$('input[data-sec]', pane).forEach(el => {
    const [i, k] = el.dataset.sec.split(','); const x = cur.boomSec.secs[+i];
    if (el.type === 'checkbox') el.onchange = () => { x.fold = el.checked; touch(); rerender(); };
    else el.oninput = () => { x[k] = el.value; if (['B', 'H', 'tt', 'ts', 'tb'].includes(k)) el.classList.toggle('missing', !(N(el.value) > 0)); touch(); clearTimeout(secPrevT); secPrevT = setTimeout(() => renderSecPreview(pane), 200); };
  });
  renderSecPreview(pane);
  $$('[data-shape]', pane).forEach(b => b.onclick = () => { cur.boomSec.shape = b.dataset.shape; touch(); flush(); rerender(); });
  $$('input[data-st]', pane).forEach(el => {
    el.oninput = () => { cur.boom.stages_m[+el.dataset.st] = el.value; el.classList.toggle('missing', !(N(el.value) > 0)); touch(); };
    el.onchange = () => renderNav();
  });
  const add = $('#stAdd', pane), del = $('#stDel', pane);
  if (add) add.onclick = () => { cur.boom.stages_m.push(''); touch(); rerender(); };
  if (del) del.onclick = () => { if (cur.boom.stages_m.length > 1) cur.boom.stages_m.pop(); touch(); rerender(); };
}
/* 有荷重表時：伸臂各段長度＝荷重表表頭 */
function syncStagesFromChart(c) {
  if (c.hasChart && c.origChart && (c.origChart.booms || []).length) c.boom.stages_m = c.origChart.booms.map(String);
}

/* ---------------- S2 上方：事業單位、車籍、起重機（AI 解析結果填在這裡） ---------------- */
function basicCardsHtml() {
  migrateCompanyAddr(cur);
  return `
  <div class="card">
    <h2>S2-1　事業單位資料</h2>
    <div class="fgrid">
      ${F('company.name', '事業單位名稱', { req: true })}${F('company.tax_id', '統一編號')}${F('company.owner', '負責人')}
      ${F('company.industry', '行業別')}${F('company.tel', '事業單位電話')}
      ${F('company.contact', '承辦人')}${F('company.mobile', '承辦人手機')}
    </div>
    <div class="field" style="margin-top:12px">
      <span>事業單位地址</span>
      ${addrRowHtml('company')}
    </div>
    <div class="field" style="margin-top:12px">
      <span>設置地址或受檢地點 <b class="req">*</b>（帶入申請書、明細表，並決定代行檢查機構）
        <button type="button" class="btn btn-outline btn-xs" id="btnSiteFromCompany">📋 同事業單位地址</button></span>
      ${addrRowHtml('site')}
      <small id="siteAgency">${siteAgencyText(cur)}</small>
    </div>
  </div>
  <div class="card">
    <h2>S2-2　車籍資料（車主聯）</h2>
    <div class="fgrid">
      ${F('vehicle.plate', '車牌號碼', { req: true })}${F('vehicle.make', '廠牌', { hint: '帶入明細表「台車」' })}${F('vehicle.model', '型式', { hint: '帶入明細表「台車」' })}${F('vehicle.engine_no', '引擎號碼')}
      ${F('vehicle.gross_weight_kg', '總重量', { unit: 'kg', num: true })}${F('vehicle.empty_weight_kg', '空重（含起重機）', { unit: 'kg', num: true, req: true, hint: '作為安定度計算之起重機總重量 Wb' })}
      ${F('vehicle.length_cm', '車長', { unit: 'cm', num: true })}${F('vehicle.width_cm', '車寬', { unit: 'cm', num: true })}
      ${F('vehicle.height_cm', '車高', { unit: 'cm', num: true, req: true, hint: '用於推估各重心高度' })}${F('vehicle.wheelbase_cm', '軸距', { unit: 'cm', num: true, req: true })}
      ${F('vehicle.front_track_cm', '前輪距', { unit: 'cm', num: true, req: true })}${F('vehicle.rear_track_cm', '後輪距', { unit: 'cm', num: true, req: true })}
    </div>
  </div>
  <div class="card">
    <h2>S2-3　起重機資料</h2>
    <div class="fgrid">
      ${F('crane.type', '種類及型式', { ph: '積載型起重機' })}${F('crane.maker', '起重機製造商')}${F('crane.model', '起重機型號')}${F('crane.serial', '製造序號')}
      ${F('crane.mfg_year', '製造年月', { type: 'month', hint: '只需年、月（帶入明細表製造年月）' })}
      <p class="hint" style="grid-column:1/-1;margin:0">吊升荷重、油壓缸支數請填在 S1-3。</p>
    </div>
  </div>`;
}
/* 地址：縣市／鄉鎮市區選單＋郵遞區號＋門牌（事業單位地址、受檢地點共用） */
const ADDR_KEYS = { company: { o: () => cur.company, county: 'addr_county', district: 'addr_district', detail: 'addr_detail' },
                    site:    { o: () => cur.site,    county: 'county',      district: 'district',      detail: 'detail' } };
function zipOf(county, district) { const d = (TW_ZIP.data[county] || []).find(x => x.name === district); return d ? d.zip : ''; }
function composeAddr(county, district, detail) { return county ? zipOf(county, district) + county + (district || '') + (detail || '') : (detail || ''); }
function districtOptions(county, sel) { return '<option value="">-- 鄉鎮市區 --</option>' + (TW_ZIP.data[county] || []).map(d => `<option value="${d.name}" ${sel === d.name ? 'selected' : ''}>${d.name}（${d.zip}）</option>`).join(''); }
/* 由完整地址字串拆出縣市、鄉鎮市區、門牌（AI 解析結果、舊資料用） */
function parseTwAddr(addr) {
  const a = String(addr || '').trim().replace(/^\d{3,6}\s*/, '').replace(/台/g, '臺');
  const county = TW_ZIP.countyFromAddress(a) || '';
  if (!county) return { county: '', district: '', detail: String(addr || '').trim() };
  const rest = a.slice(county.length);
  const d = (TW_ZIP.data[county] || []).find(x => rest.startsWith(x.name));
  return { county, district: d ? d.name : '', detail: d ? rest.slice(d.name.length) : rest };
}
function setCompanyAddr(c, addr) {
  const p = parseTwAddr(addr);
  c.company.addr_county = p.county; c.company.addr_district = p.district; c.company.addr_detail = p.detail;
  c.company.address = composeAddr(p.county, p.district, p.detail);
}
function migrateCompanyAddr(c) { if (c.company.address && !c.company.addr_county && !c.company.addr_detail) setCompanyAddr(c, c.company.address); }
function addrRowHtml(which) {
  const K = ADDR_KEYS[which], o = K.o(), county = o[K.county] || '', district = o[K.district] || '';
  const ai = which === 'company' && (cur.aiFilled || []).includes('company.address') ? 'ai-filled' : '';
  return `<div class="addr-row" data-addr="${which}">
        <select data-part="county"><option value="">-- 縣市 --</option>${TW_ZIP.counties.map(x => `<option ${county === x ? 'selected' : ''}>${x}</option>`).join('')}</select>
        <select data-part="district">${districtOptions(county, district)}</select>
        <input class="zip" readonly value="${esc(zipOf(county, district))}" placeholder="郵遞區號">
        <input data-part="detail" class="${ai}" value="${esc(o[K.detail] || '')}" placeholder="路段、巷弄、門牌號碼">
      </div>`;
}
function bindBasicCards(pane, rerender) {
  $$('[data-addr]', pane).forEach(row => {
    const which = row.dataset.addr, K = ADDR_KEYS[which];
    $$('[data-part]', row).forEach(el => el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => {
      const o = K.o(), part = el.dataset.part;
      o[K[part]] = el.value;
      if (part === 'county') { o[K.district] = ''; $('[data-part=district]', row).innerHTML = districtOptions(o[K.county], ''); }
      $('.zip', row).value = zipOf(o[K.county], o[K.district]);
      if (which === 'company') {
        cur.company.address = composeAddr(o[K.county], o[K.district], o[K.detail]);
        cur.aiFilled = (cur.aiFilled || []).filter(p => p !== 'company.address'); $('[data-part=detail]', row).classList.remove('ai-filled');
      } else $('#siteAgency', pane).innerHTML = siteAgencyText(cur);
      touch(); renderNav(); refreshS2Miss(pane);
    }));
  });
  const cp = $('#btnSiteFromCompany', pane);
  if (cp) cp.onclick = () => {
    const c = cur.company;
    if (!c.addr_county && !c.addr_detail) return alert('請先填寫事業單位地址。');
    if ((cur.site.county || cur.site.detail) && !confirm('以事業單位地址取代目前的設置地址／受檢地點？')) return;
    Object.assign(cur.site, { county: c.addr_county || '', district: c.addr_district || '', detail: c.addr_detail || '' });
    touch(); rerender(); renderNav();
  };
  // 空重、車高、軸距、輪距影響下方 S2-6 的帶入／推估值：離開欄位時重繪，並保留游標位置
  const AFFECT = ['vehicle.empty_weight_kg', 'vehicle.height_cm', 'vehicle.wheelbase_cm', 'vehicle.front_track_cm', 'vehicle.rear_track_cm'];
  AFFECT.forEach(k => { const el = $(`[data-k="${k}"]`, pane); if (el) el.addEventListener('change', () => {
    flush();
    setTimeout(() => {
      const a = document.activeElement, nextK = a && a.dataset ? a.dataset.k : null;
      rerender(); renderNav();
      const n = nextK && $(`[data-k="${nextK}"]`, pane); if (n) n.focus();
    }, 0);
  }); });
}

/* 每次 AI 解析前提醒：資料會上傳至 Google Gemini，需使用者再次確認 */
function confirmAiUse(files) {
  return new Promise(res => {
    const m = $('#aiConfirmModal'), chk = $('#chkAiConfirm'), go = $('#btnAiConfirmGo');
    $('#aiConfirmFiles').innerHTML = files.map(f => `<li>${esc(f.label)}</li>`).join('');
    chk.checked = false; go.disabled = true;
    chk.onchange = () => { go.disabled = !chk.checked; };
    // 直接由按鈕回傳結果（不依賴 close 事件，避免背景分頁延後觸發）
    let done = false;
    const finish = (v) => { if (done) return; done = true; if (m.open) m.close(); res(v); };
    go.onclick = () => finish(true);
    $('#btnAiConfirmCancel').onclick = () => finish(false);
    m.oncancel = (e) => { e.preventDefault(); finish(false); };   // Esc 鍵＝取消
    m.onclose = () => finish(false);
    m.showModal();
  });
}

/* ---------------- 機型清單：荷重性能表資料庫＋伸臂強度計算書資料庫（展開顯示完整度） ---------------- */
const normModel = (x) => String(x || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const BOOM_MACHINES = () => (window.BoomLib && window.BoomLib.MACHINES) || {};
/* 伸臂強度資料：型號（或資料庫型號）須與伸臂強度計算書資料庫完全一致 */
function boomDbOf(c) { const M = BOOM_MACHINES(); for (const k of [c.crane.dbModel, c.crane.model].map(normModel)) if (k && M[k]) return k; return null; }
const boomLabel = (id) => { const M = BOOM_MACHINES()[id]; return M ? `${M.brand} ${M.model}（原廠計算書 ${M.doc}）` : id; };
const HAS_LABEL = { chart: '荷重性能表', boom: '伸臂強度資料', wt: '伸臂與油壓缸重量', lw: '撐座全伸寬度', hook: '吊鉤重量', angle: '最大起伏角', cap: '吊升荷重' };
const HAS_NEED = { chart: 'S1-3 荷重性能表（上傳＋AI 判讀或自行輸入）', boom: 'S3 伸臂斷面尺寸、板厚、各部重量與位置（依原廠伸臂強度計算書或實測）',
  wt: 'S2-5 伸臂各節與伸縮油壓缸重量（原廠資料；未填時以經驗公式推估）',
  lw: 'S2-6 外伸撐座全伸寬度 Lw（實測）', hook: 'S1-3／S2-6 吊具組（吊鉤）重量 Wh（秤重或銘牌）', angle: 'S2-6 伸臂最大起伏角 θm（型錄）', cap: 'S1-3 吊升荷重（銘牌）' };
/* 由伸臂強度計算書之荷重點建立荷重性能表：每格取該半徑以外最近荷重點之值（保守），不在列上的點註記實際半徑 */
function chartFromBoom(d) {
  const st = d.stages.filter(x => x.len > 0).slice().sort((a, b) => a.len - b.len);
  const all = st.flatMap(x => x.rows.map(r => r[1])).filter(x => x > 0);
  const lo = Math.max(0.5, Math.floor(Math.min(...all) * 2) / 2), hi = Math.round(Math.max(...all));
  const radii = [];
  for (let r = lo; r < 4 - 1e-9; r += 0.5) radii.push(+r.toFixed(2));
  for (let r = Math.max(4, Math.ceil(lo)); r <= hi + 1e-9; r += 1) radii.push(r);
  const nearest = (R) => { let bi = 0; radii.forEach((r, i) => { if (Math.abs(r - R) < Math.abs(radii[bi] - R) - 1e-9) bi = i; }); return bi; };
  const cols = st.map(x => {
    const pts = x.rows.filter(r => r[0] > 0 && r[1] > 0).map(r => ({ W: r[0], R: r[1] })).sort((a, b) => a.R - b.R);
    const iMin = nearest(pts[0].R), iMax = nearest(pts[pts.length - 1].R), asg = {};
    pts.forEach(p => { const i = nearest(p.R); if (!asg[i] || p.R > asg[i].R) asg[i] = p; });
    return radii.map((r, i) => {
      if (i < iMin) return '/';
      if (i > iMax) return '';
      const a = asg[i];
      if (a && Math.abs(a.R - r) > 1e-6) return `${a.W} (${+a.R.toFixed(2)}m)`;
      const p = pts.find(q => q.R >= r - 1e-9) || a;
      return p ? String(p.W) : '';
    });
  });
  return { booms: st.map(x => String(x.len)), radii: radii.map(String), cells: radii.map((_, ri) => cols.map(c => c[ri])), ropes: [], notes: '' };
}
function catalog() {
  const M = BOOM_MACHINES(), list = [];
  ((window.CRANE_DB && CRANE_DB.models) || []).forEach(m => {
    const bid = M[normModel(m.model)] ? normModel(m.model) : null;
    list.push({ id: m.model, src: 'chart', maker: m.maker, series: m.series + ' 系列', booms: m.booms, boomId: bid,
      has: { chart: true, boom: !!bid, wt: !!(bid && M[bid].boom_segW), lw: !!(m.outrigger_mm && m.outrigger_mm.max), hook: m.hook_kg > 0, angle: m.maxAngle > 0, cap: m.cap_kg > 0 } });
  });
  Object.entries(M).forEach(([id, B]) => {
    if (list.some(x => normModel(x.id) === id)) return;
    const lens = B.data().stages.map(x => x.len).sort((a, b) => a - b);
    list.push({ id, src: 'boom', maker: B.brand, series: '', booms: lens, boomId: id,
      has: { chart: true, boom: true, wt: !!(B.boom_segW && B.boom_segW.length), lw: B.outrigger_cm > 0, hook: B.hook_kg > 0, angle: true, cap: true } });
  });
  list.forEach(x => { x.score = Object.values(x.has).filter(Boolean).length; });
  return list.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}
/* 目前選用：資料庫型號 id，或 'ai' / 'manual' / 'none'（最壞情況） */
function fallbackOf(c) { return c.hasChart === false ? 'none' : (c.hasChart === true && c.chartSource && c.chartSource !== 'db' ? c.chartSource : null); }
const selectedModel = (c) => c.hasChart === true && (c.chartSource || 'db') === 'db' ? c.crane.dbModel : '';
function scoreCell(n, total) { const pct = Math.round(n / total * 100); return `<div class="score"><div class="progress"><i style="width:${pct}%"></i></div><b>${n}/${total}</b></div>`; }
function catalogHtml() {
  const keys = Object.keys(HAS_LABEL), sel = selectedModel(cur), fb = fallbackOf(cur), T = keys.length;
  const ck = (v) => v ? '<span class="ck ok">✅</span>' : '<span class="ck no">❌</span>';
  const rows = catalog().map(x => `<tr class="${sel === x.id ? 'sel' : ''}">
      <td class="c">${sel === x.id ? '<span class="pill done">使用中</span>' : `<button class="btn btn-outline btn-xs" data-pick="${esc(x.id)}">選用</button>`}</td>
      <td><b>${esc(x.id)}</b><div class="hint">${esc([String(x.maker).split('（')[0], x.series].filter(Boolean).join('　'))}</div></td>
      <td class="hint">${x.booms.map(b => (+b).toFixed(2)).join('、')} m</td>
      ${keys.map(k => `<td class="c">${ck(x.has[k])}</td>`).join('')}
      <td>${scoreCell(x.score, T)}</td></tr>`).join('');
  const fbRow = (v, icon, title, desc, n) => `<tr class="fb ${fb === v ? 'sel' : ''}">
      <td class="c">${fb === v ? '<span class="pill done">使用中</span>' : `<button class="btn btn-outline btn-xs" data-fb="${v}">選用</button>`}</td>
      <td colspan="2"><b>${icon} ${title}</b><div class="hint">${desc}</div></td>
      <td colspan="${T}" class="hint">${n}</td><td>${scoreCell(0, T)}</td></tr>`;
  return `<div class="chart-wrap"><table class="check-table model-table">
    <thead><tr><th></th><th>型號</th><th>伸臂長度</th>${keys.map(k => `<th class="c">${HAS_LABEL[k]}</th>`).join('')}<th>完整度</th></tr></thead>
    <tbody>${rows}
    <tr class="sep"><td colspan="${T + 4}">資料庫沒有符合的型號時（最壞情況，需自行補齊的資料較多）</td></tr>
    ${fbRow('ai', '📷', '上傳原廠荷重性能表＋AI 判讀', '貼紙、說明書或型錄頁面；判讀結果於 S1-3 逐格核對', '除荷重性能表外，其餘資料皆需自行量測或輸入')}
    ${fbRow('manual', '✍️', '自行輸入荷重性能表', '依原廠荷重性能表於 S1-3 逐格輸入', '除荷重性能表外，其餘資料皆需自行量測或輸入')}
    ${fbRow('none', '❌', '沒有荷重性能表', '伸臂長度、原吊升荷重須實測／依銘牌；荷重表完全由伸臂強度與安定度計算', '全部資料皆需自行量測或輸入')}
    </tbody></table></div>`;
}
/* 目前資料之完整度（依案件實際內容判斷） */
function curHas(c) {
  return { chart: !!(c.hasChart && c.origChart.booms.length), boom: !!boomDbOf(c), wt: c.boom.weightMode === 'manual' && (c.boom.segW || []).some(x => N(x) > 0), lw: N(c.stab.Lw) > 0, hook: N(c.stab.Wh) > 0, angle: N(c.stab.thetaM) > 0, cap: N(c.crane.orig_capacity_t) > 0 };
}
function completenessHtml() {
  const sel = selectedModel(cur), fb = fallbackOf(cur);
  if (!sel && !fb) return '<div class="callout warn" style="margin-bottom:0">尚未選擇：請從上方列表選用機型，或選擇列表最下方的方式。</div>';
  const h = curHas(cur), keys = Object.keys(HAS_LABEL), n = keys.filter(k => h[k]).length;
  const name = sel ? sel : { ai: '上傳荷重性能表＋AI 判讀', manual: '自行輸入荷重性能表', none: '沒有荷重性能表' }[fb];
  const need = keys.filter(k => !h[k]).map(k => HAS_NEED[k]);
  return `<div class="callout ${need.length ? 'warn' : 'ok'}" style="margin-bottom:0">
    <b>目前選用：${esc(name)}　資料完整度 ${n}/${keys.length}</b>
    <div class="ckline">${keys.map(k => `<span>${h[k] ? '✅' : '❌'} ${HAS_LABEL[k]}</span>`).join('')}</div>
    ${need.length ? `<b>需自行補輸入：</b><ul>${need.map(x => `<li>${x}</li>`).join('')}</ul>` : '原廠資料齊全，各步驟可自動帶入；仍請逐項核對。'}</div>`;
}
/* 選用資料庫機型：帶入荷重性能表、伸臂長度、原吊升荷重、撐座寬度、起伏角、吊鉤重量 */
function pickModel(id) {
  const m = window.CRANE_DB && CRANE_DB.get(id), B = BOOM_MACHINES()[id];
  if (!m && !B) return false;
  const has = cur.origChart.booms.length || (cur.boom.stages_m || []).some(x => N(x) > 0) || cur.stab.Lw || cur.crane.model;
  if (has && !confirm(`以 ${id} 的原廠資料取代目前的荷重性能表、伸臂長度、撐座寬度、起重機型號等欄位？`)) return false;
  cur.hasChart = true; cur.chartSource = 'db'; cur.crane.dbModel = id; cur.crane.model = id;
  if (m) {
    cur.crane.maker = m.maker;
    cur.crane.orig_capacity_t = String(m.cap_kg / 1000);
    cur.origChart = JSON.parse(JSON.stringify(m.chart));
    cur.boom.stages_m = m.booms.map(String);
    cur.stab.Lw = String(m.outrigger_mm.max / 10);
    cur.stab.thetaM = String(m.maxAngle);
    cur.docs.angle_min = String(m.minAngle != null ? m.minAngle : 0);
    cur.stab.Wh = String(m.hook_kg);
  } else {
    // 僅伸臂強度計算書資料庫：荷重性能表取自計算書荷重點；撐座寬度、吊鉤重量取自資料庫（未收錄者需實測）
    const d = B.data(), ch = chartFromBoom(d);
    cur.crane.maker = B.brand;
    cur.origChart = ch;
    cur.boom.stages_m = ch.booms.slice();
    let mx = 0, th = 0; d.stages.forEach(x => x.rows.forEach(r => { if (r[0] > mx) mx = r[0]; if (r[2] > th) th = r[2]; }));
    cur.crane.orig_capacity_t = String(mx / 1000);
    cur.stab.thetaM = th ? String(th) : '';
    cur.stab.Lw = B.outrigger_cm > 0 ? String(B.outrigger_cm) : ''; cur.stab.Wh = B.hook_kg > 0 ? String(B.hook_kg) : '';
  }
  setBoomWeights(B && B.boom_segW, B && B.boom_cylW);
  cur.aiFilled = (cur.aiFilled || []).filter(p => !['crane.maker', 'crane.model', 'crane.orig_capacity_t'].includes(p));
  touch(); flush();
  return true;
}
/* 伸臂各節、伸縮油壓缸重量（kg）：有原廠資料改為手動輸入模式並帶入，否則回到自動推估 */
function setBoomWeights(segW, cylW) {
  const seg = (segW || []).map(N).filter(x => x > 0), cyl = (cylW || []).map(N).filter(x => x > 0);
  if (seg.length) {
    cur.boom.weightMode = 'manual'; cur.boom.segW = seg.map(String); cur.boom.cylW = cyl.map(String);
    if (cyl.length) cur.boom.numCyl = String(cyl.length);
  } else { cur.boom.weightMode = 'auto'; cur.boom.segW = []; cur.boom.cylW = []; cur.boom.numCyl = ''; }
}

/* AI 回傳「每個伸臂一串荷重」→ 編輯器格式 cells[半徑列][伸臂欄]（也接受舊版 cells[列][欄] 格式） */
function aiChartToOrig(lc) {
  if (!lc || !lc.present || !Array.isArray(lc.radii_m) || !lc.radii_m.length) return null;
  const radii = lc.radii_m.map(String);
  if (Array.isArray(lc.booms) && lc.booms.length) {
    const warn = [];
    const cols = lc.booms.map((b, ci) => {
      const L = (b.loads || []).map(x => String(x == null ? '' : x).trim());
      if (L.length !== radii.length) warn.push(`第 ${ci + 1} 欄伸臂（${b.boom_length_m || '?'}）讀到 ${L.length} 格，但半徑有 ${radii.length} 欄，位置可能錯位，請逐格核對`);
      // 最後一個荷重值右側只可能是「超出作業範圍」，AI 若填斜線一律改為空白
      let last = -1; L.forEach((x, i) => { if (/\d/.test(x)) last = i; });
      return radii.map((_, ri) => (ri > last && /^[\/／╱]$/.test(L[ri] || '')) ? '' : (L[ri] || ''));
    });
    return { booms: lc.booms.map(b => String(b.boom_length_m || '')), radii,
      cells: radii.map((_, ri) => cols.map(col => col[ri])),
      ropes: lc.booms.map(b => String(b.rope || '')), notes: lc.notes || '', warn };
  }
  if (Array.isArray(lc.boom_lengths_m) && lc.boom_lengths_m.length)
    return { booms: lc.boom_lengths_m.map(String), radii,
      cells: radii.map((_, ri) => lc.boom_lengths_m.map((__, ci) => String(((lc.cells || [])[ri] || [])[ci] || ''))),
      ropes: (lc.ropes || []).map(String), notes: lc.notes || '' };
  return null;
}
function applyAi(task, res) {
  const filled = [], conflicts = [];
  const put = (path, v) => {
    v = v == null ? '' : String(v).trim(); if (!v) return;
    const old = getP(cur, path);
    if (old !== '' && old != null && String(old) !== v) conflicts.push([path, old, v]);
    else { setP(cur, path, v); filled.push(path); }
  };
  // 車牌格式檢查（英文／數字－英文／數字，含「-」）；不符者不帶入並列為待確認
  const veh = res.vehicle || {}, uns = res.uncertain = (res.uncertain || []).slice();
  if (veh.plate) {
    const pl = String(veh.plate).trim().toUpperCase().replace(/[－—–]/g, '-').replace(/\s+/g, '').replace(/_.*$/, '');
    if (/^[A-Z0-9]{2,4}-[A-Z0-9]{2,4}$/.test(pl) && /[A-Z]/.test(pl) && /\d/.test(pl)) veh.plate = pl;
    else { uns.push(`車牌號碼：AI 讀到「${veh.plate}」不符車牌格式（例 ABC-1234），未帶入，請依車主聯右上角號碼填寫`); veh.plate = ''; }
  }
  if (veh.engine_no && veh.vin && String(veh.engine_no).replace(/\W/g, '') === String(veh.vin).replace(/\W/g, '')) {
    uns.push('引擎號碼：AI 讀到的值與車身號碼相同，未帶入，請依車主聯「引擎號碼」欄填寫'); veh.engine_no = '';
  }
  if (veh.engine_no && /^[A-HJ-NPR-Z0-9]{17}$/i.test(String(veh.engine_no).trim())) uns.push('引擎號碼：AI 讀到 17 碼，可能是車身號碼，請核對');
  for (const sec of ['company', 'vehicle', 'crane']) for (const [k, v] of Object.entries(res[sec] || {})) if (getP(cur, sec) && k in cur[sec]) put(sec + '.' + k, v);
  const cc = res.vehicle && String(res.vehicle.engine_cc || '').replace(/[^\d.]/g, '');
  if (cc && (!cur.docs.engine_power || cur.docs.engine_power === DOC_PRESET.engine_power)) { cur.docs.engine_power = cc + ' cc'; filled.push('docs.engine_power'); }
  const ang = res.crane || {};
  if (String(ang.boom_angle_min || '').trim()) { cur.docs.angle_min = String(ang.boom_angle_min).replace(/[^\d.]/g, ''); filled.push('docs.angle_min'); }
  if (String(ang.boom_angle_max || '').trim() && !cur.stab.thetaM) { cur.stab.thetaM = String(ang.boom_angle_max).replace(/[^\d.]/g, ''); }
  if (conflicts.length && confirm('以下欄位已有資料，與 AI 結果不同，是否以 AI 結果覆蓋？\n' + conflicts.map(c => `${c[0]}：「${c[1]}」→「${c[2]}」`).join('\n')))
    conflicts.forEach(([p, , v]) => { setP(cur, p, v); filled.push(p); });
  if (filled.includes('company.address')) setCompanyAddr(cur, cur.company.address);
  const chart = task === 'chart' ? aiChartToOrig(res.load_chart) : null;
  if (chart) {
    const hasOld = cur.origChart.booms.length;
    if (!hasOld || confirm('以 AI 轉錄結果取代目前的荷重性能表？')) {
      cur.hasChart = true; cur.chartSource = 'ai'; cur.crane.dbModel = '';
      res.uncertain = (chart.warn || []).concat(res.uncertain || []);
      delete chart.warn;
      cur.origChart = chart;
      cur.boom.stages_m = chart.booms.slice();
    }
  }
  const bw = res.boom_weights;
  if (task === 'chart' && bw && (bw.boom_kg || []).some(x => N(x) > 0)) { setBoomWeights(bw.boom_kg, bw.cylinder_kg); filled.push('boom.segW'); }
  cur.aiFilled = Array.from(new Set((cur.aiFilled || []).concat(filled)));
  const u = Array.isArray(cur.aiUncertain) ? { docs: cur.aiUncertain } : Object.assign({}, cur.aiUncertain);
  u[task] = res.uncertain || []; cur.aiUncertain = u;
  cur.aiLog = (cur.aiLog || []).concat([{ at: new Date().toISOString(), task, filled: filled.length }]).slice(-10);
  touch(); flush(); renderNav();
}

/* 荷重表檢核：格式、作業半徑不大於伸臂長、同一伸臂之荷重不大於上方（較小半徑）之值、表頭數值遞增 */
const CELL_RE = /^\s*(\d+(?:\.\d+)?)\s*(?:[（(]\s*(\d+(?:\.\d+)?)\s*m?\s*[)）])?\s*$/i;
function chartIssues(ch) {
  const out = { cell: {}, boom: {}, radius: {}, list: [] };
  const add = (map, key, msg, where) => { (map[key] = map[key] || []).push(msg); out.list.push(where + '：' + msg); };
  const num = (v) => /^\s*\d+(\.\d+)?\s*$/.test(String(v == null ? '' : v)) ? Number(v) : NaN;
  const booms = ch.booms.map(num), radii = ch.radii.map(num);
  booms.forEach((b, ci) => {
    if (!(b > 0)) add(out.boom, ci, '伸臂長須為正數（m）', `第 ${ci + 1} 欄伸臂長`);
    else if (ci && booms[ci - 1] > 0 && b <= booms[ci - 1]) add(out.boom, ci, '伸臂長須由左至右遞增', `伸臂 ${b} m`);
  });
  radii.forEach((r, ri) => {
    if (!(r > 0)) add(out.radius, ri, '作業半徑須為正數（m）', `第 ${ri + 1} 列作業半徑`);
    else if (ri && radii[ri - 1] > 0 && r <= radii[ri - 1]) add(out.radius, ri, '作業半徑須由上至下遞增', `半徑 ${r} m`);
  });
  ch.booms.forEach((_, ci) => {
    let above = null;   // 同一伸臂、上方最近一格有荷重值者
    ch.radii.forEach((_, ri) => {
      const t = String((ch.cells[ri] || [])[ci] || '').trim();
      if (!t || /^[\/／╱]$/.test(t)) return;
      const where = `伸臂 ${ch.booms[ci] || '?'} m／半徑 ${ch.radii[ri] || '?'} m`;
      const m = CELL_RE.exec(t);
      if (!m) { add(out.cell, ri + ',' + ci, '格式錯誤：請填數字（kg）、「/」或「2240 (4.57m)」', where); return; }
      const W = Number(m[1]), R = m[2] ? Number(m[2]) : radii[ri];
      if (booms[ci] > 0 && R > booms[ci] + 1e-9) add(out.cell, ri + ',' + ci, `作業半徑 ${R} m 大於伸臂長 ${booms[ci]} m`, where);
      if (above && W > above.W) add(out.cell, ri + ',' + ci, `荷重 ${W} kg 大於上方（半徑 ${above.r} m）之 ${above.W} kg`, where);
      above = { W, r: m[2] ? m[2] : ch.radii[ri] };
    });
  });
  return out;
}
function renderChartEditor(box) {
  const ch = cur.origChart; if (!ch.cells) ch.cells = [];
  box.innerHTML = `
    <p class="hint">荷重單位 kg；斜線（不可作業）輸入 <code>/</code>；註記半徑如 <code>2240 (4.57m)</code>。點選格子時，該列（作業半徑）與該欄（伸臂長）會整條標亮，方便對照；不合規的格子以紅框標示，游標移上可看原因。</p>
    <div class="btn-row" style="margin-bottom:8px">
      <button class="btn btn-outline" data-a="addc">➕ 伸臂欄</button><button class="btn btn-danger-outline" data-a="delc">➖ 最後一欄</button>
      <button class="btn btn-outline" data-a="addr">➕ 半徑列</button><button class="btn btn-danger-outline" data-a="delr">➖ 最後一列</button>
    </div>
    <div class="chart-wrap"><table class="load-table compact edit-grid">
      <thead><tr><th>半徑(m) ＼ 伸臂(m)</th>${ch.booms.map((b, i) => `<th data-col="${i}"><input data-b="${i}" value="${esc(b)}"></th>`).join('')}</tr></thead>
      <tbody>${ch.radii.map((r, ri) => `<tr><th data-row="${ri}"><input data-r="${ri}" value="${esc(r)}"></th>${ch.booms.map((_, ci) => `<td data-row="${ri}" data-col="${ci}"><input data-c="${ri},${ci}" value="${esc((ch.cells[ri] || [])[ci] || '')}"></td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>
    <div class="chart-issues"></div>
    ${ch.booms.length ? '' : '<p class="hint">尚無資料，可由 AI 解析或手動新增欄列。</p>'}`;
  const grid = $('.edit-grid', box);
  // 檢核：標示不合規的格子並列出問題
  const check = () => {
    const iss = chartIssues(ch);
    const mark = (el, msgs) => { el.classList.toggle('bad', !!msgs); el.title = msgs ? msgs.join('\n') : ''; };
    $$('input[data-c]', grid).forEach(el => mark(el, iss.cell[el.dataset.c]));
    $$('input[data-b]', grid).forEach(el => mark(el, iss.boom[el.dataset.b]));
    $$('input[data-r]', grid).forEach(el => mark(el, iss.radius[el.dataset.r]));
    $('.chart-issues', box).innerHTML = iss.list.length
      ? `<div class="callout danger" style="margin-bottom:0"><b>檢核發現 ${iss.list.length} 處不合規，請修正：</b><ul>${iss.list.slice(0, 30).map(x => `<li>${esc(x)}</li>`).join('')}${iss.list.length > 30 ? `<li>…其餘 ${iss.list.length - 30} 處</li>` : ''}</ul></div>`
      : (ch.booms.length ? '<div class="callout ok" style="margin-bottom:0">荷重表檢核通過（格式、作業半徑、荷重遞減）。</div>' : '');
  };
  // 標亮：所在列（作業半徑）與所在欄（伸臂長）
  const clearHl = () => $$('.hl, .hl-x', grid).forEach(x => x.classList.remove('hl', 'hl-x'));
  grid.addEventListener('focusin', (e) => {
    const el = e.target; if (!el.matches('input')) return;
    clearHl();
    const cell = el.closest('th, td'), r = cell.dataset.row, c = cell.dataset.col;
    if (r != null) $$(`[data-row="${r}"]`, grid).forEach(x => x.classList.add('hl'));
    if (c != null) $$(`[data-col="${c}"]`, grid).forEach(x => x.classList.add('hl'));
    cell.classList.add('hl-x');
  });
  grid.addEventListener('focusout', (e) => { if (!grid.contains(e.relatedTarget)) clearHl(); });
  $$('input[data-b]', box).forEach(el => el.oninput = () => { ch.booms[+el.dataset.b] = el.value; syncStagesFromChart(cur); touch(); check(); });
  $$('input[data-r]', box).forEach(el => el.oninput = () => { ch.radii[+el.dataset.r] = el.value; touch(); check(); });
  $$('input[data-c]', box).forEach(el => el.oninput = () => { const [r, c] = el.dataset.c.split(',').map(Number); if (!ch.cells[r]) ch.cells[r] = []; ch.cells[r][c] = el.value; touch(); check(); });
  $$('[data-a]', box).forEach(b => b.onclick = () => {
    const a = b.dataset.a;
    if (a === 'addc') { ch.booms.push(''); ch.cells.forEach(r => r.push('')); }
    if (a === 'delc' && ch.booms.length) { ch.booms.pop(); ch.cells.forEach(r => r.pop()); }
    syncStagesFromChart(cur);
    if (a === 'addr') { ch.radii.push(''); ch.cells.push(ch.booms.map(() => '')); }
    if (a === 'delr' && ch.radii.length) { ch.radii.pop(); ch.cells.pop(); }
    touch(); renderChartEditor(box);
  });
  check();
}

/* 受檢地點：郵遞區號、完整地址、代行檢查機構 */
function siteZip(c) { const d = (TW_ZIP.data[c.site.county] || []).find(x => x.name === c.site.district); return d ? d.zip : ''; }
function siteAddress(c) { return c.site.county ? siteZip(c) + c.site.county + (c.site.district || '') + (c.site.detail || '') : ''; }
function siteAgencyText(c) {
  const a = TW_ZIP.agencyFor(c.site.county);
  return a ? `代行檢查機構：${a.regionLabel} → <b>${a.name}</b>（${a.tel}）` : '請選擇縣市，系統會依轄區帶入代行檢查機構。';
}

/* S2-3 欄位：使用者值優先；未填時顯示預設／推估值並標示來源 */
function DF(key, label, unit, missHint) {
  const d = Calc.defaults(cur)[key];
  const u = cur.stab[key]; const has = u !== '' && u != null;
  const val = has ? u : (d ? d.v : '');
  const tag = has ? (d ? `<a href="#" class="tag reset" data-reset="${key}" title="改回${d.kind}值 ${d.v}">↺ 改回${d.kind}值 ${d.v}</a>` : '<span class="tag user">實測</span>')
                  : (d ? `<span class="tag ${d.kind === '帶入' ? 'link' : 'est'}">${d.kind}</span>` : '');
  const cls = has ? '' : (d ? 'est-val' : 'missing');
  const hint = has ? '使用者輸入值' : (d ? `${d.kind}：${esc(d.src)}` : `<span style="color:var(--ng)">${esc(missHint || '必填')}</span>`);
  return `<div class="field"><span>${esc(label)} ${tag}</span><div class="unit-in"><input data-stab="${key}" inputmode="decimal" value="${esc(val)}" class="${cls}"><em>${esc(unit)}</em></div><small>${hint}</small></div>`;
}

/* ---------------- S2：基本資料與機具量測 ---------------- */
function pStep2(pane) {
  const rerender = () => { const y = window.scrollY; pStep2(pane); window.scrollTo(0, y); };
  if (cur.hasChart === null || cur.hasChart === '') {
    pane.innerHTML = basicCardsHtml() + `<div class="card"><h2>S2-4～S2-6　搭乘設備與機具量測</h2><div class="callout warn">請先在 S1 選擇機型（或列表最下方的荷重性能表來源），再填寫搭乘設備、伸臂與安定度量測值。</div><a class="btn btn-primary" href="#case=${cur.id}&p=step1">前往 S1</a></div>`;
    bind(pane, () => renderNav()); bindBasicCards(pane, rerender); return;
  }
  const miss2 = s2Missing(cur);
  const stages = cur.boom.stages_m.length ? cur.boom.stages_m : ['', ''];
  if (!cur.boom.stages_m.length) cur.boom.stages_m = stages;
  const manual = cur.boom.weightMode === 'manual';
  const unitW = secUnitW(cur);
  const est = Calc.estimateBoom(stages.map(N).filter(x => x > 0).map(x => x * 100), N(cur.crane.orig_capacity_t), N(cur.boom.numCyl), unitW);
  pane.innerHTML = (miss2.length ? `<div class="callout warn" id="s2Miss"><b>S2 尚缺：</b>${esc(miss2.join('、'))}</div>` : '<div class="callout ok" id="s2Miss">S2 必填資料已完成。</div>') + basicCardsHtml() + `
  <div class="card">
    <h2>S2-4　搭乘設備</h2>
    <div class="fgrid">
      ${F('platform.no', '搭乘設備編號', { hint: '依搭乘設備簽證報告' })}
      ${F('platform.weight_kg', '搭乘設備重量', { unit: 'kg', num: true, req: true, hint: '依搭乘設備簽證報告' })}
      ${F('platform.payload_kg', '搭乘設備載重（積載荷重）', { unit: 'kg', num: true, req: true })}
    </div>
    <p class="hint">吊升荷重由 S4 依伸臂強度與安定度檢討荷重性能曲線決定，不再以 (搭乘設備重量＋載重)×2 為上限；搭乘設備資料帶入申請文件。</p>
  </div>
  <div class="card">
    <h2>S2-5　伸臂與油壓缸重量</h2>
    <p class="hint">伸臂各段長度依 S1-3（${stages.map(N).filter(x => x > 0).join('、') || '尚未設定'} m）；吊升荷重、油壓缸支數請於 S1-3 填寫。</p>
    <div class="fgrid">
      ${F('boom.weightMode', '伸臂重量來源', { type: 'select', options: [['auto', est.bySec ? '自動推估（依斷面單位重量）' : cur.hasChart ? '自動推估＋依荷重表反算' : '自動推估（經驗公式）'], ['manual', '手動輸入（有原廠資料／實測）']] })}
    </div>
    <div id="bwBox" style="margin-top:10px">${manual ? `
      <table class="check-table"><tr><th>項目</th>${stages.map((_, i) => `<th>第${i + 1}節</th>`).join('')}</tr>
      <tr><td>伸臂重量 kg</td>${stages.map((_, i) => `<td><input data-sw="${i}" value="${esc((cur.boom.segW || [])[i] || '')}" style="width:70px"></td>`).join('')}</tr>
      <tr><td>油壓缸重量 kg</td>${stages.map((_, i) => `<td><input data-cw="${i}" value="${esc((cur.boom.cylW || [])[i] || '')}" style="width:70px"></td>`).join('')}</tr></table>`
      : `<div class="callout info">推估伸臂各節重量（kg）：${est.segW.join('、') || '—'}；油壓缸：${est.cylW.join('、') || '—'}；合計約 <b>${Math.round(est.Wr)} kg</b>。<br><small>${est.bySec
        ? `依斷面單位重量：第 i 節重量 = (L<sub>i</sub> − L<sub>i−1</sub>) × w<sub>i</sub> × 1.2，w = 斷面積 A × 7.85×10⁻³ kg/cm（各節 w：${unitW.map(w => (w * 100).toFixed(2)).join('、')} kg/m）；油壓缸約佔 8%。斷面取自 ${cur.hasChart === false ? 'S1-3' : 'S3 伸臂強度計算書'}。`
        : `經驗式：Wr ≈ 23 × √(原吊升荷重 t) × 全伸長度 m，油壓缸約佔 8%（例：2.95t、12.5m 約 494 kg）。${cur.hasChart === false ? '於 S1-3 填妥各節伸臂斷面後，改依斷面單位重量 × 節長 × 1.2 推估。' : '於 S3 自行輸入各節斷面後，改依斷面單位重量 × 節長 × 1.2 推估。'}`}有原廠或實測重量時請改選「手動輸入」。${!est.bySec && cur.hasChart && !N(cur.crane.orig_capacity_t) ? '未填原吊升荷重時，計算將以荷重表最大值反推。' : ''}</small></div>`}
    </div>
  </div>
  <div class="card">
    <h2>S2-6　安定度量測值</h2>
    <p class="hint">高度值以地面為基準。標示 <span class="tag link">帶入</span> 者取自上方 S2-2 車籍資料、<span class="tag est">推估</span>／<span class="tag est">預設</span> 者為系統依規則算出之值（欄位呈黃底）；有實測值請直接覆寫，清空即恢復預設。</p>
    <div class="fgrid wide">
      ${DF('Wb', '起重機總重量 Wb（車重＋起重機）', 'kg', '請於 S2-2 填寫空重')}
      ${DF('Wf', '腳架、立柱（含旋轉座）重量 Wf', 'kg', '')}
      ${cur.hasChart === false ? `<div class="field"><span>吊具組（吊鉤）重量 Wh <span class="tag link">S1-3</span></span><div class="unit-in"><input readonly value="${esc(cur.stab.Wh)}" class="${N(cur.stab.Wh) > 0 ? '' : 'missing'}"><em>kg</em></div><small>${N(cur.stab.Wh) > 0 ? '取自 S1-3' : '<span style="color:var(--ng)">請於 S1-3 填寫</span>'}</small></div>` : DF('Wh', '吊具組（吊鉤）重量 Wh', 'kg', '請於 S1-3 填吊升荷重，或輸入吊鉤秤重值')}
      ${DF('thetaM', '伸臂最大起伏角 θm', '度', '')}
      ${F('stab.Lw', '外伸撐座全伸寬度 Lw', { unit: 'cm', num: true, req: true, hint: '實測左右撐座中心距；從資料庫選型號時自動帶入全張寬度。套用後標註於正面工程圖' })}
      <div class="field"><span>軸距 H <span class="tag link">帶入</span></span><div class="unit-in"><input readonly value="${esc(cur.vehicle.wheelbase_cm)}" class="${N(cur.vehicle.wheelbase_cm) > 0 ? ((cur.aiFilled || []).includes('vehicle.wheelbase_cm') ? 'ai-filled' : 'est-val') : 'missing'}"><em>cm</em></div><small>${N(cur.vehicle.wheelbase_cm) > 0 ? '取自 S2-2 車籍資料' : '<span style="color:var(--ng)">請於 S2-2 填寫軸距</span>'}</small></div>
      ${DF('B1', '前輪距 B1', 'cm', '請於 S2-2 填寫前輪距')}
      ${DF('B2', '後輪距 B2', 'cm', '請於 S2-2 填寫後輪距')}
      ${DF('S', '前輪中心至旋轉中心距離 S', 'cm', '')}
      ${DF('h1', '車台重心高度 h1', 'cm', '請於 S2-2 填寫車高')}
      ${DF('h2', '腳架、立柱重心高度 h2', 'cm', '請於 S2-2 填寫車高')}
      ${DF('h3', '吊具組重心高度 h3', 'cm', '請於 S2-2 填寫車高')}
      ${DF('h4', '伸臂重心高度 h4', 'cm', '請於 S2-2 填寫車高')}
    </div>
  </div>
  <div class="btn-row"><a class="btn btn-primary" href="#case=${cur.id}&p=step3">下一步：S3 伸臂強度計算 →</a></div>`;
  bindBasicCards(pane, rerender);
  bind(pane, (p, v) => {
    refreshS2Miss(pane);
    if (p === 'boom.weightMode') { if (v === 'manual') seedManual(); flush(); rerender(); }
    renderNav();
  });
  // 文字輸入欄位：輸入完成（離開欄位／Enter）才重繪，避免每打一字就失焦並跳回頁首
  $$('[data-k="crane.orig_capacity_t"], [data-k="boom.numCyl"]', pane).forEach(el => el.addEventListener('change', () => { flush(); rerender(); }));
  $$('input[data-stab]', pane).forEach(el => {
    el.oninput = () => { cur.stab[el.dataset.stab] = el.value.trim(); el.classList.remove('est-val'); touch(); };
    el.onchange = () => { flush(); const y = window.scrollY; pStep2(pane); window.scrollTo(0, y); renderNav(); };
  });
  $$('[data-reset]', pane).forEach(b => b.onclick = (e) => { e.preventDefault(); cur.stab[b.dataset.reset] = ''; flush(); const y = window.scrollY; pStep2(pane); window.scrollTo(0, y); renderNav(); });
  $$('input[data-sw]', pane).forEach(el => el.oninput = () => { cur.boom.segW[+el.dataset.sw] = el.value; touch(); });
  $$('input[data-cw]', pane).forEach(el => el.oninput = () => { cur.boom.cylW[+el.dataset.cw] = el.value; touch(); });
}
function seedManual() {
  const st = cur.boom.stages_m.map(N).filter(x => x > 0).map(x => x * 100);
  const e = Calc.estimateBoom(st, N(cur.crane.orig_capacity_t), N(cur.boom.numCyl), secUnitW(cur));
  if (!(cur.boom.segW || []).some(x => N(x) > 0)) cur.boom.segW = e.segW.map(String);
  if (!(cur.boom.cylW || []).some(x => N(x) > 0)) cur.boom.cylW = e.cylW.map(String);
}

/* ---------------- S3：伸臂強度計算（內嵌 伸臂強度/伸臂強度計算書.html） ---------------- */
const boomRes = (c) => Store.subGet(c.id, 'boomStrength_result');
const boomOk = (c) => { const b = boomRes(c); return !!(b && b.has && b.valid); };
/* 伸臂強度計算之起始資料：資料庫機具直接選用；其他機型由 S1-3 荷重性能表帶入伸臂長度與荷重點，S2-5 帶入重量（推估） */
function boomSeed(c) {
  const sd = { id: 's' + Date.now().toString(36), title: c.crane.type || '積載型起重機', model: c.crane.model || '' };
  const db = boomDbOf(c);
  if (db) { sd.machine = db; return sd; }
  const ch = c.hasChart && c.origChart && c.origChart.booms.length ? c.origChart : null;
  let lens = (c.boom.stages_m || []).map(N).filter(x => x > 0);
  if (!lens.length && ch) lens = ch.booms.map(N).filter(x => x > 0);
  if (!lens.length) return sd;
  sd.stages = lens.map(L => {
    const ci = ch ? ch.booms.findIndex(b => Math.abs(N(b) - L) < 0.02) : -1, rows = [];
    // 荷重格：「2240」或「2240 (4.57m)」（括號內為實際作業半徑）；斜線與空白略過
    if (ci >= 0) ch.radii.forEach((r, ri) => {
      const m = /^\s*([\d.]+)\s*(?:[（(]\s*([\d.]+)\s*m?\s*[)）])?/.exec(String((ch.cells[ri] || [])[ci] || ''));
      if (m && N(m[1]) > 0) rows.push([N(m[1]), m[2] ? N(m[2]) : N(r)]);
    });
    return { len: L, rows };
  }).reverse();   // 同原廠計算書：由全伸排到全縮
  sd.X = lens.map(L => Math.round(L * 1000) / 10);   // 全伸時各節頭端位置（cm），以伸出至該節之伸臂總長近似
  sd.m = N(c.boom.numCyl) > 0 ? Math.round(N(c.boom.numCyl)) : Math.max(1, Math.floor(lens.length / 2));
  const est = c.boom.weightMode === 'manual' && (c.boom.segW || []).some(x => N(x) > 0)
    ? { segW: c.boom.segW.map(N), cylW: (c.boom.cylW || []).map(N) }
    : Calc.estimateBoom(lens.map(x => x * 100), N(c.crane.orig_capacity_t), N(c.boom.numCyl), secUnitW(c));
  sd.segW = est.segW; sd.cylW = est.cylW;
  sd.wManual = c.boom.weightMode === 'manual';   // S2-5 為原廠／實測重量（可覆寫）；推估值只補空白
  sd.w = lens.map((L, k) => { const seg = (L - (k ? lens[k - 1] : 0)) * 100; return est.segW[k] > 0 && seg > 0 ? Math.round(est.segW[k] / seg * 1000) / 1000 : null; });
  return sd;
}
function boomStatHtml() {
  const b = boomRes(cur);
  if (!b || !b.has) return `<div class="kpi"><div class="lbl">伸臂強度計算</div><div class="val">尚未完成</div><div class="sub">請在下方選擇機具並輸入資料</div></div>`;
  const src = b.src === 'self' ? '自行計算' : '資料庫 ' + esc(b.model);
  if (!b.valid) return `<div class="kpi ng"><div class="lbl">伸臂強度計算（${src}）</div><div class="val">輸入有誤</div><div class="sub">斷面尺寸、板厚或伸臂長度有誤，無法計算；請檢查黃底欄位</div></div>`;
  return `<div class="kpi ok"><div class="lbl">伸臂強度計算（${src}）</div><div class="val">計算完成</div><div class="sub">已產生各伸臂長度、作業半徑之強度允許荷重，供 S4 檢核</div></div>
    <div class="kpi ${b.ok ? 'ok' : 'ng'}"><div class="lbl">原廠荷重點檢核</div><div class="val">${b.ok ? '全部合格' : '部分超過容許應力'}</div>
    <div class="sub">最大應力比 ${b.maxU != null ? b.maxU.toFixed(3) : '—'}（≦ 1 為合格）${b.ok ? '' : '；S4 將依伸臂強度下調荷重'}</div></div>`;
}
function pStep3(pane) {
  if (!Store.subGet(cur.id, 'boomStrengthCalc.v1')) Store.subSet(cur.id, 'boomStrength_seed', boomSeed(cur));
  if (cur.hasChart === false) computeResult();
  const db = boomDbOf(cur), st = Store.subGet(cur.id, 'boomStrengthCalc.v1');
  const stale = st && st.src && ((db && st.src !== db) || (!db && st.src !== 'self'));
  const src = '伸臂強度/伸臂強度計算書.html?case=' + encodeURIComponent(cur.id) + '&embed=1&v=' + SUB_VER;
  pane.innerHTML = `
  <div class="card">
    <h2>S3　伸臂強度計算</h2>
    ${db ? `<div class="callout ok"><b>資料庫已收錄 ${esc(boomLabel(db))}</b>：伸臂斷面外觀尺寸、各部重量、重心距離與荷重點自動帶入並鎖定，請確認設計條件（材料、容許應力等）即可。</div>`
      : `<div class="callout warn"><b>資料庫未收錄此機型，下列資料需自行輸入（黃底欄位）：</b>
        <ul><li>③ 各節伸臂斷面：${cur.hasChart === false ? '已於 S1-3 輸入（此處鎖定，修改請回 S1-3）' : '寬 B、高 H、上／側／下板厚、傾角（依原廠伸臂強度計算書或實測）'}</li>
        <li>④ 各節單位長重量 w、各部重量 Gi、全伸時各部位置（自旋轉中心起算）</li>
        <li>① 材料強度與容許應力（預設 590 N/mm² 級高張力鋼，請依材質證明修正）</li></ul>
        已依 S1／S2 預先帶入：伸臂各段長度${cur.hasChart ? '、荷重點（取自原廠荷重性能表，伸臂角由作業半徑反算）' : '（無荷重性能表：荷重點依斷面強度自動反算，最終荷重表於 S4 再與安定度取小值，並不超過原吊升荷重）'}、各節位置與重量（<b>推估值</b>，請以原廠資料或實測值覆寫）。</div>`}
    ${stale ? `<div class="callout danger">S1 起重機型號已變更，目前計算資料為「${esc(st.src === 'self' ? '自行計算' : st.src)}」。請按「依 S1／S2 資料重新帶入」更新。</div>` : ''}
    <div class="callout info">S4 會以本計算之結果檢核荷重性能：各伸臂長度、作業半徑之荷重不得超過伸臂強度允許值（應力比 ≦ 1），不足者下調，降至 0 者於荷重表標示「不可作業」。</div>
    <div class="kpis" id="boomStat">${boomStatHtml()}</div>
    <div class="btn-row"><button class="btn btn-outline" id="btnBoomReseed">📥 依 S1／S2 資料重新帶入</button><span class="hint">只更新伸臂長度、荷重點、油壓缸支數與重量；斷面尺寸等已輸入資料保留</span></div>
  </div>
  <div class="frame-wrap">
    <div class="frame-bar"><b>伸臂強度計算（輸入；全部自動儲存，計算結果即時更新）</b></div>
    <iframe class="sub" id="boomFrame" src="${src}" title="伸臂強度計算"></iframe>
  </div>
  <div class="callout info">計算書（A4 列印版）會在按左側「✅ 套用到申請文件」後，列於申請文件「6. 強度計算書」的第一份。</div>
  <div class="btn-row"><a class="btn btn-primary" href="#case=${cur.id}&p=step4">下一步：S4 荷重表反算 →</a></div>`;
  $('#btnBoomReseed', pane).onclick = () => {
    if (!confirm('以 S1／S2 的資料更新伸臂強度計算？\n\n會更新：伸臂長度與荷重點（S1-3）、油壓缸支數、各部重量（S2-5 為手動輸入之原廠／實測值時）。\n會保留：斷面尺寸、設計條件、各部位置等已輸入的資料。\n（S1 改選資料庫原廠機型時，則改用原廠資料。）')) return;
    Store.subSet(cur.id, 'boomStrength_seed', boomSeed(cur));
    pStep3(pane);
  };
}
/* ---------------- S4：反算 ---------------- */
function pStep4(pane) {
  const r = computeResult();
  if (!r.ok) {
    flush();
    pane.innerHTML = `<div class="card"><h2>S4　荷重表反算（伸臂強度＋安定度）</h2>
      <div class="callout danger"><b>尚缺以下資料，無法計算：</b><ul>${r.miss.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
      ${(r.warn || []).length ? `<div class="callout warn"><ul>${r.warn.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
      <div class="btn-row"><a class="btn btn-primary" href="#case=${cur.id}&p=step2">← 回 S2 補齊資料</a><a class="btn btn-outline" href="#case=${cur.id}&p=step3">← 回 S3 伸臂強度計算</a></div></div>`;
    renderNav(); return;
  }
  flush();
  const ck = r.checks;
  const kpi = (k) => ck[k] ? `<div class="kpi ${ck[k].ok ? 'ok' : 'ng'}"><div class="lbl">${esc(ck[k].label)}</div><div class="val">${ck[k].value.toFixed(3)} ${ck[k].ok ? '≧' : '＜'} ${ck[k].limit}</div><div class="sub">${ck[k].ok ? '符合規定' : '不符規定'}</div></div>` : '';
  pane.innerHTML = `
  <div class="card">
    <h2>S4　荷重表反算（伸臂強度＋安定度檢核）</h2>
    <div class="callout info">
      <b>計算原則：</b>回歸荷重性能曲線檢討（不以 (搭乘設備重量＋載重)×2 為上限）；每一格須同時符合 <b>S3 伸臂強度</b>（應力比 ≦ 1）與<b>前方安定度</b>（SF ≧ 1.15）檢核，不足者下調荷重，降至 0 者標示「不可作業」；
      ${cur.hasChart ? '並不得超過原廠荷重表數值（新表每一格 = min［原廠值、伸臂強度上限、安定度上限］）。未填原吊升荷重時，以荷重表最大值反推並據以推估伸臂重量。' : '並不得超過原吊升荷重。伸臂重量依原吊升荷重與伸臂長度以經驗公式推估。'}
      <details style="margin-top:6px"><summary style="cursor:pointer;font-weight:700">計算流程（每一格都經伸臂強度與安定度核算）</summary>
        <ol style="margin:6px 0 0 20px;line-height:1.7">
          <li>由 S2 各段伸臂長度、油壓缸支數與${cur.hasChart ? '原吊升荷重（或荷重表最大值）' : '原吊升荷重'}推估各節伸臂重量，求出各伸出狀態之伸臂重心 d 與前端等價質量 Wp（同安定度計算書附件 1、2）。</li>
          <li>對每一個（伸臂長度、作業半徑）格，以前方安定度公式 SF = (Wp＋Wa＋Wo)／(Wp＋Wa) ＝ 1.15 反解出允許吊升荷重 Wa（安定度上限）。</li>
          <li>伸臂強度上限：取 S3 伸臂強度計算書，於該伸臂長度、作業半徑（伸臂角 θ = cos⁻¹((R＋a)／伸臂長)，a 為伸臂腳銷在迴轉中心後方之距離）下，各臨界斷面合成應力不超過容許應力之最大額定荷重。</li>
          <li>新荷重值（吊升荷重，含吊具）= min［伸臂強度上限、安定度上限${cur.hasChart ? '、原廠荷重表值' : '、原吊升荷重'}］，無條件捨去至 10 kg，並使同一伸臂長度之荷重隨半徑增加而不增加。</li>
          <li>伸臂強度或安定度不足而降至 0 者（例如伸臂自重即超過容許應力、空載即翻倒），該格於申請資料之荷重表標示「不可作業」，該作業半徑不得使用。</li>
          <li>最後逐格以安定度公式正算驗證 SF ≧ 1.15（即上方「前方安定度最小值」，明細列於安定度計算書附件 4），並檢核後方安定度與左右安定度。</li>
        </ol>
      </details>
    </div>
    <div class="kpis">
      <div class="kpi ok"><div class="lbl">申請吊升荷重</div><div class="val">${r.liftT.toFixed(2)} 公噸</div><div class="sub">新荷重表最大值 ${r.maxVal} kg</div></div>
      <div class="kpi"><div class="lbl">伸臂重量 Wr（${r.boom.bySec ? '推估，依斷面單位重量 × 節長 × 1.2' : r.boom.est ? '推估，依原吊升荷重 ' + (r.fitInfo && r.fitInfo.origCapUsed ? r.fitInfo.origCapUsed.toFixed(2) : N(cur.crane.orig_capacity_t) || '—') + ' t' : '輸入值'}）</div><div class="val">${r.boom.Wr} kg</div><div class="sub">各節 ${r.boom.segW.join('/')}；油壓缸 ${r.boom.cylW.join('/') || '—'}</div></div>
      <div class="kpi ${r.minSF >= 1.15 - 1e-6 ? 'ok' : 'ng'}"><div class="lbl">前方安定度最小值 SF</div><div class="val">${isFinite(r.minSF) ? r.minSF.toFixed(3) : '無翻倒之虞'}</div><div class="sub">規定 ≧ 1.15</div></div>
      ${kpi('rear1')}${kpi('rear2')}${kpi('side')}
    </div>
    ${r.unstableCount ? `<div class="callout danger"><b>⚠ 新荷重表中有 ${r.unstableCount} 格為「不可作業」</b>（允許荷重降至 0）：
      ${r.deadStr ? `伸臂強度不足 ${r.deadStr} 格（伸臂自重即超過容許應力）` : ''}${r.deadStr && r.deadStab ? '；' : ''}${r.deadStab ? `安定度不足 ${r.deadStab} 格（即使不吊任何荷重，車身也會翻倒；建議改用車重較重或撐座較寬的車輛）` : ''}。
      申請資料之荷重表會於該作業半徑標示「不可作業」，嚴禁在該範圍作業。</div>` : ''}
    ${r.warn.length ? `<div class="callout warn"><ul>${r.warn.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
    ${(r.defaultsUsed || []).length ? `<details class="callout info" style="margin-top:8px"><summary style="cursor:pointer"><b>本次計算使用 ${r.defaultsUsed.length} 項預設／推估值</b>（非實測，可至 S2-6 以實測值覆寫）</summary>
      <table class="check-table" style="margin-top:6px"><tr><th>項目</th><th>採用值</th><th>類別</th><th>依據</th></tr>
      ${r.defaultsUsed.map(u => `<tr><td>${esc(u.label)}</td><td>${u.v}</td><td><span class="tag ${u.kind === '帶入' ? 'link' : 'est'}">${u.kind}</span></td><td>${esc(u.src)}</td></tr>`).join('')}
      ${r.boom.est ? `<tr><td>伸臂各節／油壓缸重量</td><td>${r.boom.Wr} kg</td><td><span class="tag est">推估</span></td><td>23 × √原吊升荷重(t) × 全伸長度(m)</td></tr>` : ''}</table></details>` : ''}
    <h3>新荷重表（吊升荷重，單位 kg，含吊具）</h3>
    <div class="legend"><span><i style="background:#fef3c7"></i>安定度主導</span><span><i style="background:#ccfbf1"></i>伸臂強度主導</span><span><i style="background:#fecaca;border:2px solid #dc2626"></i>不可作業（荷重降至 0）</span><span><i style="background:#f1f5f9"></i>原廠/原吊升荷重限制</span><span><i style="background:#ede9fe"></i>遞減修正</span><span>小字＝原廠值／強度上限／安定度上限</span><span>斜線＝小於最小作業半徑（伸臂長 × cos θm，θm 見 S2-6），伸臂無法到達</span></div>
    <div class="chart-wrap"><table class="load-table compact">
      <thead><tr><th>半徑(m) ＼ 伸臂(m)</th>${r.booms.map(b => `<th>${b}</th>`).join('')}</tr></thead>
      <tbody>${r.radii.map((rad, ri) => `<tr><th>${rad}</th>${r.booms.map((_, ci) => { const x = r.cells[ri][ci];
        if (!x || (!x.text && !x.isSlash)) return '<td></td>';
        if (x.isSlash) return '<td class="diagonal-slash-cell"></td>';
        const sub = [x.origVal != null ? '原 ' + x.origVal : '', isFinite(x.str) ? '強 ' + Math.floor(x.str) : '', isFinite(x.stab) ? '穩 ' + Math.floor(x.stab) : (x.stab === Infinity ? '穩 ∞' : '')].filter(Boolean).join(' ‧ ');
        return `<td class="g-${x.gov}${x.dead ? ' dead' : ''}" title="SF=${isFinite(x.sf) ? x.sf.toFixed(3) : '∞'}">${esc(x.text)}<span class="o">${sub}</span></td>`; }).join('')}</tr>`).join('')}</tbody>
    </table></div>
    <div class="btn-row" style="margin-top:12px">
      <a class="btn btn-primary" href="#case=${cur.id}&p=step5">下一步：S5 申請文件資料 →</a>
    </div>
  </div>`;
  if (r.unstableCount && cur._unstableWarned !== cur.result.sig) {
    cur._unstableWarned = cur.result.sig; touch();
    setTimeout(() => alert(`⚠ 新荷重表中有 ${r.unstableCount} 格「不可作業」\n\n伸臂強度不足 ${r.deadStr || 0} 格、安定度不足 ${r.deadStab || 0} 格，允許荷重已降至 0。\n申請資料之荷重表會標示該作業半徑不可作業。${r.deadStab ? '\n安定度不足表示車輛重量或外伸撐座寬度不足，建議改用較大的車輛。' : ''}`), 50);
  }
  renderNav();
}
/* 鋼索吊鉤計算書之額定荷重須等於 S4 結果（新荷重表最大值 − 吊具重量） */
function ropeHookSyncInfo(c) {
  const d = Store.subGet(c.id, 'crane3t_rope_hook_calc'), r = c.result && c.result.ok ? c.result : null;
  const rated = r ? Math.max(0, r.maxVal - N(Calc.effective(c).vals.Wh)) : NaN;
  const wire = N(d && d.wire && d.wire.Wrated), hook = N(d && d.hook && d.hook.Q);
  return { has: !!d, r, rated, wire, hook, ok: !!(d && r && Math.abs(wire - rated) < 0.5 && Math.abs(hook - rated) < 0.5) };
}
const ropeHookSynced = (c) => ropeHookSyncInfo(c).ok;
function inputSig(c) { return JSON.stringify([c.hasChart, c.platform, c.boom, c.stab, c.vehicle.wheelbase_cm, c.vehicle.empty_weight_kg, c.vehicle.height_cm, c.vehicle.front_track_cm, c.vehicle.rear_track_cm, c.crane.orig_capacity_t, c.origChart, Store.subGet(c.id, 'boomStrength_limits')]); }
/* S4 伸臂強度上限：S3 計算有效時才提供 */
Calc.setStrength((c) => { const b = Store.subGet(c.id, 'boomStrength_result'); return b && b.valid ? Store.subGet(c.id, 'boomStrength_limits') : null; });

/* ============================================================
   套用到申請文件：S1～S6 → 各文件頁面的儲存資料
   套用前申請文件不顯示；套用後使用者可在各文件頁面調整，
   再次套用時，S1～S6 擁有的欄位以 S1～S6 為準，其他欄位保留。
   ============================================================ */
function applyToDocs() {
  if (saveTimer) flush();
  if (!readyToApply()) return alert('請先完成 S1～S5（左側皆標示「完成」）再套用。');
  const r = computeResult();
  if (!r.ok) return alert('S4 尚無法計算：\n' + r.miss.join('\n'));
  const miss5 = s5Missing(cur, curFiles);
  const msg = (cur.appliedAt
      ? '重新套用會以 S1～S6 的資料覆蓋各申請文件中的對應欄位（您在文件上修改過的這些欄位會被取代，其他欄位保留）。\n'
      : '將以 S1～S6 的資料產生各份申請文件（申請書、明細表、照片標註、伸臂強度／鋼索吊鉤／安定度計算書、荷重表、自行檢查紀錄）。\n')
    + (miss5.length ? '\n⚠ S6 尚缺：' + miss5.join('、') + '（可之後補上傳）\n' : '') + '\n確定套用？';
  if (!confirm(msg)) return;
  const res = cur.result, id = cur.id, c = cur;
  // 荷重表
  Store.subSet(id, 'crane_load_chart_data', {
    docTitle: '吊升荷重表', unit: 'kg',
    notes: `本性能表只限用於外撐伸座最大張出之側及後方。表列為吊升荷重（含吊具 ${Calc.effective(c).vals.Wh} kg），各值均經伸臂強度及安定度檢核。`
      + (res.cells.some(row => row.some(x => x && x.gov === 'stab' && x.val > 0)) ? '灰底斜體之數值由安定度決定。' : '')
      + (res.unstableCount ? '表中標示「不可作業」之作業半徑，因伸臂強度或安定度不足，不得作業。' : ''),
    booms: res.booms.map(String), ropes: res.booms.map((_, i) => (c.origChart.ropes || [])[i] || ''),
    radiuses: res.radii.map(String),
    cells: res.cells.map(row => row.map(x => ({ text: x ? x.text || '' : '', isSlash: !!(x && x.isSlash), dead: !!(x && x.dead), stab: !!(x && x.gov === 'stab') })))
  });
  // 安定度計算
  const rows = [];
  res.booms.forEach((b, ci) => res.radii.forEach((_, ri) => { const x = res.cells[ri][ci]; if (x && x.val > 0) rows.push({ L: x.L, Wa: x.val, r: Math.round(x.r * 10000) / 100 }); }));
  const P = res.params;
  Store.subSet(id, '安定度計算_state_v2', {
    params: { Wb: P.Wb, Wf: P.Wf, Wh: P.Wh, B1: isFinite(P.B1) ? P.B1 : '', B2: isFinite(P.B2) ? P.B2 : '', H: isFinite(P.H) ? P.H : '', h: N(c.vehicle.height_cm) || '',
      Lw: P.Lw, thetaM: P.thetaM, S: isFinite(P.S) ? P.S : '', h1: isFinite(P.h1) ? P.h1 : '', h2: isFinite(P.h2) ? P.h2 : '', h3: isFinite(P.h3) ? P.h3 : '', h4: isFinite(P.h4) ? P.h4 : '' },
    boom: { lengths: res.boom.lengths, segW: res.boom.segW, cylW: res.boom.cylW },
    rows
  });
  // 伸臂強度計算書：表頭帶入起重機資料與日期
  const bs = Store.subGet(id, 'boomStrengthCalc.v1');
  if (bs && bs.project) {
    bs.project.title = c.crane.type || '積載型起重機';   // 不含廠牌
    bs.project.no = '';
    if (!bs.project.model) bs.project.model = c.crane.model || '';
    bs.project.date = new Date().toLocaleDateString('sv-SE');   // 本地日期 YYYY-MM-DD
    Store.subSet(id, 'boomStrengthCalc.v1', bs);
  }
  seedPhotoAnnotations(c);
  writePhotoDefaults(c);
  syncDocs(c);
  cur.appliedAt = new Date().toISOString();
  cur.needReapply = false;
  flush();
  renderCase(parseHash().page);
  refreshRopeHookResult();
  alert('已套用。左側「申請文件」已可逐份檢視、調整。');
}

/* 套用後在背景載入鋼索吊鉤計算書，讓它依新資料重新計算並記錄「合格」判定 */
function refreshRopeHookResult() {
  const id = cur.id, fr = document.createElement('iframe');
  fr.style.cssText = 'position:fixed;left:-20000px;top:0;width:1000px;height:800px;border:0;';
  fr.src = '鋼索吊鉤計算/鋼索吊鉤計算.html?case=' + encodeURIComponent(id) + '&v=' + SUB_VER;
  fr.onload = () => setTimeout(() => {
    try { if (typeof fr.contentWindow.saveData === 'function') fr.contentWindow.saveData(); } catch (e) {}
    setTimeout(() => { fr.remove(); if (cur && cur.id === id) { renderNav(); if (parseHash().page === 'overview') renderCase('overview'); } }, 300);
  }, 1200);
  document.body.appendChild(fr);
}
/* 照片標註頁：尺寸取自 S2（撐座寬度、前輪至旋轉中心、軸距、伸臂各節長度），標註點位置保留 */
/* 標註工具的預設尺寸（mm）：撐座寬度、前輪至旋轉中心、軸距、伸臂各節長度 */
function writePhotoDefaults(c) {
  const EV = Calc.effective(c).vals, st = (c.boom.stages_m || []).map(N).filter(x => x > 0);
  Store.subSet(c.id, 'photo_defaults', {
    w: N(c.stab.Lw) > 0 ? Math.round(N(c.stab.Lw) * 10) : null,
    s: N(EV.S) > 0 ? Math.round(N(EV.S) * 10) : null,
    wb: N(c.vehicle.wheelbase_cm) > 0 ? Math.round(N(c.vehicle.wheelbase_cm) * 10) : null,
    sections: st.map((L, i) => Math.round((L - (i ? st[i - 1] : 0)) * 1000))
  });
}
function seedPhotoAnnotations(c, onlyIfNew) {
  const EV = Calc.effective(c).vals;
  if (onlyIfNew && Store.subGet(c.id, 'crane_photo_annotations')) return;
  const ph = Store.subGet(c.id, 'crane_photo_annotations') || {};
  ph.front = Object.assign({}, ph.front); ph.side = Object.assign({}, ph.side); ph.boom = Object.assign({}, ph.boom);
  if (N(c.stab.Lw) > 0) ph.front.width = String(Math.round(N(c.stab.Lw) * 10));
  if (N(EV.S) > 0) ph.side.frontToCenter = String(Math.round(N(EV.S) * 10));
  if (N(c.vehicle.wheelbase_cm) > 0) ph.side.wheelbase = String(Math.round(N(c.vehicle.wheelbase_cm) * 10));
  const st = (c.boom.stages_m || []).map(N).filter(x => x > 0);
  if (st.length) {
    ph.boom.sections = st.map((L, i) => ({ id: i + 1, name: `第 ${i + 1} 節`, length: Math.round((L - (i ? st[i - 1] : 0)) * 1000), note: i ? '伸縮臂' : '基本臂' }));
    ph.boom.retracted = String(Math.round(st[0] * 1000));
  }
  ph.savedAt = new Date().toISOString();
  Store.subSet(c.id, 'crane_photo_annotations', ph);
}

/* 將 S1～S5 的資料寫入各文件頁面（只在「套用」時執行） */
function syncDocs(c) {
  const id = c.id, r = c.result && c.result.ok ? c.result : null, D = c.docs || {};
  const ok = (v) => v !== '' && v != null && !(typeof v === 'number' && !isFinite(v));
  const EV = Calc.effective(c).vals, Wh = EV.Wh, thetaM = EV.thetaM;
  const craneType = c.crane.type || '積載型起重機';
  const craneDesc = [craneType, c.crane.maker, c.crane.model].filter(Boolean).join(' ');
  const stages = (c.boom.stages_m || []).map(N).filter(x => x > 0);
  const roc = () => { const d = new Date(); return `${d.getFullYear() - 1911} 年 ${String(d.getMonth() + 1).padStart(2, '0')} 月 ${String(d.getDate()).padStart(2, '0')} 日`; };
  let maxR = 0; if (r) r.cells.forEach(row => row.forEach(x => { if (x && x.val > 0 && x.r > maxR) maxR = x.r; }));

  // 申請書
  const ap = Store.subGet(id, 'apply_form_draft') || {}; ap.values = ap.values || {}; ap.checked = ap.checked || {};
  const A = (k, v, force = true) => { if (ok(v) && (force || !ap.values[k])) ap.values[k] = String(v); };
  A('machineType', 'm2'); A('type_model', craneType);
  if (c.site && c.site.county) { A('addr_county', c.site.county); A('addr_district', c.site.district); ap.values.addr_detail = c.site.detail || ''; A('address', siteAddress(c)); }
  A('company', c.company.name); A('tax_id', c.company.tax_id); A('contact', c.company.contact); A('mobile', c.company.mobile); A('tel', c.company.tel);
  A('fax', D.fax); A('maintenance_comp', D.maint_comp); A('maintenance_contact', D.maint_contact); A('maintenance_tel', D.maint_tel); A('note', D.note);
  A('mail_address', D.mail_address || c.company.address); A('receipt_title', D.receipt_title || c.company.name); A('receipt_address', D.receipt_address || c.company.address);
  const rd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(D.req_date || '');
  if (rd) { A('req_y', +rd[1] - 1911); A('req_m', +rd[2]); A('req_d', +rd[3]); }
  A('fee', (c.fee && c.fee.amount) || '2640');
  if (r) A('load', r.liftT.toFixed(2));
  ap.checked.t4 = true;
  Store.subSet(id, 'apply_form_draft', ap);

  // 鋼索／吊鉤計算書
  const rhd = Store.subGet(id, 'crane3t_rope_hook_calc') || {};
  rhd.hook = rhd.hook || {}; rhd.wire = rhd.wire || {};
  if (ok(c.company.name)) rhd.applicant = c.company.name;
  rhd.craneModel = craneDesc; if (ok(c.vehicle.plate)) rhd.plateNo = c.vehicle.plate;
  if (Wh > 0) rhd.wire.Whook = Wh;
  const num = (v) => N(v) > 0 ? N(v) : undefined;
  [['d', D.hook_d], ['B1', D.hook_B1], ['b1', D.hook_b1], ['h1', D.hook_h1], ['B2', D.hook_B2], ['b2', D.hook_b2], ['h2', D.hook_h2]].forEach(([k, v]) => { if (num(v) !== undefined) rhd.hook[k] = num(v); });
  if (num(D.rope_d) !== undefined) rhd.wire.d = num(D.rope_d);
  if (ropeBreakKg(D) > 0) rhd.wire.Pbreak = ropeBreakKg(D);
  if (num(D.rope_n) !== undefined) rhd.wire.n = num(D.rope_n);
  if (ok(D.rope_type)) rhd.wire.type = D.rope_type;
  if (r) { const rated = Math.max(0, r.maxVal - Wh); rhd.hook.Q = rated; rhd.wire.Wrated = rated; }
  // 吊鉤尺寸 mm；無材質證明：抗拉強度取 45 kg/mm²（4500 kg/cm²）
  rhd.hook.mat = 'NOCERT:45'; rhd.hook.sigmat = 45; rhd.hook.unit = 'mm';
  Store.subSet(id, 'crane3t_rope_hook_calc', rhd);
  Store.subSet(id, 'crane3t_rope_hook_result', null);   // 開啟計算書時重新判定

  // 明細表
  const spec = Store.subGet(id, 'crane_form_draft') || {};
  const S = (k, v, force = true) => { if (ok(v) && (force || !spec[k])) spec[k] = v; };
  S('company_name', c.company.name); S('company_address', c.company.address); S('industry_type', c.company.industry);
  S('owner_name', c.company.owner); S('company_tel', c.company.tel); S('contact_tel', c.company.mobile);
  S('install_address', siteAddress(c));
  S('crane_model_type', craneType);
  S('carrier_info', [c.vehicle.make, c.vehicle.model].filter(Boolean).join(' '));
  S('mfg_company', c.crane.maker); S('mfg_serial', c.crane.serial);
  const ym = /^(\d{4})-(\d{1,2})/.exec(c.crane.mfg_year || '');
  if (ym) { spec.mfg_year = +ym[1] - 1911; spec.mfg_month = +ym[2]; } else S('mfg_year', c.crane.mfg_year);
  delete spec.mfg_day;
  S('outrigger', '有'); S('travel_device', '輪胎式', false);
  S('speed_hoist', D.speed_hoist); S('speed_luff', D.speed_luff); S('speed_slew', D.speed_slew);
  S('boom_angle_min', D.angle_min); if (thetaM > 0) S('boom_angle_max', thetaM); S('rotation_limit', D.rotation_limit);
  S('engine_purpose', D.engine_purpose); S('engine_type', D.engine_type); S('engine_power', D.engine_power);
  ['safe_overhoist', 'safe_hook_latch', 'safe_overload', 'safe_hydraulic_valves', 'safe_boom_backstop', 'safe_angle_indicator', 'safe_wire_slack', 'safe_other'].forEach(k => S(k, D[k]));
  if (String(D.brakes || '').trim()) { spec.brake_types = String(D.brakes).trim(); delete spec.brake_type_1; delete spec.brake_type_2; }
  S('drum_dia', D.drum_dia); S('sheave_dia', D.sheave_dia);
  S('drum_purpose', '主捲揚用', false); S('sheave_purpose', '臂端導輪', false);
  if (spec.luff_wire_struct === '油壓缸起伏') spec.luff_wire_struct = '';   // 起伏用無鋼索，預設空白
  if (Wh > 0) S('hook_weight', (Wh / 1000).toFixed(3));
  if (N(D.hook_opening) > 0) S('hook_opening', N(D.hook_opening));
  if (stages.length) S('max_boom_length', stages[stages.length - 1]);
  S('main_wire_struct', D.rope_type); if (N(D.rope_d) > 0) S('main_wire_dia', D.rope_d);
  if (r) {
    S('lifting_capacity', r.liftT.toFixed(2));
    for (let i = 1; i <= 9; i++) { spec['boom_len_' + i] = ''; spec['radius_' + i] = ''; spec['load_' + i] = ''; }
    r.booms.slice(0, 9).forEach((b, ci) => {
      let best = null; r.radii.forEach((_, ri) => { const x = r.cells[ri][ci]; if (x && x.val > 0 && (!best || x.val >= best.val)) best = x; });
      spec['boom_len_' + (ci + 1)] = b;
      if (best) { spec['radius_' + (ci + 1)] = best.r; spec['load_' + (ci + 1)] = Math.max(0, (best.val - Wh) / 1000).toFixed(2); }
    });
    S('max_working_radius', maxR);
  }
  // 備註：車籍與搭乘設備資料、旋轉限度
  spec.remarks = [
    '型式：' + (c.vehicle.model || ''),
    '牌照號碼：' + (c.vehicle.plate || ''),
    '引擎號碼：' + (c.vehicle.engine_no || ''),
    '搭乘設備編號：' + (c.platform.no || ''),
    '作業旋轉限度以車頭為0度僅限使用於 90~270度之作業範圍內'
  ].join('\n');
  Store.subSet(id, 'crane_form_draft', spec);

  // 自行檢查紀錄（檢查結果由使用者在文件上點選）
  const sc = Store.subGet(id, 'crane_self_inspection_record_draft') || { inputs: { inspector_date: roc(), unit_date: roc(), owner_date: roc() }, checkboxes: {}, results: {} };
  sc.inputs = sc.inputs || {};
  const I = (k, v) => { if (ok(v)) sc.inputs[k] = String(v); };
  I('company_name', c.company.name); I('company_address', c.company.address); I('machine_type', craneDesc);
  if (stages.length) I('dim_main_boom_len', stages[stages.length - 1]);
  I('dim_angle_min', D.angle_min); if (thetaM > 0) I('dim_angle_max', thetaM); I('dim_rotate_limit', D.rotation_limit);
  if (maxR) I('dim_max_radius', maxR);
  if (Wh > 0) I('hook_weight', (Wh / 1000).toFixed(3));
  I('drum_dia', D.drum_dia); I('sheave_dia', D.sheave_dia); I('rope_main_nom_dia', D.rope_d);
  I('speed_hoist', D.speed_hoist); I('speed_rotate', D.speed_slew);
  if (N(D.speed_luff) > 0) I('speed_derrick', Math.round(N(D.speed_luff) * 60 * 10) / 10);   // 明細表 度/sec → 自行檢查紀錄 度/min
  // 積載型不適用之項目（履帶部、桁架腳架、車輪阻擋器等）預帶「/」
  sc.results = sc.results || {};
  ['res_1_6_1', 'res_1_6_2', 'res_1_6_3', 'res_1_7_1', 'res_1_7_2', 'res_7_1_1', 'res_7_1_2', 'res_6_4_2', 'res_3_2_1', 'res_3_2_2', 'res_5_2_1', 'res_5_2_2'].forEach(k => { if (!sc.results[k]) sc.results[k] = '/'; });
  // 額定輸出（cc）：取 S5 原動機額定輸出中的數字（AI 由車主聯排氣量帶入）
  const pw = String(D.engine_power || ''); if (/cc/i.test(pw) || /^\s*[\d.]+\s*$/.test(pw)) I('engine_power', pw.replace(/[^\d.]/g, ''));
  // 吊鉤尺寸（S5-4）與開口標距，單位 mm
  const mm = (v) => N(v) > 0 ? N(v) + ' mm' : '';
  I('hook_b1', mm(D.hook_B1)); I('hook_h1', mm(D.hook_h1)); I('hook_b3', mm(D.hook_B2)); I('hook_h2', mm(D.hook_h2));
  if (N(D.hook_opening) > 0) I('hook_opening', N(D.hook_opening) + ' mm');
  if (r) {
    I('hoisting_capacity', r.liftT.toFixed(2));
    // 荷重試驗：取新荷重表作業半徑最遠的一點，額定荷重（扣除吊具）÷ 1.25
    let far = null;
    r.cells.forEach(row => row.forEach(x => { if (x && x.val > 0 && (!far || x.r > far.r || (x.r === far.r && x.L > far.L))) far = x; }));
    if (far) {
      I('load_test_main_t', (Math.max(0, far.val - Wh) / 1000 / 1.25).toFixed(3));
      I('load_test_boom_len1', Math.round(far.L) / 100); I('load_test_radius1', far.r);
    }
  }
  Store.subSet(id, 'crane_self_inspection_record_draft', sc);
}

/* ---------------- S5：申請文件資料 ---------------- */
const DOC_PRESET = Store.DOC_PRESET;
/* 鋼索破斷荷重採計算值：P = d² ／ 20（公噸，d 為鋼索直徑 mm） */
const ropeBreakT = (D) => { const d = N(D.rope_d); return d > 0 ? Math.round(d * d / 20 * 1000) / 1000 : NaN; };
/* 標準破斷荷重換算 kg（1 kgf = 9.80665 N；1 lb = 0.45359237 kg；1 ton = 1000 kg） */
const ROPE_UNIT = { kg: 1, N: 1 / 9.80665, lb: 0.45359237, ton: 1000 };
const ropeStdKg = (D) => { const v = N(D.rope_pbreak), k = ROPE_UNIT[D.rope_pbreak_unit || 'kg']; return v > 0 && k ? Math.round(v * k * 10) / 10 : NaN; };
const ropeBreakKg = (D) => D.rope_nocert ? (ropeBreakT(D) > 0 ? Math.round(ropeBreakT(D) * 1000 * 10) / 10 : NaN) : ropeStdKg(D);
function ropeBreakText(D) {
  const d = N(D.rope_d), t = ropeBreakT(D);
  if (D.rope_nocert) return t > 0 ? `無材證：${d}² ／ 20 ＝ <b>${t} 公噸</b>（${ropeBreakKg(D)} kg），計算書採用此值` : '請先填鋼索直徑';
  const kg = ropeStdKg(D);
  return kg > 0 ? `標準破斷荷重 ${N(D.rope_pbreak)} ${D.rope_pbreak_unit || 'kg'} ＝ <b>${kg.toLocaleString('en-US')} kg</b>，計算書採用此值` : '<span style="color:var(--ng)">請填寫標準破斷荷重</span>';
}
function pStep5(pane) {
  const YN = [['有', '有'], ['無', '無']];
  const miss = s4Missing(cur);
  const r = cur.result && cur.result.ok ? cur.result : null;
  pane.innerHTML = `
  <div class="card">
    <h2>S5　申請文件資料</h2>
    <div class="callout info">這裡集中填寫各份申請文件需要、但 S1～S4 沒有的資料。按左側「套用到申請文件」後，會自動帶入申請書、明細表、鋼索吊鉤計算書與自行檢查紀錄；套用後仍可在各文件上直接修改。
      ${miss.length ? `<br><b style="color:var(--ng)">尚缺必填：</b>${esc(miss.join('、'))}` : '<br><b style="color:var(--ok)">必填欄位已完成。</b>'}</div>
  </div>
  <div class="card">
    <h2>S5-1　檢查申請書</h2>
    <div class="fgrid">
      ${F('docs.req_date', '希望受檢日期（選填）', { type: 'date' })}
      ${F('docs.mail_address', '檢查通知寄達地址（選填）', { ph: cur.company.address || '空白＝事業單位地址' })}
      ${F('docs.fax', '傳真（選填）')}
      ${F('docs.maint_comp', '機具保養廠商（選填）')}${F('docs.maint_contact', '保養廠商連絡人（選填）')}${F('docs.maint_tel', '保養廠商電話（選填）')}
      ${F('docs.receipt_title', '收據抬頭（選填）', { ph: cur.company.name || '空白＝事業單位名稱' })}
      ${F('docs.receipt_address', '收據寄發地址（選填）', { ph: cur.company.address || '空白＝事業單位地址' })}
      ${F('docs.note', '備註（選填）')}
    </div>
    <h3>檢查規費</h3>
    <div class="fgrid">
      ${F('fee.amount', '檢查費金額', { unit: '元', num: true, hint: '預設 2,640 元' })}
    </div>
    ${(() => { const ag = TW_ZIP.agencyFor(cur.site.county); return `<div class="callout info" style="margin-top:10px">
      1. 檢查費以<b>郵局匯票</b>、<b>即期支票</b>（寄發申請當天之票期）郵寄至所屬代檢機構${ag ? `：<b>${esc(ag.name)}</b>（${esc(ag.address)}，電話 ${esc(ag.tel)}）` : '（依 S2-1 受檢地點判定）'}。<br>
      2. 支票、匯票受款人請以正楷書寫：<b>勞動部職業安全衛生署</b>。</div>`; })()}
  </div>
  <div class="card">
    <h2>S5-2　明細表規格（依原廠說明書或銘牌）</h2>
    <div class="fgrid">
      ${F('docs.speed_hoist', '額定速率－捲揚', { unit: 'm/min', num: true, ph: '例：15' })}${F('docs.speed_luff', '額定速率－起伏', { ph: '例：1~76度/7sec', hint: '依說明書照填（含單位），例：1~76度/7sec' })}
      ${F('docs.speed_slew', '額定速率－旋轉', { unit: 'rpm', num: true, preset: DOC_PRESET.speed_slew, ph: '例：2.5' })}
      ${F('docs.angle_min', '伸臂傾斜角範圍（下限）', { unit: '度', num: true, preset: DOC_PRESET.angle_min, ph: '例：0', hint: '依型錄；未標示時為 0 度' })}
      ${F('stab.thetaM', '伸臂傾斜角範圍（上限）', { unit: '度', num: true, ph: '例：76', hint: '依型錄；未標示時為 76 度（與 S2-6 θm 相同）' })}
      ${F('docs.rotation_limit', '旋轉限度', { unit: '度', num: true, preset: DOC_PRESET.rotation_limit, ph: '例：360' })}
      ${F('docs.engine_purpose', '原動機用途', { preset: DOC_PRESET.engine_purpose, ph: '例：走行/起重' })}${F('docs.engine_type', '原動機種類', { preset: DOC_PRESET.engine_type, ph: '例：柴油引擎' })}
      ${F('docs.engine_power', '原動機額定輸出', { ph: '例：2999 cc 或 150 PS', hint: 'AI 解析車主聯時自動帶入排氣量（cc）' })}
      ${F('docs.drum_dia', '捲胴節徑', { unit: 'mm', num: true, preset: DOC_PRESET.drum_dia, ph: '例：160' })}${F('docs.sheave_dia', '槽輪節徑', { unit: 'mm', num: true, preset: DOC_PRESET.sheave_dia, ph: '例：160' })}
    </div>
    ${F('docs.brakes', '制動裝置之種類及用途（可多行）', { type: 'textarea', rows: 3, preset: DOC_PRESET.brakes, ph: '例：捲揚、旋轉用－油壓制動煞車\n起伏、伸縮用－油壓缸行程逆止閥' })}
    <h3>安全裝置</h3>
    <div class="fgrid">
      ${F('docs.safe_overhoist', '過捲預防裝置', { type: 'select', options: YN, preset: DOC_PRESET.safe_overhoist })}${F('docs.safe_hook_latch', '吊鉤防脫裝置', { type: 'select', options: YN, preset: DOC_PRESET.safe_hook_latch })}
      ${F('docs.safe_overload', '過負荷預防裝置', { type: 'select', options: YN, preset: DOC_PRESET.safe_overload })}${F('docs.safe_hydraulic_valves', '油壓安全閥／逆止閥', { type: 'select', options: YN, preset: DOC_PRESET.safe_hydraulic_valves })}
      ${F('docs.safe_boom_backstop', '伸臂後傾防止裝置', { type: 'select', options: YN, preset: DOC_PRESET.safe_boom_backstop })}${F('docs.safe_angle_indicator', '傾斜角指示裝置', { type: 'select', options: YN, preset: DOC_PRESET.safe_angle_indicator })}
      ${F('docs.safe_wire_slack', '鋼索鬆弛防止裝置', { type: 'select', options: YN, preset: DOC_PRESET.safe_wire_slack })}
    </div>
    ${F('docs.safe_other', '其他安全裝置', { type: 'textarea' })}
  </div>
  <div class="card">
    <h2>S5-3　捲揚鋼索（依鋼索材質證明）</h2>
    <div class="fgrid">
      ${F('docs.rope_type', '鋼索構成規格', { preset: DOC_PRESET.rope_type, hint: '預帶常用規格，請依實際鋼索修正' })}
      ${F('docs.rope_d', '鋼索直徑', { unit: 'mm', num: true, req: true, hint: '依鋼索材質證明或實測' })}
      ${cur.docs.rope_nocert ? '' : `<label class="field"><span>標準破斷荷重 <b class="req">*</b></span>
        <div class="unit-in"><input data-k="docs.rope_pbreak" inputmode="decimal" value="${esc(cur.docs.rope_pbreak || '')}" class="${N(cur.docs.rope_pbreak) > 0 ? '' : 'missing'}">
          <select data-k="docs.rope_pbreak_unit" class="unit-sel">${['kg', 'N', 'lb', 'ton'].map(u => `<option ${(cur.docs.rope_pbreak_unit || 'kg') === u ? 'selected' : ''}>${u}</option>`).join('')}</select></div>
        <small style="color:#b45309">⚠ 請填材質證明上之<b>標準破斷荷重</b>（規格最低保證值），<b>不可填極限（實測）破斷荷重</b>。</small></label>`}
      <div class="field"><span>計算書採用之破斷荷重</span>
        <div class="calc-out" id="pbConv">${ropeBreakText(cur.docs)}</div></div>
      ${F('docs.rope_n', '鋼索掛數', { unit: '掛', num: true, req: true, preset: DOC_PRESET.rope_n, hint: '預帶 4 掛，請依吊鉤滑車組實際掛數修正' })}
    </div>
    <label class="agree-row" style="margin:8px 0 0"><input type="checkbox" data-k="docs.rope_nocert" ${cur.docs.rope_nocert ? 'checked' : ''}> 無鋼索材質證明（選填）：改以最低強度 d²／20（公噸）估算破斷荷重</label>
    <p class="hint">原廠計算之吊升荷重較大，以最低強度估算多半無法通過安全係數檢核，建議依材質證明填寫標準破斷荷重。</p>
    ${r ? `<p class="hint">鋼索額定荷重將以 S4 最大荷重 ${r.maxVal} kg − 吊具 ${Calc.effective(cur).vals.Wh} kg 計算安全係數（須 ≧ 5.0）。</p>` : ''}
  </div>
  <div class="card">
    <h2>S5-4　吊鉤尺寸（實測，單位 mm）</h2>
    <p class="hint">吊鉤無材質證明：強度計算書之抗拉強度 σt 取 <b>45 kg/mm²</b>（4500 kg/cm²），並於計算書註明「無材證」。</p>
    <p class="hint">📹 量測方式說明影片：<a href="https://www.youtube.com/shorts/iyj4gM8qpmQ" target="_blank" rel="noopener">https://www.youtube.com/shorts/iyj4gM8qpmQ</a></p>
    <div class="hook-imgs"><img src="鋼索吊鉤計算/img/hook_main.png" alt="吊鉤尺寸示意"><img src="鋼索吊鉤計算/img/hook_sec1.png" alt="第一剖面"><img src="鋼索吊鉤計算/img/hook_sec2.png" alt="第二剖面"></div>
    <div class="fgrid">
      ${F('docs.hook_opening', '吊鉤開口標距', { unit: 'mm', num: true, hint: '帶入明細表「吊鉤開口度」及自行檢查紀錄「開口標距」' })}
      ${F('docs.hook_d', '吊鉤開口直徑 d', { unit: 'mm', num: true, req: true })}
      ${F('docs.hook_B1', '第 I 剖面 B1', { unit: 'mm', num: true, req: true })}${F('docs.hook_b1', '第 I 剖面 b1', { unit: 'mm', num: true, req: true })}${F('docs.hook_h1', '第 I 剖面 h1', { unit: 'mm', num: true, req: true })}
      ${F('docs.hook_B2', '第 II 剖面 B2', { unit: 'mm', num: true, req: true })}${F('docs.hook_b2', '第 II 剖面 b2', { unit: 'mm', num: true, req: true })}${F('docs.hook_h2', '第 II 剖面 h2', { unit: 'mm', num: true, req: true })}
    </div>
  </div>
  <div class="btn-row"><a class="btn btn-primary" href="#case=${cur.id}&p=step6">下一步：S6 照片與證明文件上傳 →</a></div>`;
  bind(pane, (p) => {
    if (p === 'docs.rope_nocert') { flush(); const y = window.scrollY; pStep5(pane); window.scrollTo(0, y); renderNav(); return; }
    if (/^docs\.rope_(d|pbreak|pbreak_unit)$/.test(p)) $('#pbConv', pane).innerHTML = ropeBreakText(cur.docs);
    renderNav();
  });
}

/* ---------------- 照片標註（頁內視窗，與申請文件「3. 照片標註」同一份資料） ---------------- */
function openPhotoEditor(step, after) {
  flush();
  writePhotoDefaults(cur);   // 標註文字依 S2 尺寸產生
  const m = $('#photoModal');
  $('#photoFrame').src = '照片/annotate.html?case=' + encodeURIComponent(cur.id) + '&step=' + step + '&v=' + SUB_VER;
  $('#photoModalTitle').textContent = '照片尺寸標註（正面照／側面照／伸臂全伸照）';
  let done = false;
  const finish = async () => { if (done) return; done = true; if (m.open) m.close(); $('#photoFrame').src = 'about:blank'; await refreshFiles(); after && after(); renderNav(); };
  $('#btnPhotoDone').onclick = finish;
  m.onclose = finish;
  m.showModal();
}
function openPreview(f) {
  $('#previewTitle').textContent = f.name || '';
  $('#previewBody').innerHTML = f.type === 'application/pdf' ? `<iframe src="${f.dataUrl}"></iframe>` : `<img src="${f.dataUrl}" alt="">`;
  $('#previewModal').showModal();
}

/* ---------------- S6：照片與證明文件上傳 ---------------- */
/* 伸臂各節長度表（取自 S1-3，列於 3. 組配圖） */
function boomTableHtml() {
  const st = (cur.boom.stages_m || []).map(N).filter(x => x > 0);
  if (!st.length) return '<p class="hint">伸臂各節長度：請先於 S1-3 建立荷重性能表或填寫伸臂各段長度。</p>';
  const r2 = (v) => Math.round(v * 100) / 100;
  return `<h3>伸臂各節長度表</h3>
    <table class="check-table boom-len-table"><tr><th>節</th><th>各節長度 (m)</th><th>伸出至該節之伸臂總長 (m)</th></tr>
    ${st.map((L, i) => `<tr><td>第 ${i + 1} 節${i ? '' : '（基本臂）'}</td><td>${r2(L - (i ? st[i - 1] : 0))}</td><td>${r2(L)}</td></tr>`).join('')}
    <tr><th>合計</th><th>${r2(st[st.length - 1])}</th><th>全伸 ${r2(st[st.length - 1])}</th></tr></table>
    <p class="hint">長度取自 S1-3，列於 PDF「3. 組配圖」。</p>`;
}
function uploadSections(part) {
  const drawing = `
  <div class="card"><h2>3. 組配圖（工程圖）</h2>
    <p class="hint">正面、側面採用工程圖，尺寸自動套印（外伸撐座全伸寬度取自 S2-6 Lw、前輪中心至旋轉中心取自 S2-6 S），不需上傳或調整；修改尺寸請回 S2-6。</p>
    <div class="eng-drawings"><figure><img data-drawing="front" alt="正面工程圖"><figcaption>正面圖－外伸撐座全張</figcaption></figure>
      <figure><img data-drawing="side" alt="側面工程圖"><figcaption>側面圖－前輪與旋轉中心</figcaption></figure></div>
    ${boomTableHtml()}</div>
  <div class="card"><h2>3. 機具照片</h2>
    <p class="hint">機具現場照片可上傳多張，產出 PDF 時依序附上；點縮圖可預覽。</p>
    <div class="uploads">${['sitePhoto', 'hookPhoto'].map(uploadCard).join('')}</div></div>
  <div class="card"><h2>3. 車籍證件</h2><div class="uploads">${['ownerCert', 'license'].map(uploadCard).join('')}</div></div>`;
  const setup = `
  <div class="card"><h2>7. 結構材料材質證明</h2>
    ${cur.docs.rope_nocert ? '<p class="hint">已於 S5-3 勾選「無鋼索材質證明」，破斷荷重採最低強度 d²／20，免附材質證明。</p>' : '<p class="hint">S5-3 填寫之標準破斷荷重須與材質證明一致。</p>'}
    <div class="uploads">${uploadCard('materialCert')}</div></div>
  <div class="card"><h2>8. 設置時間相關證明文件</h2><div class="uploads">${['setupProof', 'platformReport', 'bizReg'].map(uploadCard).join('')}</div></div>
  <div class="card"><h2>其他附件</h2><div class="uploads">${uploadCard('other')}</div></div>`;
  return part === 'drawing' ? drawing : part === 'setup' ? setup : drawing + setup;
}
function pStep6(pane) {
  const miss = s5Missing(cur, curFiles);
  pane.innerHTML = `
  <div class="card">
    <h2>S6　照片與證明文件上傳</h2>
    <div class="callout ${miss.length ? 'warn' : 'ok'}">${miss.length ? '<b>尚缺：</b>' + esc(miss.join('、')) : '所有必要照片與文件皆已上傳。'}<br>
      完成 S1～S5 後，按左側「✅ 套用到申請文件」產生各份文件；照片可之後再補，補上後到申請文件檢視即可。</div>
  </div>
  ${uploadSections('all')}`;
  renderDrawings(pane);
  bindUploads(pane, () => { const y = window.scrollY; pStep6(pane); window.scrollTo(0, y); });
}
/* 申請文件：3. 組配圖照片／8. 設置時間證明（檢視、標註與替換，與 S6 同一份資料） */
function pAttach(pane, part) {
  part = part || 'all';
  const title = part === 'drawing' ? '3. 組配圖或相當圖件（工程圖標註尺寸及照片）' : part === 'setup' ? '7. 材質證明／8. 設置時間相關證明文件' : '照片與證明文件';
  if (!cur.appliedAt) return lockedPane(pane, title);
  pane.innerHTML = `<div class="card"><h2>${esc(title)}</h2>
    <div class="callout info">以下為${part === 'drawing' ? '組配工程圖（尺寸自動套印）與 S6 上傳的照片' : ' S6 上傳的證明文件'}，產出 PDF 時依文件順序附上。照片可直接在此替換或刪除。</div></div>
    ${uploadSections(part)}`;
  renderDrawings(pane);
  bindUploads(pane, () => { const y = window.scrollY; pAttach(pane, part); window.scrollTo(0, y); });
}
function lockedPane(pane, title) {
  pane.innerHTML = `<div class="card"><h2>${esc(title)}</h2>
    <div class="callout warn">申請文件會在完成 S1～S5 並按左側「✅ 套用到申請文件」後產生，之後即可在這裡檢視與修改。</div>
    <a class="btn btn-primary" href="#case=${cur.id}&p=${readyToApply() ? 'step6' : 'step1'}">前往準備步驟</a></div>`;
}

/* ---------------- 內嵌子頁面（申請文件） ---------------- */
/* 鋼索吊鉤計算書狀態說明（標示「進行中」的原因） */
function ropeStatusHtml() {
  const x = Store.subGet(cur.id, 'crane3t_rope_hook_result'), i = ropeHookSyncInfo(cur), why = [];
  if (!i.r) why.push('S4 荷重表反算目前沒有有效結果（請確認 S1～S4 皆為「完成」）');
  else if (!i.ok) why.push(`本計算書之額定荷重 W<sub>rated</sub> ＝ ${i.wire || '—'} kg、吊鉤 Q ＝ ${i.hook || '—'} kg，與 S4 結果不一致（新荷重表最大值 ${i.r.maxVal} kg − 吊具 ${Calc.effective(cur).vals.Wh} kg ＝ <b>${i.rated} kg</b>）`);
  if (x && !x.wireOk) why.push('鋼索安全係數未達 5.0');
  if (x && !x.hookOk) why.push('吊鉤安全係數未達 3.0');
  if (!x) why.push('計算書尚未開啟計算，請稍候或重新整理');
  return why.length ? `<div class="callout warn"><b>本文件標示「進行中」的原因：</b><ul>${why.map(w => `<li>${w}</li>`).join('')}</ul>
    額定荷重須與 S4 一致：S1～S5 完成後按左側「🔄 重新套用到申請文件」即自動更新；請勿直接在計算書修改額定荷重。</div>` : '';
}
function pSub(pane, page) {
  const s = SUBPAGES[page];
  if (!cur.appliedAt) return lockedPane(pane, s.title);
  flush();
  const src = s.src + '?case=' + encodeURIComponent(cur.id) + (s.q || '') + '&v=' + SUB_VER;
  pane.innerHTML = `
    ${cur.needReapply ? `<div class="callout warn">S1～S6 的資料在套用後有變更，本文件尚未更新。按左側「🔄 重新套用到申請文件」可重新帶入。</div>` : ''}
    ${page === 'doc-rope' ? ropeStatusHtml() : ''}
    <div class="frame-wrap">
      <div class="frame-bar"><b>${esc(s.title)}</b>
        <a class="btn btn-outline" href="${src}" target="_blank">↗ 新分頁開啟（列印用）</a></div>
      <div class="callout info" style="margin:8px 12px">${esc(s.tip)}<br>本頁內容於「套用到申請文件」時由 S1～S6 帶入，可直接在此修改並自動儲存。
        S1～S6 修改後，請按左側「🔄 重新套用到申請文件」重新帶入（來自 S1～S6 的欄位以 S1～S6 為準，其他在文件上修改的欄位保留）。</div>
      <iframe class="sub" src="${src}" title="${esc(s.title)}"></iframe>
    </div>`;
}

/* ============================================================
   產出完整申請資料 PDF
   ============================================================ */
const PDF_SECTIONS = [
  ['apply', '1. 檢查申請書'], ['spec', '2. 明細表'], ['drawing', '3. 組配圖（正面／側面工程圖、機具照片、吊鉤、車主聯、行照）'],
  ['calc', '6. 伸臂強度計算書、鋼索吊鉤計算書、安定度計算書、荷重表'], ['material', '7. 鋼索材質證明'], ['setup', '8. 設置時間證明、搭乘設備簽證報告、營利事業登記證'],
  ['selfcheck', '9. 自行檢查紀錄'], ['extra', '附. 其他附件']
];
let pdfUrl = null;
function openPdfModal() {
  const m = $('#pdfModal');
  if (!cur.appliedAt) { alert('請先完成 S1～S5，並按左側「✅ 套用到申請文件」產生申請文件後，再產出 PDF。'); return; }
  const pr = progressOf(cur, curFiles);
  // 以檔案方式（file://）開啟時，瀏覽器禁止讀取子頁面內容，申請書、明細表、各計算書都無法擷取
  const isFile = location.protocol === 'file:';
  $('#pdfBody').innerHTML = `
    ${isFile ? `<div class="callout danger"><b>目前是直接開啟檔案（網址為 ${esc(location.href.split('#')[0])}）</b>，瀏覽器的安全限制會讓申請書、明細表與各計算書無法放進 PDF。<br>
      請改用網站網址開啟；或雙擊資料夾中的「<b>啟動網頁.bat</b>」，以 http://localhost:8767 開啟。<br>
      注意：換網址開啟後看不到原本的申請案，請先在此按「匯出備份」，再到新網址「匯入」。</div>` : ''}
    ${pr.done < pr.total ? `<div class="callout warn">文件尚未全部完成（${pr.done}/${pr.total}）。仍可先產出檢視，未完成項目會在目錄中以紅字標示。</div>` : '<div class="callout ok">所有文件項目皆已完成。</div>'}
    ${cur.needReapply ? '<div class="callout danger">S1～S6 的資料在套用後有變更，申請文件尚未更新；建議先按左側「套用到申請文件」。</div>' : ''}
    <p class="hint">依「文件需求一覽」順序串接：封面＋目錄（含頁次）→ 各文件 → 上傳之附件（PDF 以原頁合併）。頁數多時約需 1–3 分鐘，請勿關閉網頁。</p>
    <div style="display:grid;gap:4px;margin:8px 0">${PDF_SECTIONS.map(([k, l]) => `<label class="agree-row" style="margin:0;font-weight:500"><input type="checkbox" data-sec="${k}" checked> ${l}</label>`).join('')}</div>
    <div id="pdfLog" class="pdf-log"></div>`;
  $('#btnPdfGo').disabled = false; $('#btnPdfGo').style.display = ''; $('#btnPdfGo').textContent = '開始產出';
  $('#btnPdfOpen').style.display = 'none'; $('#btnPdfSave').style.display = 'none';
  m.showModal();
}
$('#btnPdfClose').addEventListener('click', () => $('#pdfModal').close());
$('#btnPdfGo').addEventListener('click', async () => {
  const sections = {}; $$('#pdfBody [data-sec]').forEach(el => sections[el.dataset.sec] = el.checked);
  const logEl = $('#pdfLog'); const log = (m) => { logEl.insertAdjacentHTML('beforeend', `<div>${esc(m)}</div>`); logEl.scrollTop = logEl.scrollHeight; };
  // 產出期間隱藏「開始產出」、鎖定勾選項，避免重複點擊
  $('#btnPdfGo').disabled = true; $('#btnPdfGo').style.display = 'none';
  $('#btnPdfOpen').style.display = 'none'; $('#btnPdfSave').style.display = 'none';
  $$('#pdfBody [data-sec]').forEach(el => el.disabled = true);
  logEl.innerHTML = '';
  try {
    flush(); await refreshFiles();
    const { blob, pages } = await PdfExport.build(cur, curFiles, { sections }, log);
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    pdfUrl = URL.createObjectURL(blob);
    const name = `檢查申請資料_${cur.company.name || cur.name}_${cur.vehicle.plate || ''}_${new Date().toISOString().slice(0, 10)}.pdf`.replace(/[\/:*?"<>|]/g, '');
    $('#btnPdfSave').onclick = () => { const a = document.createElement('a'); a.href = pdfUrl; a.download = name; a.click(); };
    $('#btnPdfOpen').onclick = () => window.open(pdfUrl, '_blank');
    $('#btnPdfOpen').style.display = ''; $('#btnPdfSave').style.display = '';
    log(`✅ 完成，共 ${pages} 頁、${(blob.size / 1048576).toFixed(1)} MB。可「開啟預覽」直接列印，或下載保存。`);
  } catch (e) { log('❌ 產出失敗：' + (e.message || e)); }
  finally {
    $$('#pdfBody [data-sec]').forEach(el => el.disabled = false);
    $('#btnPdfGo').disabled = false; $('#btnPdfGo').textContent = '🔄 重新產出'; $('#btnPdfGo').style.display = '';
  }
});

route();
