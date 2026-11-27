/* E6-B Trainer — CX-3 style flight computer tools */
(function () {
  const U = E6.util, A = E6.av, D = E6.diagram;
  const T = (E6.tools = { list: [] });
  const n = (v) => U.parse(v, 'num');
  const ok = (...a) => a.every((x) => isFinite(x));
  const r = (label, value, cls) => [label, value, cls];
  const def = (o) => T.list.push(o);

  T.groups = [
    ['flight', 'Flight'], ['wind', 'Wind'], ['alt', 'Altitude & Air Data'], ['plan', 'Planning'], ['wb', 'Weight & Balance'], ['nav', 'Nav & IFR'], ['util', 'Utilities'],
  ];

  // ---------------- WIND ----------------
  def({
    id: 'wind', group: 'wind', name: 'Heading & Groundspeed', desc: 'Classic wind triangle with variation and deviation.',
    inputs: [{ k: 'tc', l: 'True course', u: '°', v: 90 }, { k: 'tas', l: 'TAS', u: 'kt', v: 120 }, { k: 'wd', l: 'Wind from (true)', u: '°', v: 210 }, { k: 'ws', l: 'Wind speed', u: 'kt', v: 25 }, { k: 'var', l: 'Variation (E+ / W−)', u: '°', v: 0 }, { k: 'dev', l: 'Deviation', u: '°', v: 0 }],
    run(v) {
      const [tc, tas, wd, ws, vr, dv] = ['tc', 'tas', 'wd', 'ws', 'var', 'dev'].map((k) => n(v[k]) || 0);
      const w = A.wind(tc, tas, wd, ws);
      if (!w || !tas) return { warn: 'Wind exceeds TAS across the course — no solution.' };
      const mh = U.n360(w.th - vr);
      return {
        rows: [r('WCA', `${U.fmt(Math.abs(w.wca), 1)}° ${w.wca >= 0 ? 'R' : 'L'}`), r('True heading', U.hdg(w.th) + '°', 'big'), r('Magnetic heading', U.hdg(mh) + '°'), r('Compass heading', U.hdg(mh + dv) + '°'), r('Groundspeed', U.fmt(w.gs) + ' kt', 'big'), r(w.head >= 0 ? 'Headwind' : 'Tailwind', U.fmt(Math.abs(w.head), 1) + ' kt'), r('Crosswind', `${U.fmt(Math.abs(w.cross), 1)} kt ${w.cross >= 0 ? 'R' : 'L'}`)],
        svg: D.wind({ tc, th: w.th, tas, gs: w.gs, wd, ws }),
      };
    },
  });

  def({
    id: 'findwind', group: 'wind', name: 'Find Wind', desc: 'Actual wind from heading/TAS vs track/GS.',
    inputs: [{ k: 'th', l: 'True heading', u: '°', v: 80 }, { k: 'tas', l: 'TAS', u: 'kt', v: 140 }, { k: 'tc', l: 'True track', u: '°', v: 88 }, { k: 'gs', l: 'Groundspeed', u: 'kt', v: 125 }],
    run(v) {
      const th = n(v.th), tas = n(v.tas), tc = n(v.tc), gs = n(v.gs);
      if (!ok(th, tas, tc, gs)) return {};
      const w = A.findWind(tc, gs, th, tas);
      return { rows: [r('Wind from', U.hdg(w.wd) + '°', 'big'), r('Wind speed', U.fmt(w.ws) + ' kt', 'big'), r('Drift', `${U.fmt(Math.abs(U.adiff(tc, th)), 1)}° ${U.adiff(tc, th) >= 0 ? 'R' : 'L'}`)], svg: D.wind({ tc, th, tas, gs, wd: w.wd, ws: w.ws }) };
    },
  });

  def({
    id: 'xwind', group: 'wind', name: 'Crosswind Component', desc: 'Runway head/cross components, steady and gust.',
    inputs: [{ k: 'rwy', l: 'Runway (number or heading)', u: '', v: 27 }, { k: 'wd', l: 'Wind from', u: '°', v: 300 }, { k: 'ws', l: 'Wind speed', u: 'kt', v: 15 }, { k: 'g', l: 'Gust (optional)', u: 'kt', v: '' }],
    run(v) {
      let rw = n(v.rwy); const wd = n(v.wd), ws = n(v.ws), g = n(v.g);
      if (!ok(rw, wd, ws)) return {};
      if (rw <= 36) rw *= 10;
      const c = A.components(rw, wd, ws), cg = isFinite(g) ? A.components(rw, wd, g) : null;
      const rows = [r('Angle off runway', U.fmt(Math.abs(c.angle)) + '°'), r('Crosswind', `${U.fmt(Math.abs(c.cross), 1)} kt ${c.cross >= 0 ? 'R' : 'L'}`, 'big'), r(c.head >= 0 ? 'Headwind' : 'Tailwind', U.fmt(Math.abs(c.head), 1) + ' kt', 'big')];
      if (cg) rows.push(r('Gust crosswind', U.fmt(Math.abs(cg.cross), 1) + ' kt'), r(cg.head >= 0 ? 'Gust headwind' : 'Gust tailwind', U.fmt(Math.abs(cg.head), 1) + ' kt'), r('Gust factor (add ½)', '+' + U.fmt((g - ws) / 2, 1) + ' kt to approach speed'));
      return { rows, svg: D.rwy({ rh: rw, wd, ws: cg ? g : ws, cross: (cg || c).cross, head: (cg || c).head, rname: String(Math.round(rw / 10) || 36).padStart(2, '0') }) };
    },
  });

  def({
    id: 'fb', group: 'wind', name: 'Winds Aloft Decoder', desc: 'Decode FB forecast groups (e.g. 7325-08).',
    inputs: [{ k: 'code', l: 'Group', u: '', v: '7325-08', type: 'text' }, { k: 'alt', l: 'Altitude', u: 'ft', v: 9000 }],
    run(v) {
      const alt = n(v.alt), d = A.decodeFB(v.code, alt);
      if (!d) return { warn: 'Enter 4 or 6 digits, e.g. 2715, 2715-05, 731548.' };
      if (d.light) return { rows: [r('Wind', 'Light & variable (< 5 kt)', 'big'), r('Temp', d.temp == null ? '—' : d.temp + '°C')] };
      return { rows: [r('Direction (true)', U.hdg(d.dir) + '°', 'big'), r('Speed', d.spd + ' kt', 'big'), r('Temperature', d.temp == null ? 'not forecast' : d.temp + '°C'), r('ISA deviation', d.temp == null ? '—' : U.signed(d.temp - A.isa(alt), 1) + '°C')] };
    },
  });

  // ---------------- ALT & AIR DATA ----------------
  def({
    id: 'airdata', group: 'alt', name: 'TAS & Density Altitude', desc: 'Pressure altitude, density altitude, TAS and Mach from cockpit data.',
    inputs: [{ k: 'ia', l: 'Indicated altitude', u: 'ft', v: 7500 }, { k: 'alt', l: 'Altimeter', u: 'inHg', v: 29.92 }, { k: 'oat', l: 'OAT', u: '°C', v: 10 }, { k: 'cas', l: 'CAS', u: 'kt', v: 110 }],
    run(v) {
      const ia = n(v.ia), al = n(v.alt), oat = n(v.oat), cas = n(v.cas);
      if (!ok(ia, al, oat)) return {};
      const pa = A.paInHg(ia, al), isa = A.isa(pa), da = A.densityAlt(pa, oat);
      const rows = [r('Pressure altitude', U.fmt(pa) + ' ft'), r('ISA temp', U.fmt(isa, 1) + '°C'), r('ISA deviation', U.signed(oat - isa, 1) + '°C'), r('Density altitude', U.fmt(da) + ' ft', 'big'), r('DA (rule of thumb)', U.fmt(A.daRule(pa, oat)) + ' ft')];
      if (isFinite(cas)) rows.push(r('TAS (E6-B method)', U.fmt(A.tas(cas, pa, oat, false)) + ' kt', 'big'), r('TAS (compressible)', U.fmt(A.tas(cas, pa, oat, true)) + ' kt'), r('Mach', U.fmt(A.casToMach(cas, pa), 3)));
      return { rows };
    },
  });

  def({
    id: 'mach', group: 'alt', name: 'Mach ↔ TAS', desc: 'Speed of sound from static air temperature.',
    inputs: [{ k: 'm', l: 'Mach (leave blank to solve)', u: 'M', v: 0.78 }, { k: 'tas', l: 'TAS (leave blank to solve)', u: 'kt', v: '' }, { k: 'oat', l: 'SAT', u: '°C', v: -54 }],
    run(v) {
      const m = n(v.m), tas = n(v.tas), oat = n(v.oat);
      if (!isFinite(oat)) return {};
      const a = A.sos(oat), rows = [r('Speed of sound', U.fmt(a, 1) + ' kt')];
      if (isFinite(m)) rows.push(r('TAS', U.fmt(m * a) + ' kt', 'big'));
      else if (isFinite(tas)) rows.push(r('Mach', U.fmt(tas / a, 3), 'big'));
      return { rows };
    },
  });

  def({
    id: 'truealt', group: 'alt', name: 'True Altitude', desc: 'Temperature correction to indicated altitude.',
    inputs: [{ k: 'ia', l: 'Indicated altitude', u: 'ft', v: 9000 }, { k: 'el', l: 'Station elevation', u: 'ft', v: 1000 }, { k: 'oat', l: 'OAT at altitude', u: '°C', v: -20 }],
    run(v) {
      const ia = n(v.ia), el = n(v.el), oat = n(v.oat);
      if (!ok(ia, el, oat)) return {};
      const ta = A.trueAlt(ia, el, oat);
      return { rows: [r('True altitude', U.fmt(ta) + ' ft', 'big'), r('Correction', U.signed(ta - ia) + ' ft'), r('ISA deviation', U.signed(oat - A.isa(ia), 1) + '°C'), r('4%/10°C rule', U.fmt(ia + (ia - el) * 0.004 * (oat - A.isa(ia))) + ' ft')], warn: ta < ia ? 'Colder than standard: you are LOWER than indicated.' : null };
    },
  });

  def({
    id: 'isa', group: 'alt', name: 'Standard Atmosphere', desc: 'ISA properties at a pressure altitude.',
    inputs: [{ k: 'a', l: 'Pressure altitude', u: 'ft', v: 35000 }],
    run(v) {
      const a = n(v.a); if (!isFinite(a)) return {};
      const t = A.isa(a);
      return { rows: [r('Temperature', `${U.fmt(t, 1)}°C / ${U.fmt(A.cToF(t), 1)}°F`, 'big'), r('Pressure', `${U.fmt(A.pressInHg(a), 2)} inHg / ${U.fmt(A.pressInHg(a) * 33.8639, 1)} hPa`), r('Pressure ratio δ', U.fmt(A.delta(a), 4)), r('Density ratio σ', U.fmt(A.sigma(a, t), 4)), r('Speed of sound', U.fmt(A.sos(t), 1) + ' kt')] };
    },
  });

  def({
    id: 'pa', group: 'alt', name: 'Pressure Altitude', desc: 'From field elevation and altimeter setting.',
    inputs: [{ k: 'el', l: 'Field elevation', u: 'ft', v: 5434 }, { k: 'q', l: 'Altimeter (inHg or hPa)', u: '', v: 30.12 }],
    run(v) {
      const el = n(v.el), q = n(v.q); if (!ok(el, q)) return {};
      const pa = q > 100 ? A.paHpa(el, q) : A.paInHg(el, q);
      return { rows: [r('Pressure altitude', U.fmt(pa) + ' ft', 'big'), r('Setting', q > 100 ? `${q} hPa = ${U.fmt(q / 33.8639, 2)} inHg` : `${q.toFixed(2)} inHg = ${U.fmt(q * 33.8639)} hPa`)] };
    },
  });

  // ---------------- FLIGHT ----------------
  def({
    id: 'tsd', group: 'flight', name: 'Time · Speed · Distance', desc: 'Fill any two, leave one blank.',
    inputs: [{ k: 'd', l: 'Distance', u: 'NM', v: 142 }, { k: 'gs', l: 'Groundspeed', u: 'kt', v: 118 }, { k: 't', l: 'Time (h:mm)', u: 'h:mm', v: '', kind: 'hm' }],
    run(v) {
      const d = n(v.d), gs = n(v.gs), t = U.parse(v.t, 'hm');
      if (ok(d, gs) && gs) return { rows: [r('Time', U.hm((d / gs) * 60), 'big'), r('Minutes', U.fmt((d / gs) * 60, 1)), r('NM per minute', U.fmt(gs / 60, 2))] };
      if (ok(d, t) && t) return { rows: [r('Groundspeed', U.fmt(d / (t / 60)) + ' kt', 'big')] };
      if (ok(gs, t)) return { rows: [r('Distance', U.fmt((gs * t) / 60, 1) + ' NM', 'big')] };
      return { warn: 'Enter any two values.' };
    },
  });

  def({
    id: 'fuel', group: 'flight', name: 'Fuel: Rate · Time · Amount', desc: 'Fill any two, leave one blank. Any unit.',
    inputs: [{ k: 'ff', l: 'Fuel flow', u: '/hr', v: 9.5 }, { k: 't', l: 'Time (h:mm)', u: 'h:mm', v: '2:30', kind: 'hm' }, { k: 'f', l: 'Fuel', u: '', v: '' }],
    run(v) {
      const ff = n(v.ff), t = U.parse(v.t, 'hm'), f = n(v.f);
      if (ok(ff, t)) return { rows: [r('Fuel', U.fmt((ff * t) / 60, 1), 'big')] };
      if (ok(f, t) && t) return { rows: [r('Fuel flow', U.fmt(f / (t / 60), 2) + ' /hr', 'big')] };
      if (ok(f, ff) && ff) return { rows: [r('Endurance', U.hm((f / ff) * 60), 'big')] };
      return { warn: 'Enter any two values.' };
    },
  });

  def({
    id: 'turn', group: 'flight', name: 'Turn Performance', desc: 'Radius, rate, load factor and stall-speed rise.',
    inputs: [{ k: 'tas', l: 'TAS', u: 'kt', v: 120 }, { k: 'b', l: 'Bank angle', u: '°', v: 30 }, { k: 'vs', l: 'Stall speed 1G (optional)', u: 'kt', v: 48 }],
    run(v) {
      const tas = n(v.tas), b = n(v.b), vs = n(v.vs); if (!ok(tas, b) || b <= 0 || b >= 90) return {};
      const rows = [r('Radius', `${U.fmt(A.radius(tas, b))} ft (${U.fmt(A.radius(tas, b) / 6076, 2)} NM)`, 'big'), r('Rate of turn', U.fmt(A.rot(tas, b), 2) + ' °/s', 'big'), r('Time for 360°', U.ms(360 / A.rot(tas, b) / 60)), r('Load factor', U.fmt(A.loadFactor(b), 2) + ' G'), r('Std-rate bank', `${U.fmt(A.stdRateBank(tas), 1)}° (rule ${U.fmt(tas / 10 + 7)}°)`)];
      if (isFinite(vs)) rows.push(r('Stall speed in turn', U.fmt(vs * Math.sqrt(A.loadFactor(b))) + ' kt'));
      return { rows };
    },
  });

  def({
    id: 'descent', group: 'flight', name: 'Climb / Descent Planner', desc: 'Path angle, gradient, rate, distance and time.',
    inputs: [{ k: 'a1', l: 'From altitude', u: 'ft', v: 35000 }, { k: 'a2', l: 'To altitude', u: 'ft', v: 10000 }, { k: 'gs', l: 'Groundspeed', u: 'kt', v: 420 }, { k: 'ang', l: 'Path angle', u: '°', v: 3 }, { k: 'fpm', l: 'or rate (fpm, overrides angle)', u: 'fpm', v: '' }],
    run(v) {
      const a1 = n(v.a1), a2 = n(v.a2), gs = n(v.gs), ang = n(v.ang), fpmIn = n(v.fpm);
      if (!ok(a1, a2, gs) || !gs) return {};
      const dh = Math.abs(a1 - a2);
      let fpn, fpm;
      if (isFinite(fpmIn) && fpmIn) { fpm = fpmIn; fpn = (fpm * 60) / gs; } else { fpn = A.ftPerNm(ang || 3); fpm = (fpn * gs) / 60; }
      const d = dh / fpn, t = dh / fpm;
      return { rows: [r('Distance needed', U.fmt(d, 1) + ' NM', 'big'), r('Rate', U.fmt(fpm) + ' fpm', 'big'), r('Time', U.ms(t)), r('Gradient', `${U.fmt(fpn)} ft/NM (${U.fmt(fpn / 60.76, 2)}%)`), r('Path angle', U.fmt(U.atand(fpn / 6076.12), 2) + '°'), r('3:1 rule', U.fmt((dh / 1000) * 3, 1) + ' NM')] };
    },
  });

  def({
    id: 'climb', group: 'flight', name: 'Climb Gradient', desc: 'Required rate from ft/NM or % gradient.',
    inputs: [{ k: 'g', l: 'Gradient (ft/NM)', u: 'ft/NM', v: 400 }, { k: 'p', l: 'or gradient %', u: '%', v: '' }, { k: 'gs', l: 'Climb GS', u: 'kt', v: 90 }],
    run(v) {
      let g = n(v.g); const p = n(v.p), gs = n(v.gs);
      if (isFinite(p)) g = p * 60.76;
      if (!ok(g, gs)) return {};
      return { rows: [r('Required rate', U.fmt((g * gs) / 60) + ' fpm', 'big'), r('Gradient', `${U.fmt(g)} ft/NM = ${U.fmt(g / 60.76, 2)}%`), r('Climb angle', U.fmt(U.atand(g / 6076.12), 2) + '°')] };
    },
  });

  // ---------------- PLANNING ----------------
  def({
    id: 'fuelconv', group: 'plan', name: 'Fuel Weight & Volume', desc: 'Gallons, liters, pounds, kilograms.',
    inputs: [{ k: 'v', l: 'Amount', u: '', v: 50 }, { k: 'u', l: 'Unit', type: 'sel', v: 'gal', opts: [['gal', 'US gal'], ['L', 'Liters'], ['lb', 'Pounds'], ['kg', 'Kilograms']] }, { k: 't', l: 'Fuel', type: 'sel', v: '6.0', opts: [['6.0', '100LL (6.0 lb/gal)'], ['6.7', 'Jet A / JP-8 (6.7 lb/gal)'], ['8.35', 'Water / ADI (8.35 lb/gal)']] }],
    run(v) {
      const x = n(v.v), d = parseFloat(v.t); if (!isFinite(x)) return {};
      const lb = A.fuelToLb(x, v.u, d);
      return { rows: [r('US gallons', U.fmt(A.fuelFromLb(lb, 'gal', d), 1)), r('Liters', U.fmt(A.fuelFromLb(lb, 'L', d), 1)), r('Pounds', U.fmt(lb, 1), 'big'), r('Kilograms', U.fmt(lb / 2.20462, 1))] };
    },
  });

  def({
    id: 'etp', group: 'plan', name: 'ETP & PNR', desc: 'Equal time point and point of no return.',
    inputs: [{ k: 'D', l: 'Leg distance', u: 'NM', v: 2000 }, { k: 'go', l: 'GS on / out', u: 'kt', v: 430 }, { k: 'gr', l: 'GS return', u: 'kt', v: 500 }, { k: 'f', l: 'Fuel available (PNR)', u: '', v: 20000 }, { k: 'ff', l: 'Fuel flow', u: '/hr', v: 5200 }],
    run(v) {
      const D0 = n(v.D), go = n(v.go), gr = n(v.gr), f = n(v.f), ff = n(v.ff);
      const rows = [];
      if (ok(D0, go, gr)) { const d = (D0 * gr) / (go + gr); rows.push(r('ETP from departure', U.fmt(d) + ' NM', 'big'), r('Time to ETP', U.hm((d / go) * 60))); }
      if (ok(f, ff, go, gr) && ff) { const E = f / ff, t = (E * gr) / (go + gr); rows.push(r('Endurance', U.hm(E * 60)), r('Time to PNR', U.hm(t * 60), 'big'), r('PNR distance', U.fmt(t * go) + ' NM', 'big')); }
      return { rows };
    },
  });

  def({
    id: 'offcourse', group: 'nav', name: '1-in-60 Off-Course', desc: 'Correction to parallel and to converge on destination.',
    inputs: [{ k: 'fl', l: 'Distance flown', u: 'NM', v: 40 }, { k: 'off', l: 'Distance off course', u: 'NM', v: 4 }, { k: 'rem', l: 'Distance remaining', u: 'NM', v: 60 }],
    run(v) {
      const fl = n(v.fl), off = n(v.off), rem = n(v.rem); if (!ok(fl, off, rem) || !fl || !rem) return {};
      const a = (off * 60) / fl, b = (off * 60) / rem;
      return { rows: [r('Track error', U.fmt(a, 1) + '°'), r('Convergence', U.fmt(b, 1) + '°'), r('Total correction', U.fmt(a + b, 1) + '°', 'big'), r('Exact (trig)', U.fmt(U.atand(off / fl) + U.atand(off / rem), 1) + '°')] };
    },
  });

  def({
    id: 'tts', group: 'nav', name: 'Time / Distance to Station', desc: 'Wingtip bearing method.',
    inputs: [{ k: 's', l: 'Seconds for change', u: 's', v: 90 }, { k: 'd', l: 'Degrees changed', u: '°', v: 10 }, { k: 'tas', l: 'TAS', u: 'kt', v: 120 }],
    run(v) {
      const s = n(v.s), d = n(v.d), tas = n(v.tas); if (!ok(s, d, tas) || !d) return {};
      return { rows: [r('Time to station', U.fmt(s / d, 1) + ' min', 'big'), r('Distance', U.fmt((tas * (s / d)) / 60, 1) + ' NM', 'big')] };
    },
  });

  def({
    id: 'hold', group: 'nav', name: 'Holding Entry & Wind', desc: 'AIM entry sector plus outbound heading (triple drift).',
    inputs: [{ k: 'ib', l: 'Inbound course', u: '°', v: 270 }, { k: 'h', l: 'Heading at fix', u: '°', v: 45 }, { k: 'turn', l: 'Turns', type: 'sel', v: 'R', opts: [['R', 'Right (standard)'], ['L', 'Left']] }, { k: 'ih', l: 'Inbound heading (optional)', u: '°', v: '' }],
    run(v) {
      const ib = n(v.ib), h = n(v.h), ih = n(v.ih), right = v.turn === 'R';
      if (!ok(ib, h)) return {};
      const e = A.holdEntry(h, ib, right), close = A.holdBoundaryDist(h, ib, right) <= 5;
      const rows = [r('Entry', e, 'big'), r('Outbound course', U.hdg(ib + 180) + '°')];
      if (isFinite(ih)) { const wca = U.adiff(ih, ib); rows.push(r('Inbound WCA', `${U.fmt(Math.abs(wca))}° ${wca >= 0 ? 'R' : 'L'}`), r('Outbound heading (×3)', U.hdg(ib + 180 - 3 * wca) + '°', 'big')); }
      return { rows, warn: close ? 'Within 5° of a sector boundary — either entry is acceptable.' : null, svg: D.hold({ inbound: ib, right, heading: h, entry: e }) };
    },
  });

  def({
    id: 'appr', group: 'nav', name: 'Approach Helpers', desc: 'Glidepath rate, VDP, FAF→MAP timing.',
    inputs: [{ k: 'gs', l: 'Final GS', u: 'kt', v: 90 }, { k: 'ang', l: 'Glidepath', u: '°', v: 3 }, { k: 'hat', l: 'HAT (MDA − TDZE)', u: 'ft', v: 450 }, { k: 'd', l: 'FAF → MAP', u: 'NM', v: 4.5 }],
    run(v) {
      const gs = n(v.gs), ang = n(v.ang), hat = n(v.hat), d = n(v.d); const rows = [];
      if (ok(gs, ang)) rows.push(r('Descent rate', U.fmt((gs * A.ftPerNm(ang)) / 60) + ' fpm', 'big'), r('GS × 5 rule', U.fmt(gs * 5) + ' fpm'));
      if (isFinite(hat)) rows.push(r('VDP from threshold', U.fmt(hat / 300, 2) + ' NM', 'big'));
      if (ok(gs, d) && gs) rows.push(r('FAF → MAP time', U.ms((d / gs) * 60), 'big'));
      return { rows };
    },
  });

  // ---------------- W&B ----------------
  def({
    id: 'wb', group: 'wb', name: 'Weight & Balance', desc: 'Loading table with CG and optional %MAC.', custom: 'wb',
  });

  def({
    id: 'shift', group: 'wb', name: 'Weight Shift / Ballast', desc: 'How much to move or add to reach a target CG.',
    inputs: [{ k: 'W', l: 'Total weight', u: 'lb', v: 2400 }, { k: 'cg', l: 'Current CG', u: 'in', v: 47.8 }, { k: 'tgt', l: 'Target CG', u: 'in', v: 47.3 }, { k: 'd', l: 'Distance moved (shift)', u: 'in', v: 58 }, { k: 'arm', l: 'Ballast arm (add)', u: 'in', v: 37 }],
    run(v) {
      const W = n(v.W), cg = n(v.cg), t = n(v.tgt), d = n(v.d), arm = n(v.arm); const rows = [];
      if (!ok(W, cg, t)) return {};
      if (isFinite(d) && d) rows.push(r('Weight to shift', U.fmt((W * Math.abs(cg - t)) / d, 1) + ' lb', 'big'));
      if (isFinite(arm) && arm !== t) { const w = (W * (t - cg)) / (arm - t); rows.push(r(w >= 0 ? 'Ballast to add' : 'Cannot reach by adding here', U.fmt(Math.abs(w), 1) + ' lb', 'big')); }
      return { rows };
    },
  });

  // ---------------- UTIL ----------------
  def({
    id: 'rules', group: 'util', name: 'Rules of Thumb', desc: 'Pivotal altitude, hydroplaning, cloud base, glide, Va.',
    inputs: [{ k: 'gs', l: 'GS (pivotal alt)', u: 'kt', v: 110 }, { k: 'psi', l: 'Tire pressure', u: 'psi', v: 38 }, { k: 't', l: 'Temp', u: '°C', v: 24 }, { k: 'dp', l: 'Dew point', u: '°C', v: 14 }, { k: 'agl', l: 'Height AGL (glide)', u: 'ft', v: 5000 }, { k: 'gr', l: 'Glide ratio', u: ':1', v: 9 }, { k: 'va', l: 'Va at max wt', u: 'kt', v: 105 }, { k: 'wm', l: 'Max weight', u: 'lb', v: 2550 }, { k: 'w', l: 'Actual weight', u: 'lb', v: 2100 }],
    run(v) {
      const x = {}; Object.keys(v).forEach((k) => (x[k] = n(v[k])));
      const rows = [];
      if (isFinite(x.gs)) rows.push(r('Pivotal altitude', U.fmt(A.pivotal(x.gs)) + ' ft AGL'));
      if (isFinite(x.psi)) rows.push(r('Hydroplaning (rolling / locked)', `${U.fmt(A.hydroplane(x.psi))} / ${U.fmt(A.hydroplaneNR(x.psi))} kt`));
      if (ok(x.t, x.dp)) rows.push(r('Cloud base', U.fmt(((x.t - x.dp) / 2.5) * 1000) + ' ft AGL'));
      if (ok(x.agl, x.gr)) rows.push(r('Glide distance (still air)', U.fmt((x.agl * x.gr) / 6076, 1) + ' NM'));
      if (ok(x.va, x.wm, x.w) && x.wm) rows.push(r('Va at actual weight', U.fmt(x.va * Math.sqrt(x.w / x.wm)) + ' kt'));
      return { rows };
    },
  });

  const CV = {
    Distance: [['NM', 1852], ['SM', 1609.344], ['km', 1000], ['ft', 0.3048], ['m', 1]],
    Speed: [['kt', 1852 / 3600], ['mph', 1609.344 / 3600], ['km/h', 1000 / 3600], ['m/s', 1], ['fpm', 0.00508]],
    Weight: [['lb', 0.45359237], ['kg', 1]],
    Volume: [['US gal', 3.78541], ['L', 1], ['Imp gal', 4.54609], ['qt', 0.946353]],
    Pressure: [['inHg', 33.8639], ['hPa', 1], ['psi', 68.9476], ['mmHg', 1.33322]],
  };
  def({
    id: 'conv', group: 'util', name: 'Unit Converter', desc: 'Everything at once.',
    inputs: [{ k: 'v', l: 'Value', u: '', v: 100 }, { k: 'u', l: 'From', type: 'sel', v: 'Distance|NM', opts: [].concat(...Object.entries(CV).map(([g, l]) => l.map(([u]) => [g + '|' + u, `${u} (${g.toLowerCase()})`])), [['T|C', '°C (temp)'], ['T|F', '°F (temp)']]) }],
    run(v) {
      const x = n(v.v); if (!isFinite(x)) return {};
      const [g, u] = v.u.split('|');
      if (g === 'T') { const c = u === 'C' ? x : A.fToC(x); return { rows: [r('°C', U.fmt(c, 1)), r('°F', U.fmt(A.cToF(c), 1)), r('K', U.fmt(c + 273.15, 2))] }; }
      const base = x * CV[g].find((e) => e[0] === u)[1];
      return { rows: CV[g].map(([uu, f]) => r(uu, U.fmt(base / f, 3), uu === u ? 'dim' : '')) };
    },
  });

  def({ id: 'timer', group: 'util', name: 'Stopwatch & Timer', desc: 'Leg timing, approach timing, countdowns.', custom: 'timer' });
})();
