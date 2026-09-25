/* Ponto de Cultura 2026 — scroll story.
   One cosmogram, drawn once, carries the story: the cover emblem folds into
   the labelled cosmogram, then the sun walks the four moments while the sky
   follows it. Past · Present · Future gets its own ring, and the back page
   closes with every diagram together. All motion is either scrubbed by the
   scroll position (so it plays backwards too) or a gentle ambient loop. */
(() => {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => t * t * (3 - 2 * t);
  const ramp = (t, a, b) => smooth(clamp((t - a) / (b - a)));
  const bump = (t, a, b, c, d) => ramp(t, a, b) * (1 - ramp(t, c, d));
  const backOut = t => { const s = 1.9; t -= 1; return t * t * ((s + 1) * t + s) + 1; };
  const rad = d => d * Math.PI / 180;
  const f = n => (Math.round(n * 100) / 100).toString();
  const P = (r, deg, ox = 0, oy = 0) => [ox + r * Math.cos(rad(deg)), oy - r * Math.sin(rad(deg))];
  const angDist = (a, b) => { const d = Math.abs(((a - b) % 360 + 540) % 360 - 180); return d; };

  const C = {
    ink: '#1B1412', paper: '#EBA98C', paperLight: '#F4DCCB', page: '#F6F2EC', cream: '#FBF3E6',
    kala: '#161212', tukula: '#A3301F', luvemba: '#FBF8F2', musoni: '#DB6A2C',
    sun: '#FFB700', sunDeep: '#E08A00', navy: '#2B3170', brush: '#B23A1F', rust: '#6E1F12',
  };

  function el(tag, attrs, parent) {
    const n = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function set(n, attrs) { for (const k in attrs) n.setAttribute(k, attrs[k]); }
  // older Safari only follows xlink:href on <textPath>
  function linkPath(n, id) { n.setAttribute('href', id); n.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', id); return n; }
  function txt(parent, x, y, str, attrs) { const n = el('text', Object.assign({ x, y }, attrs), parent); n.textContent = str; return n; }
  function txt2(parent, x, y, en, pt, attrs) {
    return [txt(parent, x, y, en, Object.assign({ 'data-l': 'en' }, attrs)), txt(parent, x, y, pt, Object.assign({ 'data-l': 'pt' }, attrs))];
  }
  function pie(r, a0, a1) {
    if (a1 - a0 < 0.05) return '';
    const [x0, y0] = P(r, a0), [x1, y1] = P(r, a1);
    return `M0 0L${f(x0)} ${f(y0)}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 0 ${f(x1)} ${f(y1)}Z`;
  }
  function arcD(r, a0, a1, ox = 0, oy = 0) {
    const [x0, y0] = P(r, a0, ox, oy), [x1, y1] = P(r, a1, ox, oy);
    return `M${f(x0)} ${f(y0)}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 0 ${f(x1)} ${f(y1)}`;
  }
  // arrowhead pointing along the direction the sun travels (counter-clockwise)
  function arrowHead(r, deg, s, ox = 0, oy = 0, open = false) {
    const t = rad(deg), bx = ox + r * Math.cos(t), by = oy - r * Math.sin(t);
    const T = [-Math.sin(t), -Math.cos(t)], N = [Math.cos(t), -Math.sin(t)];
    const tip = [bx + T[0] * s * 1.25, by + T[1] * s * 1.25];
    const a = [bx + N[0] * s * .75, by + N[1] * s * .75], b = [bx - N[0] * s * .75, by - N[1] * s * .75];
    return open ? `M${f(a[0])} ${f(a[1])}L${f(tip[0])} ${f(tip[1])}L${f(b[0])} ${f(b[1])}`
                : `M${f(tip[0])} ${f(tip[1])}L${f(a[0])} ${f(a[1])}L${f(b[0])} ${f(b[1])}Z`;
  }
  function glowGradient(defs, id, color) {
    const g = el('radialGradient', { id }, defs);
    [['0', .95], ['.32', .42], ['1', 0]].forEach(([o, a]) => el('stop', { offset: o, 'stop-color': color, 'stop-opacity': a }, g));
  }
  function hex(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  function mix(a, b, t) { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], t))).join(',')})`; }

  const state = { vw: innerWidth, vh: innerHeight, lang: 'en', start: 0 };
  const scenes = [];
  const docTop = n => n.getBoundingClientRect().top + scrollY;

  // Where the diagram sits. Phones: diagram on top, words underneath.
  // Wide screens: words on the left, diagram on the right.
  function layout(mode) {
    const { vw, vh } = state, desk = vw >= 860;
    if (mode === 'cover') {
      const S = desk ? Math.min(vh * .84, vw * .6) : Math.min(vw * 1.0, vh * .62);
      return { S, cx: vw / 2, cy: desk ? vh * .5 : vh * .46 };
    }
    if (desk) { const S = Math.min(vh * .9, vw * .5); return { S, cx: vw * .68, cy: vh * .5, read: vh * .36 }; }
    // the Past·Present·Future ring is simpler, so it can be smaller and leave room for longer paragraphs
    const top = 58, S = mode === 'ring' ? Math.min(vw * .86, vh * .4) : Math.min(vw * .98, vh * .5);
    return { S, cx: vw / 2, cy: top + S / 2 - 6, read: top + S + 2 };
  }
  function place(svg, L) {
    const s = svg.style;
    s.width = s.height = f(L.S) + 'px';
    s.transform = `translate(${f(L.cx - L.S / 2)}px, ${f(L.cy - L.S / 2)}px)`;
  }
  // scroll → continuous step index. Step i is fully reached when its top meets
  // the top of the viewport (its card then sits on the reading line).
  function stepT(anchors, y) {
    if (y < anchors[0]) return (y - anchors[0]) / state.vh;
    for (let i = 0; i < anchors.length - 1; i++) {
      if (y < anchors[i + 1]) return i + (y - anchors[i]) / (anchors[i + 1] - anchors[i]);
    }
    return anchors.length - 1;
  }

  /* ═════════════════ THE JOURNEY: cover → cosmogram → four moments ═════════════════ */
  const FEATHER = 'M0 -17C9 -30 16 -56 13 -78C11 -91 5 -100 0 -106C-5 -100 -11 -91 -13 -78C-16 -56 -9 -30 0 -17Z';
  const FEATHER_VEINS = (() => {
    let d = 'M0 -21L0 -101';
    for (let y = -30; y >= -94; y -= 8) {
      const w = 13.5 * Math.sin(Math.PI * (-y - 17) / 90) * .82;
      d += `M0 ${y}L${f(w)} ${y - 6}M0 ${y}L${f(-w)} ${y - 6}`;
    }
    return d;
  })();
  const MOMENTS = [
    { a: 0, name: 'KALA', en: 'East', pt: 'Leste', fill: C.kala, lx: 150, ly: 42 },
    { a: 90, name: 'TUKULA', en: 'North', pt: 'Norte', fill: C.tukula, lx: 0, ly: -187 },
    { a: 180, name: 'LUVEMBA', en: 'West', pt: 'Oeste', fill: C.luvemba, lx: -150, ly: 42 },
    { a: 270, name: 'MUSONI', en: 'South', pt: 'Sul', fill: C.musoni, lx: 0, ly: 187 },
  ];

  // One cosmogram drawing, used twice: the main story, and the step-by-step
  // breakdown under the labelled diagram on the back page. `id` keeps the two
  // copies' gradients and clip paths apart.
  function buildCosmogram(svg, id) {
    const J = { svg };
    const defs = el('defs', null, svg);
    glowGradient(defs, id + 'Sun', C.sun);
    glowGradient(defs, id + 'Night', '#5A63C8');
    const clip = el('clipPath', { id: id + 'Water' }, defs);
    J.clipC = el('circle', { r: 100 }, clip);
    // dark wedges (Kala, Tukula) — used to flip labels to cream where they sit on dark paint
    const darkClip = el('clipPath', { id: id + 'Dark' }, defs);
    J.darkClip = el('path', { d: '' }, darkClip);
    el('path', { id: id + 'ArcTop', d: 'M-114 0A114 114 0 0 1 114 0' }, defs);
    el('path', { id: id + 'ArcBot', d: 'M-128 0A128 128 0 0 0 128 0' }, defs);

    J.disk = el('circle', { r: 207, fill: '#F0D8C6', opacity: 0 }, svg);
    J.wedges = MOMENTS.map(m => el('path', { fill: m.fill, d: '' }, svg));

    const inner = el('g', { 'clip-path': `url(#${id}Water)` }, svg);
    J.topHalf = el('rect', { x: -210, y: -210, width: 420, height: 210, fill: C.sun, opacity: 0 }, inner);
    J.botHalf = el('rect', { x: -210, y: 0, width: 420, height: 210, fill: C.navy, opacity: 0 }, inner);
    J.ripples = [0, 1, 2].map(() => el('circle', { r: 0, fill: 'none', stroke: C.navy, 'stroke-width': 1.8, opacity: 0 }, inner));

    J.rings = [75, 125].map(r => el('circle', { r, fill: 'none', stroke: C.ink, 'stroke-width': 1, opacity: 0 }, svg));
    J.core = el('circle', { r: 46, fill: C.tukula, opacity: 0 }, svg);

    // ─ the cover emblem ─
    J.emblem = el('g', null, svg);
    J.spokes = el('g', { stroke: C.ink, 'stroke-width': .8, opacity: 0 }, J.emblem);
    for (let i = 0; i < 36; i++) {
      const a = i * 10 + 5, [x1, y1] = P(16, a), [x2, y2] = P(110, a);
      el('line', { x1: f(x1), y1: f(y1), x2: f(x2), y2: f(y2) }, J.spokes);
    }
    J.feathers = [];
    for (let i = 0; i < 12; i++) {
      const g = el('g', { opacity: 0 }, J.emblem);
      el('path', { d: FEATHER, fill: C.ink }, g);
      el('path', { d: FEATHER_VEINS, stroke: C.paper, 'stroke-width': .8, fill: 'none', 'stroke-linecap': 'round' }, g);
      J.feathers.push(g);
    }
    J.innerRing = el('circle', { r: 110, fill: 'none', stroke: C.ink, 'stroke-width': 2.2, pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1 }, J.emblem);
    J.ticks = el('g', { stroke: C.ink, 'stroke-width': 1.3, 'stroke-linecap': 'round', opacity: 0 }, J.emblem);
    for (let i = 0; i < 48; i++) {
      const a = i * 7.5 + 3.75, [x1, y1] = P(140, a), [x2, y2] = P(153, a);
      el('line', { x1: f(x1), y1: f(y1), x2: f(x2), y2: f(y2) }, J.ticks);
    }
    J.ringText = el('g', { 'font-family': 'Lexend Deca, Poppins, sans-serif', 'font-weight': 800, 'font-size': 15.5, fill: C.ink, 'letter-spacing': 1.1, opacity: 0 }, J.emblem);
    const tt = el('text', { 'text-anchor': 'middle' }, J.ringText);
    const tp = linkPath(el('textPath', { startOffset: '50%' }, tt), `#${id}ArcTop`);
    tp.append('CAPOEIRA = BRASIL ');
    el('tspan', { 'font-family': 'Knewave, cursive', 'font-weight': 400, 'font-size': 17.5 }, tp).textContent = '2026';
    const bt = el('text', { 'text-anchor': 'middle' }, J.ringText);
    linkPath(el('textPath', { startOffset: '50%' }, bt), `#${id}ArcBot`).textContent = 'LOS ANGELES = MESTRE BONECO';
    for (const a of [171, 13]) {
      const g = el('g', { transform: `rotate(${-a}) translate(122 0)`, stroke: C.ink, 'stroke-width': 2.4, 'stroke-linecap': 'round' }, J.ringText);
      el('line', { x1: -3, y1: -5, x2: -3, y2: 5 }, g);
      el('line', { x1: 3, y1: -5, x2: 3, y2: 5 }, g);
    }

    // ─ the cosmogram itself ─
    J.water = el('circle', { r: 135, fill: 'none', stroke: C.ink, 'stroke-width': 5, pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1 }, svg);
    J.arms = MOMENTS.map(() => el('line', { stroke: C.ink, 'stroke-width': 3, 'stroke-linecap': 'round' }, svg));
    J.poleN = el('line', { x1: 0, y1: -6, x2: 0, y2: -135, stroke: C.tukula, 'stroke-width': 7, 'stroke-linecap': 'round', opacity: 0 }, svg);
    J.poleS = el('line', { x1: 0, y1: 6, x2: 0, y2: 135, stroke: C.navy, 'stroke-width': 7, 'stroke-linecap': 'round', opacity: 0 }, svg);

    J.orbit = el('g', { opacity: 0 }, svg);
    el('circle', { r: 150, fill: 'none', stroke: C.ink, 'stroke-width': 1.1 }, J.orbit);
    for (let a = 30; a < 360; a += 30) {
      if (a % 90 === 0) continue;
      el('path', { d: arrowHead(150, a, 4.2, 0, 0, true), fill: 'none', stroke: C.ink, 'stroke-width': 1.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, J.orbit);
    }

    J.arrows = MOMENTS.map(m => {
      const g = el('g', { opacity: 1 }, svg);
      const arc = el('path', { d: arcD(178, m.a + 16, m.a + 72), fill: 'none', stroke: C.rust, 'stroke-width': 4.5, 'stroke-linecap': 'round', pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1 }, g);
      const head = el('path', { d: arrowHead(178, m.a + 72, 7.5), fill: C.rust, opacity: 0 }, g);
      return { g, arc, head };
    });

    // labels from the NSEKE / MPEMBA diagram, dark and light copies
    const lab = el('g', { 'font-family': 'Poppins, sans-serif', 'text-anchor': 'middle' }, svg);
    J.labels = lab;
    const labelSet = (parent, fill) => {
      txt(parent, 0, -44, 'NSEKE', { 'font-size': 24, 'font-weight': 500, 'letter-spacing': 2.5, fill });
      txt(parent, 0, 66, 'MPEMBA', { 'font-size': 24, 'font-weight': 500, 'letter-spacing': 2.5, fill });
      txt(parent, 66, -5, 'Kalunga', { 'font-size': 10, fill });
      txt(parent, -66, 14, 'Kalunga', { 'font-size': 10, fill });
    };
    J.worlds = el('g', { opacity: 0 }, lab);
    labelSet(J.worlds, C.ink);
    const light = el('g', { 'clip-path': `url(#${id}Dark)` }, J.worlds);
    labelSet(light, C.cream);

    J.names = el('g', { opacity: 0 }, lab);
    J.nameEls = MOMENTS.map(m => {
      const g = el('g', null, J.names);
      const below = m.ly > 0;
      txt(g, m.lx, m.ly, m.name, { 'font-size': 13.5, 'font-weight': 700, 'letter-spacing': 1.6, fill: C.ink });
      txt2(g, m.lx, m.a === 90 ? m.ly + 14 : m.ly + (below ? 14 : -15), m.en, m.pt, { 'font-size': 11, fill: C.ink, opacity: .75 });
      return g;
    });

    J.circles = MOMENTS.map(m => {
      const g = el('g', null, svg);
      const glow = el('circle', { r: 34, fill: m.a === 270 ? `url(#${id}Night)` : `url(#${id}Sun)`, opacity: 0 }, g);
      const c = el('circle', { r: 17, fill: m.fill, stroke: C.ink, 'stroke-width': m.a === 180 ? 2 : 0 }, g);
      const dot = el('circle', { r: 6, fill: C.sun, opacity: 0 }, g);
      return Object.assign({ g, glow, c, dot }, m);
    });

    J.passer = el('circle', { r: 7, fill: C.cream, stroke: C.ink, 'stroke-width': 2, opacity: 0 }, svg);
    J.passRipple = el('ellipse', { rx: 0, ry: 0, fill: 'none', stroke: C.navy, 'stroke-width': 1.6, opacity: 0 }, svg);

    J.sun = el('g', { opacity: 0 }, svg);
    el('circle', { r: 44, fill: `url(#${id}Sun)` }, J.sun);
    J.rays = el('g', { stroke: C.sun, 'stroke-width': 2.6, 'stroke-linecap': 'round' }, J.sun);
    for (let i = 0; i < 10; i++) {
      const [x1, y1] = P(16, i * 36), [x2, y2] = P(23, i * 36);
      el('line', { x1: f(x1), y1: f(y1), x2: f(x2), y2: f(y2) }, J.rays);
    }
    el('circle', { r: 11.5, fill: C.sun, stroke: C.sunDeep, 'stroke-width': 1.2 }, J.sun);

    J.ponto = txt(svg, 0, 12, 'PONTO DE CULTURA', {
      'text-anchor': 'middle', 'font-family': 'Permanent Marker, cursive', 'font-size': 37,
      fill: C.brush, stroke: C.ink, 'stroke-width': 1.5, 'paint-order': 'stroke', 'stroke-linejoin': 'round',
      textLength: 340, lengthAdjust: 'spacingAndGlyphs', opacity: 0,
    });
    return J;
  }

  function buildStars(stars) {
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 70; i++) {
      const c = el('circle', { cx: f(rnd() * 100), cy: f(rnd() * 100), r: f(.12 + rnd() * .28) }, stars);
      c.style.animationDelay = f(-rnd() * 3.2) + 's';
    }
  }

  // Each section scrolls through its own steps; this maps a section's step
  // position onto the one timeline the cosmogram knows (see renderCosmogram).
  function remap(keys, t) {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 0; i < keys.length - 1; i++) {
      const [t0, a0] = keys[i], [t1, a1] = keys[i + 1];
      if (t <= t1) return lerp(a0, a1, (t - t0) / (t1 - t0));
    }
    return keys[keys.length - 1][1];
  }
  // Main story: cover → The Kongo Cosmogram → straight on to the four stages.
  // The labelled-diagram steps (2–7) are skipped here and live in the breakdown.
  const STORY_KEYS = [[0, 0], [1, 1], [1.3, 1.9], [1.45, 2.5], [1.6, 3], [1.62, 7.5], [2, 8], [3, 9], [4, 10], [5, 11], [6, 12], [7, 13]];
  // Step-by-step breakdown: one back-page label per step, water through arrows.
  const BREAKDOWN_KEYS = [[-1, 1.5], [0, 2], [1, 3], [2, 4], [3, 5], [4, 6], [5, 7], [6, 7.5]];

  // the sky follows the sun: [angle, top colour, bottom colour]
  const SKY = [
    [-40, '#0E1030', '#1F1D46'], [0, '#2B2A5E', '#E88A4B'], [45, '#E7A06A', '#F6D3A2'],
    [90, '#F6D9A7', '#FBEBD3'], [135, '#EFB07B', '#F6CF9F'], [180, '#6B2A45', '#E0632C'],
    [220, '#231A40', '#4A2A4E'], [270, '#080A1C', '#121532'], [320, '#0E1030', '#1F1D46'],
    [360, '#2B2A5E', '#E88A4B'],
  ];
  function skyAt(theta) {
    for (let i = 0; i < SKY.length - 1; i++) {
      const [a0, t0, b0] = SKY[i], [a1, t1, b1] = SKY[i + 1];
      if (theta <= a1) { const k = smooth(clamp((theta - a0) / (a1 - a0))); return [mix(t0, t1, k), mix(b0, b1, k)]; }
    }
    return [SKY[SKY.length - 1][1], SKY[SKY.length - 1][2]];
  }
  // Scroll position → where the sun is during the four moments.
  // Each moment holds while you read it, then the sun travels to the next.
  const SUN_KEYS = [[8, -24], [9, 0], [10, 90], [11, 180], [12, 270], [13, 360]];
  function thetaAt(t) {
    if (t <= SUN_KEYS[0][0]) return SUN_KEYS[0][1];
    for (let i = 0; i < SUN_KEYS.length - 1; i++) {
      const [t0, a0] = SUN_KEYS[i], [t1, a1] = SUN_KEYS[i + 1];
      if (t < t1) return lerp(a0, a1, smooth(clamp(((t - t0) / (t1 - t0) - .16) / .74)));
    }
    return 360;
  }

  // t is a position on the full timeline: 0 cover · 1 The Kongo Cosmogram ·
  // 2 water · 3 two worlds · 4 passage · 5 small circles · 6 poles · 7 arrows ·
  // 8 four stages · 9 Kala · 10 Tukula · 11 Luvemba · 12 Musoni · 13 cycle closed.
  // opt.labelled switches the labelled-diagram effects (2–7) on or off, so the
  // main story can pass straight through that stretch without showing them.
  function renderCosmogram(J, t, now, opt) {
    const sec = now / 1000;
    const intro = opt.intro != null ? opt.intro : RM ? 1 : state.start ? clamp((now - state.start) / 2800) : 0;
    const A = opt.labelled ? 1 : 0;

    // stage placement: big and centred on the cover, then up top for the story
    const cov = layout('cover'), dia = layout('diagram');
    const k = ramp(t, .05, .9);
    place(J.svg, { S: lerp(cov.S, dia.S, k), cx: lerp(cov.cx, dia.cx, k), cy: lerp(cov.cy, dia.cy, k) });

    // ── emblem → cosmogram ──
    const m = ramp(t, .1, .9);
    const ringR = lerp(135, 100, m), cR = lerp(182, 150, m), cS = lerp(17, 15, m);
    const decoOut = ramp(t, .04, .55);
    const spin = RM ? 0 : sec * 2.2;
    J.feathers.forEach((g, i) => {
      const s = ramp(intro, .42 + i * .022, .6 + i * .022) * (1 - ramp(t, .04 + i * .012, .5 + i * .012));
      g.setAttribute('transform', `rotate(${f(i * 30 + spin + 50 * decoOut)}) scale(${f(Math.max(s, .001))})`);
      g.setAttribute('opacity', s > .002 ? 1 : 0);
    });
    J.spokes.setAttribute('opacity', f(ramp(intro, .34, .62) * (1 - ramp(t, .03, .4))));
    J.ticks.setAttribute('opacity', f(ramp(intro, .38, .66) * (1 - ramp(t, .03, .4))));
    set(J.innerRing, { 'stroke-dashoffset': f(1 - ramp(intro, .26, .56)), opacity: f(1 - ramp(t, .05, .45)) });
    J.ringText.setAttribute('opacity', f(ramp(intro, .55, .82) * (1 - ramp(t, .02, .3))));
    const stamp = ramp(intro, .74, .94);
    set(J.ponto, {
      opacity: f(stamp * (1 - ramp(t, .02, .28))),
      transform: `translate(0 ${f(-40 * ramp(t, 0, .3))}) scale(${f(1 + .28 * (1 - stamp))})`,
    });

    // water circle (the emblem's ring becomes "Circle represents Water")
    const waterHi = A * bump(t, 1.45, 1.95, 2.45, 2.9);
    set(J.water, {
      r: f(ringR), 'stroke-width': f(lerp(5, 2.6, m) + waterHi * 1.6),
      stroke: mix(C.ink, C.navy, waterHi), 'stroke-dashoffset': f(1 - ramp(intro, .1, .44)),
    });
    J.clipC.setAttribute('r', f(ringR));
    J.ripples.forEach((c, i) => {
      const ph = ((sec / 3.2) + i / 3) % 1;
      set(c, { r: f(ph * ringR), opacity: f(waterHi * (1 - ph) * .75) });
    });

    // the two worlds, above and below the line
    const worlds = A * bump(t, 2.45, 2.95, 3.45, 3.9);
    const worldsSoft = A * ramp(t, 2.45, 2.95) * (1 - ramp(t, 7.6, 8.3));
    J.topHalf.setAttribute('opacity', f(.1 * worldsSoft + .14 * worlds));
    J.botHalf.setAttribute('opacity', f(.1 * worldsSoft + .14 * worlds));
    J.worlds.setAttribute('opacity', f(ramp(t, 2.5, 2.95)));

    // cross: the connectors grow in from the circles, then reach the centre
    const armIn = ramp(intro, .06, .3), armCenter = ramp(t, .35, .95);
    J.arms.forEach((ln, i) => {
      const a = MOMENTS[i].a, rOut = cR - cS - 1, rIn = lerp(ringR, 0, armCenter);
      const r0 = lerp(rOut, rIn, armIn);
      const [x1, y1] = P(r0, a), [x2, y2] = P(rOut, a);
      set(ln, { x1: f(x1), y1: f(y1), x2: f(x2), y2: f(y2), 'stroke-width': f(lerp(3, 2.4, m)) });
    });

    // passage through water: a traveller crossing the line, rippling it
    const pass = A * bump(t, 3.45, 3.95, 4.45, 4.9);
    const py = -88 * Math.cos(sec * 1.25);
    set(J.passer, { cy: f(py), opacity: f(pass) });
    const rph = ((sec * 1.25 / Math.PI) + .5) % 1;
    set(J.passRipple, { rx: f(6 + 58 * rph), ry: f(2 + 12 * rph), opacity: f(pass * (1 - rph) * .9) });

    // poles
    const poles = A * bump(t, 5.45, 5.95, 6.45, 6.9);
    J.poleN.setAttribute('opacity', f(poles * .85));
    J.poleS.setAttribute('opacity', f(poles * .85));

    // arrows: drawn one after another, in the sun's direction
    const arrowsOut = ramp(t, 7.7, 8.3);
    J.arrows.forEach((ar, i) => {
      const d = A * ramp(t, 6.45 + i * .09, 6.8 + i * .09);
      ar.arc.setAttribute('stroke-dashoffset', f(1 - d));
      ar.head.setAttribute('opacity', f(ramp(d, .85, 1)));
      ar.g.setAttribute('opacity', f(1 - arrowsOut));
    });

    // ── the sun ──
    const loopA = (sec * 40) % 360;
    const oIntro = (opt.introOrbit ? 1 : 0) * bump(t, .55, .95, 1.45, 1.85), oArrows = A * bump(t, 6.6, 7, 7.45, 7.78);
    const journey = ramp(t, 7.8, 8.35);
    const theta = t >= 7.8 ? thetaAt(t) : loopA;
    const sunO = t >= 7.8 ? journey : Math.max(oIntro, oArrows);
    const [sx, sy] = P(150, theta);
    J.sun.setAttribute('opacity', f(sunO));
    J.sun.setAttribute('transform', `translate(${f(sx)} ${f(sy)})`);
    J.rays.setAttribute('transform', `rotate(${f(RM ? 0 : sec * 30)})`);

    // the five words of the cycle follow the sun around
    const wordsOn = oIntro > .35;
    for (const w of opt.words || []) w.classList.toggle('on', wordsOn && angDist(loopA, +w.dataset.a) < 26);

    // ── the four moments: the sun paints each quarter as it passes ──
    const thJ = t >= 7.8 ? theta : -24;
    let darkD = '';
    J.wedges.forEach((w, i) => {
      const a0 = i * 90, fill = clamp((thJ - a0) / 90);
      const d = pie(150, a0, a0 + 90 * fill);
      w.setAttribute('d', d);
      if (i < 2) darkD += d;
    });
    J.darkClip.setAttribute('d', darkD);
    const full = ramp(t, 12.35, 12.95);
    J.rings.forEach(r => r.setAttribute('opacity', f(.55 * ramp(t, 8.2, 8.8))));
    J.core.setAttribute('opacity', f(full));
    J.orbit.setAttribute('opacity', f(ramp(t, 7.75, 8.35)));
    J.disk.setAttribute('opacity', f(ramp(t, 7.6, 8.3)));
    J.names.setAttribute('opacity', f(ramp(t, 8.0, 8.6)));

    const moments = ramp(t, 8.6, 9);
    J.circles.forEach((c, i) => {
      const [x, y] = P(cR, c.a);
      const pop = backOut(ramp(intro, i * .05, .2 + i * .05));
      // small circles: moments of the sun
      const small = A * bump(t, 4.45, 4.95, 5.45, 5.9);
      const ph = ((sec * .8) - i * .25) % 1, beat = Math.exp(-((ph < 0 ? ph + 1 : ph) * 7));
      // the circle nearest the sun glows during the four moments
      const near = t >= 8.6 ? clamp(1 - angDist(theta, c.a) / 40) : 0;
      const pole = (c.a === 90 || c.a === 270) ? poles : 0;
      const sc = pop * (cS / 17) * (1 + .35 * small * beat + .22 * near * moments + .25 * pole);
      c.g.setAttribute('transform', `translate(${f(x)} ${f(y)}) scale(${f(Math.max(sc, .001))})`);
      c.dot.setAttribute('opacity', f(small * beat));
      c.glow.setAttribute('opacity', f(Math.max(near * moments, pole)));
      J.nameEls[i].setAttribute('opacity', f(t >= 8.6 ? .45 + .55 * near : 1));
    });

    // sky (main story only)
    if (!opt.sky) return;
    const skyMix = ramp(t, 7.6, 8.4);
    const [top, bottom] = skyAt(thJ);
    opt.sky.style.background = skyMix > .001
      ? `linear-gradient(180deg, ${mix2(C.paper, top, skyMix)}, ${mix2(C.paper, bottom, skyMix)})`
      : '';
    const night = thJ < 20 ? 1 - ramp(thJ, -30, 18) : ramp(thJ, 168, 215) * (1 - ramp(thJ, 325, 368));
    opt.stars.style.opacity = f(night * skyMix);
    themeColor.setAttribute('content', skyMix > .5 ? '#1B1412' : '#EBA98C');
  }
  const themeColor = document.querySelector('meta[name="theme-color"]');
  function mix2(a, rgb, t) {
    const m = rgb.match(/\d+/g).map(Number), A = hex(a);
    return `rgb(${A.map((v, i) => Math.round(lerp(v, m[i], t))).join(',')})`;
  }

  /* ═════════════════ PAST · PRESENT · FUTURE ═════════════════ */
  const Q = {};
  const QR = 135;
  const GEN = [105, 135, 165, 195, 225, 255, 285, 315, 345, 375, 405, 435];
  function buildPPF() {
    const svg = $('#ppf-svg');
    const defs = el('defs', null, svg);
    glowGradient(defs, 'qSun', C.sun);
    Q.base = el('circle', { r: QR, fill: 'none', stroke: C.ink, 'stroke-width': 1.2, 'stroke-dasharray': '2 7', opacity: 0 }, svg);
    Q.past = el('path', { d: arcD(QR, 90, 270), fill: 'none', stroke: C.brush, 'stroke-width': 6, 'stroke-linecap': 'round', pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1 }, svg);
    Q.future = el('path', { d: arcD(QR, 270, 449.9), fill: 'none', stroke: C.ink, 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-dasharray': '.1 13', opacity: 0 }, svg);
    Q.heads = el('g', { opacity: 0 }, svg);
    for (const a of [150, 210]) el('path', { d: arrowHead(QR, a, 7), fill: C.brush }, Q.heads);
    for (const a of [330, 30, 88]) el('path', { d: arrowHead(QR, a, 7), fill: C.ink }, Q.heads);

    Q.dots = GEN.map(a => {
      const [x, y] = P(QR, a), past = a < 270;
      return el('circle', { cx: f(x), cy: f(y), r: 7.5, fill: past ? C.brush : C.page, stroke: C.ink, 'stroke-width': 1.8, opacity: 0 }, svg);
    });
    Q.parts = Array.from({ length: 18 }, (_, i) => ({ ph: i / 18, n: el('circle', { r: 3.6, opacity: 0 }, svg) }));

    const lab = (x, y, big, sub) => {
      const g = el('g', { 'text-anchor': 'middle', opacity: 0 }, svg);
      txt2(g, x, y, big[0], big[1], { 'font-family': 'Knewave, cursive', 'font-size': 25, fill: C.ink });
      txt2(g, x, y + 19, sub[0], sub[1], { 'font-family': 'Poppins, sans-serif', 'font-style': 'italic', 'font-size': 13.5, fill: C.ink });
      return g;
    };
    Q.lPast = lab(-64, -4, ['PAST', 'PASSADO'], ['Ancestry', 'Ancestralidade']);
    Q.lFuture = lab(64, -4, ['FUTURE', 'FUTURO'], ['Continuity', 'Continuidade']);
    Q.lPresent = lab(0, 64, ['PRESENT', 'PRESENTE'], ['Transformation', 'Transformação']);

    Q.sun = el('g', { transform: `translate(0 ${QR})`, opacity: 0 }, svg);
    Q.halo = el('circle', { r: 46, fill: 'url(#qSun)' }, Q.sun);
    Q.rays = el('g', { stroke: C.sun, 'stroke-width': 2.8, 'stroke-linecap': 'round' }, Q.sun);
    for (let i = 0; i < 12; i++) {
      const [x1, y1] = P(17, i * 30), [x2, y2] = P(25, i * 30);
      el('line', { x1: f(x1), y1: f(y1), x2: f(x2), y2: f(y2) }, Q.rays);
    }
    Q.core = el('circle', { r: 12.5, fill: C.sun, stroke: C.sunDeep, 'stroke-width': 1.2 }, Q.sun);
  }

  function renderPPF(t, now, scene) {
    const sec = now / 1000;
    place(Q.svg, layout('ring'));
    // draw-in as the section arrives
    Q.base.setAttribute('opacity', f(.35 * ramp(t, -.8, -.3)));
    Q.past.setAttribute('stroke-dashoffset', f(1 - ramp(t, -.7, -.15)));
    Q.future.setAttribute('opacity', f(ramp(t, -.4, 0)));
    Q.sun.setAttribute('opacity', f(ramp(t, -.5, -.1)));

    // beats inside the two paragraphs
    // Beats follow the words (see index.html data-b):
    //   paragraph 1 — 0 "We chose … idea:" · 1 "where we are going" · 2 past · 3 present · 4 future
    //   paragraph 2 — 0 "The same is true of Capoeira." · 1 receive · 2 transform · 3 pass on
    const b1 = scene.beat(1), b2 = scene.beat(2);          // continuous, or -1 before arriving
    const inP2 = b2 >= 0 && t < 3, inP1 = b1 >= 0 && !inP2 && t < 3;
    const focus = (b, i) => bump(b, i - .15, i + .1, i + .9, i + 1.15);
    const dim = x => .3 + .7 * x;
    let fPast = 1, fPres = 1, fFut = 1, fDir = 0;
    if (inP1) {
      const lead = 1 - ramp(b1, .85, 1.15);   // while the opening words type in, all three stay lit
      fDir = focus(b1, 1);
      fPast = lerp(dim(focus(b1, 2)), 1, lead);
      fPres = lerp(dim(focus(b1, 3)), 1, lead);
      fFut = lerp(dim(Math.max(focus(b1, 4), fDir * .6)), 1, lead);
    }
    Q.lPast.setAttribute('opacity', f(ramp(t, -.35, -.05) * fPast));
    Q.lPresent.setAttribute('opacity', f(ramp(t, -.25, .05) * fPres));
    Q.lFuture.setAttribute('opacity', f(ramp(t, -.15, .15) * fFut));
    Q.past.setAttribute('stroke-width', f(6 + (inP1 ? 3 * focus(b1, 2) : 0)));
    Q.future.setAttribute('stroke-width', f(5 + (inP1 ? 3 * focus(b1, 4) : 0)));
    Q.heads.setAttribute('opacity', f(ramp(t, -.3, .05) * (.7 + .3 * fDir)));

    // Capoeira: generations on the ring, a legacy passed along it
    const dotsIn = t >= 3 ? 1 : inP2 ? ramp(b2, 0, .7) : 0;
    const flowPast = t >= 3 ? 1 : inP2 ? ramp(b2, .95, 1.35) : 0;
    const change = t >= 3 ? .5 : inP2 ? bump(b2, 1.9, 2.2, 2.85, 3.2) : 0;
    const flowFut = t >= 3 ? 1 : inP2 ? ramp(b2, 2.95, 3.3) : 0;
    const fillProg = t >= 3 ? 1 : inP2 ? clamp((b2 - 3) / .9) : 0;
    Q.dots.forEach((d, i) => {
      const a = GEN[i], past = a < 270;
      const appear = ramp(dotsIn, i / 16, i / 16 + .3);
      let fill = past ? C.brush : C.page;
      if (!past) { const k = ramp(fillProg, (a - 285) / 170, (a - 285) / 170 + .15); fill = mix(C.page, C.sun, k); }
      set(d, { opacity: f(appear), fill });
    });
    Q.parts.forEach(p => {
      const a = 90 + (((sec * 38) / 360 + p.ph) % 1) * 360;     // 90 → 450, counter-clockwise
      const inPast = a < 270, near = clamp(1 - Math.abs(a - 270) / 22);
      const vis = inPast ? flowPast * (a < 262 ? 1 : 1 - near) : flowFut * (a > 278 ? 1 : 1 - near);
      const [x, y] = P(QR, a);
      set(p.n, { cx: f(x), cy: f(y), opacity: f(vis * .95), fill: inPast ? C.brush : C.sun, r: f(3.6 + 1.2 * near) });
    });
    const grow = 1 + .32 * change + .14 * (inP1 ? focus(b1, 3) : 0);
    Q.core.setAttribute('r', f(12.5 * grow));
    Q.halo.setAttribute('r', f(46 * grow));
    Q.rays.setAttribute('transform', `rotate(${f(RM ? 0 : sec * (30 + 160 * change))}) scale(${f(grow)})`);
    Q.core.setAttribute('fill', mix(C.sun, C.musoni, change * .6));
  }

  /* ═════════════════ BACK PAGE ═════════════════ */
  const B = {};
  function buildLabeled() {
    const svg = $('#fig-labeled');
    // Same labels and structure as the printed diagram, re-spaced so every
    // note stays readable on a phone (the printed labels are ~2 mm tall).
    svg.setAttribute('viewBox', '0 0 416 462');
    const cx = 200, cy = 250, rw = 62, rc = 86, ra = 104;
    const defs = el('defs', null, svg);
    const flt = el('filter', { id: 'rough', x: '-5%', y: '-5%', width: '110%', height: '110%' }, defs);
    el('feTurbulence', { type: 'fractalNoise', baseFrequency: '.06', numOctaves: 2, seed: 3, result: 'n' }, flt);
    el('feDisplacementMap', { in: 'SourceGraphic', in2: 'n', scale: 3.2 }, flt);

    const ink = el('g', { stroke: C.rust, fill: 'none', 'stroke-linecap': 'round', filter: 'url(#rough)' }, svg);
    el('circle', { cx, cy, r: rw, 'stroke-width': 3.4, pathLength: 1, class: 'draw', style: '--d:.1s' }, ink);
    el('path', { d: `M${cx - rc + 7} ${cy}H${cx + rc - 7}`, 'stroke-width': 3, pathLength: 1, class: 'draw', style: '--d:.5s' }, ink);
    el('path', { d: `M${cx} ${cy - rc + 7}V${cy + rc - 7}`, 'stroke-width': 3, pathLength: 1, class: 'draw', style: '--d:.7s' }, ink);
    [0, 90, 180, 270].forEach((a, i) => {
      const [x, y] = P(rc, a, cx, cy);
      el('circle', { cx: f(x), cy: f(y), r: 6.5, 'stroke-width': 2.6, pathLength: 1, class: 'draw', style: `--d:${.9 + i * .1}s` }, ink);
      el('path', { d: arcD(ra, a + 20, a + 70, cx, cy), 'stroke-width': 3.6, pathLength: 1, class: 'draw', style: `--d:${1.2 + i * .15}s` }, ink);
      el('path', { d: arrowHead(ra, a + 70, 6, cx, cy), fill: C.rust, stroke: 'none', class: 'lbl', style: `--d:${1.9 + i * .15}s` }, ink);
    });
    // a sun walking the four moments
    B.lSun = el('circle', { r: 5.5, fill: C.sun, stroke: C.sunDeep, 'stroke-width': 1, opacity: 0 }, svg);
    B.lCenter = [cx, cy, rc];

    // The printed labels, and the same labels in Portuguese (ours — the back
    // page is printed in English only). Portuguese runs longer, so its version
    // of the figure is a little wider on the right.
    const LABELS = {
      en: {
        W: 416, H: 462,
        top: ['Pole of Physical Power:', 'North, Maleness, Noon'],
        small: ['Small Circles:', 'Moments of the Sun,', 'Representing Phases', 'of Human Life'],
        water: ['Circle', 'represents Water'],
        above: ['Above the Line:', 'World of Humans'], below: ['Below the Line:', 'World of Spirits'], side: 306,
        mid: [['Passage', 'through Water:'], ['Movement between', 'Two Worlds']],
        bottom: ['Pole of Spiritual Power:', 'South, Femaleness, Midnight'],
        arrows: ['Arrows show direction', 'of Movement; Follows Path of Sun', 'in Southern Hemisphere'],
      },
      pt: {
        W: 466, H: 472,
        top: ['Polo do Poder Físico:', 'Norte, Masculinidade, Meio-dia'],
        small: ['Pequenos Círculos:', 'Momentos do Sol,', 'Representando as', 'Fases da Vida Humana'],
        water: ['O Círculo', 'representa a Água'],
        above: ['Acima da Linha:', 'Mundo dos Humanos'], below: ['Abaixo da Linha:', 'Mundo dos Espíritos'], side: 308,
        mid: [['Passagem', 'pela Água:'], ['Movimento entre', 'Dois Mundos']],
        bottom: ['Polo do Poder Espiritual:', 'Sul, Feminilidade, Meia-noite'],
        arrows: ['As setas mostram a direção', 'do Movimento; Segue o', 'Caminho do Sol no', 'Hemisfério Sul'],
      },
    };
    B.labeledBox = {};
    const [wx, wy] = P(rw + 3, 52, cx, cy), [lx, ly] = P(rc + 9, 172, cx, cy), [ax, ay] = P(ra + 5, 225, cx, cy);
    for (const lang of ['en', 'pt']) {
      const L = LABELS[lang];
      B.labeledBox[lang] = `0 0 ${L.W} ${L.H}`;
      const T = el('g', { 'data-l': lang, 'font-family': 'Special Elite, Courier New, monospace', 'font-size': 11, fill: C.ink, 'text-anchor': 'middle' }, svg);
      const block = (x, y, lines, d, anchor = 'middle', lh = 13.5) => {
        const g = el('g', { class: 'lbl', style: `--d:${d}s`, 'text-anchor': anchor }, T);
        lines.forEach((s, i) => txt(g, x, y + i * lh, s));
        return g;
      };
      block(cx, 114, L.top, 2.2);
      block(8, 52, L.small, 2.4, 'start');
      block(L.W - 8, 52, L.water, 2.6, 'end');
      block(L.side, 228, L.above, 2.8, 'start', 13);
      block(L.side, 266, L.below, 3.0, 'start', 13);
      const mid = el('g', { class: 'lbl', style: '--d:3.2s', 'font-size': 9.5 }, T);
      L.mid.forEach(([left, right], i) => {
        txt(mid, cx - 4, cy + 15 + i * 12, left, { 'text-anchor': 'end' });
        txt(mid, cx + 4, cy + 15 + i * 12, right, { 'text-anchor': 'start' });
      });
      block(cx, 374, L.bottom, 3.4);
      block(112, 420, L.arrows, 3.6);
      // quiet leader lines tying the corner notes to what they describe
      const lead = el('g', { stroke: C.rust, 'stroke-width': .9, 'stroke-dasharray': '2 3', fill: 'none', opacity: .75 }, T);
      el('path', { d: `M52 104Q64 190 ${f(lx)} ${f(ly)}`, class: 'lbl', style: '--d:2.5s' }, lead);
      el('path', { d: `M${L.W - 44} 72Q${L.W - 56} 170 ${f(wx)} ${f(wy)}`, class: 'lbl', style: '--d:2.7s' }, lead);
      el('path', { d: `M84 406Q90 360 ${f(ax)} ${f(ay)}`, class: 'lbl', style: '--d:3.7s' }, lead);
    }
  }

  function buildDikenga() {
    const svg = $('#fig-dikenga');
    const R = 165;
    const defs = el('defs', null, svg);
    glowGradient(defs, 'dSun', C.sun);
    el('path', { d: pie(R, 0, 90), fill: C.kala }, svg);
    el('path', { d: pie(R, 90, 180), fill: '#A5261A' }, svg);
    el('path', { d: pie(R, 270, 360), fill: '#D9782E' }, svg);
    const lines = el('g', { stroke: C.ink, 'stroke-width': 1.3, fill: 'none' }, svg);
    [92, 128].forEach(r => el('circle', { r }, lines));
    el('circle', { r: R }, lines);
    el('path', { d: `M${-R} 0H${R}M0 ${-R}V${R}` }, lines);
    el('circle', { r: 50, fill: '#B5301F', stroke: C.ink, 'stroke-width': 1 }, svg);
    for (const a of [195, 215, 235, 255]) el('path', { d: arrowHead(R, a, 5, 0, 0, true), stroke: C.ink, 'stroke-width': 1.3, fill: 'none' }, svg);
    for (const a of [20, 45, 70, 110, 135, 160, 290, 315, 340]) el('path', { d: arrowHead(R + 12, a, 3.2, 0, 0, true), stroke: C.ink, 'stroke-width': 1, fill: 'none', opacity: .5 }, svg);
    B.dSun = el('g', { opacity: 0 }, svg);
    el('circle', { r: 40, fill: 'url(#dSun)' }, B.dSun);
    el('circle', { r: 9.5, fill: C.sun, stroke: C.sunDeep, 'stroke-width': 1 }, B.dSun);
    const circ = (a, fill, stroke) => { const [x, y] = P(R, a); el('circle', { cx: f(x), cy: f(y), r: 21, fill, stroke: stroke || 'none', 'stroke-width': 1.6 }, svg); };
    circ(90, '#A5261A'); circ(0, C.kala); circ(270, '#C8622A'); circ(180, C.luvemba, C.ink);
    const T = el('g', { 'font-family': 'Poppins, sans-serif', 'text-anchor': 'middle' }, svg);
    txt(T, 0, -62, 'NSEKE', { 'font-size': 30, fill: C.cream, 'font-weight': 400, 'letter-spacing': 1 });
    txt(T, 0, 104, 'MPEMBA', { 'font-size': 30, fill: C.ink, 'font-weight': 500, 'letter-spacing': 1 });
    txt(T, 98, -6, 'Kalunga', { 'font-size': 10, fill: C.cream });
    txt(T, -98, 15, 'Kalunga', { 'font-size': 10, fill: C.ink });
    txt(T, R, 3.5, 'Kala', { 'font-size': 9.5, fill: C.cream });
    txt(T, -R, 3.5, 'Luvemba', { 'font-size': 8.5, fill: C.ink });
    txt(T, 0, R + 3.5, 'Musoni', { 'font-size': 9, fill: C.ink });
    txt2(T, 0, -R - 32, 'Noon', 'Meio-dia', { 'font-size': 11, fill: C.ink, opacity: .75 });
  }

  function renderBack(now) {
    const sec = now / 1000;
    const on = B.fig4In ? 1 : 0;
    const a = RM ? 45 : (sec * 24) % 360;
    const [x, y] = P(165, a);
    B.dSun.setAttribute('transform', `translate(${f(x)} ${f(y)})`);
    B.dSun.setAttribute('opacity', on);
    const [cx, cy, rc] = B.lCenter;
    const la = RM ? 45 : (sec * 30) % 360;
    const [lx, ly] = P(rc, la, cx, cy);
    set(B.lSun, { cx: f(lx), cy: f(ly), opacity: B.fig1In ? 1 : 0 });
  }

  /* ═════════════════ scenes, scroll loop, language ═════════════════ */
  function makeScene(section, render, mode) {
    const steps = $$('.step', section);
    const sc = {
      section, steps, anchors: [], visible: false, tall: {},
      cards: $$('.card', section),
      measure() {
        this.read = Math.round(layout(mode).read);
        section.style.setProperty('--read', this.read + 'px');
        this.anchors = steps.map(docTop);
        steps.forEach((s, i) => {
          if (!s.classList.contains('tall')) return;
          // a pinned paragraph must fit whole on screen, even on short phones
          const card = $('.card', s), h = card.offsetHeight;
          const top = Math.max(50, Math.min(this.read, state.vh - h - 12));
          card.style.top = top + 'px';
          this.tall[i] = { top: this.anchors[i], range: Math.max(1, s.offsetHeight - top - h), beats: +s.dataset.beats || 4 };
        });
      },
      // continuous beat position inside a tall step (0..beats), -1 outside it
      // Continuous beat position in a pinned paragraph, -1 before it arrives.
      // Beat 0 plays while the card rises into place; beats 1… play while it
      // is pinned; afterwards it stays complete while the card leaves.
      beat(i) {
        const T = this.tall[i]; if (!T) return -1;
        const rise = state.vh * .45, y = scrollY;
        if (y < T.top - rise) return -1;
        if (y < T.top) return (y - (T.top - rise)) / rise;
        return 1 + clamp((y - T.top) / T.range) * (T.beats - 1) * .999;
      },
      render,
    };
    scenes.push(sc);
    return sc;
  }

  let typedParas = [], clauseSteps = [];
  function measure() {
    state.vw = innerWidth; state.vh = innerHeight;
    for (const s of scenes) s.measure();
  }

  // Cards fade as they rise over the diagram (phones), so the picture stays
  // visible. A card taller than the space under the diagram stays solid until
  // its last line has come into view.
  function fadeCards() {
    const { vh } = state, phone = state.vw < 860;
    for (const sc of scenes) {
      if (!sc.visible) continue;
      for (const c of sc.cards) {
        const r = c.getBoundingClientRect();
        if (r.bottom < -40 || r.top > vh + 40) continue;
        const fin = clamp((vh - r.top) / (vh * .22));
        const overflow = Math.max(0, r.height - (vh - sc.read) + 16);
        const fout = phone ? clamp((r.top + overflow - (sc.read - vh * .28)) / (vh * .28 - 24))
                           : clamp((r.bottom - vh * .04) / (vh * .2));
        c.style.opacity = f(smooth(Math.min(fin, fout)));
      }
    }
  }

  // Pinned paragraphs unfold with the diagram. Every word belongs to the beat
  // of its phrase (data-b in the markup) and appears when the scroll reaches its
  // place inside that beat; only the current beat's phrase is highlighted;
  // scrolling back hides the words again and the diagram reverses with them.
  function prepareUnfold(p) {
    const words = [], phrases = [];
    for (const seg of $$('[data-b]', p)) {
      const b = +seg.dataset.b;
      const phrase = seg.classList.contains('c') ? { el: seg, b, words: [], total: 0 } : null;
      for (const node of [...seg.childNodes]) {
        if (node.nodeType !== 3) continue;
        const frag = document.createDocumentFragment();
        node.textContent.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (phrase) phrase.total += part.length;
          if (/^\s+$/.test(part)) { frag.append(part); return; }
          const s = document.createElement('span'); s.className = 'rw'; s.textContent = part; frag.append(s);
          const w = { el: s, b, len: part.length, on: false };
          words.push(w); if (phrase) phrase.words.push(w);
        });
        node.replaceWith(frag);
      }
      if (phrase) phrases.push(phrase);
    }
    // a word's threshold: its beat, plus its place among that beat's words
    const byBeat = {};
    for (const w of words) (byBeat[w.b] = byBeat[w.b] || []).push(w);
    for (const b in byBeat) byBeat[b].forEach((w, j, all) => { w.th = +b + (j + 1) / all.length * .72; });
    return { words, phrases };
  }
  function unfold(scene) {
    for (const { i, paras, bar } of clauseSteps) {
      const B = scene.beat(i), beats = scene.tall[i] ? scene.tall[i].beats : 4;
      const cur = B < 0 ? -1 : Math.floor(B);
      for (const { words, phrases } of paras) {
        for (const w of words) {
          const on = B >= w.th;
          if (w.on !== on) { w.on = on; w.el.classList.toggle('on', on); }
        }
        for (const ph of phrases) {
          let shown = 0;
          for (const w of ph.words) if (w.on) shown += w.len + 1;
          ph.el.style.backgroundSize = f(Math.min(100, shown / ph.total * 100)) + '% 100%';
          ph.el.classList.toggle('cur', ph.b === cur);
        }
      }
      if (bar) bar.style.transform = `scaleX(${f(B < 0 ? 0 : clamp(B / (beats - .3)))})`;
    }
  }

  // The closing paragraph types in as it rises. The reveal must finish by the
  // time the page runs out: on a wide screen the paragraph never climbs far up
  // the screen before the page ends, so the end point is capped at the bottom.
  function typed() {
    for (const t of typedParas) {
      const r = t.el.getBoundingClientRect();
      if (!r.height || r.top > state.vh || r.bottom < 0) continue;   // hidden language or off screen
      const top = r.top + scrollY;
      const start = top - state.vh * .92;
      const maxScroll = document.documentElement.scrollHeight - state.vh;
      const end = Math.min(top + r.height - state.vh * .75, maxScroll - 2);
      const p = end > start ? clamp((scrollY - start) / (end - start)) : 1;
      const n = Math.ceil(p * t.words.length);
      if (n === t.last) continue;
      t.last = n;
      t.words.forEach((w, i) => w.classList.toggle('on', i < n));
    }
  }

  const dialSun = $('#dial-sun');
  function dial() {
    const max = document.documentElement.scrollHeight - state.vh;
    const a = clamp(scrollY / Math.max(1, max)) * 360;
    const [x, y] = P(18, a);
    set(dialSun, { cx: f(x), cy: f(y) });
  }

  let raf = 0, backVisible = false;
  function frame(now) {
    raf = 0;
    for (const s of scenes) if (s.visible) s.render(stepT(s.anchors, scrollY), now, s);
    if (ppf.visible) unfold(ppf);
    if (backVisible) renderBack(now);
    fadeCards();
    typed();
    dial();
    if (scenes.some(s => s.visible) || backVisible) raf = requestAnimationFrame(frame);
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };

  function setLang(l) {
    state.lang = l;
    const html = document.documentElement;
    html.dataset.lang = l;
    html.lang = l === 'pt' ? 'pt-BR' : 'en';
    $$('[data-set-lang]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.setLang === l)));
    try { localStorage.setItem('pdc-lang', l); } catch (e) { /* private mode */ }
    if (B.labeledBox) $('#fig-labeled').setAttribute('viewBox', B.labeledBox[l]);
    measure(); kick();
  }

  // ── boot ──
  const story = buildCosmogram($('#cosmo'), 'j');
  const storyOpt = { labelled: false, introOrbit: true, words: $$('#journey .w'), sky: $('#journey .sky'), stars: $('#stars') };
  buildStars($('#stars'));
  const breakdown = buildCosmogram($('#cosmo-steps'), 'k');
  const breakdownOpt = { labelled: true, introOrbit: false, intro: 1 };
  buildPPF(); Q.svg = $('#ppf-svg');
  buildLabeled(); buildDikenga();

  makeScene($('#journey'), (t, now) => renderCosmogram(story, remap(STORY_KEYS, t), now, storyOpt), 'diagram');
  const ppf = makeScene($('#ppf'), (t, now, s) => renderPPF(t, now, s), 'ring');
  makeScene($('#anatomy'), (t, now) => renderCosmogram(breakdown, remap(BREAKDOWN_KEYS, t), now, breakdownOpt), 'diagram');

  // the step-by-step breakdown opens under the labelled diagram on the back page
  const deepBtn = $('#deep-btn'), anatomy = $('#anatomy');
  deepBtn.addEventListener('click', () => {
    const open = anatomy.hidden;
    anatomy.hidden = !open;
    deepBtn.setAttribute('aria-expanded', String(open));
    measure(); kick();
    if (open) anatomy.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'start' });
  });
  clauseSteps = [1, 2].map(i => ({ i, paras: $$('.unfold', ppf.steps[i]).map(prepareUnfold), bar: $('.pin-bar i', ppf.steps[i]) }));

  function wrapWords(node) {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === 3) {
        const frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(part); return; }
          const s = document.createElement('span'); s.className = 'tw'; s.textContent = part; frag.append(s);
        });
        child.replaceWith(frag);
      } else if (child.nodeType === 1) {
        child.classList.add('tw');
      }
    }
    return node;
  }
  typedParas = $$('.typed').map(el => ({ el: wrapWords(el), words: $$('.tw', el), last: -1 }));

  let lang = 'en';
  try { lang = localStorage.getItem('pdc-lang') || ((navigator.language || '').toLowerCase().startsWith('pt') ? 'pt' : 'en'); } catch (e) { /* ignore */ }
  $$('[data-set-lang]').forEach(b => b.addEventListener('click', () => setLang(b.dataset.setLang)));

  const io = new IntersectionObserver(entries => {
    for (const e of entries) {
      const sc = scenes.find(s => s.section === e.target);
      if (sc) sc.visible = e.isIntersecting;
      if (e.target.id === 'back') backVisible = e.isIntersecting;
    }
    kick();
  }, { rootMargin: '10% 0px' });
  scenes.forEach(s => io.observe(s.section));
  io.observe($('#back'));

  const reveal = new IntersectionObserver(entries => {
    for (const e of entries) if (e.isIntersecting) {
      e.target.classList.add('in');
      if (e.target.classList.contains('fig-dikenga')) B.fig4In = true;
      if (e.target.classList.contains('fig-labeled')) B.fig1In = true;
      reveal.unobserve(e.target);
    }
  }, { threshold: .25 });
  $$('.reveal').forEach(n => reveal.observe(n));

  addEventListener('scroll', kick, { passive: true });
  addEventListener('resize', () => { measure(); kick(); });
  new ResizeObserver(() => { measure(); kick(); }).observe(document.body);

  setLang(lang);
  // start the cover animation once the fonts are in, so the lettering draws in its real shape
  const go = () => { if (!state.start) { state.start = performance.now(); kick(); } };
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(go);
  setTimeout(go, 1500);
  measure(); kick();
})();
