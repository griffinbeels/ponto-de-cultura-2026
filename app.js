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
  function fogGradient(defs, id, color) {
    const g = el('radialGradient', { id }, defs);
    [['0', 1], ['.78', 1], ['1', 0]].forEach(([o, a]) => el('stop', { offset: o, 'stop-color': color, 'stop-opacity': a }, g));
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
      // leave room under the emblem for the three credit lines
      const S = desk ? Math.min(vh * .72, vw * .6) : Math.min(vw * 1.0, vh * .62);
      return { S, cx: vw / 2, cy: desk ? vh * .45 : vh * .46 };
    }
    if (desk) { const S = Math.min(vh * .9, vw * .5); return { S, cx: vw * .68, cy: vh * .5, read: vh * .36 }; }
    // the Past·Present·Future ring is simpler, so it can be smaller and leave room for longer paragraphs
    const top = 64, S = mode === 'ring' ? Math.min(vw * .86, vh * .4) : Math.min(vw * .98, vh * .5);
    return { S, cx: vw / 2, cy: top + S / 2 - 6, read: top + S + 2 };
  }
  function place(svg, L) {
    const s = svg.style;
    s.width = s.height = f(L.S) + 'px';
    s.transform = `translate(${f(L.cx - L.S / 2)}px, ${f(L.cy - L.S / 2)}px)`;
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

    // "fog": a soft disc in the page's own colour behind the drawing — invisible
    // on its own, but a box sliding behind the diagram disappears into it
    fogGradient(defs, id + 'Fog', C.paper);
    J.fog = el('circle', { r: 212, fill: `url(#${id}Fog)` }, svg);
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
    const labelSet = (parent, fill, half) => {
      if (half === 'top') {
        txt(parent, 0, -44, 'NSEKE', { 'font-size': 24, 'font-weight': 500, 'letter-spacing': 2.5, fill });
        txt(parent, 66, -5, 'Kalunga', { 'font-size': 10, fill });
      } else {
        txt(parent, 0, 66, 'MPEMBA', { 'font-size': 24, 'font-weight': 500, 'letter-spacing': 2.5, fill });
        txt(parent, -66, 14, 'Kalunga', { 'font-size': 10, fill });
      }
    };
    // above the line and below it arrive separately ("Above the Line…" · "Below the Line…")
    J.worldTop = el('g', { opacity: 0 }, lab);
    J.worldBot = el('g', { opacity: 0 }, lab);
    const light = el('g', { 'clip-path': `url(#${id}Dark)` }, J.worldTop);
    labelSet(J.worldTop, C.ink, 'top');
    labelSet(light, C.cream, 'top');
    labelSet(J.worldBot, C.ink, 'bottom');

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
      fill: C.brush, stroke: C.ink, 'stroke-width': 3.4, 'paint-order': 'stroke', 'stroke-linejoin': 'round',   // a firm black outline keeps it legible on the feathers
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
  // Timeline position → where the sun is during the four moments. It travels
  // while each moment's words unfold (the holds live in the scroll plan).
  const SUN_KEYS = [[8.8, -24], [9, 0], [10, 90], [11, 180], [12, 270], [13, 360]];
  function thetaAt(t) {
    if (t <= SUN_KEYS[0][0]) return SUN_KEYS[0][1];
    for (let i = 0; i < SUN_KEYS.length - 1; i++) {
      const [t0, a0] = SUN_KEYS[i], [t1, a1] = SUN_KEYS[i + 1];
      if (t < t1) return lerp(a0, a1, smooth(clamp((t - t0) / (t1 - t0))));
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
    const k = opt.layout != null ? opt.layout : ramp(t, .05, .9);
    place(J.svg, { S: lerp(cov.S, dia.S, k), cx: lerp(cov.cx, dia.cx, k), cy: lerp(cov.cy, dia.cy, k) });

    // ── emblem → cosmogram, spread across the whole cover scroll (t 0 → .92) ──
    // PONTO DE CULTURA lifts away, the ring lettering fades, ticks and spokes go,
    // the feathers fold in one by one, the inner ring goes, the outer ring
    // tightens into the water circle and the cross reaches the centre — done
    // exactly as The Kongo Cosmogram box is ready.
    const m = ramp(t, .35, .88);
    const ringR = lerp(135, 100, m), cR = lerp(182, 150, m), cS = lerp(17, 15, m);
    const decoOut = ramp(t, .15, .8);
    const spin = RM ? 0 : sec * 2.2;
    J.feathers.forEach((g, i) => {
      const s = ramp(intro, .42 + i * .022, .6 + i * .022) * (1 - ramp(t, .18 + i * .03, .42 + i * .03));
      g.setAttribute('transform', `rotate(${f(i * 30 + spin + 60 * decoOut)}) scale(${f(Math.max(s, .001))})`);
      g.setAttribute('opacity', s > .002 ? 1 : 0);
    });
    J.spokes.setAttribute('opacity', f(ramp(intro, .34, .62) * (1 - ramp(t, .12, .45))));
    J.ticks.setAttribute('opacity', f(ramp(intro, .38, .66) * (1 - ramp(t, .1, .4))));
    set(J.innerRing, { 'stroke-dashoffset': f(1 - ramp(intro, .26, .56)), opacity: f(1 - ramp(t, .3, .6)) });
    J.ringText.setAttribute('opacity', f(ramp(intro, .55, .82) * (1 - ramp(t, .05, .32))));
    const stamp = ramp(intro, .74, .94), lift = ramp(t, 0, .3);
    set(J.ponto, {
      opacity: f(stamp * (1 - lift)),
      transform: `translate(0 ${f(-46 * lift)}) scale(${f((1 + .28 * (1 - stamp)) * (1 - .12 * lift))})`,
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
    // "Above the Line: World of Humans" (to 2.7) · "Below the Line: World of Spirits" (to 3)
    const later = 1 - ramp(t, 7.6, 8.3);
    const wTop = A * bump(t, 2.45, 2.7, 3.45, 3.9), wBot = A * bump(t, 2.75, 3, 3.45, 3.9);
    J.topHalf.setAttribute('opacity', f(.1 * A * ramp(t, 2.45, 2.7) * later + .14 * wTop));
    J.botHalf.setAttribute('opacity', f(.1 * A * ramp(t, 2.75, 3) * later + .14 * wBot));
    J.worldTop.setAttribute('opacity', f(ramp(t, 2.5, 2.7)));
    J.worldBot.setAttribute('opacity', f(ramp(t, 2.8, 3)));

    // cross: the connectors grow in from the circles, then reach the centre
    const armIn = ramp(intro, .06, .3), armCenter = ramp(t, .5, .9);
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
    // "Pole of Physical Power: North…" (to 5.7) · "Pole of Spiritual Power: South…" (to 6)
    const poleN = A * bump(t, 5.45, 5.7, 6.45, 6.9), poleS = A * bump(t, 5.75, 6, 6.45, 6.9);
    J.poleN.setAttribute('opacity', f(poleN * .85));
    J.poleS.setAttribute('opacity', f(poleS * .85));

    // arrows: drawn one after another, in the sun's direction
    const arrowsOut = ramp(t, 7.7, 8.3);
    J.arrows.forEach((ar, i) => {
      const d = A * ramp(t, 6.45 + i * .06, 6.65 + i * .06);    // drawn by 6.83: "Arrows show direction…"
      ar.arc.setAttribute('stroke-dashoffset', f(1 - d));
      ar.head.setAttribute('opacity', f(ramp(d, .85, 1)));
      ar.g.setAttribute('opacity', f(1 - arrowsOut));
    });

    // ── the sun ──
    const loopA = (sec * 40) % 360;
    // "It represents existence as a continuous cycle" sets the sun circling (to 1.1);
    // "Follows Path of Sun…" sends it along the arrows (to 7)
    const oIntro = (opt.introOrbit ? 1 : 0) * bump(t, .95, 1.1, 1.45, 1.85), oArrows = A * bump(t, 6.86, 7, 7.45, 7.78);
    const journey = ramp(t, 7.8, 8.35);
    const theta = t >= 7.8 ? thetaAt(t) : loopA;
    const sunO = t >= 7.8 ? journey : Math.max(oIntro, oArrows);
    const [sx, sy] = P(150, theta);
    J.sun.setAttribute('opacity', f(sunO));
    J.sun.setAttribute('transform', `translate(${f(sx)} ${f(sy)})`);
    J.rays.setAttribute('transform', `rotate(${f(RM ? 0 : sec * 30)})`);

    // the five words of the cycle follow the sun around
    const wordsOn = oIntro > .35 && t >= 1.18;           // once "of birth, growth, …" is on the page
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
    J.fog.setAttribute('opacity', f(1 - ramp(t, 7.6, 8.3)));   // the cream disc takes over once the sky darkens
    // "Its four stages symbolize this journey:" lights the four moments in order (8.4 → 8.8)
    const seq = i => ramp(t, 8.4 + i * .09, 8.49 + i * .09);
    const seqGlow = i => bump(t, 8.4 + i * .09, 8.46 + i * .09, 8.52 + i * .09, 8.62 + i * .09);
    const moments = ramp(t, 8.8, 9);
    J.circles.forEach((c, i) => {
      const [x, y] = P(cR, c.a);
      const pop = backOut(ramp(intro, i * .05, .2 + i * .05));
      // small circles: moments of the sun
      const small = A * bump(t, 4.45, 4.95, 5.45, 5.9);
      const ph = ((sec * .8) - i * .25) % 1, beat = Math.exp(-((ph < 0 ? ph + 1 : ph) * 7));
      // the circle nearest the sun glows during the four moments
      const near = t >= 8.8 ? clamp(1 - angDist(theta, c.a) / 40) : 0;
      const pole = c.a === 90 ? poleN : c.a === 270 ? poleS : 0;
      const lit = seqGlow(i);
      const sc = pop * (cS / 17) * (1 + .35 * small * beat + .22 * near * moments + .25 * pole + .3 * lit);
      c.g.setAttribute('transform', `translate(${f(x)} ${f(y)}) scale(${f(Math.max(sc, .001))})`);
      c.dot.setAttribute('opacity', f(small * beat));
      c.glow.setAttribute('opacity', f(Math.max(near * moments, pole, lit)));
      J.nameEls[i].setAttribute('opacity', f(t >= 8.8 ? .45 + .55 * near : seq(i)));
    });

    // hand-off to the next section: the diagram and its sky dissolve into the
    // page colour Past · Present · Future starts on, so the seam disappears
    const handoff = ramp(t, 13.05, 13.9);
    J.svg.style.opacity = f(1 - handoff);

    // sky (main story only)
    if (!opt.sky) return;
    const skyMix = ramp(t, 7.6, 8.4);
    const [top, bottom] = skyAt(thJ);
    const toPage = c => mix2(C.page, c, 1 - handoff);
    opt.sky.style.background = skyMix > .001
      ? `linear-gradient(180deg, ${toPage(mix2(C.paper, top, skyMix))}, ${toPage(mix2(C.paper, bottom, skyMix))})`
      : '';
    const night = thJ < 20 ? 1 - ramp(thJ, -30, 18) : ramp(thJ, 168, 215) * (1 - ramp(thJ, 325, 368));
    opt.stars.style.opacity = f(night * skyMix * (1 - handoff));
    themeColor.setAttribute('content', skyMix > .5 && handoff < .5 ? '#1B1412' : handoff >= .5 ? '#F6F2EC' : '#EBA98C');
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
    fogGradient(defs, 'qFog', C.page);
    el('circle', { r: 206, fill: 'url(#qFog)' }, svg);   // boxes recede into this
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
    // t: -1 → -.35 while the title box rises (the ring draws itself),
    // -.35 → .2 while "Ancestry · Transformation · Continuity" unfolds (one label per word),
    // 1–2 first paragraph, 2–3 second paragraph, 3 closing logo.
    Q.base.setAttribute('opacity', f(.35 * ramp(t, -1, -.75)));
    Q.past.setAttribute('stroke-dashoffset', f(1 - ramp(t, -.95, -.55)));
    Q.future.setAttribute('opacity', f(ramp(t, -.7, -.45)));
    Q.sun.setAttribute('opacity', f(ramp(t, -.8, -.5)));

    // First paragraph, one beat per chunk (t = 1 + chunk × .15):
    //   "We chose …" · "because … idea:" — all three lit; "to know where we are going," —
    //   the arrows ahead; "recognize where we came from," — PAST; "understand where we
    //   are today," — PRESENT; "prepare what we will leave …" — FUTURE.
    const kk = (t - 1) / .15;
    const inP1 = t > .97 && t < 1.88;
    const focus = (b, i) => bump(b, i - .5, i, i + .5, i + 1);
    const dim = x => .3 + .7 * x;
    let fPast = 1, fPres = 1, fFut = 1, fDir = 0;
    if (inP1) {
      const lead = 1 - ramp(kk, 1.5, 2);   // the two opening chunks keep all three lit
      fDir = focus(kk, 2);
      fPast = lerp(dim(focus(kk, 3)), 1, lead);
      fPres = lerp(dim(focus(kk, 4)), 1, lead);
      fFut = lerp(dim(Math.max(focus(kk, 5), fDir * .6)), 1, lead);
    }
    // each label lands with its word: Ancestry, Transformation, Continuity
    Q.lPast.setAttribute('opacity', f(ramp(t, -.33, -.24) * fPast));
    Q.lPresent.setAttribute('opacity', f(ramp(t, -.12, -.03) * fPres));
    Q.lFuture.setAttribute('opacity', f(ramp(t, .09, .18) * fFut));
    Q.past.setAttribute('stroke-width', f(6 + (inP1 ? 3 * focus(kk, 3) : 0)));
    Q.future.setAttribute('stroke-width', f(5 + (inP1 ? 3 * Math.max(focus(kk, 5), fDir) : 0)));
    Q.heads.setAttribute('opacity', f(ramp(t, -.6, -.35) * (.7 + .3 * fDir)));

    // Second paragraph (t = 2 + chunk × .2): the generations appear as the box
    // rises ("The same is true of Capoeira."); "We receive a legacy…" — the legacy
    // flows down from the ancestors into the present; "transform that knowledge…"
    // — the sun transforms it; "carry the responsibility…" — it flows on and the
    // future generations fill.
    const dotsIn = ramp(t, 1.8, 2);
    const flowPast = ramp(t, 2.1, 2.2);
    const change = bump(t, 2.3, 2.4, 2.5, 2.6);
    const flowFut = ramp(t, 2.5, 2.6);
    const fillProg = ramp(t, 2.5, 2.6);
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
    const grow = 1 + .32 * change + .14 * (inP1 ? focus(kk, 4) : 0);
    Q.core.setAttribute('r', f(12.5 * grow));
    Q.halo.setAttribute('r', f(46 * grow));
    Q.rays.setAttribute('transform', `rotate(${f(RM ? 0 : sec * (30 + 160 * change))}) scale(${f(grow)})`);
    Q.core.setAttribute('fill', mix(C.sun, C.musoni, change * .6));

    // Where the sun stands on the ring. First paragraph: at PRESENT for the
    // opening chunks and "to know where we are going"; back to the middle of
    // PAST for "recognize where we came from"; PRESENT again for "understand
    // where we are today"; the middle of FUTURE for "prepare what we will leave
    // for those who come after us". Second paragraph: it loops the ring —
    // continuity — carrying on from where it stood. It glides, never jumps.
    const P1A = [270, 270, 270, 180, 270, 360];
    let target;
    if (t < 1.85) {
      const x = clamp(kk, 0, 5), i = Math.min(4, Math.floor(x));
      target = t < .97 ? 270 : lerp(P1A[i], P1A[i + 1], smooth(x - i));
      Q.loopStart = null;
    } else {
      if (Q.loopStart == null) Q.loopStart = sec;
      target = 360 + (RM ? 0 : (sec - Q.loopStart) * 32);
    }
    const dt = Q.lastSec ? Math.min(100, (sec - Q.lastSec) * 1000) : 16;
    Q.lastSec = sec;
    if (Q.sunA == null || RM) Q.sunA = target;
    const dA = ((target - Q.sunA) % 360 + 540) % 360 - 180;           // the short way round
    Q.sunA += dA * (1 - Math.exp(-dt / 140));
    const [sx, sy] = P(QR, Q.sunA);
    Q.sun.setAttribute('transform', `translate(${f(sx)} ${f(sy)})`);
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
  // A scene is a sticky diagram with boxes of text scrolling over it.
  //   1. A box rises into place (heading only) while the diagram moves to the
  //      moment that box describes — the sun travels BETWEEN boxes, so when a
  //      box is ready the picture already shows what its first words say.
  //   2. Pinned, its text appears one chunk at a time. Chunks are authored in
  //      the markup (data-k): whole sentences or clauses, never a lone word
  //      (semantic line breaks, sembr.org). A chunk that adds something to the
  //      picture brings it in as it appears; scrolling back takes both away.
  //   3. After the last chunk the box hangs a moment, "keep scrolling" glowing,
  //      then recedes behind the diagram as the next box rises.
  // A plan entry gives the diagram's timeline position for a box: `arrive`
  // (reached as it pins, optionally through `via` waypoints) and one value per
  // chunk. A `span` step has no box and plays its stretch across its scroll.
  const HANG = .2;          // hang after the last chunk, in viewport heights
  const STORY_PLAN = { start: 0, steps: [
    { cover: true },
    // The Kongo Cosmogram — the emblem folds into the cosmogram as the box rises;
    // "It represents existence as a continuous cycle" sets the sun circling;
    // "of birth, growth, …" lights each word as the sun passes its moment.
    { arrive: .92, chunks: [.92, .92, 1.1, 1.25] },
    // Its four stages… — as it rises: NSEKE/MPEMBA, then the disc, sky and path;
    // its one sentence lights the four moments in order, Kala to Musoni.
    { via: [[.45, 3], [.46, 7.5]], arrive: 8.4, chunks: [8.8] },
    { arrive: 9, chunks: [9, 9] },          // KALA — the sun rises while the box does
    { arrive: 10, chunks: [10, 10] },       // TUKULA — noon
    { arrive: 11, chunks: [11, 11, 11] },   // LUVEMBA — sunset
    // MUSONI — midnight; "and preparation for a new cycle." carries the sun on round to
    // Kala, orange painting in behind it, across that chunk's scroll
    { arrive: 12, chunks: [12, 12, { to: 13, scrub: true }] },
    { span: [13, 14] },                     // the diagram and its sky dissolve into the page for the next section
  ] };
  const PPF_PLAN = { start: -1, steps: [
    { arrive: -.35, chunks: [-.24, -.03, .18] },                  // ring drawn; a label per word
    { arrive: 1, chunks: [1, 1.15, 1.3, 1.45, 1.6, 1.75] },       // see renderPPF for each beat
    { arrive: 2, chunks: [2, 2.2, 2.4, 2.6] },
    { span: [2.6, 2.6] },
  ] };
  const BREAKDOWN_PLAN = { start: 1.4, steps: [
    { arrive: 2, chunks: [2] },              // Circle represents Water
    { arrive: 2.7, chunks: [2.7, 3] },       // Above the Line… · Below the Line…
    { arrive: 4, chunks: [4] },              // Passage through Water
    { arrive: 5, chunks: [5, 5] },           // Small Circles… · Representing Phases…
    { arrive: 5.7, chunks: [5.7, 6] },       // Pole of Physical Power… · Pole of Spiritual Power…
    { arrive: 6.83, chunks: [6.83, 7] },     // Arrows show direction… · Follows Path of Sun…
    { span: [7, 7.5] },
  ] };

  function makeScene(section, plan, mode, render) {
    const steps = $$('.step', section);
    const sc = { section, steps, plan, mode, render, visible: false, keys: [[0, plan.start]], read: 0, T: null };
    sc.boxes = steps.map(step => { const card = $(':scope > .card', step); return card ? makeBox(card, step) : null; });
    sc.cards = sc.boxes.filter(Boolean).map(b => b.el);
    scenes.push(sc);
    return sc;
  }

  const FOOT = '<span class="pin-bar"><i></i></span><span class="pin-cue"><span data-l="en">Keep scrolling</span>' +
    '<span data-l="pt">Continue rolando</span><svg viewBox="0 0 20 20"><path d="M5 5l5 5 5-5M5 11l5 5 5-5"/></svg></span>';
  function makeBox(card, step) {
    const box = { el: card, step, words: [], phrases: [], vis: { en: [], pt: [] }, n: 0, s: 0,
      pinStart: 0, pinEnd: 0, cs: [], shown: -1, caretIdx: -1 };
    // every chunk's words, in reading order; each word knows its chunk and its place in it
    for (const chunk of $$('[data-k]', card)) {
      const k = +chunk.dataset.k, list = [];
      wrapReveal(chunk, list);
      list.forEach((w, j) => { w.k = k; w.j = Math.min(j, 14); w.el.style.setProperty('--j', w.j); });
      box.words.push(...list);
      for (const c of $$('.c', chunk)) box.phrases.push({ el: c, k });
      box.n = Math.max(box.n, k + 1);
    }
    for (const w of box.words) {
      const l = w.el.closest('[data-l]'), lang = l ? l.dataset.l : null;
      if (lang !== 'pt') box.vis.en.push(w);
      if (lang !== 'en') box.vis.pt.push(w);
    }
    const foot = document.createElement('div');
    foot.className = 'pin-foot'; foot.setAttribute('aria-hidden', 'true'); foot.innerHTML = FOOT;
    card.appendChild(foot);
    box.bar = $('.pin-bar i', foot);
    // a typing caret marks where the next words will appear
    box.caret = document.createElement('span');
    box.caret.className = 'caret'; box.caret.setAttribute('aria-hidden', 'true');
    card.appendChild(box.caret);
    return box;
  }
  function wrapReveal(node, list) {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === 3) {
        if (!child.textContent.trim()) continue;
        const frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(part); return; }
          const s = document.createElement('span'); s.className = 'rw'; s.textContent = part; frag.append(s);
          list.push({ el: s, on: false, k: 0 });
        });
        child.replaceWith(frag);
      } else if (child.nodeType === 1) wrapReveal(child, list);
    }
  }

  function measureScene(sc) {
    const { vh } = state;
    const read = sc.read = Math.round(layout(sc.mode).read);
    sc.section.style.setProperty('--read', read + 'px');
    // 1. size each box's step: room to rise, the box, one window per chunk, the hang
    sc.boxes.forEach((b, i) => {
      if (!b) return;
      const counts = new Array(b.n).fill(0);
      for (const w of b.vis[state.lang]) counts[w.k]++;
      const chunks = (sc.plan.steps[i] && sc.plan.steps[i].chunks) || [];
      // longer chunks get longer to read; a chunk that drives a motion gets room for it
      b.win = counts.map((c, k) => Math.max(clamp(c * 14, .15 * vh, .32 * vh), chunks[k] && chunks[k].scrub ? .55 * vh : 0));
      b.lead = .06 * vh;                                              // a beat of empty box, caret blinking
      const h = b.el.offsetHeight;
      b.s = Math.max(50, Math.min(read, vh - h - 12));                // pinned position — higher for a tall box
      b.el.style.top = b.s + 'px';
      const pinned = b.lead + b.win.reduce((a, x) => a + x, 0) + HANG * vh;
      b.step.style.height = Math.round(read + h + pinned) + 'px';
      b.pinned = pinned;
    });
    // 2. where each box pins, where each chunk appears, where it lets go
    const tops = sc.steps.map(docTop);
    sc.boxes.forEach((b, i) => {
      if (!b) return;
      b.pinStart = tops[i] + read - b.s;
      b.cs = []; let y = b.pinStart + b.lead;
      b.win.forEach(w => { b.cs.push(y); y += w; });
      b.pinEnd = b.pinStart + b.pinned;
    });
    // 3. scroll position → the diagram's timeline
    const keys = [[docTop(sc.section) - vh, sc.plan.start]];
    const last = () => keys[keys.length - 1];
    sc.plan.steps.forEach((p, i) => {
      const b = sc.boxes[i], top = tops[i];
      if (p.span) {
        // a box-less step plays its stretch over all the scroll left while the
        // diagram is still pinned: from the previous box letting go to the end
        // of the section's stuck range
        const y0 = last()[0], y1 = Math.max(y0 + 2, top + sc.steps[i].offsetHeight - vh);
        keys.push([y0 + 1, p.span[0]], [y1, p.span[1]]);
        return;
      }
      if (!b) { keys.push([top, last()[1]]); return; }
      const y0 = last()[0];
      for (const [fr, T] of p.via || []) keys.push([y0 + (b.pinStart - y0) * fr, T]);
      keys.push([b.pinStart, p.arrive]);
      let prevT = p.arrive;
      p.chunks.forEach((c, k) => {
        if (k >= b.cs.length) return;
        const T = typeof c === 'object' ? c.to : c;
        if (typeof c === 'object' && c.scrub) keys.push([b.cs[k], prevT], [b.cs[k] + b.win[k], T]);   // moves while you read it
        else keys.push([b.cs[k] - 1, prevT], [b.cs[k], T]);                                              // arrives with the chunk
        prevT = T;
      });
      keys.push([Math.max(b.pinEnd, last()[0] + 1), prevT]);
    });
    sc.keys = keys;
  }
  function timeline(keys, y) {
    if (y <= keys[0][0]) return keys[0][1];
    for (let i = 0; i < keys.length - 1; i++) {
      const [y0, a0] = keys[i], [y1, a1] = keys[i + 1];
      if (y <= y1) return y1 > y0 ? lerp(a0, a1, (y - y0) / (y1 - y0)) : a1;
    }
    return keys[keys.length - 1][1];
  }

  // Show each box's chunks up to the scroll position, highlight the newest
  // chunk's key phrase, fill its bar, and mark it complete once all are out.
  function updateBoxes(sc) {
    const y = scrollY;
    for (const b of sc.boxes) {
      if (!b) continue;
      let shown = 0;
      while (shown < b.cs.length && y >= b.cs[shown]) shown++;
      if (shown !== b.shown) {
        b.shown = shown;
        const at = performance.now();
        for (const w of b.words) { const on = w.k < shown; if (w.on !== on) { w.on = on; w.onAt = at; w.el.classList.toggle('on', on); } }
        for (const ph of b.phrases) ph.el.classList.toggle('cur', ph.k === shown - 1);
        b.el.classList.toggle('complete', shown >= b.n);
      }
      const end = b.cs.length ? b.cs[b.cs.length - 1] : b.pinStart + 1;
      b.bar.style.transform = `scaleX(${f(clamp((y - b.pinStart) / Math.max(1, end - b.pinStart)))})`;
      placeCaret(b);
    }
  }

  // Whole-site progress: one segment per box / section, the current one filling.
  const prog = { el: $('#progress'), segs: [], starts: [], end: 1 };
  function measureProgress() {
    const vh = state.vh, starts = [0];
    for (const sc of scenes) for (const b of sc.boxes) if (b && b.el.offsetHeight) starts.push(b.pinStart - (vh - b.s) * .5);
    starts.push(docTop($('.back-title')) - vh * .7);
    const t = typedParas.find(x => x.el.offsetHeight);
    if (t) starts.push(docTop(t.el) - vh * .8);
    starts.sort((a, b) => a - b);
    prog.starts = starts;
    prog.end = document.documentElement.scrollHeight - vh;
    if (prog.segs.length !== starts.length) {
      prog.el.innerHTML = starts.map(() => '<span><i></i></span>').join('');
      prog.segs = $$('i', prog.el);
    }
  }
  function drawProgress() {
    const y = scrollY, s = prog.starts;
    prog.segs.forEach((seg, i) => {
      const a = s[i], b = i + 1 < s.length ? s[i + 1] : prog.end;
      seg.style.transform = `scaleX(${f(clamp((y - a) / Math.max(1, b - a)))})`;
    });
  }

  let typedParas = [];
  function measure() {
    state.vw = innerWidth; state.vh = innerHeight;
    for (const s of scenes) { measureScene(s); for (const b of s.boxes) if (b) b.caretIdx = -1; }
    measureProgress();
  }

  // The caret sits before the first letter while a box is empty, then right
  // after the last word that has appeared; it leaves once the box is complete
  // and comes back if you scroll up. Solid while words arrive, blinking at rest.
  function offsetIn(node, root) {
    let x = 0, y = 0;
    for (let n = node; n && n !== root; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; }
    return [x, y];
  }
  // A word has finished appearing once its ripple delay and its fade are over
  // (the .rw transition in styles.css: 32ms per place in its chunk, then .28s).
  // The caret only moves past words that have, so it types along behind the
  // text and never waits ahead of it.
  const WORD_STEP = 32, WORD_FADE = 280;
  function placeCaret(b) {
    const vis = b.vis[state.lang] || [], now = performance.now();
    let idx = 0;
    while (idx < vis.length && vis[idx].on && (RM || now >= vis[idx].onAt + vis[idx].j * WORD_STEP + WORD_FADE)) idx++;
    if (idx === b.caretIdx) return;
    const moved = b.caretIdx >= 0;
    b.caretIdx = idx;
    const c = b.caret;
    if (!vis.length || idx >= vis.length) { c.classList.remove('show', 'typing'); return; }
    const w = vis[Math.max(0, idx - 1)].el;
    const [x, y] = offsetIn(w, b.el);
    c.style.left = (idx === 0 ? x - 1 : x + w.offsetWidth + 2) + 'px';
    c.style.top = y + 'px';
    c.style.height = w.offsetHeight + 'px';
    c.classList.add('show');
    if (moved) {
      c.classList.add('typing');
      clearTimeout(b.caretT);
      b.caretT = setTimeout(() => c.classList.remove('typing'), 480);
    }
  }

  // A box fades in as it rises from the bottom. Once read, as it moves up past
  // its pinned spot it drops behind the diagram, shrinks a little and fades —
  // it recedes rather than sliding over the picture.
  function fadeCards() {
    const { vh } = state;
    for (const sc of scenes) {
      if (!sc.visible) continue;
      for (const b of sc.boxes) {
        if (!b) continue;
        const c = b.el, r = c.getBoundingClientRect();
        if (r.bottom < -40 || r.top > vh + 40) continue;
        const fin = clamp((vh - r.top) / (vh * .22));
        const leave = clamp((b.s - r.top) / (vh * .4));        // 0 while pinned or arriving
        c.classList.toggle('behind', r.top < b.s - 4);
        c.style.setProperty('--depth', f(1 - .07 * smooth(leave)));
        c.style.opacity = f(Math.min(smooth(fin), 1 - smooth(clamp((leave - .12) / .88))));
      }
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

  let raf = 0, backVisible = false, lastNow = 0;
  function frame(now) {
    raf = 0;
    // On screen right now? Read from layout every frame rather than trusting the
    // observer alone: its callbacks arrive a frame late, which after a long jump
    // left a box showing words it should have hidden.
    const vh = state.vh;
    for (const s of scenes) {
      const r = s.section.getBoundingClientRect();
      s.visible = r.height > 0 && r.bottom > -vh * .1 && r.top < vh * 1.1;
    }
    // The diagram glides to where the scroll says it should be (about half a
    // second), so a chunk and the picture change it brings arrive together.
    const dt = lastNow ? Math.min(100, now - lastNow) : 16;
    lastNow = now;
    for (const s of scenes) {
      if (!s.visible) continue;
      updateBoxes(s);
      const target = timeline(s.keys, scrollY);
      s.T = (s.T == null || RM || Math.abs(target - s.T) > 3) ? target : s.T + (target - s.T) * (1 - Math.exp(-dt / 150));
      if (Math.abs(target - s.T) < 1e-4) s.T = target;
      s.render(s.T, now, s);
    }
    if (backVisible) renderBack(now);
    fadeCards();
    typed();
    dial();
    drawProgress();
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
  const coverBits = $$('.step-cover');   // holds the credit line and the scroll cue (their own fade-in animates opacity)
  buildStars($('#stars'));
  const breakdown = buildCosmogram($('#cosmo-steps'), 'k');
  const breakdownOpt = { labelled: true, introOrbit: false, intro: 1 };
  buildPPF(); Q.svg = $('#ppf-svg');
  buildLabeled(); buildDikenga();

  makeScene($('#journey'), STORY_PLAN, 'diagram', (t, now, s) => {
    // the cover emblem shrinks into place while the first box rises
    const first = s.boxes[1];
    storyOpt.layout = first ? clamp(scrollY / Math.max(1, first.pinStart)) : 1;
    // the cover's credit line and scroll cue step aside as the emblem moves up
    coverBits.forEach(n => { n.style.opacity = f(1 - ramp(storyOpt.layout, 0, .3)); });
    renderCosmogram(story, t, now, storyOpt);
  });
  makeScene($('#ppf'), PPF_PLAN, 'ring', (t, now, s) => renderPPF(t, now, s));
  makeScene($('#anatomy'), BREAKDOWN_PLAN, 'diagram', (t, now) => renderCosmogram(breakdown, t, now, breakdownOpt));

  // the step-by-step breakdown opens under the labelled diagram on the back page
  const deepBtn = $('#deep-btn'), anatomy = $('#anatomy');
  deepBtn.addEventListener('click', () => {
    const open = anatomy.hidden;
    anatomy.hidden = !open;
    deepBtn.setAttribute('aria-expanded', String(open));
    measure(); kick();
    if (open) anatomy.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'start' });
  });

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
  // Re-measure whenever a box changes size (web fonts arriving, language
  // switch, rotation) — each box's pin window depends on its height.
  const resized = new ResizeObserver(() => { measure(); kick(); });
  resized.observe(document.body);
  for (const sc of scenes) for (const c of sc.cards) resized.observe(c);

  setLang(lang);
  // read-only handle for the headless checks: scroll → timeline and each box's pin window
  window.__pdc = { scenes, timeline, plans: { journey: STORY_PLAN, ppf: PPF_PLAN, anatomy: BREAKDOWN_PLAN } };
  // start the cover animation once the fonts are in, so the lettering draws in its real shape
  const go = () => { if (!state.start) { state.start = performance.now(); kick(); } };
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(go);
  setTimeout(go, 1500);
  measure(); kick();
})();
