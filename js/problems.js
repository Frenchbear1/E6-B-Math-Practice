/* E6-B Trainer — randomized, realistic problem generators */
(function () {
  const U = E6.util, A = E6.av, AP = E6.airports;
  const G = (E6.gen = { list: [], byId: {} });

  G.groups = [
    { id: 'tsd', name: 'Time · Speed · Distance' },
    { id: 'fuel', name: 'Fuel Planning' },
    { id: 'wind', name: 'Wind & Heading' },
    { id: 'air', name: 'Air Data & Altimetry' },
    { id: 'cd', name: 'Climb & Descent' },
    { id: 'nav', name: 'Navigation' },
    { id: 'ifr', name: 'Instrument Procedures' },
    { id: 'aero', name: 'Maneuvers & Aerodynamics' },
    { id: 'wb', name: 'Weight & Balance' },
    { id: 'ops', name: 'Advanced Ops' },
    { id: 'conv', name: 'Conversions' },
  ];

  function def(o) { o.profiles = o.profiles || ['ga', 'air', 'mil']; G.list.push(o); G.byId[o.id] = o; }

  // ---------- field helpers ----------
  const F = {
    num: (key, label, unit, answer, tol, o) => Object.assign({ key, label, unit, answer, tol, kind: 'num', dp: 0 }, o || {}),
    hdg: (key, label, answer, tol, o) => Object.assign({ key, label, unit: '°', answer: U.n360(answer), tol, kind: 'hdg', dp: 0 }, o || {}),
    hm: (key, label, answer, tol, o) => Object.assign({ key, label, unit: 'h:mm', answer, tol, kind: 'hm' }, o || {}),
    ms: (key, label, answer, tol, o) => Object.assign({ key, label, unit: 'm:ss', answer, tol, kind: 'ms' }, o || {}),
    clock: (key, label, answer, tol, o) => Object.assign({ key, label, unit: 'Z', answer, tol, kind: 'clock' }, o || {}),
  };
  G.F = F;

  const ft = (v) => U.fmt(v) + ' ft';
  const kt = (v) => U.fmt(v) + ' kt';
  const nm = (v, dp = 0) => U.fmt(v, dp) + ' NM';
  const deg = (v) => U.hdg(v) + '°';
  const pct = (v, p) => Math.max(p, Math.abs(v) * 0);
  const clockS = (sec) => {
    sec = ((Math.round(sec) % 86400) + 86400) % 86400;
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return String(h).padStart(2, '0') + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') + 'Z';
  };

  // ---------- context ----------
  G.ctx = function (pk, s, needs) {
    const P = E6.profiles[pk];
    let list = P.aircraft.filter((a) => !needs || a[needs]);
    if (!list.length) list = P.aircraft;
    const ac = U.pick(list);
    const d = s.difficulty || 2;
    const fu = s.fuelUnit && s.fuelUnit !== 'auto' ? s.fuelUnit : P.fuelUnit;
    const dens = A.density[P.fuelType];
    const c = { P, p: pk, ac, d, s, fu, dens, ft: P.fuelType };
    c.r = (rng, steps) => U.step(rng[0], rng[1], Array.isArray(steps) ? steps[d - 1] : steps);
    c.gsR = [Math.round(ac.tas[0] * 0.85), Math.round(ac.tas[1] * 1.12)];
    c.legR = ac.leg || P.leg;
    c.fdp = fu === 'gal' || fu === 'L' ? 1 : 0;
    c.fq = (v) => {
      const lg = Math.floor(Math.log10(Math.abs(v) || 1));
      let m = Math.pow(10, lg - 1); if (v >= 1000) m /= 10;
      let st = m * [5, 2, 1][d - 1];
      if ((fu === 'gal' || fu === 'L') && st < 0.1) st = 0.1;
      if (fu === 'gal' && d === 1) st = Math.max(st, 0.5);
      return U.roundTo(v, st);
    };
    /** convert from profile base unit (gal for GA, lb otherwise) to display unit */
    c.toFu = (v) => A.fuelFromLb(A.fuelToLb(v, P.fuelUnit, dens), fu, dens);
    c.flow = () => c.fq(c.toFu(U.float(ac.ff[0], ac.ff[1])));
    c.f = (v) => U.fmt(v, c.fdp) + ' ' + fu;
    c.fr = (v) => U.fmt(v, c.fdp) + ' ' + fu + '/hr';
    c.ftol = (v) => Math.max(Math.abs(v) * 0.012, fu === 'gal' ? 0.2 : fu === 'L' ? 1 : 2);
    c.altStr = (a) => (a >= 18000 ? 'FL' + Math.round(a / 100) : U.fmt(a) + ' ft');
    c.cruise = () => {
      const alt = c.r(ac.alt, pk === 'ga' ? [1000, 500, 500] : [2000, 1000, 1000]);
      const dev = d === 3 ? U.int(-20, 20) : U.int(-10, 15);
      const oat = Math.round(A.isa(alt) + dev);
      let tas, mach = null;
      if (ac.mach) { mach = U.round(c.r(ac.mach, [0.02, 0.01, 0.01]), 2); tas = Math.round(mach * A.sos(oat)); }
      else tas = c.r(ac.tas, [5, 1, 1]);
      return { alt, oat, tas, mach, dev };
    };
    c.windSpd = (tas) => c.r([P.wind[0], Math.max(P.wind[0] + 5, Math.min(P.wind[1], tas * 0.33))], [5, 1, 1]);
    c.apt = () => U.pick(AP.ids);
    c.vor = () => U.pick(AP.vors);
    c.fix = () => U.pick(AP.fixes);
    return c;
  };

  // =====================================================================
  // TIME · SPEED · DISTANCE
  // =====================================================================
  def({
    id: 'tsd_time', group: 'tsd', name: 'Time en route (ETE)',
    info: ['Time (hr) = Distance ÷ Groundspeed', 'E6-B: speed index ▲60 over GS on the outer scale; read time on the inner scale under the distance.'],
    gen(c) {
      const gs = c.r(c.gsR, [10, 5, 1]), d = c.r(c.legR, [10, 5, 1]), t = (d / gs) * 60;
      return {
        text: `You're planning the next leg in the ${c.ac.name}. The measured distance is ${d} NM and the forecast groundspeed is ${gs} kt. What is the estimated time en route?`,
        given: [['Distance', nm(d)], ['Groundspeed', kt(gs)]],
        fields: [F.hm('ete', 'ETE', t, Math.max(1, t * 0.01))],
        solution: ['Time = Distance ÷ Groundspeed', `${d} ÷ ${gs} = ${U.fmt(d / gs, 3)} hr`, `${U.fmt(d / gs, 3)} × 60 = ${U.fmt(t, 1)} min = <b>${U.hm(t)}</b>`],
        e6b: `Put the ▲60 speed index under ${gs} on the outer scale. Find ${d} on the outer scale and read ≈${U.fmt(t, 0)} min directly beneath it.`,
        hint: 'Divide distance by groundspeed, then convert hours to minutes.',
      };
    },
  });

  def({
    id: 'tsd_gs', group: 'tsd', name: 'Groundspeed from checkpoints',
    info: ['GS = Distance ÷ Time (hr)', 'Time checkpoints with a stopwatch; use minutes and seconds.'],
    gen(c) {
      const gs0 = c.r(c.gsR, 1);
      const d = c.r(c.p === 'ga' ? [8, 40] : [20, 120], [5, 1, 1]);
      let tSec = (d / gs0) * 3600;
      tSec = U.roundTo(tSec, c.d === 1 ? 60 : c.d === 2 ? 15 : 5);
      const gs = d / (tSec / 3600);
      const start = U.int(0, 86399 / 5) * 5;
      return {
        text: `En route in the ${c.ac.name}, you cross one checkpoint at ${clockS(start)} and another ${d} NM farther along your course at ${clockS(start + tSec)}. What is your groundspeed?`,
        given: [['Checkpoint 1', clockS(start)], ['Checkpoint 2', clockS(start + tSec)], ['Distance between', nm(d)]],
        fields: [F.num('gs', 'Groundspeed', 'kt', gs, Math.max(2, gs * 0.015))],
        solution: [`Elapsed time = ${U.ms(tSec / 60)} = ${U.fmt(tSec / 60, 2)} min`, `GS = ${d} NM ÷ (${U.fmt(tSec / 60, 2)} ÷ 60) hr`, `GS = <b>${U.fmt(gs)} kt</b>`],
        e6b: `Put ${U.fmt(tSec / 60, 1)} min (inner scale) under ${d} (outer scale). Read GS above the ▲60 index.`,
      };
    },
  });

  def({
    id: 'tsd_dist', group: 'tsd', name: 'Distance flown',
    info: ['Distance = GS × Time (hr)'],
    gen(c) {
      const gs = c.r(c.gsR, [10, 5, 1]), t = c.r([10, c.p === 'ga' ? 120 : 240], [5, 1, 1]), d = (gs * t) / 60;
      return {
        text: `You've held a groundspeed of ${gs} kt for ${U.hm(t)} since leveling off. How far have you flown?`,
        given: [['Groundspeed', kt(gs)], ['Time', U.hm(t) + ' (h:mm)']],
        fields: [F.num('d', 'Distance', 'NM', d, Math.max(1, d * 0.01), { dp: 0 })],
        solution: [`Distance = ${gs} × (${t} ÷ 60)`, `= ${gs} × ${U.fmt(t / 60, 3)} = <b>${U.fmt(d, 1)} NM</b>`],
        e6b: `▲60 under ${gs}. Find ${t} min on the inner scale; read ${U.fmt(d, 0)} NM above it.`,
      };
    },
  });

  def({
    id: 'tsd_eta', group: 'tsd', name: 'ETA (Zulu)',
    info: ['ETA = Departure time + ETE (+ climb segment)', 'Work in Zulu to avoid date/time-zone errors.'],
    gen(c) {
      const gs = c.r(c.gsR, [10, 5, 1]), d = c.r(c.legR, [10, 5, 1]);
      const dep = U.int(0, 287) * 5;
      let ete = (d / gs) * 60, climb = null;
      const sol = [];
      if (c.d >= 2) {
        const cm = U.int(8, c.p === 'ga' ? 15 : 22), cd = Math.round((cm / 60) * gs * 0.7);
        if (cd < d - 10) {
          climb = { cm, cd };
          ete = cm + ((d - cd) / gs) * 60;
          sol.push(`Climb: ${cm} min covering ${cd} NM`, `Cruise: (${d} − ${cd}) ÷ ${gs} × 60 = ${U.fmt(((d - cd) / gs) * 60, 1)} min`);
        }
      }
      if (!climb) sol.push(`ETE = ${d} ÷ ${gs} × 60 = ${U.fmt(ete, 1)} min`);
      sol.push(`Total ETE ≈ ${U.hm(ete)}`, `ETA = ${U.clock(dep)} + ${U.hm(ete)} = <b>${U.clock(dep + ete)}</b>`);
      return {
        text: `You depart ${c.apt()} at ${U.clock(dep)} for a ${d} NM trip.${climb ? ` The climb takes ${climb.cm} min and covers ${climb.cd} NM; after that` : ''} cruise groundspeed is ${gs} kt. What is your ETA in Zulu?`,
        given: [['Departure', U.clock(dep)], ['Distance', nm(d)], ['Cruise GS', kt(gs)]].concat(climb ? [['Climb', `${climb.cm} min / ${climb.cd} NM`]] : []),
        fields: [F.clock('eta', 'ETA (HHMM)', dep + ete, 2)],
        solution: sol,
      };
    },
  });

  def({
    id: 'tsd_low', group: 'tsd', name: 'Low-level timing (seconds)', profiles: ['mil'], needs: 'low',
    info: ['NM per minute = GS ÷ 60 (420 KGS = 7 NM/min)', 'Seconds = Distance ÷ GS × 3600'],
    gen(c) {
      const opts = [120, 180, 210, 240, 300, 360, 420, 480, 540].filter((g) => g >= c.ac.low[0] - 30 && g <= c.ac.low[1] + 30);
      const gs = c.d === 1 ? U.pick(opts) : c.r(c.ac.low, [30, 10, 5]);
      const d = U.round(U.float(1.2, 12), 1);
      const sec = (d / gs) * 3600;
      return {
        text: `On a low-level route in the ${c.ac.name} at ${gs} KGS, the next turn point is ${d} NM ahead. How many seconds until you reach it?`,
        given: [['Groundspeed', gs + ' KGS'], ['Distance', nm(d, 1)]],
        fields: [F.num('sec', 'Time', 'sec', sec, Math.max(1.5, sec * 0.02))],
        solution: [`${gs} KGS ÷ 60 = ${U.fmt(gs / 60, 2)} NM/min = ${U.fmt(gs / 3600, 4)} NM/sec`, `${d} ÷ ${U.fmt(gs / 60, 2)} = ${U.fmt(d / (gs / 60), 2)} min`, `= <b>${U.fmt(sec)} sec</b>`],
        hint: `At ${gs} KGS you cover ${U.fmt(gs / 60, 1)} NM every minute.`,
      };
    },
  });

  // =====================================================================
  // FUEL
  // =====================================================================
  def({
    id: 'fuel_burn', group: 'fuel', name: 'Fuel burned',
    info: ['Fuel = Fuel flow × Time (hr)', 'E6-B: ▲60 over fuel flow; read fuel above time.'],
    gen(c) {
      const ff = c.flow(), t = c.r([20, c.p === 'ga' ? 300 : 480], [15, 5, 1]), f = (ff * t) / 60;
      return {
        text: `The ${c.ac.name} is burning ${c.fr(ff)}. How much fuel will a ${U.hm(t)} leg consume?`,
        given: [['Fuel flow', c.fr(ff)], ['Time', U.hm(t) + ' (h:mm)']],
        fields: [F.num('f', 'Fuel burned', c.fu, f, c.ftol(f), { dp: c.fdp })],
        solution: [`Fuel = ${U.fmt(ff, c.fdp)} × (${t} ÷ 60)`, `= ${U.fmt(ff, c.fdp)} × ${U.fmt(t / 60, 3)} = <b>${c.f(f)}</b>`],
        e6b: `▲60 index under ${U.fmt(ff, c.fdp)}. Over ${t} min (inner) read ${U.fmt(f, c.fdp)} (outer).`,
      };
    },
  });

  def({
    id: 'fuel_rate', group: 'fuel', name: 'Fuel flow from fuel used',
    info: ['Fuel flow = Fuel used ÷ Time (hr)'],
    gen(c) {
      const ff0 = c.toFu(U.float(c.ac.ff[0], c.ac.ff[1])), t = c.r([30, 300], [15, 5, 1]);
      const used = c.fq((ff0 * t) / 60), ff = used / (t / 60);
      return {
        text: `After ${U.hm(t)} of flight in the ${c.ac.name}, the totalizer shows ${c.f(used)} used. What is the average fuel flow?`,
        given: [['Fuel used', c.f(used)], ['Time', U.hm(t) + ' (h:mm)']],
        fields: [F.num('ff', 'Fuel flow', c.fu + '/hr', ff, c.ftol(ff), { dp: c.fdp })],
        solution: [`Fuel flow = ${U.fmt(used, c.fdp)} ÷ (${t} ÷ 60)`, `= <b>${c.fr(ff)}</b>`],
        e6b: `Put ${t} min (inner) under ${U.fmt(used, c.fdp)} (outer); read the fuel flow over the ▲60 index.`,
      };
    },
  });

  def({
    id: 'fuel_endur', group: 'fuel', name: 'Endurance',
    info: ['Endurance = Usable fuel ÷ Fuel flow'],
    gen(c) {
      const ff = c.flow(), fob = c.fq(c.toFu(c.ac.cap * U.float(0.45, 1)));
      const t = (fob / ff) * 60;
      return {
        text: `You have ${c.f(fob)} of usable fuel in the ${c.ac.name} with a planned fuel flow of ${c.fr(ff)}. What is your endurance (to dry tanks)?`,
        given: [['Usable fuel', c.f(fob)], ['Fuel flow', c.fr(ff)]],
        fields: [F.hm('e', 'Endurance', t, Math.max(2, t * 0.015))],
        solution: [`${U.fmt(fob, c.fdp)} ÷ ${U.fmt(ff, c.fdp)} = ${U.fmt(fob / ff, 3)} hr`, `= <b>${U.hm(t)}</b> (before any reserve)`],
        e6b: `▲60 under ${U.fmt(ff, c.fdp)}; find ${U.fmt(fob, c.fdp)} on the outer scale and read time beneath it.`,
      };
    },
  });

  def({
    id: 'fuel_reserve', group: 'fuel', name: 'Min fuel w/ Part 91 reserves', profiles: ['ga'],
    info: ['§91.151 VFR: destination + 30 min (day) / 45 min (night) at normal cruise', '§91.167 IFR: destination + alternate (if required) + 45 min at normal cruise'],
    gen(c) {
      const type = U.pick(c.d === 1 ? ['day', 'night'] : ['day', 'night', 'ifr']);
      const gs = c.r(c.gsR, [10, 5, 1]), d = c.r([40, 260], [10, 5, 1]), ff = c.flow();
      const taxi = c.fq(c.toFu(U.pick([1, 1.1, 1.4, 2])));
      const trip = (d / gs) * ff;
      let alt = 0, altD = 0;
      if (type === 'ifr') { altD = c.r([20, 70], [10, 5, 1]); alt = (altD / gs) * ff; }
      const resMin = type === 'day' ? 30 : 45, res = (ff * resMin) / 60;
      const total = taxi + trip + alt + res;
      const label = { day: 'day VFR', night: 'night VFR', ifr: 'IFR (alternate required)' }[type];
      const sol = [`Trip: ${d} ÷ ${gs} = ${U.fmt(d / gs, 3)} hr × ${U.fmt(ff, c.fdp)} = ${c.f(trip)}`];
      if (alt) sol.push(`Alternate: ${altD} ÷ ${gs} × ${U.fmt(ff, c.fdp)} = ${c.f(alt)}`);
      sol.push(`Reserve (${resMin} min, ${type === 'ifr' ? '§91.167' : '§91.151'}): ${c.f(res)}`, `Start/taxi/run-up: ${c.f(taxi)}`, `Minimum at engine start = <b>${c.f(total)}</b>`);
      return {
        text: `Planning a ${label} trip in the ${c.ac.name}: ${d} NM at ${gs} kt GS, burning ${c.fr(ff)}.${alt ? ` The alternate is ${altD} NM beyond the destination (use the same GS).` : ''} Allow ${c.f(taxi)} for start, taxi and run-up. What is the minimum fuel required at engine start?`,
        given: [['Flight', label], ['Distance', nm(d)], ['GS', kt(gs)], ['Fuel flow', c.fr(ff)], ['Taxi fuel', c.f(taxi)]].concat(alt ? [['Alternate', nm(altD)]] : []),
        fields: [F.num('f', 'Minimum fuel', c.fu, total, c.ftol(total), { dp: c.fdp })],
        solution: sol,
        hint: 'Trip + alternate (IFR) + required reserve time at cruise fuel flow + taxi.',
      };
    },
  });

  def({
    id: 'fuel_conv', group: 'fuel', name: 'Fuel weight ↔ volume',
    info: ['100LL ≈ 6.0 lb/gal · Jet A / JP-8 ≈ 6.7 lb/gal (varies with temperature)', '1 US gal = 3.785 L · 1 kg = 2.2046 lb', 'kg = L × specific gravity'],
    gen(c) {
      const dens = c.dens;
      const v = c.p === 'ga' ? U.pick(['gal2lb', 'lb2gal', 'gal2lb', 'L2gal']) : U.pick(['lb2gal', 'gal2lb', 'kg2lb', 'uplift']);
      if (v === 'gal2lb') {
        const g = c.r([10, Math.round(c.p === 'ga' ? c.ac.cap : c.ac.cap / dens)], [5, 1, 1]), lb = g * dens;
        return { text: `The fueler just put ${U.fmt(g)} gal of ${c.ft} in the ${c.ac.name}. How much weight did that add?`, given: [['Volume', U.fmt(g) + ' gal'], ['Density', dens + ' lb/gal']], fields: [F.num('lb', 'Weight', 'lb', lb, Math.max(2, lb * 0.01))], solution: [`${U.fmt(g)} gal × ${dens} lb/gal = <b>${U.fmt(lb)} lb</b>`], e6b: 'Use the fuel-weight index on the slide rule (or multiply directly).' };
      }
      if (v === 'L2gal') {
        const L = c.r([40, 200], [10, 5, 1]), g = L / 3.78541;
        return { text: `A European FBO bills you for ${L} liters of avgas. How many US gallons is that?`, given: [['Volume', L + ' L']], fields: [F.num('g', 'Volume', 'gal', g, Math.max(0.3, g * 0.01), { dp: 1 })], solution: [`${L} ÷ 3.785 = <b>${U.fmt(g, 1)} gal</b>`] };
      }
      if (v === 'lb2gal') {
        const lb = c.p === 'ga' ? c.r([60, 300], [10, 5, 1]) : c.r([2000, Math.min(c.ac.cap, 60000)], [1000, 500, 100]);
        const g = lb / dens;
        return { text: `You need to add ${U.fmt(lb)} lb of ${c.ft}. The truck meters in US gallons. How many gallons should you request?`, given: [['Weight', U.fmt(lb) + ' lb'], ['Density', dens + ' lb/gal']], fields: [F.num('g', 'Volume', 'gal', g, Math.max(0.5, g * 0.01), { dp: 0 })], solution: [`${U.fmt(lb)} ÷ ${dens} = <b>${U.fmt(g)} gal</b>`] };
      }
      if (v === 'kg2lb') {
        const kg = c.r([1000, Math.min(c.ac.cap / 2.2, 40000)], [500, 100, 50]), lb = kg * 2.20462;
        return { text: `The fuel slip shows ${U.fmt(kg)} kg on board. Your FMS is set for pounds. What do you enter?`, given: [['Fuel', U.fmt(kg) + ' kg']], fields: [F.num('lb', 'Fuel', 'lb', lb, lb * 0.01)], solution: [`${U.fmt(kg)} × 2.2046 = <b>${U.fmt(lb)} lb</b>`] };
      }
      // uplift
      const sg = U.pick([0.79, 0.8, 0.81]);
      const req = c.r([6000, Math.min(c.ac.cap / 2.2, 60000)], [1000, 500, 100]), rem = c.r([800, req * 0.4], [500, 100, 100]);
      const L = (req - rem) / sg;
      return { text: `Overseas, the flight plan requires ${U.fmt(req)} kg of block fuel. You arrived with ${U.fmt(rem)} kg remaining. Fuel specific gravity is ${sg}. How many liters must the fueler upload?`, given: [['Required', U.fmt(req) + ' kg'], ['Remaining', U.fmt(rem) + ' kg'], ['Specific gravity', sg + ' kg/L']], fields: [F.num('L', 'Uplift', 'L', L, L * 0.01)], solution: [`Needed: ${U.fmt(req)} − ${U.fmt(rem)} = ${U.fmt(req - rem)} kg`, `Liters = kg ÷ SG = ${U.fmt(req - rem)} ÷ ${sg} = <b>${U.fmt(L)} L</b>`] };
    },
  });

  def({
    id: 'fuel_121', group: 'fuel', name: 'Part 121 domestic fuel', profiles: ['air'],
    info: ['§121.639: fuel to destination, then to the most distant alternate, then 45 min at normal cruise fuel consumption'],
    gen(c) {
      const cr = c.cruise(), gs = c.r([cr.tas - 60, cr.tas + 50], [10, 5, 1]), ff = c.flow();
      const d = c.r([200, 1800], [50, 10, 1]), altD = c.r([60, 220], [10, 5, 1]);
      const altGs = c.r([Math.round(cr.tas * 0.75), Math.round(cr.tas * 0.9)], [10, 5, 1]), altFf = c.fq(ff * U.float(1.05, 1.2));
      const trip = (d / gs) * ff, alt = (altD / altGs) * altFf, res = ff * 0.75, total = trip + alt + res;
      const taxi = c.fq(c.toFu(c.ac.ff[0] * 0.15));
      const fields = [F.num('to', 'Min takeoff fuel', c.fu, total, c.ftol(total))];
      if (c.d >= 2) fields.push(F.num('blk', 'Block fuel (incl. taxi)', c.fu, total + taxi, c.ftol(total)));
      return {
        text: `Domestic dispatch, ${c.ac.name}: ${d} NM to destination at ${gs} kt burning ${c.fr(ff)}. The most distant alternate is ${altD} NM beyond, flown at ${altGs} kt burning ${c.fr(altFf)}. Normal cruise fuel flow is ${c.fr(ff)}.${c.d >= 2 ? ` Taxi fuel is ${c.f(taxi)}.` : ''} What's the minimum fuel at takeoff under §121.639?`,
        given: [['Trip', `${nm(d)} @ ${kt(gs)}`], ['Trip FF', c.fr(ff)], ['Alternate', `${nm(altD)} @ ${kt(altGs)}`], ['Alt FF', c.fr(altFf)]].concat(c.d >= 2 ? [['Taxi', c.f(taxi)]] : []),
        fields,
        solution: [`Trip: ${d} ÷ ${gs} × ${U.fmt(ff)} = ${c.f(trip)}`, `Alternate: ${altD} ÷ ${altGs} × ${U.fmt(altFf)} = ${c.f(alt)}`, `Reserve: 45 min × ${U.fmt(ff)} = ${c.f(res)}`, `Minimum takeoff fuel = <b>${c.f(total)}</b>`].concat(c.d >= 2 ? [`Block = takeoff + taxi = <b>${c.f(total + taxi)}</b>`] : []),
      };
    },
  });

  def({
    id: 'fuel_bingo', group: 'fuel', name: 'Bingo fuel', profiles: ['mil'],
    info: ['Bingo = fuel to return at planned RTB profile + approach/pattern fuel + required landing reserve'],
    gen(c) {
      const tas = c.cruise().tas, hw = c.r([-40, 60], [10, 5, 1]), gs = tas - hw;
      const d = c.r([40, Math.min(400, c.legR[1])], [10, 5, 1]);
      const ff = c.fq(c.toFu(U.float(c.ac.ff[0] * 0.85, c.ac.ff[1] * 0.9)));
      const resv = c.fq(c.toFu(c.r(c.ac.reserve || [800, 1200], 50)));
      const appr = c.d >= 2 ? c.fq(resv * 0.25) : 0;
      const bingo = (d / gs) * ff + resv + appr;
      return {
        text: `You're ${d} NM from home plate in the ${c.ac.name}. RTB at altitude will give ${gs} KGS (${hw >= 0 ? hw + ' kt headwind' : -hw + ' kt tailwind'}) at ${c.fr(ff)}. You must land with ${c.f(resv)}${appr ? ` and budget ${c.f(appr)} for the approach` : ''}. What is bingo fuel?`,
        given: [['Distance home', nm(d)], ['RTB groundspeed', gs + ' KGS'], ['RTB fuel flow', c.fr(ff)], ['Landing reserve', c.f(resv)]].concat(appr ? [['Approach fuel', c.f(appr)]] : []),
        fields: [F.num('b', 'Bingo', c.fu, bingo, c.ftol(bingo) * 1.5)],
        solution: [`RTB time = ${d} ÷ ${gs} = ${U.fmt((d / gs) * 60, 1)} min`, `RTB fuel = ${U.fmt(d / gs, 3)} × ${U.fmt(ff)} = ${c.f((d / gs) * ff)}`, `Bingo = ${c.f((d / gs) * ff)} + ${c.f(resv)}${appr ? ' + ' + c.f(appr) : ''} = <b>${c.f(bingo)}</b>`],
      };
    },
  });

  // =====================================================================
  // WIND
  // =====================================================================
  def({
    id: 'wind_tri', group: 'wind', name: 'Wind triangle: heading & GS',
    info: ['WCA = asin(WS × sin(wind angle) ÷ TAS)', 'GS = TAS × cos(WCA) − WS × cos(wind angle)', 'TH = TC ± WCA · MH = TH − E / + W variation ("East is least, West is best") · CH = MH ± deviation'],
    gen(c) {
      const cr = c.cruise(), tas = cr.tas;
      let tc, wd, ws, w;
      do {
        tc = c.r([5, 360], [5, 1, 1]); wd = c.r([10, 360], [10, 10, 1]); ws = c.windSpd(tas);
        w = A.wind(tc, tas, wd, ws);
      } while (!w || Math.abs(w.wca) < 1);
      const fields = [F.hdg('th', 'True heading', w.th, 2)];
      const sol = [`Wind angle = ${deg(wd)} − ${deg(tc)} = ${U.fmt(U.adiff(wd, tc))}° (${U.adiff(wd, tc) >= 0 ? 'right' : 'left'} of course)`, `WCA = asin(${ws} × sin ${U.fmt(Math.abs(U.adiff(wd, tc)))}° ÷ ${tas}) = ${U.fmt(Math.abs(w.wca), 1)}° ${w.wca >= 0 ? 'right' : 'left'}`, `TH = ${deg(tc)} ${w.wca >= 0 ? '+' : '−'} ${U.fmt(Math.abs(w.wca), 1)} = <b>${deg(w.th)}</b>`];
      let vr = 0, dv = 0, mh = w.th, ch;
      const given = [['True course', deg(tc)], ['TAS', kt(tas)], ['Wind (true)', `${deg(wd)} @ ${ws} kt`]];
      if (c.d >= 2) {
        do vr = U.int(-16, 16); while (vr === 0);
        mh = U.n360(w.th - vr);
        fields.push(F.hdg('mh', 'Magnetic heading', mh, 2));
        given.push(['Variation', U.ew(vr)]);
        sol.push(`MH = TH ${vr > 0 ? '−' : '+'} ${Math.abs(vr)}° ${vr > 0 ? 'E' : 'W'} = <b>${deg(mh)}</b>`);
      }
      if (c.d === 3) {
        dv = U.pick([-3, -2, -1, 1, 2, 3]); ch = U.n360(mh + dv);
        const ref = U.roundTo(mh, 30) || 360;
        fields.push(F.hdg('ch', 'Compass heading', ch, 2));
        given.push(['Compass card', `For ${U.hdg(ref)} steer ${U.hdg(ref + dv)}`]);
        sol.push(`Deviation ${dv > 0 ? '+' : '−'}${Math.abs(dv)}° → CH = <b>${deg(ch)}</b>`);
      }
      fields.push(F.num('gs', 'Groundspeed', 'kt', w.gs, Math.max(2, w.gs * 0.015)));
      sol.push(`GS = ${tas} cos ${U.fmt(Math.abs(w.wca), 1)}° − ${ws} cos ${U.fmt(Math.abs(U.adiff(wd, tc)))}° = <b>${U.fmt(w.gs)} kt</b>`);
      const wrongTh = U.n360(tc - w.wca), wrongGs = tas + w.head;
      const mk = (th, gs) => { const o = { th, gs }; o.mh = U.n360(th - vr); o.ch = U.n360(o.mh + dv); return o; };
      return {
        text: `${c.ac.name} at ${c.altStr(cr.alt)}. True course ${deg(tc)}, TAS ${tas} kt. Forecast winds aloft are ${deg(wd)} at ${ws} kt.${c.d >= 2 ? ' Find the true and magnetic heading' + (c.d === 3 ? ', compass heading' : '') + ', and groundspeed.' : ' Find the true heading and groundspeed.'}`,
        given, fields, solution: sol,
        e6b: `Wind side: set ${U.hdg(wd)} under TRUE INDEX, mark ${ws} kt up from the grommet. Rotate to ${U.hdg(tc)} under TRUE INDEX, slide until the mark sits on the ${tas} kt arc. Read WCA (${U.fmt(Math.abs(w.wca))}° ${w.wca >= 0 ? 'right/+' : 'left/−'}) and GS (${U.fmt(w.gs)}) under the grommet.`,
        diagram: { type: 'wind', tc, th: w.th, tas, gs: w.gs, wd, ws },
        distractors: [mk(wrongTh, w.gs), mk(w.th, wrongGs), mk(wrongTh, wrongGs)],
        hint: `Wind from the ${U.adiff(wd, tc) >= 0 ? 'right' : 'left'} → correct ${U.adiff(wd, tc) >= 0 ? 'right (add)' : 'left (subtract)'}.`,
      };
    },
  });

  def({
    id: 'wind_find', group: 'wind', name: 'Find the wind',
    info: ['Wind = Ground vector − Air vector', 'E6-B: TC under index, GS dot; rotate to TH, slide TAS arc; wind = mark relative to grommet.'],
    gen(c) {
      const cr = c.cruise(), tas = cr.tas;
      let tc, wd, ws, w;
      do { tc = c.r([5, 360], [5, 1, 1]); wd = c.r([10, 360], [10, 5, 1]); ws = Math.max(12, c.windSpd(tas)); w = A.wind(tc, tas, wd, ws); } while (!w);
      const th = Math.round(w.th), gs = Math.round(w.gs), ans = A.findWind(tc, gs, th, tas);
      return {
        text: `Level at ${c.altStr(cr.alt)} in the ${c.ac.name}, you're holding a true heading of ${deg(th)} at ${tas} KTAS. The GPS shows a true track of ${deg(tc)} and a groundspeed of ${gs} kt. What are the actual winds?`,
        given: [['True heading', deg(th)], ['TAS', kt(tas)], ['True track', deg(tc)], ['Groundspeed', kt(gs)]],
        fields: [F.hdg('wd', 'Wind direction (from)', ans.wd, 4), F.num('ws', 'Wind speed', 'kt', ans.ws, Math.max(2, ans.ws * 0.06))],
        solution: [`Drift = ${deg(tc)} − ${deg(th)} = ${U.fmt(U.adiff(tc, th))}° → wind is from the ${U.adiff(th, tc) > 0 ? 'right' : 'left'}`, `Ground vector − air vector gives wind blowing toward ${deg(ans.wd + 180)}`, `Wind = <b>${deg(ans.wd)} @ ${U.fmt(ans.ws)} kt</b>`],
        e6b: `Set ${U.hdg(tc)} under TRUE INDEX, grommet on ${gs}. Mark where the ${tas} kt arc crosses the ${U.fmt(Math.abs(U.adiff(th, tc)))}° ${U.adiff(th, tc) >= 0 ? 'right' : 'left'} WCA line. Rotate the mark to straight above the grommet and read wind direction under TRUE INDEX and speed from the grommet.`,
        diagram: { type: 'wind', tc, th, tas, gs, wd: ans.wd, ws: ans.ws },
      };
    },
  });

  def({
    id: 'wind_xw', group: 'wind', name: 'Crosswind / headwind components',
    info: ['Crosswind = WS × sin(angle) · Headwind = WS × cos(angle)', 'Rule of thumb: 30° ≈ ½, 45° ≈ ¾ (0.7), 60°+ ≈ full crosswind', 'Use the gust value for crosswind limits. Tower/ATIS winds are magnetic.'],
    gen(c) {
      const rwy = U.int(1, 36), rh = rwy * 10;
      const off = c.d === 1 ? U.pick([-60, -45, -30, 30, 45, 60, -20, 20, 90, -90]) : c.r([-120, 120], [10, 10, 1]);
      const wd = U.n360(rh + off) || 360, ws = c.r([5, 25], [5, 1, 1]);
      const gust = c.d >= 2 && U.chance(0.4) ? ws + U.int(6, 14) : null;
      const sp = gust || ws, comp = A.components(rh, wd, sp);
      const rname = String(rwy).padStart(2, '0');
      return {
        text: `Landing ${c.apt()} Runway ${rname}. Tower reports wind ${U.hdg(wd)} at ${ws}${gust ? ' gusting ' + gust : ''} kt. What are the crosswind and headwind components${gust ? ' (use the gust)' : ''}? Enter a tailwind as a negative headwind.`,
        given: [['Runway', rname + ` (${U.hdg(rh)}°)`], ['Wind', `${U.hdg(wd)}° @ ${ws}${gust ? 'G' + gust : ''} kt`]],
        fields: [F.num('xw', 'Crosswind', 'kt', Math.abs(comp.cross), 1.5), F.num('hw', 'Headwind (− = tail)', 'kt', comp.head, 1.5, { signed: true })],
        solution: [`Angle = ${U.hdg(wd)} − ${U.hdg(rh)} = ${U.fmt(Math.abs(comp.angle))}° from the ${comp.angle >= 0 ? 'right' : 'left'}`, `Crosswind = ${sp} × sin ${U.fmt(Math.abs(comp.angle))}° = <b>${U.fmt(Math.abs(comp.cross), 1)} kt</b> from the ${comp.cross >= 0 ? 'right' : 'left'}`, `Headwind = ${sp} × cos ${U.fmt(Math.abs(comp.angle))}° = <b>${U.fmt(comp.head, 1)} kt</b>${comp.head < 0 ? ' (tailwind)' : ''}`],
        diagram: { type: 'rwy', rh, wd, ws: sp, cross: comp.cross, head: comp.head, rname },
      };
    },
  });

  def({
    id: 'wind_rwy', group: 'wind', name: 'Best runway for the wind',
    info: ['Choose the runway most nearly aligned with the wind: max headwind, min crosswind.'],
    gen(c) {
      let ends, wd, ws, best, scored;
      do {
        const n = c.d === 1 ? 2 : U.pick([2, 3]);
        const base = U.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]);
        const r = [];
        for (const b of base) { if (r.every((x) => Math.min(Math.abs(x - b), 18 - Math.abs(x - b)) >= 4)) r.push(b); if (r.length === n) break; }
        ends = []; r.forEach((x) => { ends.push(x); ends.push(x + 18); });
        wd = c.r([10, 360], 10); ws = c.r([10, 25], 5);
        scored = ends.map((e) => ({ e, ...A.components(e * 10, wd, ws) })).sort((a, b) => b.head - a.head);
        best = scored[0];
      } while (scored[1].head > best.head - 2);
      const nm2 = (e) => String(e > 36 ? e - 36 : e).padStart(2, '0');
      const pairs = []; for (let i = 0; i < ends.length; i += 2) pairs.push(nm2(ends[i]) + '/' + nm2(ends[i + 1]));
      const choices = U.shuffle(scored.map((s) => s.e));
      return {
        text: `${c.apt()} has runways ${pairs.join(', ')}. The ATIS wind is ${U.hdg(wd)} at ${ws} kt. Which runway gives the most headwind and least crosswind?`,
        given: [['Runways', pairs.join(' · ')], ['Wind', `${U.hdg(wd)}° @ ${ws} kt`]],
        choices: choices.map((e) => 'Runway ' + nm2(e)),
        answer: choices.indexOf(best.e),
        solution: scored.map((s) => `Rwy ${nm2(s.e)}: head ${U.fmt(s.head, 1)} kt, cross ${U.fmt(Math.abs(s.cross), 1)} kt`).concat([`Best: <b>Runway ${nm2(best.e)}</b>`]),
        diagram: { type: 'rwy', rh: best.e * 10, wd, ws, cross: best.cross, head: best.head, rname: nm2(best.e) },
      };
    },
  });

  def({
    id: 'wind_fb', group: 'wind', name: 'Decode winds aloft (FB)',
    info: ['DDSS±TT: direction (tens of degrees TRUE), speed (kt), temp (°C)', 'Direction code 51–86: subtract 50 from direction, add 100 to speed', 'Above 24,000 ft temps are negative; the sign is omitted', 'No winds are forecast within 1,500 ft of station elevation; 3,000 ft has no temperature'],
    gen(c) {
      const alts = c.p === 'ga' ? [3000, 6000, 9000, 12000, 18000] : [18000, 24000, 30000, 34000, 39000];
      const alt = U.pick(alts);
      const dir = U.int(1, 36) * 10;
      const spd = alt >= 24000 ? (U.chance(0.55) ? U.int(100, 160) : U.int(20, 99)) : alt >= 12000 ? U.int(15, 80) : U.int(6, 45);
      let temp = Math.round(A.isa(alt) + U.int(-8, 8));
      if (alt > 24000 && temp >= 0) temp = -temp - 1;
      const code = A.encodeFB(alt, dir, spd, temp);
      const st = U.pick(AP.vors);
      const fields = [F.hdg('d', 'Direction (true)', dir, 0, { fixed: true }), F.num('s', 'Speed', 'kt', spd, 0, { fixed: true })];
      if (alt !== 3000) fields.push(F.num('t', 'Temperature', '°C', temp, 0, { fixed: true, signed: true }));
      const sol = [`Code: <code>${code}</code>`, `Direction digits ${code.slice(0, 2)}${spd >= 100 ? ` → ≥51 so subtract 50 → ${dir / 10}` : ''} → <b>${deg(dir)}</b> true`, `Speed digits ${code.slice(2, 4)}${spd >= 100 ? ' + 100' : ''} → <b>${spd} kt</b>`];
      if (alt !== 3000) sol.push(`Temp ${code.slice(4)}${alt > 24000 ? ' (above FL240 → negative)' : ''} → <b>${temp}°C</b>`);
      return {
        text: `The FB winds aloft forecast for ${st} at ${U.fmt(alt)} ft reads <code class="big">${code}</code>. Decode it.`,
        given: [['Station', st], ['Altitude', ft(alt)], ['Group', code]],
        fields, solution: sol,
      };
    },
  });

  // =====================================================================
  // AIR DATA & ALTIMETRY
  // =====================================================================
  function altimeter(c) {
    if (c.s.pressUnit === 'hPa') { const q = c.r([985, 1038], [5, 1, 1]); return { q, str: q + ' hPa', pa: (e) => A.paHpa(e, q), sol: (e) => `PA = ${U.fmt(e)} + (1013 − ${q}) × 27 ft`, tol: 30 + 3 * Math.abs(1013 - q) }; }
    const a = c.r([2940, 3045], [10, 1, 1]) / 100;
    return { q: a, str: a.toFixed(2) + '"', pa: (e) => A.paInHg(e, a), sol: (e) => `PA = ${U.fmt(e)} + (29.92 − ${a.toFixed(2)}) × 1,000`, tol: 20 };
  }

  def({
    id: 'alt_pa', group: 'air', name: 'Pressure altitude',
    info: ['PA = Field elevation + (29.92 − altimeter) × 1,000 ft', 'Metric: ≈ 27–30 ft per hPa from 1013'],
    gen(c) {
      const apt = U.chance(0.5) ? U.pick(AP.hot) : [c.apt(), '', c.r([0, 4000], [100, 10, 1])];
      const al = altimeter(c), pa = al.pa(apt[2]);
      return {
        text: `${apt[0]} (field elevation ${ft(apt[2])}) is reporting an altimeter setting of ${al.str}. What is the pressure altitude?`,
        given: [['Field elevation', ft(apt[2])], ['Altimeter', al.str]],
        fields: [F.num('pa', 'Pressure altitude', 'ft', pa, al.tol, { signed: true })],
        solution: [al.sol(apt[2]), `= <b>${ft(Math.round(pa))}</b>`],
        hint: 'Low pressure → higher pressure altitude.',
      };
    },
  });

  def({
    id: 'alt_da', group: 'air', name: 'Density altitude',
    info: ['ISA temp ≈ 15°C − 2°C per 1,000 ft', 'DA ≈ PA + 120 × (OAT − ISA)', 'E6-B: align OAT over PA in the airspeed window, read DA.'],
    gen(c) {
      const apt = U.pick(AP.hot), al = altimeter(c);
      const pa = al.pa(apt[2]), isa = A.isa(pa);
      const oat = Math.round(isa + U.int(c.d === 1 ? 5 : -5, 28));
      const da = A.densityAlt(pa, oat), rule = A.daRule(pa, oat);
      return {
        text: `Summer afternoon at ${apt[1]} (${apt[0]}), elevation ${ft(apt[2])}. Altimeter ${al.str}, temperature ${oat}°C. Find the pressure altitude and density altitude.`,
        given: [['Field elevation', ft(apt[2])], ['Altimeter', al.str], ['OAT', oat + '°C']],
        fields: [F.num('pa', 'Pressure altitude', 'ft', pa, al.tol, { signed: true }), F.num('da', 'Density altitude', 'ft', da, 150, { alts: [rule], signed: true })],
        solution: [al.sol(apt[2]) + ` = ${ft(Math.round(pa))}`, `ISA at PA = 15 − 1.98 × ${U.fmt(pa / 1000, 2)} = ${U.fmt(isa, 1)}°C → ISA ${U.signed(oat - isa, 1)}°C`, `Rule of thumb: ${U.fmt(pa)} + 120 × ${U.fmt(oat - isa, 1)} = ${ft(Math.round(rule))}`, `Exact (density ratio σ = ${U.fmt(A.sigma(pa, oat), 4)}): <b>${ft(Math.round(da))}</b>`],
        e6b: `Airspeed window: put ${oat}°C over ${U.fmt(pa / 1000, 1)} (PA in thousands); read ≈${U.fmt(da / 1000, 1)} in the density altitude window.`,
      };
    },
  });

  def({
    id: 'air_tas', group: 'air', name: 'True airspeed from CAS',
    info: ['Low speed: TAS ≈ CAS ÷ √σ (E6-B density-altitude method) · ≈ +2% per 1,000 ft', 'High speed: compressibility matters — go through Mach (CAS → Mach → TAS)'],
    gen(c) {
      const cr = c.cruise();
      const comp = c.p !== 'ga';
      let cas;
      if (c.ac.cas) cas = c.r(c.ac.cas, [5, 1, 1]);
      else cas = Math.round(A.casFromTas(cr.tas, cr.alt, cr.oat, true));
      const tas = A.tas(cas, cr.alt, cr.oat, comp), tasI = A.tas(cas, cr.alt, cr.oat, false);
      const da = A.densityAlt(cr.alt, cr.oat);
      const sol = comp
        ? [`Mach from CAS ${cas} at PA ${U.fmt(cr.alt)}: M ${U.fmt(A.casToMach(cas, cr.alt), 3)}`, `Speed of sound at ${cr.oat}°C = 38.97√(${cr.oat}+273) = ${U.fmt(A.sos(cr.oat), 1)} kt`, `TAS = <b>${U.fmt(tas)} kt</b> (uncorrected E6-B: ${U.fmt(tasI)} kt — compressibility matters up here)`]
        : [`DA ≈ ${ft(Math.round(da))} (σ = ${U.fmt(A.sigma(cr.alt, cr.oat), 4)})`, `TAS = ${cas} ÷ √${U.fmt(A.sigma(cr.alt, cr.oat), 4)} = <b>${U.fmt(tas)} kt</b>`, `Check: 2% per 1,000 ft → ${cas} × (1 + 0.02 × ${U.fmt(da / 1000, 1)}) ≈ ${U.fmt(cas * (1 + 0.02 * da / 1000))} kt`];
      return {
        text: `${c.ac.name} cruising at pressure altitude ${c.altStr(cr.alt)}, OAT ${cr.oat}°C, calibrated airspeed ${cas} kt. What is the true airspeed?`,
        given: [['Pressure altitude', ft(cr.alt)], ['OAT', cr.oat + '°C'], ['CAS', kt(cas)]],
        fields: [F.num('tas', 'TAS', 'kt', tas, Math.max(2, tas * 0.015), comp ? {} : { alts: [A.tas(cas, cr.alt, cr.oat, true)] })],
        solution: sol,
        e6b: comp ? 'On the CX-3: FLT → TAS, enter PALT, CAS and indicated OAT (it handles compressibility and ram rise).' : `Airspeed window: ${cr.oat}°C over ${U.fmt(cr.alt / 1000, 1)}; find ${cas} on the inner scale and read TAS on the outer scale.`,
      };
    },
  });

  def({
    id: 'air_mach', group: 'air', name: 'Mach ↔ TAS', profiles: ['air', 'mil'], needs: 'mach',
    info: ['a (kt) = 38.97 × √(OAT°C + 273.15)', 'TAS = Mach × a · Mach = TAS ÷ a', 'At ISA: ≈661 kt at sea level, ≈573 kt in the stratosphere'],
    gen(c) {
      const cr = c.cruise(), a = A.sos(cr.oat), m = cr.mach || U.round(cr.tas / a, 2);
      if (U.chance(0.5)) {
        return {
          text: `${c.ac.name} at ${c.altStr(cr.alt)}, SAT ${cr.oat}°C, cruising at Mach ${m.toFixed(2)}. What is the TAS?`,
          given: [['Altitude', c.altStr(cr.alt)], ['SAT', cr.oat + '°C'], ['Mach', m.toFixed(2)]],
          fields: [F.num('tas', 'TAS', 'kt', m * a, Math.max(3, m * a * 0.01))],
          solution: [`a = 38.97 × √(${cr.oat} + 273.15) = ${U.fmt(a, 1)} kt`, `TAS = ${m.toFixed(2)} × ${U.fmt(a, 1)} = <b>${U.fmt(m * a)} kt</b>`],
          e6b: 'E6-B: Mach index in the airspeed window over OAT; read TAS opposite the Mach number.',
        };
      }
      const tas = c.r([Math.round(m * a) - 15, Math.round(m * a) + 15], [5, 1, 1]);
      return {
        text: `ATC asks for your Mach number. You're at ${c.altStr(cr.alt)}, SAT ${cr.oat}°C, ${tas} KTAS in the ${c.ac.name}. What do you report?`,
        given: [['Altitude', c.altStr(cr.alt)], ['SAT', cr.oat + '°C'], ['TAS', kt(tas)]],
        fields: [F.num('m', 'Mach', 'M', tas / a, 0.01, { dp: 2 })],
        solution: [`a = 38.97 × √(${cr.oat} + 273.15) = ${U.fmt(a, 1)} kt`, `M = ${tas} ÷ ${U.fmt(a, 1)} = <b>${U.fmt(tas / a, 3)}</b>`],
      };
    },
  });

  def({
    id: 'alt_true', group: 'air', name: 'True altitude (temperature)',
    info: ['Colder than ISA → true altitude LOWER than indicated ("high to low, look out below")', 'TA ≈ IA + (IA − station elev) × 4% per 10°C ISA deviation', 'E6-B: OAT over PA in the altitude window; height above station on inner → true height on outer'],
    gen(c) {
      const elev = c.r([0, 5000], [500, 100, 10]);
      const ia = elev + c.r([3000, 12000], [1000, 500, 100]);
      const dev = c.d === 1 ? U.pick([-20, -15, -10, 10, 15]) : U.int(-30, 20);
      const oat = Math.round(A.isa(ia) + dev);
      const ta = A.trueAlt(ia, elev, oat), rule = ia + (ia - elev) * 0.004 * (oat - A.isa(ia));
      return {
        text: `Winter IFR in the ${c.ac.name}. You're at an indicated altitude of ${ft(ia)} with the local altimeter set (station elevation ${ft(elev)}). OAT is ${oat}°C. What is your approximate true altitude?`,
        given: [['Indicated altitude', ft(ia)], ['Station elevation', ft(elev)], ['OAT', oat + '°C']],
        fields: [F.num('ta', 'True altitude', 'ft', ta, Math.max(40, (ia - elev) * 0.012), { alts: [rule] })],
        solution: [`ISA at ${U.fmt(ia)} ft = ${U.fmt(A.isa(ia), 1)}°C → ISA ${U.signed(oat - A.isa(ia), 1)}°C`, `Height above station = ${U.fmt(ia - elev)} ft`, `Correction = ${U.fmt(ia - elev)} × (${oat}+273) ÷ (${U.fmt(A.isa(ia), 1)}+273) − ${U.fmt(ia - elev)} = ${U.signed(ta - ia)} ft`, `True altitude ≈ <b>${ft(Math.round(ta))}</b>`],
        hint: 'About 4% of the height above the station for every 10°C off standard.',
      };
    },
  });

  def({
    id: 'air_isa', group: 'air', name: 'ISA temperature & deviation',
    info: ['ISA = 15°C − 1.98°C per 1,000 ft up to 36,089 ft, then −56.5°C', 'ISA deviation = OAT − ISA'],
    gen(c) {
      const alt = c.p === 'ga' ? c.r([1000, 14000], [1000, 500, 100]) : c.r([10000, 45000], [1000, 1000, 1000]);
      const isa = A.isa(alt), oat = Math.round(isa + U.int(-15, 20));
      return {
        text: `The OAT at ${c.altStr(alt)} is ${oat}°C. What is the ISA temperature there, and what is the ISA deviation?`,
        given: [['Altitude', c.altStr(alt)], ['OAT', oat + '°C']],
        fields: [F.num('isa', 'ISA temperature', '°C', isa, 1, { signed: true, dp: 1 }), F.num('dev', 'ISA deviation', '°C', oat - isa, 1, { signed: true, dp: 1 })],
        solution: [alt <= 36089 ? `ISA = 15 − 1.98 × ${U.fmt(alt / 1000, 1)} = <b>${U.fmt(isa, 1)}°C</b>` : 'Above the tropopause (36,089 ft) ISA is constant: <b>−56.5°C</b>', `Deviation = ${oat} − (${U.fmt(isa, 1)}) = <b>ISA ${U.signed(oat - isa, 1)}°C</b>`],
      };
    },
  });

  def({
    id: 'wx_cloud', group: 'air', name: 'Cloud base estimate',
    info: ['Base (ft AGL) ≈ (Temp − Dew point) °C ÷ 2.5 × 1,000', 'or (spread °F ÷ 4.4) × 1,000', 'Add field elevation for MSL'],
    gen(c) {
      const t = U.int(8, 34), sp = c.d === 1 ? U.pick([2.5, 5, 7.5, 10]) * 1 : U.int(2, 18);
      const dp = Math.round(t - sp), spread = t - dp;
      const apt = U.chance(0.5) ? U.pick(AP.hot) : [c.apt(), '', c.r([0, 3000], [100, 10, 1])];
      const agl = (spread / 2.5) * 1000;
      return {
        text: `The ${apt[0]} METAR shows ${t}/${String(dp).padStart(2, '0')} (temperature/dew point °C). Field elevation is ${ft(apt[2])}. Estimate the base of cumulus clouds.`,
        given: [['Temp / dew point', `${t}°C / ${dp}°C`], ['Field elevation', ft(apt[2])]],
        fields: [F.num('agl', 'Cloud base', 'ft AGL', agl, Math.max(100, agl * 0.08)), F.num('msl', 'Cloud base', 'ft MSL', agl + apt[2], Math.max(100, agl * 0.08))],
        solution: [`Spread = ${t} − ${dp} = ${spread}°C`, `${spread} ÷ 2.5 × 1,000 = <b>${ft(Math.round(agl))} AGL</b>`, `+ ${U.fmt(apt[2])} = <b>${ft(Math.round(agl + apt[2]))} MSL</b>`],
      };
    },
  });

  // =====================================================================
  // CLIMB & DESCENT
  // =====================================================================
  def({
    id: 'cd_climb', group: 'cd', name: 'Climb gradient → rate',
    info: ['fpm = ft/NM × GS ÷ 60', 'ft/NM = gradient % × 60.76', 'Standard TERPS climb gradient: 200 ft/NM (3.3%)'],
    gen(c) {
      const gs = c.r(c.P.climbGs, [10, 5, 1]);
      const usePct = c.d === 3 || (c.p === 'mil' && U.chance(0.5));
      let grad, pctv;
      if (usePct) { pctv = U.round(U.float(3.3, 7.5), 1); grad = pctv * 60.76; } else grad = c.r([220, 520], [50, 10, 1]);
      const fpm = (grad * gs) / 60, to = c.r([3000, 9000], [500, 100, 100]);
      return {
        text: `The departure procedure at ${c.apt()} requires a minimum climb gradient of ${usePct ? pctv + '%' : grad + ' ft/NM'} to ${ft(to)}. In the ${c.ac.name} you expect a climb groundspeed of ${gs} kt. What rate of climb is required?`,
        given: [['Climb gradient', usePct ? pctv + '%' : grad + ' ft/NM'], ['Climb GS', kt(gs)]],
        fields: [F.num('fpm', 'Rate of climb', 'fpm', fpm, Math.max(10, fpm * 0.02))],
        solution: (usePct ? [`${pctv}% × 60.76 = ${U.fmt(grad)} ft/NM`] : []).concat([`fpm = ${U.fmt(grad)} × ${gs} ÷ 60`, `= <b>${U.fmt(fpm)} fpm</b>`]),
        hint: `At ${gs} kt you cover ${U.fmt(gs / 60, 2)} NM per minute.`,
      };
    },
  });

  def({
    id: 'cd_tod', group: 'cd', name: 'Top of descent',
    info: ['GA: time = altitude to lose ÷ descent rate; distance = GS × time', '3° path ≈ 318 ft/NM → distance ≈ altitude to lose ÷ 318', '3:1 rule: 3 NM per 1,000 ft (add ~10 NM to slow down)', 'Required fpm on 3° ≈ GS × 5'],
    gen(c) {
      if (c.p === 'ga') {
        const elev = c.r([0, 3000], [100, 10, 10]), cruise = c.r([Math.max(c.ac.alt[0], elev + 3500), Math.max(c.ac.alt[1], elev + 5500)], [1000, 500, 500]);
        const tpa = elev + 1000, loss = cruise - tpa;
        const fpm = c.r(c.P.descentFpm, [100, 50, 50]), gs = c.r(c.gsR, [10, 5, 1]);
        const t = loss / fpm, d = (gs * t) / 60;
        return {
          text: `Cruising at ${ft(cruise)} in the ${c.ac.name} with ${gs} kt GS. You want to arrive at pattern altitude (${ft(tpa)} MSL) over the field using a ${fpm} fpm descent at the same groundspeed. How long is the descent, and how far out should you start down?`,
          given: [['Cruise', ft(cruise)], ['Pattern altitude', ft(tpa)], ['Descent rate', fpm + ' fpm'], ['GS', kt(gs)]],
          fields: [F.ms('t', 'Descent time', t, 0.3), F.num('d', 'Start descent', 'NM out', d, Math.max(1, d * 0.03), { dp: 1 })],
          solution: [`Altitude to lose = ${U.fmt(cruise)} − ${U.fmt(tpa)} = ${ft(loss)}`, `Time = ${U.fmt(loss)} ÷ ${fpm} = <b>${U.fmt(t, 1)} min</b>`, `Distance = ${gs} × ${U.fmt(t, 1)} ÷ 60 = <b>${nm(d, 1)}</b>`],
        };
      }
      const cr = c.cruise();
      let cands = [10000, 11000, 12000, 8000, 6000, 4000, 3000, 2000].filter((t) => t <= cr.alt - (cr.alt > 15000 ? 6000 : 2000));
      if (!cands.length) { cr.alt = Math.max(cr.alt, 5000); cands = [2000]; }
      const tgt = U.pick(cands.slice(0, 5)), loss = cr.alt - tgt;
      const gs = c.r([Math.round(cr.tas * 0.85), Math.round(cr.tas * 1.05)], [10, 5, 1]);
      const fpn = A.ftPerNm(3), d = loss / fpn, fpm = (gs * fpn) / 60;
      const fx = c.fix();
      return {
        text: `${c.ac.name} at ${c.altStr(cr.alt)}. The arrival says cross ${fx} at ${ft(tgt)}. Using a 3° descent path, how many NM before ${fx} should you start down, and what descent rate does that take at an average ${gs} kt GS?`,
        given: [['Cruise', c.altStr(cr.alt)], ['Crossing', `${fx} at ${ft(tgt)}`], ['Path', '3.0°'], ['Average GS', kt(gs)]],
        fields: [F.num('d', 'Top of descent', 'NM prior', d, Math.max(1.5, d * 0.03), { alts: [(loss / 1000) * 3] }), F.num('fpm', 'Descent rate', 'fpm', fpm, fpm * 0.03, { alts: [gs * 5] })],
        solution: [`Altitude to lose = ${ft(loss)}`, `3° ≈ ${U.fmt(fpn)} ft/NM → ${U.fmt(loss)} ÷ ${U.fmt(fpn)} = <b>${nm(d)}</b> (3:1 rule: ${nm((loss / 1000) * 3)})`, `Rate = ${gs} × ${U.fmt(fpn)} ÷ 60 = <b>${U.fmt(fpm)} fpm</b> (GS × 5 = ${U.fmt(gs * 5)})`],
      };
    },
  });

  def({
    id: 'cd_rod', group: 'cd', name: 'Descent to a crossing restriction',
    info: ['fpm = altitude to lose ÷ time to the point', 'time (min) = distance ÷ GS × 60'],
    gen(c) {
      const ga = c.p === 'ga';
      const cur = ga ? c.r([6000, 12500], [500, 500, 100]) : c.r([16000, 37000], [1000, 1000, 1000]);
      const tgt = ga ? c.r([3000, cur - 2000], [500, 500, 100]) : c.r([10000, cur - 6000], [1000, 1000, 1000]);
      const gs = c.r(c.gsR, [10, 5, 1]);
      const d = ga ? c.r([15, 40], [5, 1, 1]) : c.r([40, 110], [10, 5, 1]);
      const early = c.d === 3 ? U.pick([3, 5]) : 0;
      const t = ((d - early) / gs) * 60, fpm = (cur - tgt) / t, fx = c.fix();
      return {
        text: `ATC: "${c.ac.name.split(' ')[0]} 4KX, cross ${fx} at ${ft(tgt)}." You're at ${c.altStr(cur)}, ${d} NM from ${fx}, ${gs} kt GS, and you start down now.${early ? ` You want to be level ${early} NM before the fix.` : ''} What descent rate is required?`,
        given: [['Current altitude', c.altStr(cur)], ['Crossing altitude', ft(tgt)], ['Distance to fix', nm(d)], ['GS', kt(gs)]].concat(early ? [['Level-off', early + ' NM early']] : []),
        fields: [F.num('fpm', 'Descent rate', 'fpm', fpm, Math.max(15, fpm * 0.03))],
        solution: [`Altitude to lose = ${ft(cur - tgt)}`, `Time = ${d - early} ÷ ${gs} × 60 = ${U.fmt(t, 2)} min`, `Rate = ${U.fmt(cur - tgt)} ÷ ${U.fmt(t, 2)} = <b>${U.fmt(fpm)} fpm</b>`],
      };
    },
  });

  def({
    id: 'cd_gp', group: 'cd', name: 'Glidepath descent rate',
    info: ['fpm = GS × 101.3 × tan(angle) · 3° ≈ GS × 5.3 (GS × 5 rule)', 'Approach charts list fpm by GS in the rate-of-descent table'],
    gen(c) {
      const ang = c.d === 3 ? U.pick([2.75, 3.0, 3.1, 3.2, 3.5]) : 3.0;
      const gs = c.r(c.P.apprGs, [10, 5, 1]), fpm = (gs * A.ftPerNm(ang)) / 60;
      return {
        text: `Flying the ILS into ${c.apt()} with a ${ang.toFixed(2)}° glideslope. Your groundspeed on final is ${gs} kt. What descent rate should you expect?`,
        given: [['Glidepath', ang.toFixed(2) + '°'], ['GS', kt(gs)]],
        fields: [F.num('fpm', 'Descent rate', 'fpm', fpm, Math.max(15, fpm * 0.03), { alts: [(gs * 5 * ang) / 3] })],
        solution: [`ft/NM = 6,076 × tan ${ang}° = ${U.fmt(A.ftPerNm(ang))}`, `fpm = ${gs} × ${U.fmt(A.ftPerNm(ang))} ÷ 60 = <b>${U.fmt(fpm)} fpm</b>`, `Rule of thumb: ${gs} × 5${ang !== 3 ? ` × ${ang}/3` : ''} ≈ ${U.fmt((gs * 5 * ang) / 3)} fpm`],
      };
    },
  });

  // =====================================================================
  // NAVIGATION
  // =====================================================================
  def({
    id: 'nav_1in60', group: 'nav', name: 'Off-course correction (1-in-60)',
    info: ['Degrees off = NM off × 60 ÷ distance flown', 'Degrees to converge = NM off × 60 ÷ distance remaining', 'Total correction to fly direct = sum of both'],
    gen(c) {
      const flown = c.r([20, 90], [10, 5, 1]), off = c.d === 1 ? U.int(2, 6) : U.round(U.float(1.5, 8), 1), rem = c.r([20, 120], [10, 5, 1]);
      const a1 = (off * 60) / flown, a2 = (off * 60) / rem, right = U.chance(0.5);
      const hdg0 = c.r([5, 360], [5, 1, 1]);
      const fields = [F.num('a1', 'Degrees off course', '°', a1, 1, { dp: 1 }), F.num('tot', 'Total correction to destination', '°', a1 + a2, 1.5, { dp: 1 })];
      if (c.d >= 2) fields.push(F.hdg('h', 'New heading', hdg0 + (right ? -1 : 1) * (a1 + a2), 2));
      return {
        text: `${flown} NM after departure, a fix shows you ${off} NM ${right ? 'right' : 'left'} of course with ${rem} NM still to go.${c.d >= 2 ? ` You've been holding heading ${deg(hdg0)}.` : ''} Using the 1-in-60 rule, how far off course are you, and how much do you correct to fly direct to the destination?`,
        given: [['Distance flown', nm(flown)], ['Off course', nm(off, 1) + (right ? ' right' : ' left')], ['Remaining', nm(rem)]].concat(c.d >= 2 ? [['Current heading', deg(hdg0)]] : []),
        fields,
        solution: [`Track error = ${off} × 60 ÷ ${flown} = <b>${U.fmt(a1, 1)}°</b>`, `Convergence = ${off} × 60 ÷ ${rem} = ${U.fmt(a2, 1)}°`, `Total = <b>${U.fmt(a1 + a2, 1)}° ${right ? 'left' : 'right'}</b>`].concat(c.d >= 2 ? [`New heading = <b>${deg(hdg0 + (right ? -1 : 1) * (a1 + a2))}</b>`] : []),
      };
    },
  });

  def({
    id: 'nav_tts', group: 'nav', name: 'Time & distance to station',
    info: ['Turn so the station is on the wingtip; time a bearing change', 'Minutes to station = seconds for change ÷ degrees changed', 'Distance = TAS × minutes ÷ 60'],
    gen(c) {
      const tas = c.p === 'ga' ? c.r(c.ac.tas, [10, 5, 1]) : c.r([180, 300], [10, 5, 1]);
      const dg = U.pick([5, 10, 10, 15, 20]), sec = c.r([30, 180], [15, 5, 1]);
      const min = sec / dg, dist = (tas * min) / 60, v = c.vor();
      return {
        text: `Checking position from the ${v} VOR in the ${c.ac.name} (${tas} KTAS). With the station 90° off the wingtip, the bearing changes ${dg}° in ${sec} seconds. How far are you from the station in time and distance?`,
        given: [['Bearing change', dg + '°'], ['Elapsed', sec + ' s'], ['TAS', kt(tas)]],
        fields: [F.num('min', 'Time to station', 'min', min, Math.max(0.2, min * 0.03), { dp: 1 }), F.num('d', 'Distance', 'NM', dist, Math.max(0.5, dist * 0.03), { dp: 1 })],
        solution: [`Time = ${sec} s ÷ ${dg}° = <b>${U.fmt(min, 1)} min</b>`, `Distance = ${tas} × ${U.fmt(min, 2)} ÷ 60 = <b>${nm(dist, 1)}</b>`],
      };
    },
  });

  // =====================================================================
  // INSTRUMENT
  // =====================================================================
  def({
    id: 'ifr_hold', group: 'ifr', name: 'Holding pattern entry',
    info: ['AIM 5-3-8: Parallel (110° sector), Teardrop (70°), Direct (180°)', 'Draw the 70° line through the fix on the holding side; ±5° of a boundary is pilot choice', 'Inbound course = radial + 180°'],
    gen(c) {
      const right = c.d === 1 ? true : U.chance(0.7);
      const radial = c.r([10, 360], [10, 5, 1]), inbound = U.n360(radial + 180);
      let h;
      do h = c.r([5, 360], [10, 5, 1]); while (A.holdBoundaryDist(h, inbound, right) < 8);
      const entry = A.holdEntry(h, inbound, right), v = c.vor();
      const choices = ['Direct', 'Teardrop', 'Parallel'];
      return {
        text: `ATC: "Hold ${U.compass8(radial)} of the ${v} VOR on the ${U.hdg(radial)} radial${right ? '' : ', left turns'}, expect further clearance in 20 minutes." You'll cross ${v} on a heading of ${deg(h)}. Which entry does the AIM recommend?`,
        given: [['Holding radial', U.hdg(radial) + '°'], ['Inbound course', deg(inbound)], ['Turns', right ? 'Right (standard)' : 'Left (non-standard)'], ['Heading at fix', deg(h)]],
        choices, answer: choices.indexOf(entry),
        solution: [`Inbound course = ${U.hdg(radial)} + 180 = ${deg(inbound)}`, `Heading relative to inbound: ${U.fmt(U.n360(h - inbound))}°`, right ? 'Right turns: 0–110° direct · 110–180° teardrop · 180–290° parallel · 290–360° direct' : 'Left turns: 0–70° direct · 70–180° parallel · 180–250° teardrop · 250–360° direct', `Entry: <b>${entry}</b>`],
        diagram: { type: 'hold', inbound, right, heading: h, entry },
      };
    },
  });

  def({
    id: 'ifr_holdwca', group: 'ifr', name: 'Holding wind correction',
    info: ['AIM 5-3-8: triple the inbound drift correction on the outbound leg', 'Outbound heading = outbound course − 3 × inbound WCA (WCA + when right)'],
    gen(c) {
      const ic = c.r([5, 360], [10, 5, 1]), wca = (U.chance(0.5) ? 1 : -1) * U.int(2, c.d === 1 ? 5 : 9);
      const ih = U.n360(ic + wca), oc = U.n360(ic + 180), oh = U.n360(oc - 3 * wca);
      return {
        text: `Established in a hold with an inbound course of ${deg(ic)}. You find that a heading of ${deg(ih)} keeps you on the inbound course. What heading should you fly on the next outbound leg?`,
        given: [['Inbound course', deg(ic)], ['Inbound heading', deg(ih)]],
        fields: [F.hdg('oh', 'Outbound heading', oh, 2)],
        solution: [`Inbound WCA = ${Math.abs(wca)}° ${wca > 0 ? 'right' : 'left'} (wind from the ${wca > 0 ? 'right' : 'left'} inbound)`, `Outbound course = ${deg(oc)}; the wind is now from the ${wca > 0 ? 'left' : 'right'}`, `Triple it: ${3 * Math.abs(wca)}° ${wca > 0 ? 'left' : 'right'} → <b>${deg(oh)}</b>`],
        diagram: null,
      };
    },
  });

  def({
    id: 'ifr_vdp', group: 'ifr', name: 'Visual descent point',
    info: ['VDP (NM from threshold) = HAT ÷ 300 for a ~3° path', 'HAT = MDA − TDZE (or threshold elevation)'],
    gen(c) {
      const tdze = c.r([0, 5000], [100, 10, 1]), hat = U.roundTo(c.r([300, 800], [50, 20, 20]), 20);
      const mda = tdze + hat, v = hat / 300, dme = c.d >= 2 ? U.round(U.float(0.2, 1.5), 1) : null;
      const fields = [F.num('v', 'VDP from threshold', 'NM', v, 0.1, { dp: 2 })];
      if (dme != null) fields.push(F.num('dme', 'VDP DME', 'DME', v + dme, 0.1, { dp: 1 }));
      return {
        text: `The RNAV/LOC approach to ${c.apt()} has an MDA of ${ft(mda)} and a TDZE of ${ft(tdze)}. No VDP is published.${dme != null ? ` The DME reads ${dme} at the threshold and increases along the final approach course.` : ''} Where would you compute the VDP?`,
        given: [['MDA', ft(mda)], ['TDZE', ft(tdze)]].concat(dme != null ? [['Threshold DME', String(dme)]] : []),
        fields,
        solution: [`HAT = ${U.fmt(mda)} − ${U.fmt(tdze)} = ${hat} ft`, `VDP = ${hat} ÷ 300 = <b>${U.fmt(v, 2)} NM</b> from the threshold`].concat(dme != null ? [`DME = ${dme} + ${U.fmt(v, 2)} = <b>${U.fmt(v + dme, 1)} DME</b>`] : []),
      };
    },
  });

  def({
    id: 'ifr_time', group: 'ifr', name: 'FAF → MAP timing',
    info: ['Time = FAF-to-MAP distance ÷ GS × 60 (convert to min:sec)'],
    gen(c) {
      const d = U.round(U.float(2.5, 6.5), 1), gs = c.r(c.P.apprGs, [10, 5, 1]), t = (d / gs) * 60;
      return {
        text: `The non-precision approach at ${c.apt()} shows ${d} NM from the FAF to the MAP. Your groundspeed on final is ${gs} kt (not on the timing table). What time should you start at the FAF?`,
        given: [['FAF → MAP', nm(d, 1)], ['Final GS', kt(gs)]],
        fields: [F.ms('t', 'Time', t, 5 / 60)],
        solution: [`${d} ÷ ${gs} × 60 = ${U.fmt(t, 3)} min`, `= <b>${U.ms(t)}</b>`],
      };
    },
  });

  def({
    id: 'ifr_rate', group: 'ifr', name: 'Standard-rate turn',
    info: ['Bank for standard rate (3°/s) ≈ TAS ÷ 10 + 7', 'Exact: tan θ = 3 × TAS ÷ 1,091', 'Standard-rate radius (NM) ≈ TAS ÷ 200 (exact TAS ÷ 188.5)'],
    gen(c) {
      const tas = c.p === 'ga' ? c.r(c.ac.tas, [10, 5, 1]) : c.r([150, 250], [10, 5, 1]);
      const fields = [F.num('b', 'Bank angle', '°', tas / 10 + 7, 2, { alts: [A.stdRateBank(tas)] })];
      if (c.d >= 2) fields.push(F.num('r', 'Turn radius', 'NM', tas / (60 * Math.PI), Math.max(0.05, tas / 3000), { dp: 2, alts: [tas / 200] }));
      return {
        text: `In the ${c.ac.name} at ${tas} KTAS, what bank angle gives a standard-rate turn${c.d >= 2 ? ', and what is the turn radius' : ''}?`,
        given: [['TAS', kt(tas)]],
        fields,
        solution: [`Rule: ${tas} ÷ 10 + 7 = <b>${U.fmt(tas / 10 + 7)}°</b>`, `Exact: atan(3 × ${tas} ÷ 1,091) = ${U.fmt(A.stdRateBank(tas), 1)}°`].concat(c.d >= 2 ? [`Radius = ${tas} ÷ 188.5 = <b>${U.fmt(tas / (60 * Math.PI), 2)} NM</b> (÷200 rule: ${U.fmt(tas / 200, 2)})`] : []),
      };
    },
  });

  // =====================================================================
  // MANEUVERS & AERODYNAMICS
  // =====================================================================
  def({
    id: 'aero_lf', group: 'aero', name: 'Load factor & stall speed in a turn',
    info: ['n = 1 ÷ cos(bank) · 30° 1.15, 45° 1.41, 60° 2.0', 'Vs(turn) = Vs × √n'],
    gen(c) {
      const bank = c.d === 1 ? U.pick([30, 45, 60]) : c.r([20, 70], [5, 5, 1]);
      const vs = c.ac.vs || c.r([100, 140], 5), n = A.loadFactor(bank);
      return {
        text: `${c.ac.vs ? `The ${c.ac.name} stalls at ${vs} KIAS wings-level (clean, max weight).` : `Your aircraft stalls at ${vs} KIAS wings-level in this configuration.`} In a level ${bank}° banked turn, what is the load factor and the new stall speed?`,
        given: [['Bank', bank + '°'], ['Vs (1 G)', vs + ' KIAS']],
        fields: [F.num('n', 'Load factor', 'G', n, 0.03, { dp: 2 }), F.num('vs', 'Stall speed', 'KIAS', vs * Math.sqrt(n), 1.5)],
        solution: [`n = 1 ÷ cos ${bank}° = <b>${U.fmt(n, 2)} G</b>`, `Vs = ${vs} × √${U.fmt(n, 2)} = <b>${U.fmt(vs * Math.sqrt(n))} KIAS</b>`],
      };
    },
  });

  def({
    id: 'aero_radius', group: 'aero', name: 'Turn radius & rate',
    info: ['Radius (ft) = V² ÷ (11.26 × tan bank)', 'Rate (°/s) = 1,091 × tan bank ÷ V'],
    gen(c) {
      const tas = c.p === 'ga' ? c.r(c.ac.tas, [10, 5, 1]) : c.r(c.ac.low || [200, 350], [10, 5, 1]);
      const bank = c.d === 1 ? U.pick([30, 45, 60]) : c.r([15, c.p === 'mil' ? 80 : 60], [5, 5, 1]);
      const r = A.radius(tas, bank), rot = A.rot(tas, bank);
      return {
        text: `${c.ac.name} at ${tas} KTAS rolls into a level ${bank}° bank turn. What is the turn radius and the rate of turn?`,
        given: [['TAS', kt(tas)], ['Bank', bank + '°']],
        fields: [F.num('r', 'Radius', 'ft', r, r * 0.03), F.num('rot', 'Rate of turn', '°/s', rot, Math.max(0.15, rot * 0.03), { dp: 1 })],
        solution: [`r = ${tas}² ÷ (11.26 × tan ${bank}°) = <b>${ft(Math.round(r))}</b> (${U.fmt(r / 6076, 2)} NM)`, `ROT = 1,091 × tan ${bank}° ÷ ${tas} = <b>${U.fmt(rot, 1)}°/s</b>`],
      };
    },
  });

  def({
    id: 'aero_va', group: 'aero', name: 'Maneuvering speed at weight', profiles: ['ga'], needs: 'va',
    info: ['Va decreases with weight: Va(new) = Va × √(W ÷ Wmax)'],
    gen(c) {
      const w = c.r([c.ac.vaW - 750, c.ac.vaW - 150], [50, 10, 1]), va = c.ac.va * Math.sqrt(w / c.ac.vaW);
      return {
        text: `The ${c.ac.name}'s Va is ${c.ac.va} KIAS at ${U.fmt(c.ac.vaW)} lb. Today you weigh ${U.fmt(w)} lb and expect turbulence. What is your maneuvering speed?`,
        given: [['Va (max weight)', c.ac.va + ' KIAS'], ['Max weight', U.fmt(c.ac.vaW) + ' lb'], ['Current weight', U.fmt(w) + ' lb']],
        fields: [F.num('va', 'Va', 'KIAS', va, 1.5)],
        solution: [`Va = ${c.ac.va} × √(${U.fmt(w)} ÷ ${U.fmt(c.ac.vaW)})`, `= ${c.ac.va} × ${U.fmt(Math.sqrt(w / c.ac.vaW), 3)} = <b>${U.fmt(va)} KIAS</b>`],
      };
    },
  });

  def({
    id: 'aero_pivot', group: 'aero', name: 'Pivotal altitude (eights-on-pylons)', profiles: ['ga'],
    info: ['Pivotal altitude (ft AGL) ≈ GS² ÷ 11.3 (knots)', 'Higher GS (downwind) → higher pivotal altitude'],
    gen(c) {
      const gs = c.r([85, 135], [5, 1, 1]), elev = c.r([200, 2000], [100, 10, 1]), p = A.pivotal(gs);
      return {
        text: `Practicing eights-on-pylons for the commercial checkride. At the point you're evaluating, your groundspeed is ${gs} kt. The pylons sit at ${ft(elev)} MSL. What is the pivotal altitude?`,
        given: [['Groundspeed', kt(gs)], ['Pylon elevation', ft(elev)]],
        fields: [F.num('agl', 'Pivotal altitude', 'ft AGL', p, p * 0.02), F.num('msl', 'Pivotal altitude', 'ft MSL', p + elev, p * 0.02)],
        solution: [`${gs}² ÷ 11.3 = <b>${ft(Math.round(p))} AGL</b>`, `+ ${U.fmt(elev)} = <b>${ft(Math.round(p + elev))} MSL</b>`],
      };
    },
  });

  def({
    id: 'aero_glide', group: 'aero', name: 'Glide distance',
    info: ['Still air: distance (NM) = height AGL × glide ratio ÷ 6,076', 'Wind: scale by GS ÷ glide TAS'],
    gen(c) {
      const ratio = c.p === 'ga' ? U.pick([8, 9, 9.5, 10, 11]) : c.p === 'air' ? U.pick([15, 16, 17, 18]) : U.pick([7, 8, 10, 12]);
      const agl = c.p === 'ga' ? c.r([2000, 10000], [500, 100, 100]) : c.r([8000, 35000], [1000, 1000, 500]);
      let d = (agl * ratio) / 6076, wind = null, sol = [`Still air: ${U.fmt(agl)} × ${ratio} ÷ 6,076 = ${nm(d, 1)}`];
      if (c.d === 3) {
        const v = c.p === 'ga' ? U.pick([68, 70, 74, 88]) : c.r([180, 250], 10), hw = U.int(10, 30) * (U.chance(0.6) ? 1 : -1);
        wind = { v, hw }; const k = (v - hw) / v; d *= k;
        sol.push(`Wind factor = (${v} ${hw > 0 ? '−' : '+'} ${Math.abs(hw)}) ÷ ${v} = ${U.fmt(k, 3)}`);
      }
      sol.push(`Glide distance = <b>${nm(d, 1)}</b>`);
      return {
        text: `Engine failure${c.p === 'ga' ? '' : 's'}! The ${c.ac.name} is ${ft(agl)} AGL with a glide ratio of about ${ratio}:1.${wind ? ` Best glide is ${wind.v} KTAS with a ${Math.abs(wind.hw)} kt ${wind.hw > 0 ? 'headwind' : 'tailwind'}.` : ''} How far can you glide?`,
        given: [['Height', ft(agl) + ' AGL'], ['Glide ratio', ratio + ':1']].concat(wind ? [['Best glide', kt(wind.v)], [wind.hw > 0 ? 'Headwind' : 'Tailwind', kt(Math.abs(wind.hw))]] : []),
        fields: [F.num('d', 'Glide distance', 'NM', d, Math.max(0.3, d * 0.03), { dp: 1 })],
        solution: sol,
      };
    },
  });

  def({
    id: 'aero_hydro', group: 'aero', name: 'Hydroplaning speed',
    info: ['Dynamic hydroplaning (rotating tire) ≈ 9 × √tire psi', 'Non-rotating tire (touchdown) ≈ 7.7 × √psi'],
    gen(c) {
      const psi = c.r(c.P.tire, [5, 1, 1]);
      return {
        text: `The ${c.ac.name}'s main tires are inflated to ${psi} psi and the runway at ${c.apt()} has standing water. What is the minimum dynamic hydroplaning speed for a rolling tire, and for a non-rotating tire at touchdown?`,
        given: [['Tire pressure', psi + ' psi']],
        fields: [F.num('r', 'Rotating tire', 'kt', A.hydroplane(psi), 1.5), F.num('nr', 'Non-rotating tire', 'kt', A.hydroplaneNR(psi), 1.5)],
        solution: [`9 × √${psi} = 9 × ${U.fmt(Math.sqrt(psi), 2)} = <b>${U.fmt(A.hydroplane(psi))} kt</b>`, `7.7 × √${psi} = <b>${U.fmt(A.hydroplaneNR(psi))} kt</b>`],
      };
    },
  });

  // =====================================================================
  // WEIGHT & BALANCE
  // =====================================================================
  def({
    id: 'wb_cg', group: 'wb', name: 'Loading & CG', profiles: ['ga'], needs: 'wb',
    info: ['Moment = Weight × Arm', 'CG = Total moment ÷ Total weight', 'Example data only — use your aircraft\'s actual W&B'],
    gen(c) {
      const wb = c.ac.wb;
      const items = [['Basic empty weight', wb.empty, wb.emptyArm]];
      wb.stations.forEach(([n, arm, r]) => { const w = c.r(r, [10, 5, 1]); if (w > 0 || n.startsWith('Pilot')) items.push([n, w, arm]); });
      const gal = c.r([15, c.ac.cap], [5, 1, 1]); items.push([`Fuel (${gal} gal × 6)`, gal * 6, wb.fuelArm]);
      const W = items.reduce((s, i) => s + i[1], 0), M = items.reduce((s, i) => s + i[1] * i[2], 0), cg = M / W;
      const ok = W <= wb.max && cg >= wb.fwd && cg <= wb.aft;
      const rows = items.map(([n, w, a]) => `<tr><td>${n}</td><td>${U.fmt(w)}</td><td>${a.toFixed(1)}</td><td>${U.fmt(w * a)}</td></tr>`).join('');
      return {
        text: `Compute the takeoff weight and CG for this ${c.ac.name} loading. (Example data — always use the actual aircraft's W&B.)`,
        given: items.map(([n, w, a]) => [n, `${U.fmt(w)} lb @ ${a.toFixed(1)} in`]),
        fields: [F.num('w', 'Total weight', 'lb', W, 2), F.num('cg', 'CG', 'in aft of datum', cg, 0.1, { dp: 2 })],
        solution: [`<table class="wbt"><tr><th>Item</th><th>lb</th><th>Arm</th><th>Moment</th></tr>${rows}<tr class="tot"><td>Total</td><td>${U.fmt(W)}</td><td>${cg.toFixed(2)}</td><td>${U.fmt(M)}</td></tr></table>`, `CG = ${U.fmt(M)} ÷ ${U.fmt(W)} = <b>${cg.toFixed(2)} in</b>`, `Limits (example): ${wb.fwd}–${wb.aft} in, max ${U.fmt(wb.max)} lb → ${ok ? '✅ within limits' : '⚠️ OUT of limits'}`],
      };
    },
  });

  def({
    id: 'wb_shift', group: 'wb', name: 'Weight shift',
    info: ['Weight to move ÷ Total weight = ΔCG ÷ Distance moved', 'w = W × ΔCG ÷ d'],
    gen(c) {
      let W, d, dcg, what;
      if (c.p === 'ga') { W = c.r([2000, 3500], [50, 10, 1]); d = c.r([40, 90], [5, 1, 1]); dcg = U.round(U.float(0.3, 2.5), c.d === 1 ? 1 : 2); what = 'baggage from the aft baggage area to the rear seat'; }
      else if (c.p === 'mil') { W = c.r([110000, 155000], [5000, 1000, 100]); d = c.r([150, 500], [50, 10, 1]); dcg = U.round(U.float(1, 8), 1); what = 'cargo forward in the cargo compartment'; }
      else { W = c.r([120000, 170000], [5000, 1000, 100]); d = c.r([400, 800], [50, 10, 1]); dcg = U.round(U.float(1, 6), 1); what = 'bags from the aft cargo hold to the forward hold'; }
      const w = (W * dcg) / d;
      return {
        text: `The ${c.ac.name} weighs ${U.fmt(W)} lb and the CG is ${dcg} in aft of the limit. You'll move ${what}, a distance of ${d} in. How much weight must move?`,
        given: [['Total weight', U.fmt(W) + ' lb'], ['CG change needed', dcg + ' in'], ['Distance moved', d + ' in']],
        fields: [F.num('w', 'Weight to move', 'lb', w, Math.max(1, w * 0.015))],
        solution: [`w = ${U.fmt(W)} × ${dcg} ÷ ${d}`, `= <b>${U.fmt(w)} lb</b>`],
        e6b: `E6-B: set ${d} (inner) under ${U.fmt(W)} (outer); read the weight above ${dcg} on the inner scale.`,
      };
    },
  });

  def({
    id: 'wb_add', group: 'wb', name: 'Add ballast to fix CG', profiles: ['ga', 'mil'],
    info: ['Weight to add = W × (CGnew − CGold) ÷ (arm − CGnew)'],
    gen(c) {
      const ga = c.p === 'ga';
      const W = ga ? c.r([1800, 3200], [50, 10, 1]) : c.r([100000, 150000], [5000, 1000, 100]);
      const lim = ga ? U.round(U.float(40, 95), 1) : c.r([500, 700], 1);
      const cg = U.round(lim + U.float(ga ? 0.3 : 2, ga ? 2 : 10), 1);
      const arm = ga ? U.round(lim - U.float(15, 50), 1) : c.r([lim - 400, lim - 150], 10);
      const w = (W * (lim - cg)) / (arm - lim);
      return {
        text: `The ${c.ac.name} weighs ${U.fmt(W)} lb with the CG at ${cg} in. The aft limit is ${lim} in. How much ballast must be added at station ${arm} in to bring the CG to the limit?`,
        given: [['Weight', U.fmt(W) + ' lb'], ['Current CG', cg + ' in'], ['Target CG', lim + ' in'], ['Ballast arm', arm + ' in']],
        fields: [F.num('w', 'Ballast', 'lb', w, Math.max(1, w * 0.02))],
        solution: [`w = ${U.fmt(W)} × (${lim} − ${cg}) ÷ (${arm} − ${lim})`, `= ${U.fmt(W)} × ${U.fmt(lim - cg, 1)} ÷ ${U.fmt(arm - lim, 1)} = <b>${U.fmt(w)} lb</b>`],
      };
    },
  });

  def({
    id: 'wb_mac', group: 'wb', name: 'CG in %MAC', profiles: ['air', 'mil'],
    info: ['%MAC = (CG − LEMAC) ÷ MAC × 100'],
    gen(c) {
      const lemac = c.r([400, 900], [10, 1, 0.1]), mac = U.round(U.float(100, 260), c.d === 1 ? 0 : 1), p = U.float(12, 34);
      const cg = U.round(lemac + (p * mac) / 100, 1);
      let W = null, M = null;
      if (c.d === 3) { W = c.r([100000, 180000], 100); M = W * cg; }
      const ans = ((cg - lemac) / mac) * 100;
      return {
        text: `${c.ac.name}: LEMAC is at station ${lemac} in, and the MAC is ${mac} in. ${W ? `Gross weight is ${U.fmt(W)} lb with a total moment of ${U.fmt(M / 1000, 1)} (×1,000 in-lb).` : `The CG is at station ${cg} in.`} What is the CG in %MAC?`,
        given: [['LEMAC', lemac + ' in'], ['MAC', mac + ' in']].concat(W ? [['Weight', U.fmt(W) + ' lb'], ['Moment/1000', U.fmt(M / 1000, 1)]] : [['CG station', cg + ' in']]),
        fields: [F.num('p', 'CG', '%MAC', ans, 0.2, { dp: 1 })],
        solution: (W ? [`CG = ${U.fmt(M / 1000, 1)} × 1,000 ÷ ${U.fmt(W)} = ${cg} in`] : []).concat([`%MAC = (${cg} − ${lemac}) ÷ ${mac} × 100`, `= <b>${U.fmt(ans, 1)}% MAC</b>`]),
      };
    },
  });

  // =====================================================================
  // ADVANCED OPS
  // =====================================================================
  def({
    id: 'ops_etp', group: 'ops', name: 'Equal time point (ETP)', profiles: ['air', 'mil'],
    info: ['ETP distance from departure = D × GSreturn ÷ (GSon + GSreturn)', 'Headwind on the way out moves the ETP toward the destination'],
    gen(c) {
      const cr = c.cruise(), D = c.r([600, 2800], [50, 10, 1]), hw = c.r([-80, 100], [10, 5, 1]);
      const gso = cr.tas - hw, gsr = cr.tas + hw, d = (D * gsr) / (gso + gsr);
      return {
        text: `Over-water leg in the ${c.ac.name}: ${D} NM between suitable airports. Continuing, your GS is ${gso} kt; turning back, it would be ${gsr} kt. How far from the departure point is the equal time point, and how long after departure do you reach it?`,
        given: [['Leg distance', nm(D)], ['GS on', kt(gso)], ['GS return', kt(gsr)]],
        fields: [F.num('d', 'ETP distance', 'NM', d, Math.max(3, d * 0.012)), F.hm('t', 'Time to ETP', (d / gso) * 60, Math.max(2, (d / gso) * 0.6))],
        solution: [`ETP = ${D} × ${gsr} ÷ (${gso} + ${gsr})`, `= <b>${nm(d)}</b> from departure`, `Time = ${U.fmt(d)} ÷ ${gso} = <b>${U.hm((d / gso) * 60)}</b>`],
      };
    },
  });

  def({
    id: 'ops_pnr', group: 'ops', name: 'Point of no return (PNR)', profiles: ['air', 'mil'],
    info: ['Endurance E = fuel available ÷ FF', 'Time to PNR = E × GSreturn ÷ (GSout + GSreturn)', 'Distance = time × GSout'],
    gen(c) {
      const cr = c.cruise(), hw = c.r([-60, 80], [10, 5, 1]), gso = cr.tas - hw, gsr = cr.tas + hw;
      const ff = c.flow(), avail = c.fq(ff * U.float(2, 6));
      const E = avail / ff, t = (E * gsr) / (gso + gsr);
      return {
        text: `${c.ac.name} on a mission with ${c.f(avail)} available above reserves, burning ${c.fr(ff)}. Outbound GS is ${gso} kt, inbound would be ${gsr} kt. When and where is the point of no return?`,
        given: [['Fuel available', c.f(avail)], ['Fuel flow', c.fr(ff)], ['GS out', kt(gso)], ['GS home', kt(gsr)]],
        fields: [F.hm('t', 'Time to PNR', t * 60, Math.max(2, t * 60 * 0.015)), F.num('d', 'PNR distance', 'NM', t * gso, Math.max(3, t * gso * 0.015))],
        solution: [`Endurance = ${U.fmt(avail)} ÷ ${U.fmt(ff)} = ${U.fmt(E, 3)} hr`, `t = ${U.fmt(E, 3)} × ${gsr} ÷ (${gso} + ${gsr}) = ${U.fmt(t, 3)} hr = <b>${U.hm(t * 60)}</b>`, `Distance = ${U.fmt(t, 3)} × ${gso} = <b>${nm(t * gso)}</b>`],
      };
    },
  });

  def({
    id: 'ops_radius', group: 'ops', name: 'Radius of action', profiles: ['mil'],
    info: ['Fuel for transit = total − reserve − loiter', 'Radius = transit fuel ÷ (FF/GSout + FF/GSback)'],
    gen(c) {
      const cr = c.cruise(), hw = c.r([-50, 60], [10, 5, 1]), gso = cr.tas - hw, gsr = cr.tas + hw;
      const ff = c.flow(), fuel = c.fq(c.toFu(c.ac.cap * U.float(0.85, 1))), res = c.fq(c.toFu(c.r(c.ac.reserve || [1000, 1500], 50)));
      const loit = c.r([10, 45], [5, 5, 1]), lff = c.fq(ff * 0.8);
      const lf = (lff * loit) / 60, avail = fuel - res - lf, R = avail / (ff / gso + ff / gsr);
      return {
        text: `${c.ac.name} takes off with ${c.f(fuel)}. Plan ${loit} min on station at ${c.fr(lff)} and land with ${c.f(res)}. Transit burns ${c.fr(ff)}; GS out ${gso} kt, GS back ${gsr} kt. What is the maximum radius of action?`,
        given: [['Takeoff fuel', c.f(fuel)], ['Reserve', c.f(res)], ['On station', `${loit} min @ ${c.fr(lff)}`], ['Transit FF', c.fr(ff)], ['GS out / back', `${gso} / ${gsr} kt`]],
        fields: [F.num('r', 'Radius', 'NM', R, Math.max(3, R * 0.02))],
        solution: [`Loiter fuel = ${U.fmt(lff)} × ${loit}/60 = ${c.f(lf)}`, `Transit fuel = ${U.fmt(fuel)} − ${U.fmt(res)} − ${U.fmt(lf)} = ${c.f(avail)}`, `Per NM: ${U.fmt(ff)}/${gso} + ${U.fmt(ff)}/${gsr} = ${U.fmt(ff / gso + ff / gsr, 2)} ${c.fu}/NM (out & back)`, `Radius = <b>${nm(R)}</b>`],
      };
    },
  });

  def({
    id: 'ops_tot', group: 'ops', name: 'Time-over-target control', profiles: ['mil'],
    info: ['Required GS = distance remaining ÷ time remaining', 'Required TAS = GS + headwind (− tailwind)'],
    gen(c) {
      const gsN = c.r(c.ac.low || c.gsR, 10), d = c.r([20, 120], [5, 1, 1]);
      const tRem = U.roundTo((d / gsN) * 3600 * U.float(0.88, 1.12), c.d === 1 ? 60 : 5);
      const now = U.int(0, 17279) * 5, gs = d / (tRem / 3600);
      const hw = c.d >= 2 ? U.int(5, 30) * (U.chance(0.5) ? 1 : -1) : 0;
      const fields = [F.num('gs', 'Required GS', 'kt', gs, Math.max(3, gs * 0.015))];
      if (hw) fields.push(F.num('tas', 'Required TAS', 'kt', gs + hw, Math.max(3, gs * 0.015)));
      return {
        text: `${c.ac.name} on a timed run. It's ${clockS(now)}, the TOT is ${clockS(now + tRem)}, and the target is ${d} NM away.${hw ? ` The wind gives a ${Math.abs(hw)} kt ${hw > 0 ? 'headwind' : 'tailwind'} component.` : ''} What groundspeed${hw ? ' and TAS' : ''} do you need to hit the TOT?`,
        given: [['Time now', clockS(now)], ['TOT', clockS(now + tRem)], ['Distance', nm(d)]].concat(hw ? [['Wind component', (hw > 0 ? 'Head ' : 'Tail ') + Math.abs(hw) + ' kt']] : []),
        fields,
        solution: [`Time remaining = ${U.ms(tRem / 60)} = ${U.fmt(tRem / 60, 2)} min`, `GS = ${d} ÷ (${U.fmt(tRem / 60, 2)} ÷ 60) = <b>${U.fmt(gs)} kt</b>`].concat(hw ? [`TAS = ${U.fmt(gs)} ${hw > 0 ? '+' : '−'} ${Math.abs(hw)} = <b>${U.fmt(gs + hw)} kt</b>`] : []),
      };
    },
  });

  def({
    id: 'ops_join', group: 'ops', name: 'Intercept & rendezvous closure', profiles: ['mil'],
    info: ['Head-on closure = GS1 + GS2', 'Overtake closure = GSreceiver − GStanker', 'Time = range ÷ closure'],
    gen(c) {
      const head = U.chance(0.5);
      let g1, g2, R, text, given;
      if (head) {
        g1 = c.r(c.gsR, 10); g2 = c.r([380, 560], 10); R = c.r([20, 80], [5, 1, 1]);
        text = `${c.ac.name} on CAP at ${g1} KGS. AWACS calls a bogey ${R} NM on the nose, hot, at ${g2} KGS. What's the closure rate and time to merge?`;
        given = [['Your GS', kt(g1)], ['Bogey GS', kt(g2)], ['Range', nm(R)]];
      } else {
        g2 = c.r([260, 310], 5); g1 = g2 + c.r([20, 80], [10, 5, 1]); R = c.r([4, 25], [1, 1, 0.5]);
        text = `Tanker rendezvous: the tanker is ${R} NM ahead on the same track at ${g2} KGS. The ${c.ac.name} is closing at ${g1} KGS. What's the overtake and how long until you're at the tanker?`;
        given = [['Tanker GS', kt(g2)], ['Your GS', kt(g1)], ['Range', nm(R, 1)]];
      }
      const cl = head ? g1 + g2 : g1 - g2, t = (R / cl) * 60;
      return {
        text, given,
        fields: [F.num('c', 'Closure', 'kt', cl, 2), F.ms('t', 'Time', t, Math.max(5 / 60, t * 0.02))],
        solution: [`Closure = ${g1} ${head ? '+' : '−'} ${g2} = <b>${cl} kt</b>`, `Time = ${R} ÷ ${cl} × 60 = ${U.fmt(t, 2)} min = <b>${U.ms(t)}</b>`],
      };
    },
  });

  // =====================================================================
  // CONVERSIONS
  // =====================================================================
  const CONV = [
    ['NM', 'SM', 1.15078, 'nautical miles', 'statute miles', [10, 300]],
    ['SM', 'NM', 1 / 1.15078, 'statute miles', 'nautical miles', [5, 300]],
    ['NM', 'km', 1.852, 'nautical miles', 'kilometers', [10, 500]],
    ['km', 'NM', 1 / 1.852, 'kilometers', 'nautical miles', [10, 800]],
    ['kt', 'mph', 1.15078, 'knots', 'mph', [50, 500]],
    ['mph', 'kt', 1 / 1.15078, 'mph', 'knots', [50, 400]],
    ['kt', 'km/h', 1.852, 'knots', 'km/h', [50, 500]],
    ['ft', 'm', 0.3048, 'feet', 'meters', [500, 40000]],
    ['m', 'ft', 1 / 0.3048, 'meters', 'feet', [100, 12000]],
    ['gal', 'L', 3.78541, 'US gallons', 'liters', [10, 2000]],
    ['L', 'gal', 1 / 3.78541, 'liters', 'US gallons', [20, 6000]],
    ['lb', 'kg', 1 / 2.20462, 'pounds', 'kilograms', [100, 60000]],
    ['kg', 'lb', 2.20462, 'kilograms', 'pounds', [50, 30000]],
    ['inHg', 'hPa', 33.8639, 'inHg', 'hPa', [29.5, 30.5]],
    ['hPa', 'inHg', 1 / 33.8639, 'hPa', 'inHg', [990, 1035]],
    ['°C', '°F', null, '°C', '°F', [-40, 40]],
    ['°F', '°C', null, '°F', '°C', [-20, 110]],
    ['m/s', 'kt', 1.94384, 'm/s', 'knots', [3, 30]],
  ];
  def({
    id: 'conv', group: 'conv', name: 'Unit conversions',
    info: ['1 NM = 1.15 SM = 1.852 km', '1 ft = 0.3048 m', '1 US gal = 3.785 L', '1 kg = 2.2046 lb', '1 inHg = 33.86 hPa', '°F = °C × 9/5 + 32', '1 m/s ≈ 1.94 kt'],
    gen(c) {
      const k = U.pick(CONV);
      let v, ans, dp = 0;
      if (k[0] === 'inHg') { v = c.r([2950, 3050], 1) / 100; dp = 0; }
      else if (k[0] === 'hPa') { v = c.r(k[5], 1); dp = 2; }
      else v = c.r(k[5], [10, 5, 1].map((x) => x * (k[5][1] > 5000 ? 50 : k[5][1] > 500 ? 5 : 1)));
      if (k[0] === '°C') ans = A.cToF(v); else if (k[0] === '°F') ans = A.fToC(v); else ans = v * k[2];
      if (k[1] === 'inHg') dp = 2; if (k[1] === 'gal' || k[1] === 'kt' && k[0] === 'm/s') dp = 1;
      const tol = k[0].startsWith('°') ? 1 : Math.max(Math.pow(10, -dp), Math.abs(ans) * 0.01);
      return {
        text: `Convert ${k[0] === 'inHg' ? v.toFixed(2) : U.fmt(v)} ${k[3]} to ${k[4]}.`,
        given: [['Value', `${k[0] === 'inHg' ? v.toFixed(2) : U.fmt(v)} ${k[0]}`]],
        fields: [F.num('a', k[4][0].toUpperCase() + k[4].slice(1), k[1], ans, tol, { dp, signed: k[0].startsWith('°') })],
        solution: [k[0] === '°C' ? `°F = ${v} × 9/5 + 32 = <b>${U.fmt(ans, 1)}°F</b>` : k[0] === '°F' ? `°C = (${v} − 32) × 5/9 = <b>${U.fmt(ans, 1)}°C</b>` : `${U.fmt(v, k[0] === 'inHg' ? 2 : 0)} × ${U.fmt(k[2], 4)} = <b>${U.fmt(ans, dp)} ${k[1]}</b>`],
        e6b: 'E6-B: use the conversion indexes on the outer scale (NAUT/STAT/KM, LBS/KG, IMP/US GAL/LITERS) — set the "from" index under the value and read under the "to" index.',
      };
    },
  });

  // =====================================================================
  // ENGINE
  // =====================================================================
  G.available = (g, pk) => (pk === 'mix' ? true : g.profiles.includes(pk));

  G.make = function (id, s) {
    const g = G.byId[id];
    let pk = s.profile;
    if (pk === 'mix' || !g.profiles.includes(pk)) pk = U.pick(g.profiles);
    let q, tries = 0;
    while (!q && tries++ < 20) {
      try { const c = G.ctx(pk, s, g.needs); q = g.gen(c); q.ac = c.ac.name; } catch (e) { if (tries > 15) throw e; }
    }
    q.id = Math.random().toString(36).slice(2, 10);
    q.cat = id; q.catName = g.name; q.group = g.group; q.profile = pk;
    if (!q.choices) {
      const mc = s.format === 'mc' || (s.format === 'mixed' && Math.random() < 0.5);
      if (mc) G.toMC(q, s);
    }
    q.mc = !!q.choices;
    return q;
  };

  G.fmtField = function (f, v) {
    if (!isFinite(v)) return '—';
    switch (f.kind) {
      case 'hdg': return U.hdg(v) + '°';
      case 'hm': return U.hm(v);
      case 'ms': return U.ms(v);
      case 'clock': return U.clock(v);
      default: return (f.signed && v > 0 && f.unit.startsWith('°') ? '+' : '') + U.fmt(v, f.dp || 0) + (f.unit ? (f.unit.startsWith('°') ? '' : ' ') + f.unit : '');
    }
  };

  /** Convert a typed question to multiple choice with plausible distractors. */
  G.toMC = function (q) {
    const correct = {}; q.fields.forEach((f) => (correct[f.key] = f.answer));
    const label = (vals) => q.fields.map((f) => (q.fields.length > 1 ? f.label + ': ' : '') + G.fmtField(f, vals[f.key])).join(' · ');
    const seen = new Set([label(correct)]);
    const opts = [];
    (q.distractors || []).forEach((d) => { const v = Object.assign({}, correct, d); const l = label(v); if (!seen.has(l) && opts.length < 3 && !q.fields.every((f) => near(f, v[f.key]))) { seen.add(l); opts.push(l); } });
    let guard = 0;
    while (opts.length < 3 && guard++ < 60) {
      const v = {};
      q.fields.forEach((f) => {
        const sgn = Math.random() < 0.5 ? -1 : 1, k = U.pick([1, 1.5, 2, 2.5, 3]);
        let spread;
        if (f.kind === 'hdg') spread = Math.max(5, f.tol * 3) * k;
        else if (f.kind === 'clock' || f.kind === 'hm') spread = Math.max(4, f.answer * 0.08, f.tol * 3) * k;
        else if (f.kind === 'ms') spread = Math.max(0.25, f.answer * 0.1) * k;
        else spread = Math.max(Math.abs(f.answer) * 0.08, f.tol * 3, Math.pow(10, -(f.dp || 0)) * 3) * k;
        let x = f.answer + sgn * spread;
        if (f.kind === 'hdg') x = U.n360(x);
        if (f.kind === 'num' && !f.signed && f.answer > 0 && x <= 0) x = f.answer + spread;
        v[f.key] = Math.random() < 0.35 && q.fields.length > 1 ? f.answer : x;
      });
      const l = label(v);
      if (!seen.has(l) && !q.fields.every((f) => near(f, v[f.key]))) { seen.add(l); opts.push(l); }
    }
    function near(f, x) { return Math.abs(f.kind === 'hdg' ? U.adiff(x, f.answer) : x - f.answer) <= Math.max(f.tol * 2, 1e-9); }
    const all = U.shuffle([label(correct)].concat(opts));
    q.choices = all; q.answer = all.indexOf(label(correct));
    q.convertedMC = true;
  };

  /** Check one field. tolMult from settings. */
  G.checkField = function (f, val, tolMult) {
    if (!isFinite(val)) return false;
    const tol = f.fixed ? f.tol : f.tol * tolMult;
    const targets = [f.answer].concat(f.alts || []);
    return targets.some((t) => {
      let d;
      if (f.kind === 'hdg') d = U.adiff(val, t);
      else if (f.kind === 'clock') { d = (((val - t) % 1440) + 1440) % 1440; if (d > 720) d -= 1440; }
      else d = val - t;
      return Math.abs(d) <= tol + 1e-9 + (f.kind === 'num' ? 0.5 * Math.pow(10, -(f.dp || 0)) : 0);
    });
  };

  G.presets = {
    private: { name: 'Private Pilot', cats: ['tsd_time', 'tsd_gs', 'tsd_dist', 'tsd_eta', 'fuel_burn', 'fuel_rate', 'fuel_endur', 'fuel_reserve', 'fuel_conv', 'wind_tri', 'wind_xw', 'wind_rwy', 'alt_pa', 'alt_da', 'air_tas', 'wx_cloud', 'nav_1in60', 'aero_lf', 'wb_cg', 'wb_shift', 'conv'] },
    instrument: { name: 'Instrument', cats: ['ifr_hold', 'ifr_holdwca', 'ifr_vdp', 'ifr_time', 'ifr_rate', 'cd_climb', 'cd_rod', 'cd_gp', 'alt_true', 'nav_tts', 'wind_fb', 'wind_find', 'wind_tri', 'fuel_reserve', 'tsd_eta'] },
    commercial: { name: 'Commercial', cats: ['aero_pivot', 'aero_va', 'aero_hydro', 'aero_glide', 'aero_radius', 'aero_lf', 'wb_add', 'wb_shift', 'wb_cg', 'alt_da', 'air_tas', 'wind_tri', 'wind_find', 'fuel_reserve', 'cd_tod', 'air_isa'] },
    airline: { name: 'ATP / Airline', cats: ['air_mach', 'air_tas', 'air_isa', 'ops_etp', 'ops_pnr', 'fuel_121', 'fuel_conv', 'wb_mac', 'wb_shift', 'cd_tod', 'cd_gp', 'cd_climb', 'wind_find', 'wind_tri', 'wind_fb', 'aero_hydro', 'ifr_hold'] },
    military: { name: 'Military', cats: ['tsd_low', 'ops_tot', 'ops_join', 'ops_radius', 'ops_pnr', 'ops_etp', 'fuel_bingo', 'fuel_burn', 'air_mach', 'wind_tri', 'wind_find', 'cd_climb', 'cd_tod', 'aero_radius', 'aero_lf', 'wb_mac', 'wb_shift', 'nav_1in60', 'ifr_hold'] },
    all: { name: 'Everything', cats: null },
  };
})();
