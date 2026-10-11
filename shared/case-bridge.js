/**
 * 申請案資料隔離橋接 (case-bridge.js)
 * ------------------------------------------------------------
 * 各子頁面（荷重表、安定度、明細表…）原本各自用固定的 localStorage key 存檔。
 * 由主控台以 ?case=<申請案ID> 開啟時，本腳本會把所有 localStorage 讀寫
 * 自動加上「case:<ID>:」前綴，讓每個申請案的資料互不干擾。
 * 必須在子頁面其他 <script> 之前載入。
 */
(function () {
  const params = new URLSearchParams(location.search);
  const caseId = params.get('case');
  window.CASE_ID = caseId || null;
  if (!caseId) return;

  const prefix = 'case:' + caseId + ':';
  const proto = Storage.prototype;
  const rawGet = proto.getItem, rawSet = proto.setItem, rawRemove = proto.removeItem;
  const isLocal = (s) => { try { return s === window.localStorage; } catch (e) { return false; } };

  proto.getItem = function (k) { return rawGet.call(this, isLocal(this) ? prefix + k : k); };
  proto.setItem = function (k, v) {
    const r = rawSet.call(this, isLocal(this) ? prefix + k : k, v);
    if (isLocal(this)) {
      try { rawSet.call(this, prefix + '__touched', new Date().toISOString()); } catch (e) {}
      try { if (window.parent !== window) window.parent.postMessage({ type: 'case-saved', caseId, key: k }, '*'); } catch (e) {}
    }
    return r;
  };
  proto.removeItem = function (k) { return rawRemove.call(this, isLocal(this) ? prefix + k : k); };

  /* ---- 大型檔案（照片）改存 IndexedDB，避免 localStorage 5MB 上限 ---- */
  const DB_NAME = 'crane3t_files', STORE = 'files';
  function openDb() {
    return new Promise((res, rej) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const os = db.createObjectStore(STORE, { keyPath: 'id' });
          os.createIndex('caseId', 'caseId');
        }
      };
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  }
  window.CaseFiles = {
    async put(slot, name, type, dataUrl) {
      const db = await openDb();
      const rec = { id: caseId + ':' + slot, caseId, slot, name, type, dataUrl, savedAt: Date.now() };
      await new Promise((res, rej) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(rec); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
      try { if (window.parent !== window) window.parent.postMessage({ type: 'case-saved', caseId, key: 'file:' + slot }, '*'); } catch (e) {}
      return rec;
    },
    async get(slot) {
      const db = await openDb();
      return new Promise((res, rej) => { const r = db.transaction(STORE).objectStore(STORE).get(caseId + ':' + slot); r.onsuccess = () => res(r.result || null); r.onerror = () => rej(r.error); });
    }
  };

  /* ---- 申請文件工具列 ----
     內嵌於主控台時：隱藏各頁原有的工具列、按鈕與提示（避免與主控台重複）；
     以「新分頁開啟（列印用）」開啟時：同樣隱藏原有工具列，改顯示統一樣式的工具列（各頁功能＋列印＋回到總覽）。 */
  const path = decodeURIComponent(location.pathname);
  const qs = new URLSearchParams(location.search);
  const PAGES = [
    { m: /申請書\/index\.html$/, hide: 'form > button',
      act: [['📄 產生並下載 Word 申請書', w => w.generateWord()], ['🖨️ 列印（A4 版面）', w => w.open('print.html' + w.location.search, '_blank')]] },
    { m: /申請書\/print\.html$/, hide: '.toolbar', act: [['🖨️ 列印 / 存成 PDF', w => w.print()]] },
    { m: /明細表\/[^/]+\.html$/, hide: '.toolbar, .notice-banner',
      act: [['↶ 上一步', w => w.undoSpec()], ['🖨️ 列印', w => w.print()]] },
    { m: /荷重表\/index\.html$/, hide: '.app-header, .control-panel', act: [['🖨️ 列印', w => w.print()]] },
    { m: /安定度\/[^/]+\.html$/, hide: '.toolbar', act: [['🖨️ 列印', w => w.print()]] },
    { m: /鋼索吊鉤計算\/鋼索吊鉤計算\.html$/, hide: '.toolbar',
      act: [['📑 全部', w => w.switchTab('all')], ['🪝 吊鉤', w => w.switchTab('hook')], ['🪢 鋼索', w => w.switchTab('wire')], ['🖨️ 列印', w => w.print()]] },
    { m: /自行檢查紀錄表\/[^/]+\.html$/, hide: '.toolbar, .notice-banner', act: [['🖨️ 列印', w => w.print()]] },
    { m: /伸臂強度\/[^/]+\.html$/, when: () => qs.get('view') === 'doc', hide: '#pvbar', css: 'body.preview #print{padding-top:16px !important;}',
      act: [['🖨️ 列印', w => w.print()]] }
  ];
  const page = PAGES.find(x => x.m.test(path) && (!x.when || x.when()));
  const embedded = window.parent !== window;
  if (page) {
    const st = document.createElement('style');
    st.textContent = (page.hide ? page.hide + '{display:none !important;}' : '') + (page.css || '') +
      '.case-docbar{position:sticky;top:0;z-index:1000;display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:8px 16px;background:#0f766e;color:#fff;' +
      'font:14px/1.4 "Microsoft JhengHei","PingFang TC","Noto Sans TC",sans-serif;box-shadow:0 2px 6px rgba(0,0,0,.15);}' +
      '.case-docbar *{box-sizing:border-box}.case-docbar b{margin-right:8px;font-weight:700}' +
      '.case-docbar button{all:unset;display:inline-block;width:auto;margin:0;font:700 14px/1.4 "Microsoft JhengHei","PingFang TC",sans-serif;border-radius:6px;padding:6px 14px;background:#fff;color:#0f766e;cursor:pointer;box-shadow:none}' +
      '.case-docbar button:hover{background:#ccfbf1}.case-docbar span{font-size:12px;opacity:.85}' +
      '.case-docbar a{all:unset;color:#fff;font-weight:700;margin-left:auto;cursor:pointer}.case-docbar a:hover{text-decoration:underline}' +
      '@media print{.case-docbar{display:none !important}}';
    document.head.appendChild(st);
  }
  if (!embedded) {
    document.addEventListener('DOMContentLoaded', () => {
      const bar = document.createElement('div');
      bar.className = 'case-docbar no-print';
      const back = new URL('../index.html#case=' + encodeURIComponent(caseId), location.href).href;
      bar.innerHTML = `<b>📁 ${(document.title || '申請文件').replace(/[<>&]/g, '')}</b>` +
        (page ? page.act.map((a, k) => `<button type="button" data-act="${k}">${a[0]}</button>`).join('') : '') +
        `<span>資料自動儲存於本瀏覽器</span><a href="${back}">← 回到申請案總覽</a>`;
      bar.querySelectorAll('[data-act]').forEach(b => b.onclick = () => { try { page.act[+b.dataset.act][1](window); } catch (e) { alert('此功能無法執行：' + e.message); } });
      document.body.prepend(bar);
    });
  }
})();
