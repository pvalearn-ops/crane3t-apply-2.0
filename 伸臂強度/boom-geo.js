/* 伸臂臨界斷面：幾何、斷面性質與工程圖（主控台 S1-3 與伸臂強度計算書共用）
   單位 cm；SVG 顏色使用 CSS 變數 --steel、--dbl、--cl、--dim（使用頁面須定義） */
(function () {
  const RAD = Math.PI / 180;
  const LET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const secName = k => LET[k] + '-' + LET[k];
  const isNum = v => v !== null && v !== '' && v !== undefined && isFinite(v);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function f(x, d = 2) { if (!isNum(x)) return '—'; return Number(x).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); }

/* ---------------- 斷面幾何與斷面性質（薄殼） ---------------- */
function polyProps(P) {
  let A = 0, Sx = 0, Sy = 0, Ixx = 0, Iyy = 0;
  for (let i = 0; i < P.length; i++) {
    const [x0, y0] = P[i], [x1, y1] = P[(i + 1) % P.length];
    const c = x0 * y1 - x1 * y0;
    A += c / 2; Sy += (x0 + x1) * c / 6; Sx += (y0 + y1) * c / 6;
    Ixx += (y0 * y0 + y0 * y1 + y1 * y1) * c / 12; Iyy += (x0 * x0 + x0 * x1 + x1 * x1) * c / 12;
  }
  return { A, Sx, Sy, Ixx, Iyy };
}
function lineInt(p1, d1, p2, d2) {
  const den = d1[0] * d2[1] - d1[1] * d2[0];
  if (Math.abs(den) < 1e-12) return null;
  const t = ((p2[0] - p1[0]) * d2[1] - (p2[1] - p1[1]) * d2[0]) / den;
  return [p1[0] + t * d1[0], p1[1] + t * d1[1]];
}
/* 外輪廓 (逆時針) 每邊依其板厚向內偏移，取相鄰偏移線交點得內輪廓 */
function offsetPoly(P, T) {
  const n = P.length, L = [];
  for (let i = 0; i < n; i++) {
    const a = P[i], b = P[(i + 1) % n];
    let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy); dx /= l; dy /= l;
    L.push({ p: [a[0] - dy * T[i], a[1] + dx * T[i]], d: [dx, dy] });
  }
  const Q = [];
  for (let i = 0; i < n; i++) { const l0 = L[(i - 1 + n) % n], l1 = L[i]; Q.push(lineInt(l0.p, l0.d, l1.p, l1.d)); }
  return Q;
}
function secGeom(shape, p) {
  const out = { err: null };
  for (const k of ['B', 'H', 'tt', 'ts', 'tb']) if (!isNum(p[k]) || p[k] <= 0) { out.err = '寬、高、板厚須為正值'; return out; }
  const b = p.B / 2, H = p.H;
  let P, T, top, bot, ht = 0, hb = 0;
  if (shape === 'rect') {
    P = [[-b, 0], [b, 0], [b, H], [-b, H]]; T = [p.tb, p.ts, p.tt, p.ts];
    top = [[2, 3], [3, 2]]; bot = [[1, 0], [0, 1]];
  } else if (shape === 'pent') {
    if (!isNum(p.ab) || p.ab <= 0 || p.ab >= 80) { out.err = '下傾角須介於 0~80°'; return out; }
    hb = b * Math.tan(p.ab * RAD);
    P = [[0, 0], [b, hb], [b, H], [-b, H], [-b, hb]]; T = [p.tb, p.ts, p.tt, p.ts, p.tb];
    top = [[2, 3], [3, 2]]; bot = [[1, 0], [4, 0]];
  } else {
    if (!isNum(p.ab) || p.ab <= 0 || p.ab >= 80 || !isNum(p.at) || p.at <= 0 || p.at >= 80) { out.err = '傾角須介於 0~80°'; return out; }
    hb = b * Math.tan(p.ab * RAD); ht = b * Math.tan(p.at * RAD);
    P = [[0, 0], [b, hb], [b, H - ht], [0, H], [-b, H - ht], [-b, hb]]; T = [p.tb, p.ts, p.tt, p.tt, p.ts, p.tb];
    top = [[2, 3], [4, 3]]; bot = [[1, 0], [5, 0]];
  }
  if (H - ht - hb <= 0) { out.err = '高度不足：側板直線段長度 ≤ 0'; return out; }
  const Q = offsetPoly(P, T);
  if (Q.some(q => !q)) { out.err = '內輪廓計算失敗'; return out; }
  const pi = polyProps(Q);
  const valid = pi.A > 0 && Q.every(q => Math.abs(q[0]) < b + 1e-9 && q[1] > -1e-9 && q[1] < H + 1e-9);
  let selfX = false;
  for (let i = 0; i < Q.length; i++) {
    const a = Q[i], c = Q[(i + 1) % Q.length], pa = P[i], pc = P[(i + 1) % P.length];
    if ((c[0] - a[0]) * (pc[0] - pa[0]) + (c[1] - a[1]) * (pc[1] - pa[1]) <= 0) selfX = true;
  }
  if (!valid || selfX) { out.err = '板厚過大，內輪廓無效'; return out; }
  const cen = [0, pi.Sx / pi.A];
  const dbls = [];
  function dbl(i, j, len, t) {
    if (!(len > 0) || !(t > 0)) return;
    const c = Q[i], to = Q[j];
    let dx = to[0] - c[0], dy = to[1] - c[1]; const l = Math.hypot(dx, dy);
    len = Math.min(len, l); dx /= l; dy /= l;
    let nx = -dy, ny = dx;
    const mx = c[0] + dx * len / 2, my = c[1] + dy * len / 2;
    if ((cen[0] - mx) * nx + (cen[1] - my) * ny < 0) { nx = -nx; ny = -ny; }
    dbls.push([c, [c[0] + dx * len, c[1] + dy * len], [c[0] + dx * len + nx * t, c[1] + dy * len + ny * t], [c[0] + nx * t, c[1] + ny * t]]);
  }
  if (p.fold) {
    top.forEach(([i, j]) => dbl(i, j, p.dtL, p.dtT));
    bot.forEach(([i, j]) => dbl(i, j, p.dbL, p.dbT));
  }
  let A = 0, Sx = 0, Ixx = 0, Iyy = 0;
  const add = (R, s) => { const q = polyProps(R), g = s * Math.sign(q.A); A += g * q.A; Sx += g * q.Sx; Ixx += g * q.Ixx; Iyy += g * q.Iyy; };
  add(P, 1); add(Q, -1); dbls.forEach(R => add(R, 1));
  const yc = Sx / A, Ix = Ixx - A * yc * yc, Iy = Iyy;
  const e1 = H - yc, e2 = yc, ey = b;
  Object.assign(out, {
    P, Q, T, dbls, ht, hb, b, H, side: H - ht - hb,
    A, yc, e1, e2, ey, Ix, Iy, Zx1: Ix / e1, Zx2: Ix / e2, Zy: Iy / ey, kx: Math.sqrt(Ix / A), ky: Math.sqrt(Iy / A)
  });
  return out;
}

/* ---------------- 繪製：斷面工程圖 ---------------- */
function arrowDefs(id) {
  return `<defs><marker id="${id}" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,1.5 L10,5 L0,8.5 z" fill="var(--dim)"/></marker></defs>`;
}
function dimV(x, y1, y2, txt, side, small, mk) {
  const ym = (y1 + y2) / 2, tx = x + side * 4;
  const line = `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="var(--dim)" stroke-width=".8" marker-start="url(#${mk})" marker-end="url(#${mk})"/>`;
  if (small) return line + `<text x="${x + 5}" y="${ym + 3.5}" font-size="9.5" fill="var(--dim)">${txt}</text>`;
  return line + `<text x="${tx}" y="${ym}" transform="rotate(-90 ${tx} ${ym})" text-anchor="middle" font-size="11" fill="var(--dim)" dy="${side > 0 ? 9 : -3}">${txt}</text>`;
}
function dimH(y, x1, x2, txt, mk) {
  return `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="var(--dim)" stroke-width=".8" marker-start="url(#${mk})" marker-end="url(#${mk})"/>
  <text x="${(x1 + x2) / 2}" y="${y - 4}" text-anchor="middle" font-size="11" fill="var(--dim)">${txt}</text>`;
}
const ext = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--dim)" stroke-width=".5" opacity=".75"/>`;
const DM = { ml: 84, mr: 112, mt: 30, mb: 52 };
function drawingScale(geo) {
  const ok = geo.filter(g => !g.err);
  const maxH = Math.max(...ok.map(g => g.H), 10), maxB = Math.max(...ok.map(g => g.b * 2), 5);
  const s = Math.min(290 / maxH, 190 / maxB);
  return { s, maxH, maxB, VW: DM.ml + maxB * s + DM.mr, VH: DM.mt + maxH * s + DM.mb };
}
/* sizeAttr：列印時指定 mm 寬高以符合比例 */
function drawSection(k, g, sc, sizeAttr = '', mk = 'ar', p) {
  const s = sc.s, VW = sc.VW, VH = sc.VH;
  const cx = DM.ml + sc.maxB * s / 2, by = DM.mt + sc.maxH * s;
  if (g.err) return `<svg viewBox="0 0 ${VW} ${VH}" ${sizeAttr}><text x="${VW / 2}" y="${VH / 2}" text-anchor="middle" fill="var(--ng)" font-size="14">${esc(g.err)}</text></svg>`;
  const X = x => cx + x * s, Y = y => by - y * s;
  const pts = P => P.map(q => `${X(q[0]).toFixed(2)},${Y(q[1]).toFixed(2)}`).join(' L');
  const b = g.b, H = g.H;
  let o = `<svg viewBox="0 0 ${VW.toFixed(1)} ${VH.toFixed(1)}" ${sizeAttr} xmlns="http://www.w3.org/2000/svg" font-family="Arial,'Microsoft JhengHei',sans-serif">${arrowDefs(mk)}`;
  o += `<path d="M${pts(g.P)} Z M${pts(g.Q)} Z" fill="var(--steel)" fill-rule="evenodd" stroke="#111" stroke-width=".6" stroke-linejoin="miter"/>`;
  g.dbls.forEach(R => o += `<path d="M${pts(R)} Z" fill="var(--dbl)" stroke="#111" stroke-width=".5"/>`);
  const yc = Y(g.yc);
  o += `<line x1="${X(-b) - 18}" y1="${yc}" x2="${X(b) + 18}" y2="${yc}" stroke="var(--cl)" stroke-width=".7" stroke-dasharray="10 3 2 3"/>`;
  o += `<line x1="${X(0)}" y1="${Y(H) - 16}" x2="${X(0)}" y2="${Y(0) + 14}" stroke="var(--cl)" stroke-width=".7" stroke-dasharray="10 3 2 3"/>`;
  o += `<text x="${X(b) + 21}" y="${yc + 4}" font-size="11" fill="var(--cl)" font-style="italic">x</text>`;
  o += `<text x="${X(0) + 4}" y="${Y(H) - 18}" font-size="11" fill="var(--cl)" font-style="italic">y</text>`;
  o += `<circle cx="${X(0)}" cy="${yc}" r="2.2" fill="var(--cl)"/>`;
  const yB = Y(0) + 24, ySideBot = Y(g.hb);
  o += ext(X(-b), ySideBot + 3, X(-b), yB + 4) + ext(X(b), ySideBot + 3, X(b), yB + 4);
  o += dimH(yB, X(-b), X(b), `${f(p.B, 2)}`, mk);
  const xC = X(b) + 26, xH = X(b) + 72;
  const lv = [[0, 0]];
  if (g.hb) lv.push([g.hb, b]);
  if (g.ht) lv.push([H - g.ht, b]); else lv.push([H, b]);
  if (g.ht) lv.push([H, 0]);
  if (!g.hb) lv[0] = [0, b];
  lv.forEach(([y, x]) => o += ext(X(x) + 3, Y(y), xH + 4, Y(y)));
  for (let i = 0; i < lv.length - 1; i++) {
    const dd = lv[i + 1][0] - lv[i][0];
    o += dimV(xC, Y(lv[i][0]), Y(lv[i + 1][0]), f(dd, 2), 1, dd * s < 40, mk);
  }
  if (lv.length > 2) o += dimV(xH, Y(0), Y(H), f(H, 2), 1, false, mk);
  const xE = X(-b) - 30;
  o += ext(X(-b) - 18, yc, xE - 4, yc) + ext(X(0) - 3, Y(H), xE - 4, Y(H)) + ext(X(0) - 3, Y(0), xE - 4, Y(0));
  o += dimV(xE, Y(H), yc, `e₁=${f(g.e1, 2)}`, -1, false, mk);
  o += dimV(xE, yc, Y(0), `e₂=${f(g.e2, 2)}`, -1, false, mk);
  const ang = (yApex, a, down) => {
    const r = 22, x0 = X(0), y0 = Y(yApex), sgn = down ? 1 : -1;
    const ex = x0 + r * Math.cos(a * RAD), ey = y0 + sgn * r * Math.sin(a * RAD);
    return `<line x1="${x0}" y1="${y0}" x2="${x0 + r + 10}" y2="${y0}" stroke="var(--dim)" stroke-width=".5" stroke-dasharray="3 2"/>
      <path d="M${x0 + r},${y0} A${r},${r} 0 0 ${down ? 1 : 0} ${ex},${ey}" fill="none" stroke="var(--dim)" stroke-width=".8"/>
      <text x="${x0 + r + 3}" y="${y0 - sgn * 4 + (down ? 0 : 7)}" font-size="10.5" fill="var(--dim)">${f(a, 1)}°</text>`;
  };
  if (g.ht) o += ang(H, p.at, true);
  if (g.hb) o += ang(0, p.ab, false);
  const tcol = '#26324a';
  o += `<text x="${X(0)}" y="${Y(H - g.ht) + 16}" text-anchor="middle" font-size="10.5" fill="${tcol}">上板 t=${f(p.tt, 2)}</text>`;
  o += `<text x="${X(0)}" y="${Y(g.hb) - 9}" text-anchor="middle" font-size="10.5" fill="${tcol}">下板 t=${f(p.tb, 2)}</text>`;
  const xs = X(b) - 11, ys = Y(g.hb + g.side / 2);
  o += `<text x="${xs}" y="${ys}" transform="rotate(-90 ${xs} ${ys})" text-anchor="middle" font-size="10.5" fill="${tcol}">側板 t=${f(p.ts, 2)}</text>`;
  if (g.dbls.length) {
    if (p.fold && p.dtL > 0) o += `<text x="${X(-b) + 10}" y="${Y(H - g.ht) + 30}" font-size="9.5" fill="${tcol}">上內折 ${f(p.dtL, 1)}×${f(p.dtT, 2)}</text>`;
    if (p.fold && p.dbL > 0) o += `<text x="${X(-b) + 10}" y="${Y(g.hb) - 22}" font-size="9.5" fill="${tcol}">下內折 ${f(p.dbL, 1)}×${f(p.dbT, 2)}</text>`;
  }
  o += `<text x="${cx}" y="${VH - 10}" text-anchor="middle" font-size="13" font-weight="700" fill="#111" text-decoration="underline">斷面 ${secName(k)}</text>`;
  return o + `</svg>`;
}
function scaleBar(sc) {
  const L = 10 * sc.s;
  return `<svg width="${L + 70}" height="26" style="vertical-align:middle"><g stroke="#111" stroke-width="1">
    <rect x="4" y="9" width="${L / 2}" height="5" fill="#111"/><rect x="${4 + L / 2}" y="9" width="${L / 2}" height="5" fill="#fff"/></g>
    <text x="4" y="24" font-size="9">0</text><text x="${4 + L}" y="24" font-size="9" text-anchor="middle">10 cm</text></svg>`;
}

  window.BoomGeo = { secGeom, drawSection, drawingScale, scaleBar };
})();
