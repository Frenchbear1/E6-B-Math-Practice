/* E6-B Trainer — flight computer math (ISA, air data, wind triangle, performance) */
(function () {
  const U = E6.util;
  const A = (E6.av = {});

  // ---------- Standard atmosphere ----------
  A.isa = (ft) => (ft <= 36089 ? 15 - 0.0019812 * ft : -56.5);
  A.delta = (pa) =>
    pa <= 36089 ? Math.pow(1 - 6.8755856e-6 * pa, 5.2558797) : 0.2233609 * Math.exp(-4.806346e-5 * (pa - 36089));
  A.theta = (oat) => (oat + 273.15) / 288.15;
  A.sigma = (pa, oat) => A.delta(pa) / A.theta(oat);
  A.daFromSigma = (s) => (1 - Math.pow(s, 0.234969)) / 6.8755856e-6;
  A.densityAlt = (pa, oat) => A.daFromSigma(A.sigma(pa, oat));
  A.daRule = (pa, oat) => pa + 120 * (oat - A.isa(pa)); // FAA rule of thumb
  A.paInHg = (elev, alt) => elev + (29.92 - alt) * 1000; // FAA: 1,000 ft per inHg
  A.paHpa = (elev, q) => elev + (1013 - q) * 27; // ~27 ft per hPa near sea level
  A.pressInHg = (pa) => 29.92126 * A.delta(pa);
  A.sos = (oat) => 38.967854 * Math.sqrt(oat + 273.15); // knots
  A.cToF = (c) => (c * 9) / 5 + 32;
  A.fToC = (f) => ((f - 32) * 5) / 9;

  // ---------- Airspeeds ----------
  const A0 = 661.4786;
  A.casToMach = (cas, pa) => {
    const qcP0 = Math.pow(1 + 0.2 * Math.pow(cas / A0, 2), 3.5) - 1;
    return Math.sqrt(5 * (Math.pow(qcP0 / A.delta(pa) + 1, 2 / 7) - 1));
  };
  A.machToCas = (m, pa) => {
    const qcP = Math.pow(1 + 0.2 * m * m, 3.5) - 1;
    return A0 * Math.sqrt(5 * (Math.pow(qcP * A.delta(pa) + 1, 2 / 7) - 1));
  };
  /** TAS from CAS. compressible=false is the classic E6-B density-altitude method. */
  A.tas = (cas, pa, oat, compressible) =>
    compressible ? A.casToMach(cas, pa) * A.sos(oat) : cas / Math.sqrt(A.sigma(pa, oat));
  A.casFromTas = (tas, pa, oat, compressible) =>
    compressible ? A.machToCas(tas / A.sos(oat), pa) : tas * Math.sqrt(A.sigma(pa, oat));

  // ---------- Wind triangle (all TRUE, wind FROM) ----------
  A.wind = (tc, tas, wd, ws) => {
    const rel = U.n360(wd - tc);
    const x = (ws * U.sin(rel)) / tas;
    if (Math.abs(x) >= 1) return null;
    const wca = U.asind(x);
    const gs = tas * U.cos(wca) - ws * U.cos(rel);
    return { wca, th: U.n360(tc + wca), gs, head: ws * U.cos(rel), cross: ws * U.sin(rel) };
  };
  A.findWind = (tc, gs, th, tas) => {
    const wx = gs * U.sin(tc) - tas * U.sin(th);
    const wy = gs * U.cos(tc) - tas * U.cos(th);
    const ws = Math.hypot(wx, wy);
    return { ws, wd: U.n360(U.atan2d(wx, wy) + 180) };
  };
  /** Runway components. head>0 headwind, cross>0 from the right. */
  A.components = (rwy, wd, ws) => {
    const a = U.adiff(wd, rwy);
    return { angle: a, head: ws * U.cos(a), cross: ws * U.sin(a) };
  };

  // ---------- Altimetry ----------
  /** True altitude via E6-B temperature ratio applied to height above the station. */
  A.trueAlt = (ia, elev, oat) => elev + ((ia - elev) * (oat + 273.15)) / (A.isa(ia) + 273.15);

  // ---------- Turns & aerodynamics ----------
  A.rot = (tas, bank) => (1091 * U.tan(bank)) / tas; // deg/sec
  A.radius = (tas, bank) => (tas * tas) / (11.26 * U.tan(bank)); // ft
  A.stdRateBank = (tas) => U.atand((3 * tas) / 1091);
  A.loadFactor = (bank) => 1 / U.cos(bank);
  A.pivotal = (gs) => (gs * gs) / 11.3; // ft AGL
  A.hydroplane = (psi) => 9 * Math.sqrt(psi);
  A.hydroplaneNR = (psi) => 7.7 * Math.sqrt(psi);
  A.ftPerNm = (deg) => 6076.12 * U.tan(deg);

  // ---------- Holding entry (AIM 5-3-8) ----------
  /** heading = heading crossing the fix, inbound = inbound course. */
  A.holdEntry = (heading, inbound, rightTurns) => {
    const t = U.n360(heading - inbound);
    if (rightTurns) {
      if (t >= 110 && t < 180) return 'Teardrop';
      if (t >= 180 && t < 290) return 'Parallel';
      return 'Direct';
    }
    if (t > 180 && t <= 250) return 'Teardrop';
    if (t > 70 && t <= 180) return 'Parallel';
    return 'Direct';
  };
  A.holdBoundaryDist = (heading, inbound, rightTurns) => {
    const t = U.n360(heading - inbound);
    const b = rightTurns ? [110, 180, 290] : [70, 180, 250];
    return Math.min(...b.map((x) => Math.abs(U.adiff(t, x))));
  };

  // ---------- Winds aloft (FB) ----------
  A.encodeFB = (alt, dir, spd, temp) => {
    let d = Math.round(dir / 10), s = spd;
    if (spd < 5) return alt === 3000 ? '9900' : '9900' + fbTemp(alt, temp);
    if (s >= 100) { d += 50; s -= 100; }
    const ds = String(d).padStart(2, '0') + String(s).padStart(2, '0');
    return alt === 3000 ? ds : ds + fbTemp(alt, temp);
  };
  function fbTemp(alt, t) {
    if (alt > 24000) return String(Math.abs(t)).padStart(2, '0');
    return (t >= 0 ? '+' : '-') + String(Math.abs(t)).padStart(2, '0');
  }
  A.decodeFB = (code, alt) => {
    const c = String(code).trim();
    if (!/^\d{4}([+-]?\d{2})?$/.test(c)) return null;
    let d = parseInt(c.slice(0, 2), 10), s = parseInt(c.slice(2, 4), 10);
    let t = null;
    if (c.length > 4) {
      const tt = c.slice(4);
      t = /^[+-]/.test(tt) ? parseInt(tt, 10) : (alt > 24000 ? -parseInt(tt, 10) : parseInt(tt, 10));
    }
    if (d === 99 && s === 0) return { light: true, temp: t };
    if (d > 36) { d -= 50; s += 100; }
    return { dir: d * 10, spd: s, temp: t };
  };

  // ---------- Fuel ----------
  A.density = { '100LL': 6.0, 'Jet A': 6.7, 'JP-8': 6.7 };
  A.fuelToLb = (v, unit, dens) => (unit === 'lb' ? v : unit === 'kg' ? v * 2.20462 : unit === 'gal' ? v * dens : (v / 3.78541) * dens);
  A.fuelFromLb = (lb, unit, dens) => (unit === 'lb' ? lb : unit === 'kg' ? lb / 2.20462 : unit === 'gal' ? lb / dens : (lb / dens) * 3.78541);
})();
