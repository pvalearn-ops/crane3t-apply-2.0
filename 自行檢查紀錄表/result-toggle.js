/* 自行檢查紀錄：「結果」欄改為點選切換
 * 空白 → 按一下「V」→ 再按「/」→ 再按「V」… 循環，只有 V 與 / 兩種結果。
 * 舊資料中的「良好／正常／合格」等文字視為 V。 */
(function () {
  const style = document.createElement('style');
  style.textContent = `
    .quick-pill-menu { display: none !important; }
    .result-input { cursor: pointer !important; caret-color: transparent; user-select: none; font-size: 14px !important; }
    .result-input:hover { background: #eef5ff !important; }`;
  document.head.appendChild(style);

  const ALLOWED = ['', 'V', '/'];
  // 預設為「/」的項目（空白時自動填入）：(5)吊架鎖扣(Twist lock)，僅貨櫃吊架用
  const DEFAULT_SLASH = ['res_1_9_5'];
  const norm = (v) => { v = String(v || '').trim(); return ALLOWED.includes(v) ? v : (v === 'v' || v === '✓' || v === '✔' ? 'V' : (v ? 'V' : '')); };
  const all = () => Array.from(document.querySelectorAll('.result-input'));
  const fire = (el) => el.dispatchEvent(new Event('input', { bubbles: true }));

  // V 顯示綠色、/ 顯示紅色（畫面與 PDF 皆同）
  function paint(el) {
    const v = el.value;
    el.style.setProperty('color', v === '/' ? '#dc2626' : v === 'V' ? '#15803d' : '#111111', 'important');
  }
  // 記錄已點選的項目數，供主控台判斷是否完成
  function status() {
    const els = all(), filled = els.filter(el => el.value === 'V' || el.value === '/').length;
    try { localStorage.setItem('crane_self_inspection_status', JSON.stringify({ total: els.length, filled, at: new Date().toISOString() })); } catch (e) {}
  }
  function prep() {
    all().forEach(el => {
      el.readOnly = true;
      el.placeholder = '點選';
      el.title = '按一下切換：V ↔ /';
      let v = norm(el.value);
      if (!v && DEFAULT_SLASH.includes(el.dataset.key)) v = '/';
      if (v !== el.value) { el.value = v; fire(el); }
      paint(el);
    });
    status();
  }
  document.addEventListener('click', (e) => {
    const el = e.target.closest && e.target.closest('.result-input');
    if (!el) return;
    el.value = el.value === 'V' ? '/' : 'V';
    paint(el); el.blur(); fire(el); status();
  });

  // 範例資料、清空表單、全部清空後重新套用預設
  ['fillDemoData', 'clearForm', 'fillAllResults'].forEach(name => {
    const orig = window[name];
    if (typeof orig === 'function') window[name] = function () { const r = orig.apply(this, arguments); prep(); return r; };
  });

  // 等草稿還原完再整理（原頁於 DOMContentLoaded 還原草稿）
  window.addEventListener('DOMContentLoaded', () => setTimeout(prep, 0));
})();
