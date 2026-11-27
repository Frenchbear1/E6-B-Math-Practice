/* E6-B Trainer — application UI */
(function () {
  const U = E6.util, G = E6.gen, T = E6.tools, D = E6.diagram, PR = E6.profiles;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = U.esc;

  // ------------------------------------------------------------------ settings & stats
  const DEFAULTS = {
    profile: 'ga', cats: G.presets.private.cats.slice(), preset: 'private',
    mode: 'practice', count: 10, minutes: 5, examMinutes: 0,
    difficulty: 2, tolerance: 'standard', format: 'typed',
    hints: true, solutions: true, e6b: true, diagrams: true, autoNext: false, calc: true, adaptive: false,
    fuelUnit: 'auto', pressUnit: 'inHg', theme: 'dark',
  };
  const S = Object.assign({}, DEFAULTS, U.store.get('settings', {}));
  S.cats = (S.cats || []).filter((id) => G.byId[id]);
  const save = () => U.store.set('settings', S);
  const stats = Object.assign({ cats: {}, sessions: [], missed: [], total: { n: 0, c: 0, t: 0 } }, U.store.get('stats', {}));
  const saveStats = () => U.store.set('stats', stats);
  const TOL = { strict: 0.5, standard: 1, lenient: 2 };

  document.documentElement.dataset.theme = S.theme;

  // ------------------------------------------------------------------ navigation
  let view = 'practice';
  function show(v) {
    view = v;
    $$('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.view === v));
    $$('.view').forEach((s) => s.classList.toggle('on', s.id === 'view-' + v));
    if (v === 'tools') renderTools();
    if (v === 'stats') renderStats();
    if (v === 'ref') renderRef();
    window.scrollTo({ top: 0 });
  }
  $$('.tabs button').forEach((b) => b.addEventListener('click', () => show(b.dataset.view)));

  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 1800);
  }

  // ------------------------------------------------------------------ setup screen
  const seg = (name, opts, val) => `<div class="seg" data-name="${name}">${opts.map(([v, l]) => `<button type="button" data-v="${v}" class="${String(v) === String(val) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  const tog = (k, l, d) => `<label class="tog"><input type="checkbox" data-k="${k}" ${S[k] ? 'checked' : ''}/><span class="sw"></span><span><b>${l}</b>${d ? `<small>${d}</small>` : ''}</span></label>`;

  function catAvailable(id) { return G.available(G.byId[id], S.profile); }
  function activeCats() { return S.cats.filter(catAvailable); }

  function renderSetup() {
    const el = $('#view-practice');
    const profs = [['ga', PR.ga], ['air', PR.air], ['mil', PR.mil], ['mix', { name: 'Mixed', tag: 'All three', desc: 'Every question picks a random profile it supports.' }]];
    const missed = stats.missed.length;
    el.innerHTML = `
    <div class="hero">
      <h1>Sharpen your flight computer.</h1>
      <p>Randomized, realistic E6-B / CX-3 problems — from a Skyhawk cross-country to a Mach 0.84 oceanic ETP to a 480-knot low-level TOT. Worked solutions, flight-computer technique, and diagrams for every answer.</p>
    </div>
    <div class="setup">
      <div class="panel">
        <h2><span class="num">1</span>Flight profile</h2>
        <div class="profiles">${profs.map(([k, p]) => `<button type="button" class="prof ${S.profile === k ? 'on' : ''}" data-p="${k}"><span class="pt">${p.name}</span><span class="ps">${p.tag}</span><span class="pd">${p.desc}</span></button>`).join('')}</div>
      </div>

      <div class="panel">
        <h2><span class="num">2</span>Categories <span class="count" id="catCount"></span></h2>
        <div class="presets">${Object.entries(G.presets).map(([k, p]) => `<button type="button" class="chip ${S.preset === k ? 'on' : ''}" data-preset="${k}">${p.name}</button>`).join('')}<button type="button" class="chip ghost" data-preset="none">Clear</button></div>
        <div class="catgroups">${G.groups.map((g) => {
          const cs = G.list.filter((x) => x.group === g.id);
          return `<div class="cg"><div class="cgh"><span>${g.name}</span><button type="button" class="link" data-grp="${g.id}">toggle</button></div>
            <div class="cgl">${cs.map((x) => { const av = catAvailable(x.id); const only = x.profiles.length < 3 ? x.profiles.map((p) => ({ ga: 'GA', air: 'Airline', mil: 'Mil' }[p])).join('/') : ''; return `<label class="cat ${av ? '' : 'na'}" title="${av ? '' : 'Not used in this profile'}"><input type="checkbox" data-cat="${x.id}" ${S.cats.includes(x.id) ? 'checked' : ''} ${av ? '' : 'disabled'}/><span>${x.name}${only ? `<em>${only}</em>` : ''}</span></label>`; }).join('')}</div></div>`;
        }).join('')}</div>
      </div>

      <div class="panel">
        <h2><span class="num">3</span>Session</h2>
        <div class="grid2">
          <div class="fld"><label>Mode</label>${seg('mode', [['practice', 'Practice'], ['quiz', 'Quiz'], ['exam', 'Exam'], ['sprint', 'Sprint']], S.mode)}<small id="modeDesc"></small></div>
          <div class="fld" id="fCount"><label>Questions</label>${seg('count', [[5, '5'], [10, '10'], [20, '20'], [30, '30'], [50, '50']], S.count)}</div>
          <div class="fld" id="fMin"><label>Sprint length</label>${seg('minutes', [[2, '2 min'], [5, '5 min'], [10, '10 min'], [15, '15 min']], S.minutes)}</div>
          <div class="fld" id="fExam"><label>Exam time limit</label>${seg('examMinutes', [[0, 'None'], [10, '10'], [20, '20'], [30, '30'], [60, '60']], S.examMinutes)}</div>
          <div class="fld"><label>Difficulty</label>${seg('difficulty', [[1, 'Easy'], [2, 'Standard'], [3, 'Hard']], S.difficulty)}<small>Easy: round numbers. Hard: messy numbers, variation + deviation, extra steps.</small></div>
          <div class="fld"><label>Answer tolerance</label>${seg('tolerance', [['strict', 'Strict'], ['standard', 'Standard'], ['lenient', 'Lenient']], S.tolerance)}<small>How close counts — Standard ≈ what you can read off a real E6-B.</small></div>
          <div class="fld"><label>Answer format</label>${seg('format', [['typed', 'Typed'], ['mc', 'Multiple choice'], ['mixed', 'Mixed']], S.format)}</div>
          <div class="fld"><label>Fuel units</label>${seg('fuelUnit', [['auto', 'Auto'], ['gal', 'gal'], ['lb', 'lb'], ['kg', 'kg'], ['L', 'L']], S.fuelUnit)}<small>Auto: gallons for GA, pounds for turbine.</small></div>
          <div class="fld"><label>Altimeter setting</label>${seg('pressUnit', [['inHg', 'inHg'], ['hPa', 'hPa']], S.pressUnit)}</div>
          <div class="fld"><label>Theme</label>${seg('theme', [['dark', 'Night'], ['light', 'Day']], S.theme)}</div>
        </div>
        <div class="toggles">
          ${tog('solutions', 'Worked solutions', 'Step-by-step math after each answer')}
          ${tog('e6b', 'Flight-computer technique', 'How to set it up on the E6-B / CX-3')}
          ${tog('diagrams', 'Diagrams', 'Wind triangles, runways, holding sectors')}
          ${tog('hints', 'Hints', 'A nudge button on each question')}
          ${tog('calc', 'Scratch calculator', 'Floating calculator during sessions')}
          ${tog('autoNext', 'Auto-advance', 'Jump to the next question when correct')}
          ${tog('adaptive', 'Focus weak areas', 'Weight categories you miss more often')}
        </div>
      </div>

      <div class="start">
        <button class="btn primary big" id="startBtn">Start session</button>
        ${missed ? `<button class="btn" id="missBtn">Review ${missed} missed</button>` : ''}
      </div>
    </div>`;

    const updateCount = () => {
      const n = activeCats().length;
      $('#catCount').textContent = n + ' selected';
      $('#startBtn').disabled = !n;
      $('#startBtn').textContent = n ? 'Start session' : 'Pick at least one category';
    };
    const modeDesc = { practice: 'Untimed and endless. Instant feedback and solutions.', quiz: 'Fixed number of questions with instant feedback.', exam: 'Fixed set, no feedback until the end — like the written.', sprint: 'Beat the clock: as many correct as you can.' };
    const updateMode = () => {
      $('#modeDesc').textContent = modeDesc[S.mode];
      $('#fCount').style.display = S.mode === 'quiz' || S.mode === 'exam' ? '' : 'none';
      $('#fMin').style.display = S.mode === 'sprint' ? '' : 'none';
      $('#fExam').style.display = S.mode === 'exam' ? '' : 'none';
    };
    updateCount(); updateMode();

    $$('.prof', el).forEach((b) => b.addEventListener('click', () => { S.profile = b.dataset.p; save(); renderSetup(); }));
    $$('.seg', el).forEach((sg) => sg.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      const k = sg.dataset.name, raw = b.dataset.v;
      S[k] = /^\d+$/.test(raw) ? +raw : raw;
      $$('button', sg).forEach((x) => x.classList.toggle('on', x === b));
      if (k === 'theme') document.documentElement.dataset.theme = S.theme;
      if (k === 'mode') updateMode();
      save();
    }));
    $$('[data-k]', el).forEach((c) => c.addEventListener('change', () => { S[c.dataset.k] = c.checked; save(); }));
    $$('[data-cat]', el).forEach((c) => c.addEventListener('change', () => {
      const id = c.dataset.cat;
      S.cats = c.checked ? Array.from(new Set(S.cats.concat(id))) : S.cats.filter((x) => x !== id);
      S.preset = null; $$('[data-preset]', el).forEach((b) => b.classList.remove('on'));
      save(); updateCount();
    }));
    $$('[data-preset]', el).forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.preset;
      S.cats = k === 'none' ? [] : k === 'all' ? G.list.map((x) => x.id) : G.presets[k].cats.slice();
      S.preset = k === 'none' ? null : k;
      if (k === 'military' && S.profile === 'ga') S.profile = 'mil';
      if (k === 'airline' && S.profile === 'ga') S.profile = 'air';
      save(); renderSetup();
    }));
    $$('[data-grp]', el).forEach((b) => b.addEventListener('click', () => {
      const ids = G.list.filter((x) => x.group === b.dataset.grp && catAvailable(x.id)).map((x) => x.id);
      const all = ids.every((id) => S.cats.includes(id));
      S.cats = all ? S.cats.filter((x) => !ids.includes(x)) : Array.from(new Set(S.cats.concat(ids)));
      S.preset = null; save(); renderSetup();
    }));
    $('#startBtn').addEventListener('click', () => startSession());
    const mb = $('#missBtn'); if (mb) mb.addEventListener('click', () => startSession(stats.missed.slice().reverse().map((m) => m.q)));
  }

  // ------------------------------------------------------------------ session
  let ss = null; // session state
  function startSession(fixedQs) {
    const mode = fixedQs ? 'quiz' : S.mode;
    ss = {
      mode, fixed: fixedQs ? fixedQs.map((q) => JSON.parse(JSON.stringify(q))) : null,
      total: fixedQs ? fixedQs.length : mode === 'quiz' || mode === 'exam' ? S.count : Infinity,
      recs: [], cur: null, start: Date.now(), streak: 0, best: 0, last: null,
      deadline: mode === 'sprint' ? Date.now() + S.minutes * 60000 : mode === 'exam' && S.examMinutes ? Date.now() + S.examMinutes * 60000 : null,
      tolMult: TOL[S.tolerance] || 1, review: !!fixedQs,
    };
    clearInterval(ss.timer);
    ss.timer = setInterval(tick, 250);
    $('#calcFab').hidden = !S.calc;
    nextQuestion();
  }

  function pickCat() {
    const pool = activeCats();
    let w = pool.map((id) => {
      if (!S.adaptive) return 1;
      const st = stats.cats[id]; if (!st || st.n < 3) return 1.5;
      return 1 + 4 * (1 - st.c / st.n);
    });
    if (pool.length > 1 && ss.last) w = w.map((x, i) => (pool[i] === ss.last ? x * 0.15 : x));
    let r = Math.random() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) return pool[i]; }
    return pool[pool.length - 1];
  }

  function nextQuestion() {
    if (ss.recs.length >= ss.total) return finish();
    let q;
    if (ss.fixed) q = ss.fixed[ss.recs.length];
    else {
      const id = pickCat(); ss.last = id;
      q = G.make(id, S);
    }
    ss.cur = { q, t0: Date.now(), answered: false, hintShown: false };
    renderQuestion();
  }

  function sessionBar() {
    const n = ss.recs.length, c = ss.recs.filter((r) => r.ok).length;
    const k = ss.cur && ss.cur.answered ? n : n + 1;
    const prog = isFinite(ss.total) ? `${Math.min(k, ss.total)} / ${ss.total}` : `#${k}`;
    const showScore = ss.mode !== 'exam';
    return `<div class="sbar">
      <div class="sb-l"><span class="pill">${{ practice: 'Practice', quiz: ss.review ? 'Review' : 'Quiz', exam: 'Exam', sprint: 'Sprint' }[ss.mode]}</span><span class="mono">${prog}</span></div>
      <div class="sb-m">${showScore ? `<span class="mono good">✓ ${c}</span><span class="mono bad">✗ ${n - c}</span><span class="mono dim">🔥 ${ss.streak}</span>` : ''}</div>
      <div class="sb-r"><span class="mono" id="clock">0:00</span><button class="btn small ghost" id="endBtn">End</button></div>
      ${isFinite(ss.total) ? `<div class="prog"><i style="width:${(n / ss.total) * 100}%"></i></div>` : ''}
    </div>`;
  }

  function fieldInput(f, i) {
    const ph = { hm: 'h:mm', ms: 'm:ss', clock: 'HHMM', hdg: '###' }[f.kind] || '';
    const im = f.kind === 'num' && !f.signed ? 'decimal' : 'text';
    return `<div class="af">
      <label for="a${i}">${esc(f.label)}</label>
      <div class="ain">
        ${f.signed ? `<button type="button" class="pm" data-i="${i}" title="Toggle sign">±</button>` : ''}
        <input id="a${i}" data-i="${i}" autocomplete="off" inputmode="${im}" placeholder="${ph}" spellcheck="false"/>
        <span class="unit">${esc(f.unit === '°' ? '°' : f.unit)}</span>
      </div>
    </div>`;
  }

  function renderQuestion() {
    const q = ss.cur.q, el = $('#view-practice');
    const grp = G.groups.find((g) => g.id === q.group);
    el.innerHTML = `${sessionBar()}
    <div class="qcard" id="qcard">
      <div class="qmeta"><span class="chip sm">${grp ? grp.name : ''}</span><span class="chip sm acc">${esc(q.catName)}</span><span class="chip sm prof-${q.profile}">${esc(q.ac || '')}</span></div>
      <p class="qtext">${q.text}</p>
      <div class="given">${(q.given || []).map(([k, v]) => `<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>
      <form id="af" class="answers" autocomplete="off">
        ${q.choices ? `<div class="choices">${q.choices.map((c, i) => `<button type="button" class="choice" data-c="${i}"><span class="key">${'ABCDEF'[i]}</span><span>${esc(c)}</span></button>`).join('')}</div>`
          : `<div class="afields">${q.fields.map(fieldInput).join('')}</div>`}
        <div class="qactions">
          ${S.hints && (q.hint || q.e6b) && ss.mode !== 'exam' ? '<button type="button" class="btn ghost" id="hintBtn">Hint</button>' : ''}
          <button type="button" class="btn ghost" id="skipBtn">${ss.mode === 'exam' ? 'Skip' : 'Show answer'}</button>
          ${q.choices ? '' : `<button type="submit" class="btn primary" id="chkBtn">${ss.mode === 'exam' ? 'Submit' : 'Check'}</button>`}
        </div>
        <div id="hintBox"></div>
      </form>
      <div id="fb"></div>
    </div>`;
    bindSessionBar();
    const form = $('#af');
    form.addEventListener('submit', (e) => { e.preventDefault(); if (ss.cur.answered) return nextQuestion(); submit(); });
    $$('.pm', form).forEach((b) => b.addEventListener('click', () => {
      const inp = $('#a' + b.dataset.i); const v = inp.value.trim();
      inp.value = v.startsWith('-') || v.startsWith('−') ? v.slice(1) : '-' + v; inp.focus();
    }));
    $$('.choice', form).forEach((b) => b.addEventListener('click', () => { if (!ss.cur.answered) submit(+b.dataset.c); }));
    const hb = $('#hintBtn'); if (hb) hb.addEventListener('click', () => { ss.cur.hintShown = true; $('#hintBox').innerHTML = `<div class="hint">${q.hint ? '💡 ' + q.hint : ''}${q.e6b && S.e6b ? `<div class="e6b-tip"><b>On the flight computer:</b> ${q.e6b}</div>` : ''}</div>`; hb.remove(); });
    $('#skipBtn').addEventListener('click', () => submit(null, true));
    const first = $('#a0'); if (first && !matchMedia('(pointer:coarse)').matches) first.focus();
  }

  function bindSessionBar() {
    $('#endBtn').addEventListener('click', () => { if (ss.recs.length) finish(); else { stop(); renderSetup(); } });
    tick();
  }

  function submit(choice, gaveUp) {
    const q = ss.cur.q; if (ss.cur.answered) return;
    let ok, given;
    if (q.choices) {
      given = choice; ok = !gaveUp && choice === q.answer;
    } else {
      given = q.fields.map((f, i) => $('#a' + i).value);
      if (!gaveUp && given.every((g) => !g.trim())) { toast('Enter an answer (or tap Show answer)'); return; }
      const res = q.fields.map((f, i) => G.checkField(f, U.parse(given[i], f.kind), ss.tolMult));
      ok = !gaveUp && res.every(Boolean);
      ss.cur.res = res;
    }
    const sec = (Date.now() - ss.cur.t0) / 1000;
    ss.cur.answered = true;
    const rec = { q, given, ok, sec, res: ss.cur.res, gaveUp: !!gaveUp };
    ss.recs.push(rec);
    ss.streak = ok ? ss.streak + 1 : 0; ss.best = Math.max(ss.best, ss.streak);
    record(rec);
    if (ss.mode === 'exam') { nextQuestion(); return; }
    showFeedback(rec, $('#fb'));
    lockAnswers(rec);
    const sb = $('.sbar'); sb.outerHTML = sessionBar(); bindSessionBar();
    if (ss.recs.length >= ss.total) {
      $('#fb').insertAdjacentHTML('beforeend', '<div class="nextrow"><button class="btn primary" id="nextBtn">See results →</button></div>');
    } else $('#fb').insertAdjacentHTML('beforeend', '<div class="nextrow"><button class="btn primary" id="nextBtn">Next question →</button></div>');
    $('#nextBtn').addEventListener('click', () => nextQuestion());
    if (ok && (S.autoNext || ss.mode === 'sprint')) ss.autoT = setTimeout(() => { if (ss && ss.recs.includes(rec)) nextQuestion(); }, ss.mode === 'sprint' ? 700 : 1100);
    if (!matchMedia('(pointer:coarse)').matches) $('#nextBtn').focus();
    else $('#fb').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function lockAnswers(rec) {
    const q = rec.q;
    if (q.choices) {
      $$('.choice').forEach((b) => { const i = +b.dataset.c; b.disabled = true; b.classList.toggle('right', i === q.answer); b.classList.toggle('wrong', i === rec.given && !rec.ok); });
    } else {
      q.fields.forEach((f, i) => { const inp = $('#a' + i); inp.readOnly = true; inp.closest('.af').classList.add(rec.res && rec.res[i] && !rec.gaveUp ? 'right' : 'wrong'); });
    }
    const chk = $('#chkBtn'); if (chk) chk.remove();
    const sk = $('#skipBtn'); if (sk) sk.remove();
    const hb = $('#hintBtn'); if (hb) hb.remove();
  }

  function answerTable(rec) {
    const q = rec.q;
    if (q.choices) {
      return `<div class="atab"><div class="ar head"><span></span><span>Your answer</span><span>Correct</span></div><div class="ar ${rec.ok ? 'ok' : 'no'}"><span>Answer</span><span>${rec.given == null ? '—' : esc(q.choices[rec.given])}</span><span>${esc(q.choices[q.answer])}</span></div></div>`;
    }
    return `<div class="atab"><div class="ar head"><span></span><span>You</span><span>Answer</span></div>${q.fields.map((f, i) => {
      const v = U.parse(rec.given ? rec.given[i] : '', f.kind);
      const good = rec.res ? rec.res[i] && !rec.gaveUp : false;
      const tol = f.fixed ? f.tol : f.tol * (ss ? ss.tolMult : 1);
      return `<div class="ar ${good ? 'ok' : 'no'}"><span>${esc(f.label)}</span><span>${isFinite(v) ? esc(G.fmtField(f, v)) : '—'}</span><span>${esc(G.fmtField(f, f.answer))}${tol ? `<small> ±${f.kind === 'ms' ? Math.round(tol * 60) + 's' : f.kind === 'hm' || f.kind === 'clock' ? U.fmt(tol, 0) + ' min' : U.fmt(tol, f.dp ? f.dp : tol < 1 ? 2 : 0)}</small>` : ''}</span></div>`;
    }).join('')}</div>`;
  }

  function showFeedback(rec, box) {
    const q = rec.q;
    box.innerHTML = `
      <div class="verdict ${rec.ok ? 'ok' : 'no'}">${rec.ok ? '✓ Correct' : rec.gaveUp ? 'Answer' : '✗ Not quite'}<span class="mono dim">${U.fmt(rec.sec, 0)}s</span></div>
      ${answerTable(rec)}
      ${S.diagrams && q.diagram ? `<div class="diagram">${D.render(q.diagram)}</div>` : ''}
      ${S.solutions ? `<div class="sol"><h4>Worked solution</h4><ol>${q.solution.map((s) => `<li>${s}</li>`).join('')}</ol></div>` : ''}
      ${S.e6b && q.e6b ? `<div class="e6b-tip"><b>On the flight computer:</b> ${q.e6b}</div>` : ''}`;
  }

  function record(rec) {
    const id = rec.q.cat;
    const c = (stats.cats[id] = stats.cats[id] || { n: 0, c: 0, t: 0 });
    c.n++; c.c += rec.ok ? 1 : 0; c.t += Math.min(rec.sec, 600);
    stats.total.n++; stats.total.c += rec.ok ? 1 : 0; stats.total.t += Math.min(rec.sec, 600);
    if (!rec.ok) {
      stats.missed = stats.missed.filter((m) => m.q.id !== rec.q.id);
      const qq = JSON.parse(JSON.stringify(rec.q));
      stats.missed.push({ q: qq, at: Date.now() });
      if (stats.missed.length > 80) stats.missed.shift();
    } else stats.missed = stats.missed.filter((m) => m.q.id !== rec.q.id);
    saveStats();
  }

  function tick() {
    if (!ss) return;
    const el = $('#clock'); if (!el) return;
    if (ss.deadline) {
      const left = Math.max(0, ss.deadline - Date.now());
      el.textContent = U.ms(left / 60000);
      el.classList.toggle('bad', left < 30000);
      if (left <= 0) {
        if (ss.mode === 'sprint' && ss.cur && !ss.cur.answered) { /* unanswered question doesn't count */ }
        finish();
      }
    } else el.textContent = U.ms((Date.now() - ss.start) / 60000);
  }

  function stop() { if (ss) { clearInterval(ss.timer); clearTimeout(ss.autoT); } $('#calcFab').hidden = true; $('#calc').hidden = true; }

  function finish() {
    if (!ss) return;
    stop();
    const recs = ss.recs, n = recs.length, c = recs.filter((r) => r.ok).length, dur = (Date.now() - ss.start) / 1000;
    if (n) { stats.sessions.unshift({ at: Date.now(), mode: ss.mode, profile: S.profile, n, c, dur }); stats.sessions = stats.sessions.slice(0, 60); saveStats(); }
    const by = {};
    recs.forEach((r) => { const b = (by[r.q.cat] = by[r.q.cat] || { n: 0, c: 0, name: r.q.catName }); b.n++; b.c += r.ok ? 1 : 0; });
    const pctv = n ? Math.round((c / n) * 100) : 0;
    const grade = pctv >= 90 ? 'Checkride ready' : pctv >= 70 ? 'Passing — the FAA minimum is 70%' : n ? 'Keep practicing' : 'No questions answered';
    const done = ss; ss = null;
    const el = $('#view-practice');
    el.innerHTML = `
      <div class="results">
        <div class="score-ring" style="--p:${pctv}"><div><b>${pctv}%</b><small>${c} / ${n}</small></div></div>
        <h2>${grade}</h2>
        <div class="tiles">
          <div><small>Time</small><b class="mono">${U.ms(dur / 60)}</b></div>
          <div><small>Avg / question</small><b class="mono">${n ? U.fmt(recs.reduce((s, r) => s + r.sec, 0) / n, 0) + 's' : '—'}</b></div>
          <div><small>Best streak</small><b class="mono">${done.best}</b></div>
          ${done.mode === 'sprint' ? `<div><small>Correct / min</small><b class="mono">${U.fmt(c / Math.max(1, S.minutes), 1)}</b></div>` : ''}
        </div>
        <div class="panel">
          <h3>By category</h3>
          <div class="bars">${Object.values(by).sort((a, b) => a.c / a.n - b.c / b.n).map((b) => `<div class="bar"><span>${esc(b.name)}</span><i><em style="width:${(b.c / b.n) * 100}%" class="${b.c / b.n >= 0.7 ? 'g' : 'r'}"></em></i><b class="mono">${b.c}/${b.n}</b></div>`).join('')}</div>
        </div>
        <div class="panel">
          <h3>Review</h3>
          <div class="rlist">${recs.map((r, i) => `<details class="ritem ${r.ok ? 'ok' : 'no'}"><summary><span class="mk">${r.ok ? '✓' : '✗'}</span><span class="rt">${esc(r.q.catName)}</span><span class="mono dim">${U.fmt(r.sec, 0)}s</span></summary><div class="rbody"><p class="qtext">${r.q.text}</p><div class="fbx" data-i="${i}"></div></div></details>`).join('')}</div>
        </div>
        <div class="start">
          <button class="btn primary big" id="againBtn">New session</button>
          ${recs.some((r) => !r.ok) ? '<button class="btn" id="retryBtn">Retry missed</button>' : ''}
          <button class="btn ghost" id="setupBtn">Change setup</button>
        </div>
      </div>`;
    $$('.ritem', el).forEach((d) => d.addEventListener('toggle', () => { const b = $('.fbx', d); if (d.open && !b.innerHTML) showFeedback(recs[+b.dataset.i], b); }, { once: false }));
    $('#againBtn').addEventListener('click', () => startSession());
    $('#setupBtn').addEventListener('click', () => renderSetup());
    const rb = $('#retryBtn'); if (rb) rb.addEventListener('click', () => startSession(recs.filter((r) => !r.ok).map((r) => r.q)));
    window.scrollTo({ top: 0 });
  }

  // keyboard: A–D for choices, Enter for next
  document.addEventListener('keydown', (e) => {
    if (view !== 'practice' || !ss || !ss.cur) return;
    if (e.target.closest && e.target.closest('#calc')) return;
    const k = e.key.toUpperCase();
    if (ss.cur.q.choices && !ss.cur.answered && 'ABCDEF'.includes(k) && k.length === 1 && e.target.tagName !== 'INPUT') {
      const i = 'ABCDEF'.indexOf(k); if (i < ss.cur.q.choices.length) submit(i);
    } else if (e.key === 'Enter' && ss.cur.answered && e.target.tagName !== 'BUTTON') { e.preventDefault(); nextQuestion(); }
  });

  // ------------------------------------------------------------------ scratch calculator
  const calc = { expr: '', hist: [] };
  function renderCalc() {
    const keys = ['(', ')', '√', '⌫', 'sin', 'cos', 'tan', '÷', '7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '+', '±', '0', '.', '='];
    $('#calc').innerHTML = `<div class="ch"><b>Scratch calculator</b><span class="dim">degrees</span><button class="link" id="calcX">close</button></div>
      <div class="chist">${calc.hist.slice(-3).map((h) => `<div>${esc(h)}</div>`).join('')}</div>
      <input id="calcIn" class="mono" value="${esc(calc.expr)}" placeholder="e.g. 142/118*60" spellcheck="false" autocomplete="off"/>
      <div class="ckeys">${keys.map((k) => `<button type="button" data-k="${k}" class="${'=÷×−+'.includes(k) && k.length === 1 ? 'op' : ''} ${k === '=' ? 'eq' : ''}">${k}</button>`).join('')}<button type="button" data-k="C" class="wide">Clear</button><button type="button" data-k="ans" class="wide">Use in answer</button></div>`;
    $('#calcX').onclick = () => ($('#calc').hidden = true);
    const inp = $('#calcIn');
    inp.oninput = () => (calc.expr = inp.value);
    inp.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); evalCalc(); } };
    $$('.ckeys button').forEach((b) => (b.onclick = () => {
      const k = b.dataset.k;
      if (k === '=') return evalCalc();
      if (k === 'C') calc.expr = '';
      else if (k === '⌫') calc.expr = calc.expr.slice(0, -1);
      else if (k === '±') calc.expr = calc.expr.startsWith('-') ? calc.expr.slice(1) : '-' + calc.expr;
      else if (k === 'ans') {
        const li = calc.lastInput && document.body.contains(calc.lastInput) ? calc.lastInput : null;
        const target = li || $$('.qcard .ain input').find((x) => !x.value && !x.readOnly) || $('.qcard .ain input');
        if (target && !target.readOnly) { const v = safeEval(calc.expr); target.value = isFinite(v) ? String(U.round(v, 3)) : calc.expr; $('#calc').hidden = true; target.focus(); }
        return;
      } else calc.expr += ['sin', 'cos', 'tan', '√'].includes(k) ? k + '(' : k;
      inp.value = calc.expr;
    }));
  }
  function safeEval(s) {
    let x = String(s).replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/√/g, 'sqrt').replace(/\^/g, '**').replace(/π/g, 'pi');
    if (!/^[\d+\-*/().\s,a-z]*$/i.test(x)) return NaN;
    const words = x.match(/[a-z]+/gi) || [];
    if (words.some((w) => !['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sqrt', 'pi', 'abs', 'log', 'ln'].includes(w.toLowerCase()))) return NaN;
    x = x.replace(/,/g, '');
    try {
      // eslint-disable-next-line no-new-func
      const f = new Function('sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sqrt', 'pi', 'abs', 'log', 'ln', 'return (' + x + ');');
      return f(U.sin, U.cos, U.tan, (v) => U.asind(v), (v) => Math.acos(v) / U.R, (v) => U.atand(v), Math.sqrt, Math.PI, Math.abs, Math.log10, Math.log);
    } catch (e) { return NaN; }
  }
  function evalCalc() {
    const v = safeEval(calc.expr);
    if (!isFinite(v)) { toast('Can’t evaluate that'); return; }
    const out = String(U.round(v, 6));
    calc.hist.push(calc.expr + ' = ' + out); calc.expr = out; renderCalc(); $('#calcIn').focus();
  }
  document.addEventListener('focusin', (e) => { if (e.target.matches && e.target.matches('.qcard .ain input')) calc.lastInput = e.target; });
  $('#calcFab').addEventListener('click', () => { const c = $('#calc'); c.hidden = !c.hidden; if (!c.hidden) { renderCalc(); if (!matchMedia('(pointer:coarse)').matches) $('#calcIn').focus(); } });

  // ------------------------------------------------------------------ tools
  let curTool = U.store.get('tool', 'wind');
  const toolVals = U.store.get('toolVals', {});
  function renderTools() {
    const el = $('#view-tools');
    if (!T.list.find((t) => t.id === curTool)) curTool = 'wind';
    el.innerHTML = `<div class="tools">
      <aside class="tnav">${T.groups.map(([g, gn]) => `<div class="tg"><div class="tgh">${gn}</div>${T.list.filter((t) => t.group === g).map((t) => `<button class="tb ${t.id === curTool ? 'on' : ''}" data-t="${t.id}">${t.name}</button>`).join('')}</div>`).join('')}</aside>
      <div class="tpanel" id="tpanel"></div>
    </div>`;
    $$('.tb', el).forEach((b) => b.addEventListener('click', () => { curTool = b.dataset.t; U.store.set('tool', curTool); renderTools(); if (innerWidth < 800) $('#tpanel').scrollIntoView({ behavior: 'smooth' }); }));
    renderTool();
  }
  function renderTool() {
    const t = T.list.find((x) => x.id === curTool), el = $('#tpanel');
    if (t.custom === 'wb') return renderWB(el, t);
    if (t.custom === 'timer') return renderTimer(el, t);
    const vals = Object.assign({}, ...t.inputs.map((i) => ({ [i.k]: i.v })), toolVals[t.id] || {});
    el.innerHTML = `<div class="panel tool"><div class="th"><h2>${t.name}</h2><p>${t.desc}</p><button class="link" id="tReset">reset</button></div>
      <div class="tin">${t.inputs.map((i) => i.type === 'sel'
        ? `<div class="fld"><label>${i.l}</label><select data-k="${i.k}">${i.opts.map(([v, l]) => `<option value="${v}" ${String(vals[i.k]) === String(v) ? 'selected' : ''}>${l}</option>`).join('')}</select></div>`
        : `<div class="fld"><label>${i.l}</label><div class="ain"><input data-k="${i.k}" value="${esc(vals[i.k] ?? '')}" inputmode="${i.type === 'text' || i.kind ? 'text' : 'decimal'}" autocomplete="off"/>${i.u ? `<span class="unit">${i.u}</span>` : ''}</div></div>`).join('')}</div>
      <div class="tout" id="tout"></div></div>`;
    const run = () => {
      const v = {}; $$('[data-k]', el).forEach((x) => (v[x.dataset.k] = x.value));
      toolVals[t.id] = v; U.store.set('toolVals', toolVals);
      let res = {}; try { res = t.run(v) || {}; } catch (e) { res = { warn: 'Check your inputs.' }; }
      $('#tout').innerHTML = `${res.warn ? `<div class="warn">${res.warn}</div>` : ''}<div class="trows">${(res.rows || []).map(([l, val, cls]) => `<div class="trow ${cls || ''}"><span>${l}</span><b class="mono">${val}</b></div>`).join('')}</div>${res.svg ? `<div class="diagram">${res.svg}</div>` : ''}`;
    };
    $$('[data-k]', el).forEach((x) => x.addEventListener('input', run));
    $('#tReset').addEventListener('click', () => { delete toolVals[t.id]; U.store.set('toolVals', toolVals); renderTool(); });
    run();
  }

  function renderWB(el) {
    const st = toolVals.wb || { rows: [['Empty weight', 1663, 39.4], ['Pilot & front pax', 340, 37], ['Rear pax', 170, 73], ['Baggage', 40, 95], ['Fuel (gal×6)', 240, 48]], lemac: '', mac: '' };
    const draw = () => {
      el.innerHTML = `<div class="panel tool"><div class="th"><h2>Weight &amp; Balance</h2><p>Enter weights and arms. Add rows as needed. Example values: Cessna 172S.</p><button class="link" id="wbReset">reset</button></div>
      <table class="wbtool"><thead><tr><th>Item</th><th>Weight</th><th>Arm</th><th>Moment</th><th></th></tr></thead><tbody>${st.rows.map((r, i) => `<tr><td><input data-r="${i}" data-c="0" value="${esc(r[0])}"/></td><td><input data-r="${i}" data-c="1" value="${r[1]}" inputmode="decimal"/></td><td><input data-r="${i}" data-c="2" value="${r[2]}" inputmode="decimal"/></td><td class="mono" id="m${i}"></td><td><button class="link" data-del="${i}">✕</button></td></tr>`).join('')}</tbody></table>
      <div class="wbbar"><button class="btn small" id="wbAdd">+ Row</button><div class="fld inline"><label>LEMAC</label><input id="lemac" value="${st.lemac}" inputmode="decimal"/></div><div class="fld inline"><label>MAC</label><input id="mac" value="${st.mac}" inputmode="decimal"/></div></div>
      <div class="tout"><div class="trows" id="wbOut"></div></div></div>`;
      const calc2 = () => {
        let W = 0, M = 0;
        st.rows.forEach((r, i) => { const w = parseFloat(r[1]) || 0, a = parseFloat(r[2]) || 0; W += w; M += w * a; $('#m' + i).textContent = U.fmt(w * a); });
        const cg = W ? M / W : NaN, le = parseFloat(st.lemac), mc = parseFloat(st.mac);
        $('#wbOut').innerHTML = [['Total weight', U.fmt(W, 1) + ' lb', 'big'], ['Total moment', U.fmt(M)], ['CG', U.fmt(cg, 2) + ' in', 'big']].concat(isFinite(le) && isFinite(mc) && mc ? [['CG %MAC', U.fmt(((cg - le) / mc) * 100, 1) + '%', 'big']] : []).map(([l, v, c]) => `<div class="trow ${c || ''}"><span>${l}</span><b class="mono">${v}</b></div>`).join('');
        toolVals.wb = st; U.store.set('toolVals', toolVals);
      };
      $$('[data-r]', el).forEach((x) => x.addEventListener('input', () => { st.rows[+x.dataset.r][+x.dataset.c] = x.value; calc2(); }));
      $$('[data-del]', el).forEach((x) => x.addEventListener('click', () => { st.rows.splice(+x.dataset.del, 1); draw(); }));
      $('#wbAdd').addEventListener('click', () => { st.rows.push(['Item', 0, 0]); draw(); });
      $('#lemac').addEventListener('input', (e) => { st.lemac = e.target.value; calc2(); });
      $('#mac').addEventListener('input', (e) => { st.mac = e.target.value; calc2(); });
      $('#wbReset').addEventListener('click', () => { delete toolVals.wb; U.store.set('toolVals', toolVals); renderWB(el); });
      calc2();
    };
    draw();
  }

  const tm = { sw: 0, swOn: null, laps: [], cd: 0, cdEnd: null, cdSet: 120 };
  function renderTimer(el) {
    el.innerHTML = `<div class="panel tool"><div class="th"><h2>Stopwatch &amp; Timer</h2><p>Leg timing and countdowns (approach timing, holds, fuel tank switches).</p></div>
      <div class="timers">
        <div class="tmr"><small>Stopwatch</small><div class="tdisp mono" id="swD">0:00.0</div><div class="tbtns"><button class="btn primary" id="swGo">Start</button><button class="btn" id="swLap">Lap</button><button class="btn ghost" id="swRst">Reset</button></div><div class="laps mono" id="laps"></div></div>
        <div class="tmr"><small>Countdown</small><div class="tdisp mono" id="cdD">2:00</div><div class="tbtns"><button class="btn" data-cd="60">1:00</button><button class="btn" data-cd="120">2:00</button><button class="btn" data-cd="180">3:00</button><button class="btn" data-cd="1800">30:00</button></div><div class="tbtns"><button class="btn primary" id="cdGo">Start</button><button class="btn ghost" id="cdRst">Reset</button></div></div>
      </div></div>`;
    const swVal = () => tm.sw + (tm.swOn ? Date.now() - tm.swOn : 0);
    const fmtS = (ms) => { const s = ms / 1000; return Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0') + '.' + Math.floor((s * 10) % 10); };
    const upd = () => {
      if (!$('#swD')) { clearInterval(tm.iv); tm.iv = null; return; }
      $('#swD').textContent = fmtS(swVal());
      const left = tm.cdEnd ? Math.max(0, tm.cdEnd - Date.now()) : tm.cd || tm.cdSet * 1000;
      $('#cdD').textContent = U.ms(left / 60000);
      $('#cdD').classList.toggle('bad', !!tm.cdEnd && left <= 10000);
      if (tm.cdEnd && left <= 0) { tm.cdEnd = null; tm.cd = 0; toast('⏱ Countdown complete'); if (navigator.vibrate) navigator.vibrate([200, 100, 200]); $('#cdGo').textContent = 'Start'; }
    };
    $('#swGo').onclick = () => { if (tm.swOn) { tm.sw = swVal(); tm.swOn = null; } else tm.swOn = Date.now(); $('#swGo').textContent = tm.swOn ? 'Stop' : 'Start'; };
    $('#swLap').onclick = () => { tm.laps.unshift(fmtS(swVal())); $('#laps').innerHTML = tm.laps.slice(0, 6).map((l, i) => `<div>Lap ${tm.laps.length - i}: ${l}</div>`).join(''); };
    $('#swRst').onclick = () => { tm.sw = 0; tm.swOn = null; tm.laps = []; $('#laps').innerHTML = ''; $('#swGo').textContent = 'Start'; };
    $$('[data-cd]').forEach((b) => (b.onclick = () => { tm.cdSet = +b.dataset.cd; tm.cd = 0; tm.cdEnd = null; $('#cdGo').textContent = 'Start'; }));
    $('#cdGo').onclick = () => { if (tm.cdEnd) { tm.cd = tm.cdEnd - Date.now(); tm.cdEnd = null; } else tm.cdEnd = Date.now() + (tm.cd || tm.cdSet * 1000); $('#cdGo').textContent = tm.cdEnd ? 'Pause' : 'Start'; };
    $('#cdRst').onclick = () => { tm.cd = 0; tm.cdEnd = null; $('#cdGo').textContent = 'Start'; };
    $('#swGo').textContent = tm.swOn ? 'Stop' : 'Start'; $('#cdGo').textContent = tm.cdEnd ? 'Pause' : 'Start';
    clearInterval(tm.iv); tm.iv = setInterval(upd, 100); upd();
  }

  // ------------------------------------------------------------------ stats
  function renderStats() {
    const el = $('#view-stats'), t = stats.total;
    const rows = G.list.map((g) => ({ g, s: stats.cats[g.id] })).filter((x) => x.s && x.s.n);
    el.innerHTML = `
      <div class="tiles big">
        <div><small>Questions</small><b class="mono">${t.n}</b></div>
        <div><small>Accuracy</small><b class="mono">${t.n ? Math.round((t.c / t.n) * 100) + '%' : '—'}</b></div>
        <div><small>Avg time</small><b class="mono">${t.n ? U.fmt(t.t / t.n, 0) + 's' : '—'}</b></div>
        <div><small>Sessions</small><b class="mono">${stats.sessions.length}</b></div>
      </div>
      ${rows.length ? `<div class="panel"><h3>Categories (weakest first)</h3><div class="bars">${rows.sort((a, b) => a.s.c / a.s.n - b.s.c / b.s.n).map(({ g, s }) => `<div class="bar"><span>${g.name}</span><i><em style="width:${(s.c / s.n) * 100}%" class="${s.c / s.n >= 0.7 ? 'g' : 'r'}"></em></i><b class="mono">${Math.round((s.c / s.n) * 100)}% <small>${s.c}/${s.n} · ${U.fmt(s.t / s.n, 0)}s</small></b></div>`).join('')}</div>
        <div class="start"><button class="btn primary" id="weakBtn">Practice my 5 weakest</button></div></div>` : '<div class="panel empty">No practice yet — your accuracy by category will show up here.</div>'}
      ${stats.sessions.length ? `<div class="panel"><h3>Recent sessions</h3><div class="sess">${stats.sessions.slice(0, 15).map((s) => `<div><span>${new Date(s.at).toLocaleDateString()} ${new Date(s.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span><span class="pill">${s.mode}</span><span>${{ ga: 'GA', air: 'Airline', mil: 'Military', mix: 'Mixed' }[s.profile] || ''}</span><b class="mono">${s.c}/${s.n}</b><span class="mono dim">${U.ms(s.dur / 60)}</span></div>`).join('')}</div></div>` : ''}
      <div class="start"><button class="btn ghost" id="resetStats">Reset all stats</button></div>`;
    const wb = $('#weakBtn');
    if (wb) wb.addEventListener('click', () => {
      const weak = rows.sort((a, b) => a.s.c / a.s.n - b.s.c / b.s.n).slice(0, 5).map((x) => x.g.id);
      S.cats = weak; S.preset = null; S.profile = 'mix'; S.mode = 'quiz'; save(); show('practice'); startSession();
    });
    $('#resetStats').addEventListener('click', () => { if (confirm('Reset all stats and missed questions?')) { stats.cats = {}; stats.sessions = []; stats.missed = []; stats.total = { n: 0, c: 0, t: 0 }; saveStats(); renderStats(); } });
  }

  // ------------------------------------------------------------------ reference
  function renderRef() {
    const el = $('#view-ref');
    el.innerHTML = `<div class="ref">
      <div class="panel"><h2>Quick reference</h2><p class="dim">Formulas and rules behind every problem type. The FAA references (PHAK, AFH, IFH, AIM) remain the authority.</p></div>
      <div class="refgrid">${G.groups.map((g) => `<div class="panel"><h3>${g.name}</h3>${G.list.filter((x) => x.group === g.id).map((x) => `<div class="refitem"><b>${x.name}</b><ul>${(x.info || []).map((i) => `<li>${i}</li>`).join('')}</ul></div>`).join('')}</div>`).join('')}
        <div class="panel"><h3>E6-B sides at a glance</h3><div class="refitem"><b>Computer (slide-rule) side</b><ul><li>Outer scale = distance / fuel / "miles"; inner = time in minutes; ▲60 = speed index</li><li>Airspeed window: OAT over PA → TAS & density altitude</li><li>Altitude window: OAT over PA → true altitude</li><li>Conversion indexes: NAUT/STAT/KM, LBS/KG, US GAL/IMP GAL/LITERS, °C↔°F</li></ul></div><div class="refitem"><b>Wind side</b><ul><li>Rotate wind direction under TRUE INDEX, mark speed above grommet</li><li>Rotate to TC, slide TAS under mark → read WCA and GS</li><li>Right WCA (+) when the mark is right of centerline</li></ul></div></div>
      </div></div>`;
  }

  // ------------------------------------------------------------------ boot
  renderSetup();
})();
