import type { Diagram } from '../contracts'

// Static instruction diagrams for the Movement Age start, setup and test screens.
// Each returns an inline SVG string. No DOM access, so these run in Node tests.
// Colours come only from CSS classes (dg-*) in app.css, which read the theme
// custom properties, so the figures follow light and dark mode.
//
// Visual language matches research/explainer.html: teal limbs with round caps,
// amber joint dots, a head circle, panel backgrounds, a chair in a muted line.

type Pt = readonly [number, number]

const f = (v: number): string => String(Math.round(v * 10) / 10)
const pt = (x: number, y: number): Pt => [x, y]
const pstr = (p: Pt): string => `${f(p[0])} ${f(p[1])}`
/** An open polyline path through the given points. */
const line = (...pts: Pt[]): string => 'M' + pts.map(pstr).join(' L')

/** A small filled arrowhead whose tip is at (x, y), pointing along dir (1 right, -1 left). */
const head = (x: number, y: number, dir: 1 | -1, cls: string): string =>
  `<polygon class="${cls}" points="${f(x)} ${f(y)}, ${f(x - 8 * dir)} ${f(y - 4)}, ${f(x - 8 * dir)} ${f(y + 4)}"/>`

const open = (viewBox: string, label: string): string =>
  `<svg class="dg" xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img" aria-label="${label}" focusable="false"><title>${label}</title>`

// ---------- front-view stick figure ----------

interface FrontOpts {
  /** Horizontal centre of the figure. */
  cx: number
  /** y of the floor under the feet. */
  floor: number
  /** Scale; 1 is a figure about 190 units tall. */
  s: number
  arms: 'hips' | 'down'
  /** Lift the figure's right foot (screen right) clear of the floor, knee bent. */
  lift: boolean
  eyes: boolean
  /** Thinner strokes for small figures. */
  thin: boolean
}

function frontFigure(o: FrontOpts): string {
  const at = (x: number, y: number): Pt => [o.cx + o.s * x, o.floor + o.s * y]
  const hips = o.arms === 'hips'
  const shL = at(-20, -165)
  const shR = at(20, -165)
  const neck = at(0, -165)
  const pelvis = at(0, -105)
  const hipL = at(-10, -105)
  const hipR = at(10, -105)
  const elL = hips ? at(-38, -137) : at(-24, -133)
  const elR = hips ? at(38, -137) : at(24, -133)
  const haL = hips ? at(-15, -109) : at(-26, -102)
  const haR = hips ? at(15, -109) : at(26, -102)
  const knL = at(-10, -56)
  const anL = at(-10, -7)
  const knR = o.lift ? at(28, -59) : at(10, -56)
  const anR = o.lift ? at(24, -23) : at(10, -7)
  const ftLy = -4
  const ftRy = o.lift ? -20 : -4
  const ftRx = o.lift ? 24 : 10

  const d = [
    line(shL, shR),
    line(neck, pelvis),
    line(hipL, hipR),
    line(shL, elL, haL),
    line(shR, elR, haR),
    line(hipL, knL, anL),
    line(hipR, knR, anR),
    line(at(-17, ftLy), at(-3, ftLy)),
    line(at(ftRx - 7, ftRy), at(ftRx + 7, ftRy)),
  ].join(' ')

  const thin = o.thin ? ' dg-thin' : ''
  const headC = at(0, -179)
  const dotR = Math.max(2.3, 3.6 * o.s)
  const joints: Pt[] = [shL, shR, elL, elR, hipL, hipR, knL, knR, anL, anR]
  const parts = [
    `<path class="dg-limb${thin}" d="${d}"/>`,
    `<circle class="dg-head${thin}" cx="${f(headC[0])}" cy="${f(headC[1])}" r="${f(10 * o.s)}"/>`,
    ...joints.map((p) => `<circle class="dg-dot" cx="${f(p[0])}" cy="${f(p[1])}" r="${f(dotR)}"/>`),
  ]
  if (o.eyes) {
    for (const ex of [-3.5, 3.5]) {
      const e = at(ex, -180)
      parts.push(`<circle class="dg-eye" cx="${f(e[0])}" cy="${f(e[1])}" r="${f(1.7 * o.s)}"/>`)
    }
  }
  return parts.join('')
}

// ---------- side-view stick figure for the chair stand ----------

const FY = 217

function sideFigure(c: number, standing: boolean): string {
  const hip = standing ? pt(c + 20, 126) : pt(c - 18, 164)
  const knee = pt(c + 20, 164)
  const ankle = pt(c + 20, 214)
  const toe = pt(c + 34, 214)
  const shoulder = standing ? pt(c + 20, 68) : pt(c - 18, 106)
  const headC = standing ? pt(c + 20, 56) : pt(c - 18, 94)
  // Forearms folded across the chest: the elbow points forward, the hand comes back to the chest.
  const elbow = standing ? pt(c + 34, 84) : pt(c - 4, 122)
  const hand = standing ? pt(c + 21, 76) : pt(c - 17, 114)
  const d = [line(hip, shoulder), line(hip, knee, ankle), line(ankle, toe), line(shoulder, elbow, hand)].join(' ')
  const joints: Pt[] = [shoulder, elbow, hip, knee, ankle]
  return [
    `<path class="dg-limb" d="${d}"/>`,
    `<circle class="dg-head" cx="${f(headC[0])}" cy="${f(headC[1])}" r="10"/>`,
    ...joints.map((p) => `<circle class="dg-dot" cx="${f(p[0])}" cy="${f(p[1])}" r="3.5"/>`),
  ].join('')
}

function chairColumn(c: number, standing: boolean, n: number, title: string, detail: string): string {
  const bx = c + 4
  const chair = `M${f(c - 25)} 115 V${FY} M${f(c - 25)} 167 H${f(c + 12)} M${f(c + 12)} 167 V${FY}`
  return [
    `<path class="dg-floor" d="M${f(c - 34)} ${FY} H${f(c + 40)}"/>`,
    `<path class="dg-chair" d="${chair}"/>`,
    sideFigure(c, standing),
    `<circle class="dg-badge" cx="${f(bx)}" cy="24" r="12"/>`,
    `<text class="dg-num" x="${f(bx)}" y="29">${n}</text>`,
    `<text class="dg-t dg-tb dg-mid" x="${f(bx)}" y="240">${title}</text>`,
    `<text class="dg-t dg-tm dg-mid" x="${f(bx)}" y="258">${detail}</text>`,
  ].join('')
}

// ---------- the three diagrams ----------

const CHAIR_LABEL =
  'Chair stand diagram: sit with arms crossed, stand up fully, sit back down. Steps 1 to 3 make 1 rep.'

export const chairStandDiagram: Diagram = () =>
  [
    open('0 0 360 316', CHAIR_LABEL),
    `<path class="dg-arrow" d="M102 150 H140"/>`,
    head(146, 150, 1, 'dg-mk'),
    `<path class="dg-arrow" d="M222 150 H260"/>`,
    head(266, 150, 1, 'dg-mk'),
    chairColumn(60, false, 1, 'Sit', 'arms crossed'),
    chairColumn(180, true, 2, 'Stand up fully', 'legs straight'),
    chairColumn(300, false, 3, 'Sit back down', 'like step 1'),
    `<path class="dg-brace" d="M44 272 V280 H172 L180 288 L188 280 H316 V272"/>`,
    `<text class="dg-t dg-tb dg-mid" x="180" y="308">Steps 1 to 3 make 1 rep</text>`,
    '</svg>',
  ].join('')

const ONE_LEG_LABEL =
  'One-leg stand diagram: barefoot beside a wall, hands on hips, eyes open, one foot lifted a hand width off the floor, hold up to 60 seconds.'

export const oneLegStandDiagram: Diagram = () =>
  [
    open('0 0 360 280', ONE_LEG_LABEL),
    // Wall on the standing-leg side, within reach but not touching.
    `<text class="dg-t dg-tb" x="18" y="40">Wall within reach</text>`,
    `<rect class="dg-wall" x="18" y="52" width="12" height="198"/>`,
    `<path class="dg-dash" d="M34 113 H54"/>`,
    `<path class="dg-floor" d="M18 250 H250"/>`,
    // Main figure: barefoot, hands on hips, eyes open, right foot lifted, knee bent.
    frontFigure({ cx: 100, floor: 250, s: 1, arms: 'hips', lift: true, eyes: true, thin: false }),
    // Callouts with short leaders.
    `<path class="dg-lead" d="M112 71 H150"/>`,
    `<text class="dg-t" x="156" y="76">Eyes open</text>`,
    `<path class="dg-lead" d="M121 141 H150"/>`,
    `<text class="dg-t" x="156" y="146">Hands on hips</text>`,
    `<path class="dg-lead" d="M136 191 H150"/>`,
    `<text class="dg-t" x="156" y="196">Knee bent</text>`,
    `<path class="dg-arrow" d="M146 233 V249 M141 233 H151 M141 249 H151"/>`,
    `<text class="dg-t" x="158" y="226">Foot up</text>`,
    `<text class="dg-t" x="158" y="242">a hand width</text>`,
    `<path class="dg-lead" d="M90 254 V259"/>`,
    `<text class="dg-t dg-mid" x="90" y="273">Barefoot</text>`,
    // Timer badge.
    `<rect class="dg-badge" x="214" y="10" width="134" height="38" rx="8"/>`,
    `<circle class="dg-icon" cx="236" cy="30" r="9"/>`,
    `<path class="dg-icon" d="M236 30 V25 M233 18 H239 M236 18 V21"/>`,
    `<text class="dg-t dg-tb dg-tl" x="252" y="35">up to 60 s</text>`,
    // Second small figure: the foot comes back down and the timer stops.
    `<rect class="dg-card" x="262" y="84" width="90" height="168" rx="6"/>`,
    `<path class="dg-floor" d="M274 206 H340"/>`,
    frontFigure({ cx: 307, floor: 206, s: 0.55, arms: 'hips', lift: false, eyes: false, thin: true }),
    `<path class="dg-hot" d="M338 156 V197"/>`,
    `<polygon class="dg-mkhot" points="338 205, 333 196, 343 196"/>`,
    `<text class="dg-t dg-tb dg-mid" x="307" y="226">Foot down</text>`,
    `<text class="dg-t dg-tb dg-mid" x="307" y="242">timer stops</text>`,
    '</svg>',
  ].join('')

const FRAMING_LABEL =
  'Camera framing diagram: phone propped at hip height 2 to 3 metres away, screen showing the whole body from shoulders to ankles.'

export const framingDiagram: Diagram = () =>
  [
    open('0 0 360 268', FRAMING_LABEL),
    // Scene: a phone on a stool at about hip height, 2 to 3 m from the person.
    `<path class="dg-floor" d="M10 210 H230"/>`,
    `<path class="dg-chair" d="M12 146 H58 M18 146 V210 M52 146 V210"/>`,
    `<path class="dg-dash" d="M42 126 L174 64 M42 126 L174 212"/>`,
    `<rect class="dg-phone dg-slim" x="30" y="120" width="10" height="26" rx="2"/>`,
    `<circle class="dg-eye" cx="40" cy="126" r="2"/>`,
    `<path class="dg-lead" d="M35 50 V116"/>`,
    `<text class="dg-t dg-tb" x="12" y="28">Phone at</text>`,
    `<text class="dg-t dg-tb" x="12" y="44">hip height</text>`,
    frontFigure({ cx: 172, floor: 210, s: 0.75, arms: 'down', lift: false, eyes: false, thin: true }),
    // Distance line.
    `<path class="dg-arrow" d="M46 238 H166 M40 230 V246 M172 230 V246"/>`,
    head(40, 238, -1, 'dg-mk'),
    head(172, 238, 1, 'dg-mk'),
    `<text class="dg-t dg-tb dg-mid" x="106" y="230">2 to 3 m</text>`,
    // What the phone sees.
    `<path class="dg-arrow" d="M206 140 H232"/>`,
    head(240, 140, 1, 'dg-mk'),
    // Inset: the phone screen with the whole body in frame.
    `<rect class="dg-phone" x="248" y="14" width="100" height="206" rx="12"/>`,
    `<rect class="dg-screen" x="256" y="26" width="84" height="182" rx="6"/>`,
    `<path class="dg-floor" d="M290 20 H306 M284 214 H312"/>`,
    `<path class="dg-frame" d="M266 64 V52 H278 M318 52 H330 V64 M330 184 V196 H318 M278 196 H266 V184"/>`,
    frontFigure({ cx: 298, floor: 188, s: 0.68, arms: 'down', lift: false, eyes: false, thin: true }),
    `<circle class="dg-ok" cx="324" cy="38" r="9"/>`,
    `<path class="dg-check" d="M319.5 38 L322.5 41 L328.5 34.5"/>`,
    `<text class="dg-t dg-tb dg-mid" x="298" y="240">Shoulders to</text>`,
    `<text class="dg-t dg-tb dg-mid" x="298" y="256">ankles in view</text>`,
    '</svg>',
  ].join('')
