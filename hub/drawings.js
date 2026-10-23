/* ============================================================
   組配圖：工程圖（正面、側面）套印尺寸標註
   - 正面圖：外伸撐座全伸寬度 Lw（左右撐座中心距）
   - 側面圖：前輪中心至起重機旋轉中心距離 S
   尺寸取自 S2-6，使用者不需上傳或調整；錨點為圖檔上之像素座標（2000 × 1493）。
   ============================================================ */
const Drawings = (() => {
  // 圖檔改用內嵌 data URL（hub/drawings-img.js，首次需要時才載入）：
  // 以 file:// 開啟時，直接讀 照片/工程圖_*.jpg 會使 canvas 被視為跨來源而無法 toDataURL
  const IMG_JS = 'hub/drawings-img.js?v=20261023b';
  let imgJs = null;
  const embedded = () => imgJs || (imgJs = new Promise((res, rej) => {
    if (window.DRAWING_IMG) return res(window.DRAWING_IMG);
    const s = document.createElement('script'); s.src = IMG_JS;
    s.onload = () => window.DRAWING_IMG ? res(window.DRAWING_IMG) : rej(new Error('工程圖資料載入失敗'));
    s.onerror = () => { imgJs = null; rej(new Error('工程圖資料載入失敗：' + IMG_JS)); };
    document.head.appendChild(s);
  }));
  const ANCHOR = {
    front: { a: [300, 1316], b: [1827, 1316], top: 1100 },   // 左、右外伸撐座中心（底板下緣）；top：中心線起點
    side: { a: [386, 1306], b: [668, 1306], top: 880 }       // 前輪中心、起重機旋轉中心（旋轉座軸線）
  };
  const TITLE = { front: '外伸撐座全伸寬度', side: '前輪中心至旋轉中心距離' };
  const RED = '#c0392b', FONT = '"Microsoft JhengHei","PingFang TC","Noto Sans TC",sans-serif';
  const cache = {};
  const load = (kind) => cache[kind] || (cache[kind] = embedded().then(D => new Promise((res, rej) => {
    const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('工程圖載入失敗：' + kind)); i.src = D[kind];
  })).catch(e => { delete cache[kind]; throw e; }));

  function arrow(g, x, y, dir) {
    g.beginPath(); g.moveTo(x, y); g.lineTo(x - dir * 34, y - 13); g.lineTo(x - dir * 34, y + 13); g.closePath(); g.fill();
  }
  /* 尺寸值（mm）：正面 = Lw（cm）× 10；側面 = S（cm）× 10（未實測時為預設值） */
  function valuesOf(c) {
    const EV = Calc.effective(c).vals, n = Calc.num;
    return { front: n(c.stab.Lw) > 0 ? n(c.stab.Lw) * 10 : NaN, side: n(EV.S) > 0 ? n(EV.S) * 10 : NaN };
  }
  /* 回傳 JPEG dataURL */
  async function render(kind, mm) {
    const img = await load(kind);
    const W = img.naturalWidth, H = img.naturalHeight, extra = 230;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H + extra;
    const g = cv.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(img, 0, 0);
    const A = ANCHOR[kind], [ax, ay] = A.a, [bx] = A.b, yDim = H + 60;
    g.strokeStyle = RED; g.fillStyle = RED; g.lineWidth = 4;
    // 中心線（一點鏈線）
    g.setLineDash([36, 12, 8, 12]);
    [[ax, kind === 'side' ? ay - 140 : A.top], [bx, A.top]].forEach(([x, y0]) => { g.beginPath(); g.moveTo(x, y0); g.lineTo(x, yDim + 30); g.stroke(); });
    g.setLineDash([]);
    if (kind === 'side') {   // 前輪中心十字
      g.beginPath(); g.moveTo(ax - 40, ay); g.lineTo(ax + 40, ay); g.stroke();
      g.beginPath(); g.arc(ax, ay, 12, 0, Math.PI * 2); g.stroke();
    }
    // 尺寸線與箭頭
    g.beginPath(); g.moveTo(ax, yDim); g.lineTo(bx, yDim); g.stroke();
    arrow(g, ax, yDim, -1); arrow(g, bx, yDim, 1);
    // 尺寸文字（置中於尺寸線下方，不超出圖框）
    const txt = `${TITLE[kind]}　${isFinite(mm) ? Math.round(mm).toLocaleString('en-US') + ' mm' : '（未填）'}`;
    g.font = `bold 62px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'top';
    const tw = g.measureText(txt).width, mid = Math.min(W - tw / 2 - 20, Math.max(tw / 2 + 20, (ax + bx) / 2));
    g.fillText(txt, mid, yDim + 40);
    return cv.toDataURL('image/jpeg', 0.9);
  }
  return { render, valuesOf, TITLE };
})();
