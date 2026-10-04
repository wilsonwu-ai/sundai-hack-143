import './app.css'
import type {
  AgeBand,
  Frame,
  MountApp,
  Performance,
  PoseTracker,
  Sex,
  SlsBand,
  SlsPlacement,
  SourceRef,
} from '../contracts'
import { SLS_MAX_MS } from '../contracts'
import { createChairCounter } from '../pose/chair'
import { createStanceTimer } from '../pose/stance'
import { checkFraming } from '../pose/framing'
import { drawPose } from '../pose/draw'
import { placeSts } from '../norms/sts'
import { placeSls } from '../norms/sls'
import { summarizeBalance } from '../norms/balance'
import { chairStandDiagram, framingDiagram, oneLegStandDiagram } from './diagrams'

const EXPLAINER_URL = './explainer/'
const SOURCE_URL = 'https://github.com/wilsonwu-ai/sundai-hack-143'

const FRAMING_HOLD_MS = 1500
const FRAMING_GRACE_MS = 600
// Chair test timeline, measured in frame time from the first frame of the test.
const STAND_MS = 2000
const SIT_MS = 4000
const COUNT_MS = 3000
const GO_AT_MS = STAND_MS + SIT_MS + COUNT_MS
const THIRTY_MS = 30000
const BALANCE_MARK_MS = 10000
const MAX_ATTEMPTS = 2

type ChairMode = '5rep' | '30s'
type Facing = 'user' | 'environment'

interface Inputs {
  age: number | null
  sex: Sex | null
  chair: ChairMode
}

interface ChairResult {
  mode: ChairMode
  camReps: number
  tapReps: number
  camSeconds: number | null
  tapSeconds: number | null
  basis: 'camera' | 'taps'
}

interface BalanceAttempt {
  heldMs: number
  liftedSide: 'left' | 'right' | null
}

interface Cam {
  gen: number
  tracker: PoseTracker | null
  facing: Facing
  mirror: boolean
  state: 'loading' | 'running' | 'error'
  error: string
  lastT: number
  hook: ((f: Frame) => void) | null
}

const round1 = (n: number): number => Math.round(n * 10) / 10
const fmt1 = (n: number): string => n.toFixed(1)
const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (cls) node.className = cls
  if (text !== undefined) node.textContent = text
  return node
}

function setText(node: HTMLElement, text: string): void {
  if (node.textContent !== text) node.textContent = text
}

function btn(label: string, cls: string, onClick: () => void): HTMLButtonElement {
  const b = el('button', `btn ${cls}`, label)
  b.type = 'button'
  b.addEventListener('click', onClick)
  return b
}

/** A figure holding one instruction diagram. The markup is static and trusted (src/ui/diagrams.ts). */
function diagramFigure(svg: string, caption?: string): HTMLElement {
  const fig = el('figure', 'diagram')
  const art = el('div', 'diagram-art')
  art.innerHTML = svg
  fig.appendChild(art)
  if (caption) fig.appendChild(el('figcaption', 'diagram-cap', caption))
  return fig
}

function link(label: string, href: string, external: boolean, cls?: string): HTMLAnchorElement {
  const a = el('a', cls, label)
  a.href = href
  if (external) {
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
  }
  return a
}

function bandRange(bands: AgeBand[]): string {
  const first = bands[0]
  const last = bands[bands.length - 1]
  return `${first.split('-')[0]} to ${last.split('-')[1]}`
}

/** One start-to-end range for the single-leg stand bands; the open-ended 70+ band reads "70 and over". */
function slsBandRange(bands: SlsBand[]): string {
  const first = bands[0]
  const last = bands[bands.length - 1]
  const start = first === '70+' ? '70' : first.split('-')[0]
  if (last === '70+') return `${start} and over`
  return `${start} to ${last.split('-')[1]}`
}

function slsBandLabel(band: SlsBand): string {
  return band === '70+' ? '70 and over' : band.replace('-', ' to ')
}

const PERFORMANCE_WORDS: Record<Performance, string> = {
  'well-below': 'well below typical',
  below: 'below typical',
  typical: 'typical',
  above: 'above typical',
  'well-above': 'well above typical',
}

/** The value placed on the table: seconds for 5 stands, reps for 30 seconds. Null when there is none. */
function chairValue(r: ChairResult): number | null {
  if (r.mode === '5rep') return r.basis === 'camera' ? r.camSeconds : r.tapSeconds
  const n = r.basis === 'camera' ? r.camReps : r.tapReps
  return n > 0 ? n : null
}

function chairHeadline(r: ChairResult): string {
  const v = chairValue(r)
  if (r.mode === '5rep') return v === null ? 'Not completed' : `5 stands in ${fmt1(v)} s`
  return `${plural(v ?? 0, 'stand')} in 30 s`
}

/** The other counting method, when it also produced a usable and different result. */
function chairAlternative(r: ChairResult): 'camera' | 'taps' | null {
  const other = r.basis === 'camera' ? 'taps' : 'camera'
  if (r.mode === '5rep') {
    const a = r.camSeconds
    const b = r.tapSeconds
    if (a === null || b === null || a === b) return null
    return other
  }
  if (r.camReps === r.tapReps) return null
  const otherReps = other === 'camera' ? r.camReps : r.tapReps
  return otherReps > 0 ? other : null
}

export const mountApp: MountApp = (root) => {
  const main = el('main', 'app')
  root.replaceChildren(main)

  const inputs: Inputs = { age: null, sex: null, chair: '5rep' }
  let chairResult: ChairResult | null = null
  let balanceBest: BalanceAttempt | null = null
  let cam: Cam | null = null
  let wakeLock: WakeLockSentinel | null = null
  let wantWake = false

  // ---------- screen wake lock ----------

  async function acquireWake(): Promise<void> {
    wantWake = true
    try {
      if (!('wakeLock' in navigator)) return
      if (wakeLock && !wakeLock.released) return
      const lock = await navigator.wakeLock.request('screen')
      if (!wantWake) {
        void lock.release().catch(() => undefined)
        return
      }
      wakeLock = lock
    } catch {
      // The screen may sleep; the tests still work.
    }
  }

  function releaseWake(): void {
    wantWake = false
    const lock = wakeLock
    wakeLock = null
    if (lock) void lock.release().catch(() => undefined)
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && wantWake) void acquireWake()
  })

  function teardownCamera(): void {
    if (cam) {
      cam.gen += 1
      cam.hook = null
      const tracker = cam.tracker
      cam.tracker = null
      if (tracker) tracker.stop()
      cam = null
    }
    releaseWake()
  }

  function show(screen: HTMLElement, title: HTMLElement): void {
    main.replaceChildren(screen)
    window.scrollTo(0, 0)
    title.focus({ preventScroll: true })
  }

  // ---------- 1. start ----------

  function radioGroup(
    legend: string,
    name: string,
    options: { value: string; label: string }[],
    current: string | null,
    onChange: (value: string) => void,
    stack: boolean,
    note?: string,
  ): HTMLFieldSetElement {
    const fs = el('fieldset', 'field')
    fs.appendChild(el('legend', 'label', legend))
    const row = el('div', stack ? 'pills stack' : 'pills')
    for (const o of options) {
      const lab = el('label', 'pill')
      const inp = el('input')
      inp.type = 'radio'
      inp.name = name
      inp.value = o.value
      inp.checked = o.value === current
      inp.addEventListener('change', () => {
        if (inp.checked) onChange(o.value)
      })
      lab.append(inp, el('span', undefined, o.label))
      row.appendChild(lab)
    }
    fs.appendChild(row)
    if (note) fs.appendChild(el('p', 'hint', note))
    return fs
  }

  function renderStart(): void {
    teardownCamera()
    chairResult = null
    balanceBest = null

    const screen = el('div', 'screen')
    const title = el('h1', 'title', 'Movement Age')
    title.tabIndex = -1
    const eyebrow = el('p', 'eyebrow', 'Sundai Hack 143, Biomarkers of Aging')
    const lead = el(
      'p',
      'lead',
      'Two quick tests, a chair stand and a one-leg stand, scored against published age tables.',
    )

    const form = el('form', 'card')
    form.noValidate = true

    const ageField = el('div', 'field')
    const ageLabel = el('label', 'label', 'Your age in years')
    ageLabel.htmlFor = 'age'
    const ageInput = el('input', 'input')
    ageInput.id = 'age'
    ageInput.type = 'number'
    ageInput.inputMode = 'numeric'
    ageInput.min = '1'
    ageInput.max = '120'
    ageInput.step = '1'
    ageInput.autocomplete = 'off'
    ageInput.value = inputs.age === null ? '' : String(inputs.age)
    ageInput.setAttribute('aria-describedby', 'age-hint')
    const ageHint = el(
      'p',
      'hint',
      'The tables cover ages 18 to 80. Outside that range you still get a result, but it cannot be placed in your own age band.',
    )
    ageHint.id = 'age-hint'
    ageField.append(ageLabel, ageInput, ageHint)

    const sexField = radioGroup(
      'Sex',
      'sex',
      [
        { value: 'female', label: 'Female' },
        { value: 'male', label: 'Male' },
      ],
      inputs.sex,
      (v) => {
        inputs.sex = v === 'male' ? 'male' : 'female'
        refresh()
      },
      false,
      'The reference tables are split by sex.',
    )

    const chairField = radioGroup(
      'Chair test',
      'chair',
      [
        { value: '5rep', label: '5 chair stands, timed (default)' },
        { value: '30s', label: '30 seconds, counted' },
      ],
      inputs.chair,
      (v) => {
        inputs.chair = v === '30s' ? '30s' : '5rep'
      },
      true,
    )

    const startBtn = el('button', 'btn', 'Start the tests')
    startBtn.type = 'submit'
    startBtn.disabled = true

    function readAge(): number | null {
      const raw = ageInput.value.trim()
      if (raw === '') return null
      const n = Number(raw)
      if (!Number.isFinite(n) || n < 1 || n > 120) return null
      return Math.floor(n)
    }
    function refresh(): void {
      inputs.age = readAge()
      startBtn.disabled = inputs.age === null || inputs.sex === null
    }
    ageInput.addEventListener('input', refresh)
    refresh()

    form.addEventListener('submit', (e) => {
      e.preventDefault()
      refresh()
      if (!startBtn.disabled) renderCamera()
    })
    form.append(ageField, sexField, chairField, startBtn)

    const notes = el('div', 'callout')
    notes.append(
      el('p', undefined, 'Stand next to a wall or a sturdy chair, and stop if you feel unsteady.'),
      el('p', undefined, 'Runs on your device. Nothing is uploaded.'),
      el('p', undefined, 'Not a medical device.'),
    )

    const links = el('ul', 'links')
    const li1 = el('li')
    li1.appendChild(link('How it works', EXPLAINER_URL, false))
    const li2 = el('li')
    li2.appendChild(link('Source code', SOURCE_URL, true))
    links.append(li1, li2)

    const howto = el('section', 'howto')
    howto.append(
      el('h2', undefined, 'What you will do'),
      diagramFigure(
        chairStandDiagram(),
        '1. Chair stands: sit with your arms crossed, stand up fully, sit back down, five times as fast as you safely can.',
      ),
      diagramFigure(
        oneLegStandDiagram(),
        `2. One-leg stand: barefoot, hands on hips, lift one foot and hold for up to ${SLS_MAX_MS / 1000} seconds.`,
      ),
    )

    screen.append(eyebrow, title, lead, howto, form, notes, links)
    show(screen, title)
  }

  // ---------- 2 to 4. camera screens ----------

  function renderCamera(): void {
    teardownCamera()
    void acquireWake()

    const c: Cam = {
      gen: 0,
      tracker: null,
      facing: 'user',
      mirror: true,
      state: 'loading',
      error: '',
      lastT: 0,
      hook: null,
    }
    cam = c
    let refreshSetup: (() => void) | null = null

    const screen = el('div', 'screen')
    const title = el('h1', 'title', 'Check your framing')
    title.tabIndex = -1

    // Stage: live video, skeleton overlay and a large readout.
    const stage = el('div', 'stage')
    const video = el('video', 'mirror')
    video.playsInline = true
    video.muted = true
    video.autoplay = true
    video.setAttribute('aria-label', 'Live camera preview')
    const canvas = el('canvas')
    canvas.width = 480
    canvas.height = 640
    canvas.setAttribute('aria-hidden', 'true')
    const ctx = canvas.getContext('2d')

    const hud = el('div', 'hud')
    hud.hidden = true
    const hudMain = el('div', 'hud-main')
    hudMain.setAttribute('aria-live', 'polite')
    hudMain.setAttribute('aria-atomic', 'true')
    const hudSub = el('div', 'hud-sub')
    const hudTime = el('div', 'hud-time')
    const hudBarRow = el('div', 'hud-bar-row')
    const hudBar = el('div', 'hud-bar')
    const hudFill = el('div', 'hud-fill')
    const hudTick = el('div', 'hud-tick')
    hudBar.append(hudFill, hudTick)
    const hudChip = el('span', 'chip marker', '10 s')
    hudBarRow.append(hudBar, hudChip)
    hudBarRow.hidden = true
    hud.append(hudMain, hudSub, hudTime, hudBarRow)
    stage.append(video, canvas, hud)

    const panel = el('div', 'panel')
    screen.append(title, stage, panel)

    interface HudSet {
      main: string
      kind: 'num' | 'word' | 'time'
      sub?: string
      time?: string
      bar?: number | null
      lit?: boolean
    }
    function setHud(o: HudSet): void {
      hud.hidden = false
      hud.dataset.kind = o.kind
      setText(hudMain, o.main)
      setText(hudSub, o.sub ?? '')
      hudSub.hidden = !o.sub
      setText(hudTime, o.time ?? '')
      hudTime.hidden = !o.time
      if (o.bar === undefined || o.bar === null) {
        hudBarRow.hidden = true
      } else {
        hudBarRow.hidden = false
        hudFill.style.transform = `scaleX(${Math.max(0, Math.min(1, o.bar))})`
        hudChip.classList.toggle('lit', o.lit === true)
      }
    }
    function hideHud(): void {
      hud.hidden = true
    }

    function onFrame(gen: number, f: Frame): void {
      if (gen !== c.gen) return
      if (c.state === 'loading') {
        c.state = 'running'
        refreshSetup?.()
      }
      c.lastT = f.t
      const vw = video.videoWidth
      const vh = video.videoHeight
      if (vw > 0 && vh > 0 && (canvas.width !== vw || canvas.height !== vh)) {
        canvas.width = vw
        canvas.height = vh
        stage.style.setProperty('--ar', String(vw / vh))
      }
      if (ctx) drawPose(ctx, f.pose, c.mirror)
      c.hook?.(f)
    }

    async function startCamera(): Promise<void> {
      c.gen += 1
      const gen = c.gen
      if (c.tracker) c.tracker.stop()
      c.tracker = null
      c.state = 'loading'
      c.error = ''
      c.mirror = c.facing === 'user'
      video.classList.toggle('mirror', c.mirror)
      refreshSetup?.()
      try {
        const { createPoseTracker } = await import('../pose/tracker')
        if (gen !== c.gen) return
        const tracker = createPoseTracker()
        c.tracker = tracker
        await tracker.start(video, (f) => onFrame(gen, f), { facingMode: c.facing })
        if (gen !== c.gen) {
          tracker.stop()
          return
        }
        c.state = 'running'
      } catch (err) {
        if (gen !== c.gen) return
        c.state = 'error'
        c.error =
          err instanceof Error && err.message
            ? err.message
            : 'The camera could not start. Allow camera access for this page, then try again.'
      }
      refreshSetup?.()
    }

    // ----- 2. setup -----

    function enterSetup(): void {
      c.hook = null
      setText(title, 'Check your framing')
      hideHud()
      const intro = el(
        'p',
        'lead',
        'Prop your phone up or lean it against something, then stand where the camera sees you from your shoulders to your ankles.',
      )
      const status = el('div', 'status')
      status.setAttribute('role', 'status')
      const statusIcon = el('span', 'status-icon')
      statusIcon.setAttribute('aria-hidden', 'true')
      const statusText = el('span')
      status.append(statusIcon, statusText)

      const begin = btn('Begin chair test', '', () => enterChair())
      begin.disabled = true
      const retry = btn('Try again', 'secondary', () => void startCamera())
      retry.hidden = true
      const flip = btn('Switch camera', 'secondary', () => {
        c.facing = c.facing === 'user' ? 'environment' : 'user'
        void startCamera()
      })
      const actions = el('div', 'actions')
      actions.append(begin, retry, flip)
      panel.replaceChildren(diagramFigure(framingDiagram()), intro, status, actions)

      let okSince: number | null = null
      let badSince: number | null = null
      let ready = false
      let framingMsg = 'Step into view'

      const update = (): void => {
        if (c.state !== 'running') {
          ready = false
          okSince = null
          badSince = null
        }
        let msg: string
        let ok = false
        if (c.state === 'loading') msg = 'Loading the pose model'
        else if (c.state === 'error') msg = c.error
        else if (ready) {
          msg = 'You are in view. Ready when you are.'
          ok = true
        } else msg = framingMsg
        setText(statusText, msg)
        status.dataset.ok = ok ? 'true' : 'false'
        status.dataset.kind = c.state
        setText(statusIcon, ok ? '✓' : c.state === 'error' ? '!' : '')
        begin.disabled = !(c.state === 'running' && ready)
        retry.hidden = c.state !== 'error'
      }
      refreshSetup = update
      update()

      c.hook = (f) => {
        const fr = checkFraming(f.pose)
        if (fr.ok) {
          badSince = null
          if (okSince === null) okSince = f.t
          if (!ready && f.t - okSince >= FRAMING_HOLD_MS) ready = true
          if (!ready) framingMsg = 'Good. Hold still for a moment'
        } else {
          okSince = null
          if (badSince === null) badSince = f.t
          if (ready && f.t - badSince >= FRAMING_GRACE_MS) ready = false
          framingMsg = fr.issues.includes('no-person')
            ? 'Step into view'
            : 'Step back until your whole body from shoulders to ankles is in view'
        }
        update()
      }
    }

    // ----- 3. chair test -----

    function enterChair(): void {
      refreshSetup = null
      c.hook = null
      setText(title, 'Chair test')
      hudMain.setAttribute('aria-live', 'polite')
      const mode = inputs.chair
      const counter = createChairCounter()
      let t0: number | null = null
      let goT = 0
      let phase: 'prep' | 'running' | 'done' = 'prep'
      let camTimes: number[] = []
      const tapTimes: number[] = []

      const instruction = el(
        'p',
        'lead',
        'Sit on a chair with your arms crossed over your chest. When the countdown ends, stand up fully and sit back down, as fast as you safely can.',
      )
      const goal = el(
        'p',
        'hint',
        mode === '5rep'
          ? 'Goal: 5 stands, as fast as you safely can.'
          : 'Goal: as many stands as you can in 30 seconds.',
      )
      const tapNote = el(
        'p',
        'hint',
        'A friend can tap the button below for each stand. Taps are counted separately from the camera.',
      )
      const tapCount = el('p', 'hint', 'Taps: 0')
      const tap = btn('Tap for each rep', 'secondary tap', () => {
        if (phase !== 'running') return
        tapTimes.push(c.lastT)
        setText(tapCount, `Taps: ${tapTimes.length}`)
        if (mode === '5rep' && tapTimes.length >= 5) finish()
      })
      tap.disabled = true
      const redo = btn('Redo', 'secondary', () => enterChair())
      const skip = btn('Skip chair test', 'ghost', () => {
        chairResult = null
        enterBalance()
      })
      const resultBox = el('div', 'result-box')
      resultBox.hidden = true
      const resultHead = el('p', 'big')
      const resultCounts = el('p', 'hint')
      const next = btn('Next: balance test', '', () => enterBalance())
      resultBox.append(resultHead, resultCounts)
      const resultActions = el('div', 'actions')
      resultActions.hidden = true
      resultActions.append(next)
      const actions = el('div', 'actions')
      actions.append(redo, skip)

      panel.replaceChildren(
        diagramFigure(chairStandDiagram()),
        instruction,
        goal,
        resultBox,
        resultActions,
        tapNote,
        tap,
        tapCount,
        actions,
      )

      function finish(): void {
        if (phase === 'done') return
        phase = 'done'
        c.hook = null
        tap.disabled = true
        const cams = camTimes.slice().sort((a, b) => a - b)
        const taps = tapTimes.slice().sort((a, b) => a - b)
        const res: ChairResult = {
          mode,
          camReps: mode === '5rep' ? Math.min(cams.length, 5) : cams.length,
          tapReps: taps.length,
          camSeconds: mode === '5rep' && cams.length >= 5 ? round1((cams[4] - goT) / 1000) : null,
          tapSeconds: mode === '5rep' && taps.length >= 5 ? round1((taps[4] - goT) / 1000) : null,
          basis: 'camera',
        }
        if (mode === '5rep') {
          if (res.camSeconds === null && res.tapSeconds !== null) res.basis = 'taps'
        } else if (res.camReps === 0 && res.tapReps > 0) {
          res.basis = 'taps'
        }
        chairResult = res
        setHud({ main: 'Done', kind: 'word', sub: chairHeadline(res) })
        setText(resultHead, chairHeadline(res))
        setText(
          resultCounts,
          `Camera counted ${plural(res.camReps, 'stand')}. Taps counted ${tapTimes.length}.`,
        )
        resultBox.hidden = false
        resultActions.hidden = false
        tapNote.hidden = true
        tap.hidden = true
        tapCount.hidden = true
        skip.hidden = true
        next.focus()
      }

      c.hook = (f) => {
        const st = counter.push(f)
        if (t0 === null) t0 = f.t
        const since = f.t - t0
        if (phase === 'prep') {
          if (since < STAND_MS) {
            setHud({ main: 'Stand in view', kind: 'word', sub: 'Then sit down' })
          } else if (since < STAND_MS + SIT_MS) {
            setHud({ main: 'Sit down', kind: 'word', sub: 'Arms crossed over your chest' })
          } else if (since < GO_AT_MS) {
            setHud({
              main: String(Math.ceil((GO_AT_MS - since) / 1000)),
              kind: 'num',
              sub: 'Get ready',
            })
          } else {
            phase = 'running'
            goT = t0 + GO_AT_MS
            tap.disabled = false
          }
        }
        if (phase === 'running') {
          const end = goT + THIRTY_MS
          camTimes = st.repTimesMs.filter((t) => t >= goT && (mode === '5rep' || t <= end))
          const reps = camTimes.length
          const runMs = f.t - goT
          const goWord = reps === 0 && runMs < 800
          if (mode === '5rep') {
            setHud({
              main: goWord ? 'Go' : String(Math.min(reps, 5)),
              kind: goWord ? 'word' : 'num',
              sub: goWord ? 'Stand up and sit down' : 'of 5 stands',
              time: `${fmt1(runMs / 1000)} s`,
            })
            if (reps >= 5) finish()
          } else {
            const left = Math.max(0, end - f.t)
            setHud({
              main: goWord ? 'Go' : String(reps),
              kind: goWord ? 'word' : 'num',
              sub: goWord ? 'Stand up and sit down' : reps === 1 ? 'stand' : 'stands',
              time: `${fmt1(left / 1000)} s left`,
            })
            if (f.t >= end) finish()
          }
        }
      }
    }

    // ----- 4. balance test -----

    function enterBalance(): void {
      refreshSetup = null
      c.hook = null
      setText(title, 'One-leg stand')
      hudMain.setAttribute('aria-live', 'off')
      const timer = createStanceTimer({ maxMs: SLS_MAX_MS })
      const maxSeconds = SLS_MAX_MS / 1000
      const attempts: BalanceAttempt[] = []
      let active = true

      const instruction = el(
        'p',
        'lead',
        `Stand barefoot next to a wall, hands on your hips, eyes open. Lift one foot and hold as long as you can, up to ${maxSeconds} seconds. You get two tries, and the best one counts.`,
      )
      const attemptLine = el('p', 'status')
      attemptLine.setAttribute('role', 'status')
      const list = el('ul', 'attempts')
      list.hidden = true
      const again = btn('Try again', 'secondary', () => startAttempt())
      const see = btn('See my result', '', () => toResult())
      const skip = btn('Skip balance test', 'ghost', () => toResult())
      const actions = el('div', 'actions')
      actions.append(again, see, skip)
      panel.replaceChildren(diagramFigure(oneLegStandDiagram()), instruction, attemptLine, list, actions)

      // The best attempt keeps its own lifted side; an earlier attempt wins a tie.
      function best(): BalanceAttempt | null {
        let top: BalanceAttempt | null = null
        for (const a of attempts) {
          if (top === null || a.heldMs > top.heldMs) top = a
        }
        return top
      }
      function toResult(): void {
        balanceBest = best()
        renderResult()
      }
      function startAttempt(): void {
        timer.reset()
        active = true
        setText(attemptLine, `Attempt ${attempts.length + 1} of ${MAX_ATTEMPTS}`)
        again.hidden = true
        see.hidden = true
        setHud({
          main: '0.0 s',
          kind: 'time',
          sub: 'Lift one foot when you are ready',
          time: `Maximum ${maxSeconds} s`,
          bar: 0,
          lit: false,
        })
      }
      function endAttempt(heldMs: number, liftedSide: 'left' | 'right' | null): void {
        active = false
        attempts.push({ heldMs, liftedSide })
        list.replaceChildren(
          ...attempts.map((a, i) =>
            el('li', undefined, `Attempt ${i + 1}: ${fmt1(a.heldMs / 1000)} s`),
          ),
        )
        list.hidden = false
        const bestMs = best()?.heldMs ?? 0
        setText(
          attemptLine,
          `Held ${fmt1(heldMs / 1000)} s. Best so far: ${fmt1(bestMs / 1000)} s.`,
        )
        again.hidden = attempts.length >= MAX_ATTEMPTS
        see.hidden = false
        see.focus()
      }

      startAttempt()
      c.hook = (f) => {
        if (!active) return
        const st = timer.push(f)
        setHud({
          main: `${fmt1(st.heldMs / 1000)} s`,
          kind: 'time',
          sub:
            st.status === 'waiting'
              ? 'Lift one foot when you are ready'
              : st.status === 'holding'
                ? 'Holding'
                : 'Done',
          time: `Maximum ${maxSeconds} s`,
          bar: st.heldMs / SLS_MAX_MS,
          lit: st.heldMs >= BALANCE_MARK_MS,
        })
        if (st.status === 'ended') endAttempt(st.heldMs, st.liftedSide)
      }
    }

    enterSetup()
    show(screen, title)
    void startCamera()
  }

  // ---------- 5. result ----------

  function renderResult(): void {
    teardownCamera()

    const screen = el('div', 'screen')
    const title = el('h1', 'title', 'Your Movement Age')
    title.tabIndex = -1
    const sources: SourceRef[] = []
    const addSource = (s: SourceRef): void => {
      if (!sources.some((x) => x.id === s.id)) sources.push(s)
    }

    const summaryParts: string[] = []

    // Leg strength row
    const leg = el('section', 'card row')
    leg.appendChild(el('h2', undefined, 'Leg strength'))
    const r = chairResult
    if (r === null) {
      leg.appendChild(el('p', undefined, 'Skipped.'))
    } else {
      leg.appendChild(el('p', 'big', chairHeadline(r)))
      if (r.tapReps > 0) {
        leg.appendChild(
          el(
            'p',
            'hint',
            `Camera counted ${plural(r.camReps, 'stand')}. Taps counted ${r.tapReps}.`,
          ),
        )
        const alt = chairAlternative(r)
        if (alt !== null) {
          const swap = btn(
            alt === 'taps' ? 'Use the tap count instead' : 'Use the camera count instead',
            'secondary',
            () => {
              r.basis = alt
              renderResult()
            },
          )
          const wrap = el('div', 'actions')
          wrap.appendChild(swap)
          leg.appendChild(wrap)
        }
      }
      const value = chairValue(r)
      if (value === null || inputs.age === null || inputs.sex === null) {
        leg.appendChild(
          el('p', undefined, 'This test was not completed, so it cannot be placed on the table.'),
        )
      } else {
        try {
          const p = placeSts(r.mode, value, inputs.sex, inputs.age)
          if (p.typicalOf.length > 0) {
            leg.appendChild(
              el('p', 'range', `Your result is typical of ages ${bandRange(p.typicalOf)}.`),
            )
            summaryParts.push(`Leg strength: typical of ages ${bandRange(p.typicalOf)}.`)
          }
          if (p.ownBand !== null && p.performance !== null) {
            leg.appendChild(
              el(
                'p',
                undefined,
                `For your age band (${p.ownBand.replace('-', ' to ')}): ${PERFORMANCE_WORDS[p.performance]}.`,
              ),
            )
          } else {
            leg.appendChild(
              el(
                'p',
                undefined,
                'Your age is outside the 18 to 80 range of the table, so this cannot be placed in your own age band.',
              ),
            )
          }
          addSource(p.source)
        } catch {
          leg.appendChild(el('p', undefined, 'This result could not be placed on the table.'))
        }
      }
    }

    // Balance row
    const bal = el('section', 'card row')
    bal.appendChild(el('h2', undefined, 'Balance'))
    const best = balanceBest
    if (best === null) {
      bal.appendChild(el('p', undefined, 'Skipped.'))
    } else {
      const s = summarizeBalance(best.heldMs)
      let placement: SlsPlacement | null = null
      if (inputs.age !== null) {
        try {
          placement = placeSls(best.heldMs, best.liftedSide, inputs.age)
        } catch {
          placement = null
        }
      }
      const legWords =
        placement === null || placement.stanceLeg === 'either'
          ? ''
          : `, standing on your ${placement.stanceLeg} leg`
      bal.appendChild(el('p', 'big', `Held ${fmt1(s.heldSeconds)} s${legWords}`))
      if (placement === null) {
        bal.appendChild(el('p', undefined, 'This result could not be placed on the table.'))
      } else {
        if (placement.capped) {
          bal.appendChild(
            el(
              'p',
              undefined,
              `You held the full ${SLS_MAX_MS / 1000} seconds, the test maximum.`,
            ),
          )
        }
        if (placement.aboveAllBands) {
          bal.appendChild(
            el(
              'p',
              'range',
              'That is above the average range of every age band, including 18 to 29.',
            ),
          )
          summaryParts.push('Balance: above every age band.')
        } else if (placement.matchesAverageOf.length > 0) {
          const range = slsBandRange(placement.matchesAverageOf)
          bal.appendChild(
            el('p', 'range', `Your hold matches the average for ages ${range}.`),
          )
          summaryParts.push(`Balance: matches ages ${range}.`)
        }
        if (placement.ownBand !== null && placement.performance !== null) {
          bal.appendChild(
            el(
              'p',
              undefined,
              `For your age band (${slsBandLabel(placement.ownBand)}): ${PERFORMANCE_WORDS[placement.performance]}.`,
            ),
          )
        } else {
          bal.appendChild(
            el(
              'p',
              undefined,
              'The balance table starts at age 18, so this cannot be placed in your own age band.',
            ),
          )
        }
        addSource(placement.source)
      }
      const chip = el('span', s.passedTenSeconds ? 'chip pass' : 'chip fail')
      const glyph = el('span', undefined, s.passedTenSeconds ? '✓' : '✕')
      glyph.setAttribute('aria-hidden', 'true')
      chip.append(glyph, document.createTextNode(s.passedTenSeconds ? 'Passed 10 seconds' : 'Not passed 10 seconds'))
      const chipRow = el('p')
      chipRow.appendChild(chip)
      bal.appendChild(chipRow)
      bal.appendChild(el('p', undefined, s.context))
      addSource(s.source)
    }

    screen.appendChild(title)
    if (summaryParts.length > 0) {
      screen.appendChild(el('p', 'lead summary', summaryParts.join(' ')))
    }
    screen.append(leg, bal)

    if (r === null && best === null) {
      screen.appendChild(el('p', undefined, 'You skipped both tests, so there is nothing to place yet.'))
    }

    if (sources.length > 0) {
      const src = el('section', 'card')
      src.appendChild(el('h2', undefined, 'Sources'))
      const ul = el('ul', 'src')
      for (const s of sources) {
        const li = el('li')
        li.append(
          el('p', undefined, s.citation),
          el('p', 'small', s.note),
          link(s.url, s.url, true),
        )
        ul.appendChild(li)
      }
      src.appendChild(ul)
      screen.appendChild(src)
    }

    screen.appendChild(
      el('p', 'disclaimer', 'An estimate from published reference data. Not a medical device, not a diagnosis.'),
    )

    const actions = el('div', 'actions')
    actions.append(
      btn('Do it again', '', () => renderStart()),
      link('How it works', EXPLAINER_URL, false, 'btn secondary'),
    )
    screen.appendChild(actions)

    show(screen, title)
  }

  renderStart()
}
