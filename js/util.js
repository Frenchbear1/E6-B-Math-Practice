/* E6-B Trainer — shared helpers */
(function () {
  const E6 = (window.E6 = window.E6 || {});
  const U = (E6.util = {});

  U.int = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
  U.step = (a, b, s) => {
    const lo = Math.ceil(a / s), hi = Math.floor(b / s);
    return +(U.int(lo, Math.max(lo, hi)) * s).toFixed(6);
  };
  U.float = (a, b) => a + Math.random() * (b - a);
  U.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  U.chance = (p) => Math.random() < p;
  U.shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  U.round = (v, dp = 0) => { const f = Math.pow(10, dp); return Math.round(v * f) / f; };
  U.roundTo = (v, s) => +(Math.round(v / s) * s).toFixed(6);
  U.clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  U.R = Math.PI / 180;
  U.n360 = (a) => ((a % 360) + 360) % 360;
  U.adiff = (a, b) => { let d = U.n360(a - b); return d > 180 ? d - 360 : d; };
  U.sin = (d) => Math.sin(d * U.R);
  U.cos = (d) => Math.cos(d * U.R);
  U.tan = (d) => Math.tan(d * U.R);
  U.asind = (x) => Math.asin(x) / U.R;
  U.atand = (x) => Math.atan(x) / U.R;
  U.atan2d = (y, x) => Math.atan2(y, x) / U.R;

  U.fmt = (v, dp = 0) =>
    isFinite(v)
      ? Number(v).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })
      : '—';
  U.hdg = (a) => { let n = Math.round(U.n360(a)); if (n === 0) n = 360; return String(n).padStart(3, '0'); };
  U.hm = (min) => {
    const t = Math.round(min), a = Math.abs(t);
    return (t < 0 ? '-' : '') + Math.floor(a / 60) + ':' + String(a % 60).padStart(2, '0');
  };
  U.ms = (min) => {
    const t = Math.round(min * 60), a = Math.abs(t);
    return (t < 0 ? '-' : '') + Math.floor(a / 60) + ':' + String(a % 60).padStart(2, '0');
  };
  U.clock = (min, sec) => {
    const t = (((Math.round(min) % 1440) + 1440) % 1440);
    return String(Math.floor(t / 60)).padStart(2, '0') + String(t % 60).padStart(2, '0') + (sec != null ? ':' + String(sec).padStart(2, '0') : '') + 'Z';
  };
  U.signed = (v, dp = 0) => (v > 0 ? '+' : v < 0 ? '−' : '') + U.fmt(Math.abs(v), dp);
  U.ew = (v) => U.fmt(Math.abs(v), 0) + '°' + (v >= 0 ? 'E' : 'W');
  U.compass8 = (deg) =>
    ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'][Math.round(U.n360(deg) / 45) % 8];
  U.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /** Parse user input by field kind. Returns number (minutes for time kinds) or NaN. */
  U.parse = (str, kind) => {
    if (str == null) return NaN;
    let s = String(str).trim().toLowerCase().replace(/[,°\s]/g, '').replace(/[−–—]/g, '-');
    if (kind === 'clock') {
      s = s.replace(/z$/, '').replace(':', '');
      if (!/^\d{3,4}$/.test(s)) return NaN;
      const v = parseInt(s, 10), h = Math.floor(v / 100), m = v % 100;
      return h < 24 && m < 60 ? h * 60 + m : NaN;
    }
    s = s.replace(/[a-z%/]+$/i, '');
    if (!s) return NaN;
    if (kind === 'hm' || kind === 'ms') {
      if (s.includes(':')) {
        const [a, b] = s.split(':');
        if (!/^\d*$/.test(a) || !/^\d+(\.\d+)?$/.test(b)) return NaN;
        const A = parseFloat(a || '0'), B = parseFloat(b);
        return kind === 'hm' ? A * 60 + B : A + B / 60;
      }
    }
    if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s)) return NaN;
    return parseFloat(s);
  };

  U.store = {
    get(k, d) { try { const v = localStorage.getItem('e6b:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('e6b:' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
    del(k) { try { localStorage.removeItem('e6b:' + k); } catch (e) { /* ignore */ } },
  };
})();
