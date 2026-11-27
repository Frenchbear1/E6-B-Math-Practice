/* E6-B Trainer — SVG diagrams (wind triangle, runway components, holding entries) */
(function () {
  const U = E6.util, A = E6.av;
  const D = (E6.diagram = {});
  const P = (b, len) => [U.sin(b) * len, -U.cos(b) * len];
  const f1 = (n) => (Math.round(n * 10) / 10).toString();

  function arrowHead(x1, y1, x2, y2, size, cls) {
    const a = Math.atan2(y2 - y1, x2 - x1), s = size;
    const p1 = [x2 - s * Math.cos(a - 0.4), y2 - s * Math.sin(a - 0.4)];
    const p2 = [x2 - s * Math.cos(a + 0.4), y2 - s * Math.sin(a + 0.4)];
    return `<path class="${cls}" d="M${f1(x2)},${f1(y2)} L${f1(p1[0])},${f1(p1[1])} L${f1(p2[0])},${f1(p2[1])} Z"/>`;
  }
  function vec(x1, y1, x2, y2, cls, w) {
    return `<line class="${cls}" x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}" stroke-width="${w || 3}" stroke-linecap="round"/>` + arrowHead(x1, y1, x2, y2, 10, cls + ' fill');
  }
  function north(x, y) {
    return `<g class="dg-north"><line x1="${x}" y1="${y + 14}" x2="${x}" y2="${y - 10}"/>${arrowHead(x, y + 14, x, y - 12, 7, 'dg-north fill')}<text x="${x}" y="${y + 28}" text-anchor="middle">N</text></g>`;
  }

  D.wind = function ({ tc, th, tas, gs, wd, ws }) {
    const W = 320, H = 280;
    const a0 = P(th, tas), g0 = P(tc, gs);
    const xs = [0, a0[0], g0[0]], ys = [0, a0[1], g0[1]];
    const bw = Math.max(...xs) - Math.min(...xs), bh = Math.max(...ys) - Math.min(...ys);
    const s = Math.min(220 / Math.max(bw, 1), 190 / Math.max(bh, 1), 230 / Math.max(tas, gs));
    const a = [a0[0] * s, a0[1] * s], g = [g0[0] * s, g0[1] * s];
    const cx = W / 2 - ((Math.min(...xs) + Math.max(...xs)) / 2) * s, cy = H / 2 + 6 - ((Math.min(...ys) + Math.max(...ys)) / 2) * s;
    const o = [cx, cy], A2 = [cx + a[0], cy + a[1]], G2 = [cx + g[0], cy + g[1]];
    // which side of the ground track is the air vector? put labels on opposite sides
    const side = Math.sign(U.adiff(th, tc)) || 1;
    const lab = (b, len, perp, txt, cls) => {
      const m = P(b, len * 0.55), pp = P(b + 90 * perp, 16);
      return `<text class="${cls}" x="${f1(cx + m[0] + pp[0])}" y="${f1(cy + m[1] + pp[1] + 4)}" text-anchor="middle">${txt}</text>`;
    };
    const mW = [(A2[0] + G2[0]) / 2, (A2[1] + G2[1]) / 2], pw = P(wd + 180 + 90 * side, 18);
    return `<svg viewBox="0 0 ${W} ${H}" class="dg" role="img" aria-label="Wind triangle">
      ${north(22, 26)}
      ${vec(o[0], o[1], A2[0], A2[1], 'dg-air')}
      ${vec(o[0], o[1], G2[0], G2[1], 'dg-gnd')}
      ${ws > 0.5 ? vec(A2[0], A2[1], G2[0], G2[1], 'dg-wind', 2.5) : ''}
      <circle cx="${f1(cx)}" cy="${f1(cy)}" r="3.5" class="dg-dot"/>
      ${lab(th, tas * s, side, `TH ${U.hdg(th)}° · ${Math.round(tas)} kt`, 'dg-t air')}
      ${lab(tc, gs * s, -side, `TC ${U.hdg(tc)}° · ${Math.round(gs)} kt`, 'dg-t gnd')}
      ${ws > 0.5 ? `<text class="dg-t wind" x="${f1(mW[0] + pw[0])}" y="${f1(mW[1] + pw[1] + 4)}" text-anchor="middle">W ${U.hdg(wd)}°/${Math.round(ws)}</text>` : ''}
      <g class="dg-legend"><rect x="${W - 92}" y="8" width="84" height="52" rx="6"/><line class="dg-air" x1="${W - 84}" y1="21" x2="${W - 68}" y2="21" stroke-width="3"/><text x="${W - 62}" y="25">Air</text><line class="dg-gnd" x1="${W - 84}" y1="35" x2="${W - 68}" y2="35" stroke-width="3"/><text x="${W - 62}" y="39">Ground</text><line class="dg-wind" x1="${W - 84}" y1="49" x2="${W - 68}" y2="49" stroke-width="3"/><text x="${W - 62}" y="53">Wind</text></g>
    </svg>`;
  };

  D.rwy = function ({ rh, wd, ws, cross, head, rname }) {
    const W = 300, H = 260, cx = 150, cy = 135;
    const rot = `rotate(${rh} ${cx} ${cy})`;
    const recip = String(((Math.round(rh / 10) + 17) % 36) + 1).padStart(2, '0');
    const wf = P(wd, 112), wt = P(wd, 30);
    return `<svg viewBox="0 0 ${W} ${H}" class="dg" role="img" aria-label="Runway wind components">
      ${north(22, 26)}
      <g transform="${rot}">
        <rect x="${cx - 16}" y="${cy - 100}" width="32" height="200" rx="3" class="dg-rwy"/>
        <line x1="${cx}" y1="${cy - 80}" x2="${cx}" y2="${cy + 80}" class="dg-cl"/>
        <text x="${cx}" y="${cy - 84}" text-anchor="middle" class="dg-rn" transform="rotate(180 ${cx} ${cy - 88})">${recip}</text>
        <text x="${cx}" y="${cy + 92}" text-anchor="middle" class="dg-rn">${rname}</text>
      </g>
      ${vec(cx + wf[0], cy + wf[1], cx + wt[0], cy + wt[1], 'dg-wind', 3)}
      <text x="${f1(cx + wf[0])}" y="${f1(cy + wf[1] + (wf[1] < 0 ? -8 : 16))}" text-anchor="middle" class="dg-t wind">${U.hdg(wd)}° / ${Math.round(ws)} kt</text>
      <g class="dg-box"><rect x="8" y="${H - 50}" width="150" height="42" rx="6"/>
      <text x="16" y="${H - 33}">X-wind ${U.fmt(Math.abs(cross), 1)} kt ${cross >= 0 ? 'R' : 'L'}</text>
      <text x="16" y="${H - 16}">${head >= 0 ? 'Headwind' : 'Tailwind'} ${U.fmt(Math.abs(head), 1)} kt</text></g>
    </svg>`;
  };

  D.hold = function ({ inbound, right, heading, entry }) {
    const W = 300, H = 280, cx = 150, cy = 140, R = 118;
    const g = (b, r) => { const p = P(b + inbound, r); return [cx + p[0], cy + p[1]]; };
    const wedge = (b0, b1, cls) => {
      const p0 = g(b0, R), p1 = g(b1, R), large = U.n360(b1 - b0) > 180 ? 1 : 0;
      return `<path class="${cls}" d="M${cx},${cy} L${f1(p0[0])},${f1(p0[1])} A${R},${R} 0 ${large} 1 ${f1(p1[0])},${f1(p1[1])} Z"/>`;
    };
    const sec = right ? { Parallel: [0, 110], Direct: [110, 290], Teardrop: [290, 360] } : { Teardrop: [0, 70], Direct: [70, 250], Parallel: [250, 360] };
    let wedges = '', labels = '';
    for (const [n, [a, b]] of Object.entries(sec)) {
      wedges += wedge(a, b, 'dg-sec' + (n === entry ? ' on' : ''));
      const m = g((a + b) / 2, 86);
      labels += `<text x="${f1(m[0])}" y="${f1(m[1] + 4)}" text-anchor="middle" class="dg-sl${n === entry ? ' on' : ''}">${n}</text>`;
    }
    // racetrack in local frame (inbound = up, inbound leg below the fix)
    const L = 78, r = 20, sgn = right ? 1 : -1, pts = [];
    for (let i = 0; i <= 20; i++) { const t = Math.PI - (Math.PI * i) / 20; pts.push([sgn * (r + r * Math.cos(t)), -r * Math.sin(t)]); }
    for (let i = 0; i <= 20; i++) { const t = (Math.PI * i) / 20; pts.push([sgn * (r + r * Math.cos(t)), L + r * Math.sin(t)]); }
    pts.push([0, 0]);
    const th = inbound * U.R;
    const path = pts.map(([x, y], i) => { const X = cx + x * Math.cos(th) - y * Math.sin(th), Y = cy + x * Math.sin(th) + y * Math.cos(th); return (i ? 'L' : 'M') + f1(X) + ',' + f1(Y); }).join(' ');
    const ac0 = P(heading + 180, 128), ac1 = P(heading + 180, 22);
    const ib = g(180, 40);
    return `<svg viewBox="0 0 ${W} ${H}" class="dg" role="img" aria-label="Holding entry sectors">
      ${north(22, 26)}
      ${wedges}
      <line x1="${f1(g(0, R)[0])}" y1="${f1(g(0, R)[1])}" x2="${f1(g(180, R)[0])}" y2="${f1(g(180, R)[1])}" class="dg-ln"/>
      <line x1="${f1(g(right ? 110 : 250, R)[0])}" y1="${f1(g(right ? 110 : 250, R)[1])}" x2="${f1(g(right ? 290 : 70, R)[0])}" y2="${f1(g(right ? 290 : 70, R)[1])}" class="dg-ln dash"/>
      <path d="${path}" class="dg-hold"/>
      ${labels}
      <circle cx="${cx}" cy="${cy}" r="5" class="dg-fix"/>
      <text x="${f1(ib[0] + 8)}" y="${f1(ib[1])}" class="dg-t small">inbound ${U.hdg(inbound)}°</text>
      ${vec(cx + ac0[0], cy + ac0[1], cx + ac1[0], cy + ac1[1], 'dg-ac', 3)}
      <text x="${f1(cx + ac0[0])}" y="${f1(cy + ac0[1] + (ac0[1] < 0 ? -6 : 14))}" text-anchor="middle" class="dg-t air">HDG ${U.hdg(heading)}°</text>
    </svg>`;
  };

  D.render = (d) => (d && D[d.type] ? D[d.type](d) : '');
})();
