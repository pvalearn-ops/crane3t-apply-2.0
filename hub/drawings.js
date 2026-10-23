/* ============================================================
   組配圖：工程圖（正面、側面）套印尺寸標註
   - 正面圖：外伸撐座全伸寬度 Lw（左右撐座中心距）；前／後輪距（兩輪胎中心距，以文字標示前、後輪距）
   - 側面圖：軸距 H（前、後輪中心距）；前輪中心至起重機旋轉中心距離 S；車高 h（地面至最高點）
   尺寸取自 S2-2／S2-6，使用者不需上傳或調整；錨點為圖檔上之像素座標（2000 × 1493）。
   ============================================================ */
const Drawings = (() => {
  // 圖檔改用內嵌 data URL（hub/drawings-img.js，首次需要時才載入）：
  // 以 file:// 開啟時，直接讀 照片/工程圖_*.jpg 會使 canvas 被視為跨來源而無法 toDataURL
  const IMG_JS = 'hub/drawings-img.js?v=20261023y';
  let imgJs = null;
  const embedded = () => imgJs || (imgJs = new Promise((res, rej) => {
    if (window.DRAWING_IMG) return res(window.DRAWING_IMG);
    const s = document.createElement('script'); s.src = IMG_JS;
    s.onload = () => window.DRAWING_IMG ? res(window.DRAWING_IMG) : rej(new Error('工程圖資料載入失敗'));
    s.onerror = () => { imgJs = null; rej(new Error('工程圖資料載入失敗：' + IMG_JS)); };
    document.head.appendChild(s);
  }));
  const ANCHOR = {
    // 左、右外伸撐座中心（底板下緣）；top：中心線起點；tireL／tireR：左右前輪中心 x，tireY：輪胎接地 y
    front: { a: [300, 1316], b: [1827, 1316], top: 1100, tireL: 770, tireR: 1352, tireY: 1303 },
    // 前輪中心、起重機旋轉中心（旋轉座軸線）；rear：後輪中心；ground：前輪接地 y；topY／topX：車輛最高點（伸臂收納）
    side: { a: [389, 1310], b: [668, 1310], top: 880, rear: [1521, 1312], ground: 1448, topY: 627, topX: 1097 }
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
  function arrowV(g, x, y, dir) {   // 垂直箭頭：dir = −1 朝上、1 朝下
    g.beginPath(); g.moveTo(x, y); g.lineTo(x - 13, y - dir * 34); g.lineTo(x + 13, y - dir * 34); g.closePath(); g.fill();
  }
  function centerLine(g, x, y0, y1) { g.setLineDash([36, 12, 8, 12]); g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y1); g.stroke(); g.setLineDash([]); }
  function cross(g, x, y) { g.beginPath(); g.moveTo(x - 40, y); g.lineTo(x + 40, y); g.stroke(); g.beginPath(); g.arc(x, y, 12, 0, Math.PI * 2); g.stroke(); }
  /* 水平尺寸線＋置中文字（文字不超出畫布） */
  function dimH(g, W, x1, x2, y, txt, size, mid) {
    g.beginPath(); g.moveTo(x1, y); g.lineTo(x2, y); g.stroke();
    arrow(g, x1, y, -1); arrow(g, x2, y, 1);
    g.font = `bold ${size}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'top';
    const tw = g.measureText(txt).width, m = Math.min(W - tw / 2 - 20, Math.max(tw / 2 + 20, mid != null ? mid : (x1 + x2) / 2));
    g.fillText(txt, m, y + 40);
  }
  const mmTxt = (mm) => isFinite(mm) && mm > 0 ? Math.round(mm).toLocaleString('en-US') + ' mm' : '（未填）';

  /* 尺寸值（mm）：Lw、S、輪距、軸距、車高（cm × 10；未實測者為預設值或「未填」）
     front／side 為主要標註值（保留供完整度檢核）。 */
  function valuesOf(c) {
    const EV = Calc.effective(c).vals, n = Calc.num, mm = (v) => n(v) > 0 ? n(v) * 10 : NaN;
    return { front: mm(c.stab.Lw), side: mm(EV.S), B1: mm(EV.B1), B2: mm(EV.B2), H: mm(c.vehicle.wheelbase_cm), h: mm(c.vehicle.height_cm) };
  }
  /* 回傳 JPEG dataURL；v 為 valuesOf() 之結果（相容舊呼叫：傳入單一數值時只標主要尺寸） */
  async function render(kind, v) {
    if (typeof v !== 'object' || v == null) v = { [kind]: v };
    const img = await load(kind), A = ANCHOR[kind];
    const W = img.naturalWidth, H = img.naturalHeight;
    const extraW = kind === 'side' ? 300 : 0, extraH = kind === 'side' ? 360 : 230;
    const cv = document.createElement('canvas'); cv.width = W + extraW; cv.height = H + extraH;
    const g = cv.getContext('2d'), CW = cv.width;
    g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(img, 0, 0);
    g.strokeStyle = RED; g.fillStyle = RED; g.lineWidth = 4;
    if (kind === 'front') {
      const [ax] = A.a, [bx] = A.b, y1 = H + 60;
      // 外伸撐座全伸寬度（圖下方）
      centerLine(g, ax, A.top, y1 + 30); centerLine(g, bx, A.top, y1 + 30);
      dimH(g, CW, ax, bx, y1, `${TITLE.front}　${mmTxt(v.front)}`, 62);
      // 輪距：兩輪胎中心距（輪胎下方），文字標示前、後輪距
      const yt = A.tireY + 62;
      centerLine(g, A.tireL, A.tireY - 170, yt + 26); centerLine(g, A.tireR, A.tireY - 170, yt + 26);
      g.beginPath(); g.moveTo(A.tireL, yt); g.lineTo(A.tireR, yt); g.stroke();
      arrow(g, A.tireL, yt, -1); arrow(g, A.tireR, yt, 1);
      g.font = `bold 46px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'top';
      g.fillText(`前輪距 ${mmTxt(v.B1)}／後輪距 ${mmTxt(v.B2)}`, (A.tireL + A.tireR) / 2, yt + 34);
    } else {
      const [ax, ay] = A.a, [bx] = A.b, [rx, ry] = A.rear, y1 = H + 60, y2 = H + 200;
      cross(g, ax, ay); cross(g, rx, ry);
      // 第 1 排：軸距（前輪中心至後輪中心）；文字置於旋轉中心與後輪之間，避開尺寸界線
      centerLine(g, ax, ay - 140, y2 + 30); centerLine(g, rx, ry - 140, y1 + 30);
      dimH(g, CW, ax, rx, y1, `軸距　${mmTxt(v.H)}`, 56, (bx + rx) / 2);
      // 第 2 排：前輪中心至旋轉中心距離
      centerLine(g, bx, A.top, y2 + 30);
      dimH(g, CW, ax, bx, y2, `${TITLE.side}　${mmTxt(v.side)}`, 62);
      // 車高：地面至車輛最高點（右側垂直尺寸）
      const xd = W + 120;
      g.lineWidth = 3;
      g.beginPath(); g.moveTo(A.topX + 30, A.topY); g.lineTo(xd + 40, A.topY); g.stroke();
      g.beginPath(); g.moveTo(rx + 160, A.ground); g.lineTo(xd + 40, A.ground); g.stroke();
      g.lineWidth = 4;
      g.beginPath(); g.moveTo(xd, A.topY); g.lineTo(xd, A.ground); g.stroke();
      arrowV(g, xd, A.topY, -1); arrowV(g, xd, A.ground, 1);
      g.save(); g.translate(xd + 70, (A.topY + A.ground) / 2); g.rotate(-Math.PI / 2);
      g.font = `bold 56px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(`車高　${mmTxt(v.h)}`, 0, 0); g.restore();
    }
    return cv.toDataURL('image/jpeg', 0.9);
  }
  return { render, valuesOf, TITLE };
})();
