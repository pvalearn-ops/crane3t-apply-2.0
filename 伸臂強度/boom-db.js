/* 伸臂強度計算書：機具資料庫（主控台 S1 與伸臂強度計算書共用）
   每台機具為原廠伸臂強度計算書之數據；型號須完全一致才可套用（尾碼不同之機型構造可能不同）。 */
(function () {
  /* =========================================================
     機具資料庫：原廠計算書之外觀尺寸、重量、重心距離（表 2）、荷重點
     單位已換算為 cm / kgf / kgf/cm²（1 N/mm² = 10.197 kgf/cm²）
     ========================================================= */
  const n_ = null;
  const secOf = (B, H, tt, ts, tb, dtL = 0, dtT = 0, dbL = 0, dbT = 0) => ({ B, H, tt, ts, tb, at: 15, ab: 15, fold: dtL > 0 || dbL > 0, dtL: dtL || 3.5, dtT: dtT || 0.3, dbL: dbL || 3.5, dbT: dbT || 0.3 });
  const kgf = v => Math.round(v * 100 / 9.80665);   // N/mm² → kgf/cm²
  const geoMm = (L, l0, li) => ({ L: L == null ? n_ : L / 10, l0: l0 == null ? n_ : l0 / 10, li: li.map(v => v == null ? n_ : v / 10) });

  /* URA506WY（UNIC SA-0063）：舊式計算（kgf 制、ω 公式、拉壓同一容許應力 2700 × 1.15 = 3105 kgf/cm²） */
  function dataURA506WY() {
    const n = n_;
    const g = (L, l0, li) => ({ L, l0, li: li || [n, n, n, n, n, n, n, n, n] });
    const blank = () => g(n, n);
    return {
      project: { title: '油壓起重機', model: 'URA506WY', no: '' },
      design: {
        sigB: 6000, sigY: 4600, sigA0: 2700, kA: 1.15, E: 2100000,
        psi1: 1.25, psi2: 1.1, phi: 0.05, C: 1.2, qk: 8.5, h: 16, headA: 0,
        axial: 'wire', nRope: 4,
        omegaMode: 'formula', omegaTable: null, omegaCls: 0, omegaRow: 'up',
        cDiv: 1, fatigueOn: false, fatigue: 3600, weldEff: 1,
        round: 'ceil', thetaFromR: false, rOff: 0
      },
      shape: 'hex',
      booms: [
        { w: 0.56, sec: secOf(20.2, 46.15, 0.40, 0.40, 0.60, 3.5, 0.3, 3.0, 0.3) },
        { w: 0.40, sec: secOf(19.0, 42.54, 0.32, 0.40, 0.40, 4.0, 0.3, 4.0, 0.3) },
        { w: 0.36, sec: secOf(17.7, 39.24, 0.32, 0.32, 0.45, 3.5, 0.3, 5.5, 0.3) },
        { w: 0.29, sec: secOf(16.7, 36.01, 0.29, 0.29, 0.32, 3.5, 0.3, 3.5, 0.3) },
        { w: 0.24, sec: secOf(15.6, 31.78, 0.29, 0.29, 0.29) },
        { w: 0.23, sec: secOf(14.5, 28.48, 0.29, 0.29, 0.29) }
      ],
      items: [
        { name: '伸縮缸(2) 底端銷等效重量', G: 40, boom: 0 },
        { name: '伸臂(2) 重量', G: 129, boom: 2 },
        { name: '伸臂(3) 重量', G: 114, boom: 3 },
        { name: '伸臂(4) 重量', G: 92, boom: 4 },
        { name: '伸臂(5) 重量', G: 74, boom: 5 },
        { name: '伸臂(6) 重量', G: 74, boom: 6 },
        { name: '伸縮缸(3) 底端銷等效重量', G: 57, boom: 0 },
        { name: '伸縮缸(2) 頂端銷等效重量', G: 48, boom: 0 },
        { name: '伸縮缸(3) 頂端銷等效重量', G: 20, boom: 0 }
      ],
      stages: [
        { len: 15.64, rows: [[530, 3.177, 78], [530, 6, 67.1], [380, 8, 58.8], [280, 11, 46.6], [230, 13, 32.7], [180, 15.4, 1]],
          geo: [g(1481.5, 263.5, [190, 344.5, 600.5, 847.5, 1079.5, 1346.5, 441.5, 689, 963.5]),
                g(1218, 246, [n, n, 337, 584, 816, 1083, 178, 425.5, 700]),
                g(972, 245, [n, n, n, 338, 570, 837, n, 179.5, 454]),
                g(727, 245, [n, n, n, n, 325, 592, n, n, 209]),
                g(482, 239, [n, n, n, n, n, 347, n, n, n]),
                g(243, 252)] },
        { len: 13.31, rows: [[1030, 2.693, 78], [1030, 5, 67.5], [880, 6, 62.7], [630, 8, 52.4], [530, 10, 40.4], [380, 13.1, 1]],
          geo: [g(1248.5, 263.5, [190, 344.5, 600.5, 770, 924, 1113.5, 441.5, 689, 963.5]),
                g(985, 246, [n, n, 337, 506.5, 660.5, 850, 178, 425.5, 700]),
                g(739, 245, [n, n, n, 260.5, 414.5, 604, n, 179.5, 454]),
                g(494, 167.3, [n, n, n, n, 169.5, 359, n, n, 209]),
                g(326.7, 161.3, [n, n, n, n, n, 191.7, n, n, 41.7]),
                g(165.3, 174.3)] },
        { len: 10.98, rows: [[2030, 2.209, 78], [1830, 4.5, 65.2], [1630, 5, 62.3], [1130, 7, 49.6], [880, 9, 33.5], [730, 10.7, 1]],
          geo: [g(1015.5, 263.5, [190, 344.5, 600.5, 692, 769, 880.5, 441.5, 689, 808]),
                g(752, 246, [n, n, 337, 428.5, 505.5, 617, 178, 425.5, 544.5]),
                g(506, 245, [n, n, n, 182.5, 259.5, 371, n, 179.5, 298.5]),
                g(261, 89.7, [n, n, n, n, 14.5, 126, n, n, 53.5]),
                g(171.3, 83.7, [n, n, n, n, n, 36.3, n, n, n]),
                g(87.7, 96.7)] },
        { len: 8.65, rows: [[3030, 1.724, 78], [3030, 3.4, 66.2], [2430, 4, 61.7], [1880, 5, 53.8], [1580, 6, 44.9], [1030, 8.4, 1]],
          geo: [g(782.5, 263.5, [190, 344.5, 600.5, 614.5, 613.5, 647.5, 441.5, 689, 730.5]),
                g(519, 246, [n, n, 337, 351, 350, 384, 178, 425.5, 467]),
                g(273, 245, [n, n, n, 105, 104, 138, n, 179.5, 221]),
                blank(), blank(), blank()] },
        { len: 6.26, rows: [[3030, 1.227, 78], [3030, 3.4, 55.9], [2430, 4, 48.8], [1880, 5, 34.6], [1580, 6, 6.2]],
          geo: [g(543.5, 263.5, [190, 344.5, 361.5, 375.5, 374.5, 408.5, 202.5, 450, 491.5]),
                g(280, 246, [n, n, 98, 112, 111, 145, n, 186.5, 228]),
                blank(), blank(), blank(), blank()] },
        { len: 3.86, rows: [[3030, 0.728, 78], [3030, 3.4, 21.9], [2780, 3.6, 1]],
          geo: [g(303.5, 263.5, [n, 104.5, 121.5, 135.5, 134.5, 168.5, n, 250, 251.5]),
                blank(), blank(), blank(), blank(), blank()] }
      ],
      est: {
        m: 3, X: [346, 592, 837, 1082, 1321, 1524], Xsec: [82.5, 346, 592, 837, 1082, 1321], Xpin: 1564,
        items: [
          { name: '伸臂(2) 重量', G: 129, kind: 'boom', boom: 2, cyl: 1, X: null },
          { name: '伸臂(3) 重量', G: 114, kind: 'boom', boom: 3, cyl: 1, X: null },
          { name: '伸臂(4) 重量', G: 92, kind: 'boom', boom: 4, cyl: 1, X: null },
          { name: '伸臂(5) 重量', G: 74, kind: 'boom', boom: 5, cyl: 1, X: null },
          { name: '伸臂(6) 重量', G: 74, kind: 'boom', boom: 6, cyl: 1, X: null },
          { name: '伸縮油壓缸 1', G: 57, kind: 'cyl', boom: 0, cyl: 1, X: null },
          { name: '伸縮油壓缸 2', G: 48, kind: 'cyl', boom: 0, cyl: 2, X: null },
          { name: '伸縮油壓缸 3（鋼索同步）', G: 20, kind: 'cyl', boom: 0, cyl: 3, X: null }
        ]
      }
    };
  }

  /* 自行計算預設設計條件（現行構造規格：σca 另計、ω 查表）；材料值另以 SELF_DESIGN 覆寫 */
  const BASE_DESIGN = {
    sigB: kgf(590), sigY: kgf(450), sigA0: kgf(300), kA: 1.15, E: kgf(206000), weldEff: 1,
    psi1: 1.25, psi2: 1.1, phi: 0.05, C: 1.2, qk: 8.5, h: 16, headA: 0,
    axial: 'wire', nRope: 4,
    omegaMode: 'code', omegaTable: null, omegaCls: 0, omegaRow: 'up',
    cDiv: 1.15, fatigueOn: false, fatigue: 3600,
    round: 'dec1', thetaFromR: false, rOff: 0
  };

  /* 自行計算之空白範本：設計條件採現行規格預設值，其餘留空待填 */
  /* 自行計算（非原廠）之材料值：依台灣法規認可值；熔接效率預帶 0.8（有非破壞檢測可改 1.0） */
  const SELF_DESIGN = { sigB: 6000, sigY: 4580, E: 2100000, weldEff: 0.8, rOff: 0.2 };   // rOff：迴轉中心至伸臂腳銷偏移預設 20 cm
  function dataBlank(N = 5) {
    const n = n_;
    return {
      project: { title: '', model: '', no: '' },
      design: { ...BASE_DESIGN, ...SELF_DESIGN },
      shape: 'hex',
      booms: Array.from({ length: N }, () => ({ w: n, sec: { B: n, H: n, tt: n, ts: n, tb: n, at: 15, ab: 15, fold: false, dtL: 3.5, dtT: 0.3, dbL: 3.5, dbT: 0.3 } })),
      items: [],
      stages: Array.from({ length: N }, () => ({ len: n, rows: [[n, n, n]], geo: [] })),
      est: {
        m: 2, X: Array(N).fill(n), Xsec: [100, ...Array(N - 1).fill(n)], Xpin: n,   // 斷面 A-A 預設 100 cm
        items: [...Array.from({ length: N - 1 }, (_, k) => ({ name: `伸臂(${k + 2}) 重量`, G: n, kind: 'boom', boom: k + 2, cyl: 1, X: n })),
                { name: '伸縮油壓缸 1', G: n, kind: 'cyl', boom: 0, cyl: 1, X: n }]
      }
    };
  }

  const MACHINES = {
    URA506WY: { brand: 'UNIC', model: 'URA506WY', doc: 'SA-0063', outrigger_cm: 420, hook_kg: 30,
      // 伸臂各節、伸縮油壓缸重量（kg，供安定度計算），取原廠計算書 G 值：
      //   伸臂(2)～(6) = G2～G6 = 129、114、92、74、74；伸臂(1) 未列，以單位長重量 0.56 kgf/cm × 386 cm ≈ 216 推估
      //   伸縮油壓缸(2) = G1 底端銷 40 ＋ G8 頂端銷 48 = 88；伸縮油壓缸(3) = G7 底端銷 57 ＋ G9 頂端銷 20 = 77
      boom_segW: [216, 129, 114, 92, 74, 74], boom_cylW: [88, 77],
      note: '6 節伸臂，60 kgf/mm² 級高張力鋼；舊式計算（kgf 制、ω 公式、拉壓同一容許應力）', data: dataURA506WY }
  };
  window.BoomLib = { MACHINES, dataURA506WY, dataBlank, SELF_DESIGN };
})();
