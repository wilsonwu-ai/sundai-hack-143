// Shared contract for the Movement Age app. Builders implement against these
// signatures and may not change them; only the main session edits this file.
//
// File layout, one export per file, so unit tests never load MediaPipe:
//   src/pose/framing.ts  -> export const checkFraming: CheckFraming
//   src/pose/chair.ts    -> export const createChairCounter: CreateChairCounter
//   src/pose/stance.ts   -> export const createStanceTimer: CreateStanceTimer
//   src/pose/tracker.ts  -> export const createPoseTracker: CreatePoseTracker
//   src/pose/draw.ts     -> export const drawPose: DrawPose
//   src/norms/sts.ts     -> export const placeSts: PlaceSts
//   src/norms/balance.ts -> export const summarizeBalance: SummarizeBalance
//   src/ui/app.ts        -> export const mountApp: MountApp

/** A MediaPipe pose landmark: x and y normalised to [0, 1] of the image, y growing downward. */
export interface Landmark {
  x: number
  y: number
  z: number
  visibility?: number
}

/** 33 landmarks in BlazePose order, or null when no person was found in the frame. */
export type Pose = Landmark[] | null

/** One processed video frame. t is a monotonic timestamp in milliseconds. */
export interface Frame {
  t: number
  pose: Pose
}

/** BlazePose indices this app reads. */
export const LM = {
  leftShoulder: 11,
  rightShoulder: 12,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
} as const

// Besides Google Fonts in index.html, these are the only network fetches the app
// makes. Camera frames, landmarks and ages never leave the device.
export const TASKS_VISION_VERSION = '1.0.1'
export const WASM_BASE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VISION_VERSION}/wasm`
export const POSE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'

// ---------- pose: src/pose/ ----------

export type FramingIssue = 'no-person' | 'hips' | 'knees' | 'ankles'
export interface Framing {
  ok: boolean
  issues: FramingIssue[]
}
/** ok only when both hips, both knees and both ankles have visibility >= 0.5. issues lists every failing group in the order hips, knees, ankles; a null pose gives exactly ['no-person']. */
export type CheckFraming = (pose: Pose) => Framing

export type ChairPhase = 'unknown' | 'sitting' | 'standing'
export interface ChairState {
  phase: ChairPhase
  /** Completed repetitions. A rep completes each time the person reaches full standing after having been seated. */
  reps: number
  /** Frame timestamp (ms) at which each rep completed. */
  repTimesMs: number[]
}
export interface ChairCounter {
  push(frame: Frame): ChairState
  reset(): void
}
/**
 * Must count correctly whether the camera sees the person from the side or from
 * the front, at any distance that keeps shoulders to ankles in frame. The person
 * stands in frame first (that is when the app checks framing) and then sits down,
 * so a counter may use that first standing posture as its reference. Frames with
 * a null pose are skipped. Half rises that never reach full standing do not count.
 */
export type CreateChairCounter = () => ChairCounter

export interface StanceState {
  status: 'waiting' | 'holding' | 'ended'
  /** Duration of the current or final hold, in ms; 0 while waiting; never above maxMs. */
  heldMs: number
  liftedSide: 'left' | 'right' | null
}
export interface StanceTimer {
  push(frame: Frame): StanceState
  reset(): void
}
/**
 * A hold starts once one ankle has stayed clearly lifted for 300 ms, and heldMs
 * counts from the first frame of that lift. It ends when that foot has been back
 * down for 300 ms (heldMs stops at the first frame it was down), or when heldMs
 * reaches maxMs (default 30000; heldMs is then exactly maxMs). After ended, the
 * state stays ended until reset. Lifts shorter than 300 ms are ignored.
 */
export type CreateStanceTimer = (opts?: { maxMs?: number }) => StanceTimer

export interface PoseTracker {
  /** Opens the camera into video and calls onFrame for each processed frame until stop(). Rejects with an Error whose message tells the person what to do. */
  start(
    video: HTMLVideoElement,
    onFrame: (frame: Frame) => void,
    opts?: { facingMode?: 'user' | 'environment' },
  ): Promise<void>
  stop(): void
}
export type CreatePoseTracker = () => PoseTracker

/** Clears the canvas and draws the skeleton for pose across it; mirror flips it horizontally. */
export type DrawPose = (ctx: CanvasRenderingContext2D, pose: Pose, mirror: boolean) => void

// ---------- norms: src/norms/ ----------

export type Sex = 'female' | 'male'
export type StsTest = '30s' | '1min' | '5rep'
export type AgeBand = '18-29' | '30-39' | '40-49' | '50-59' | '60-69' | '70-80'
/** Where a raw value v falls in the table: v < p2.5, p2.5 <= v < p25, p25 <= v < p50, p50 <= v < p75, p75 <= v <= p97.5, v > p97.5. */
export type TableRange = '<p2.5' | 'p2.5-p25' | 'p25-p50' | 'p50-p75' | 'p75-p97.5' | '>p97.5'
/**
 * Performance against people of the same sex and age band. For reps, the ranges
 * <p2.5, p2.5-p25, p25-p50 and p50-p75, p75-p97.5, >p97.5 map to well-below,
 * below, typical, above, well-above. For 5rep seconds (fewer is better) the
 * mapping is reversed: <p2.5 is well-above and >p97.5 is well-below.
 */
export type Performance = 'well-below' | 'below' | 'typical' | 'above' | 'well-above'

export interface SourceRef {
  id: string
  citation: string
  url: string
  note: string
}

export interface StsPlacement {
  test: StsTest
  /** reps for 30s and 1min, seconds for 5rep */
  value: number
  sex: Sex
  age: number
  /** 18 <= age < 30 is '18-29', 30 <= age < 40 is '30-39', ..., 70 <= age <= 80 is '70-80'; null outside 18 to 80. */
  ownBand: AgeBand | null
  /** null when ownBand is null */
  tableRange: TableRange | null
  /** null when ownBand is null */
  performance: Performance | null
  /** The age band(s) whose median (p50) for this sex is closest to value. Ties return every tied band, youngest first. */
  typicalOf: AgeBand[]
  source: SourceRef
}
/** Places a sit-to-stand result on the F23 reference table in src/data/sts-norms.json. */
export type PlaceSts = (test: StsTest, value: number, sex: Sex, age: number) => StsPlacement

export interface BalanceSummary {
  /** heldMs / 1000, rounded to one decimal */
  heldSeconds: number
  /** heldMs >= 10000 */
  passedTenSeconds: boolean
  /** One plain sentence stating the F21 finding with its 51 to 75 age scope. */
  context: string
  source: SourceRef
}
export type SummarizeBalance = (heldMs: number) => BalanceSummary

// ---------- ui: src/ui/ ----------

/** Mounts the whole app into root and wires the modules above. */
export type MountApp = (root: HTMLElement) => void
