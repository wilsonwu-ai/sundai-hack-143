// Synthetic pose sequences for the pose-module tests. These check the logic
// against a simple body model; they are not a real-world anchor. The live test
// on a phone is what anchors the app to real people.
//
// Body model: shins stay vertical and each thigh pitches from vertical
// (standing) to horizontal (seated). From the side, a seated thigh points
// sideways. From the front it points at the camera and foreshortens to almost
// nothing, so a knee angle measured in the image stays near 180 degrees and
// only the drop of the hips gives the movement away. Noise is seeded, so every
// sequence is deterministic.
import type { Frame, Landmark } from '../../src/contracts'
import { LM } from '../../src/contracts'

const SHIN = 0.2
const THIGH = 0.2
const TORSO = 0.24
const HALF_HIP = 0.05
const ANKLE_Y = 0.9

export type View = 'side' | 'front'

function makeRng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

interface Body {
  /** 0 = thighs vertical (standing), 1 = thighs horizontal (seated) */
  pitch: number
  /** ankle lift as a fraction of shin length */
  liftLeft?: number
  liftRight?: number
}

function bodyPose(body: Body, view: View, scale: number, jitter: () => number): Landmark[] {
  const pose: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.2, z: 0, visibility: 0.9 }))
  const phi = (body.pitch * Math.PI) / 2
  const set = (i: number, x: number, y: number) => {
    pose[i] = { x: x + jitter(), y: y + jitter(), z: 0, visibility: 0.95 }
  }
  for (const side of ['left', 'right'] as const) {
    const sign = side === 'left' ? 1 : -1
    const dx = view === 'front' ? sign * HALF_HIP * scale : sign * 0.004
    const lift = (side === 'left' ? body.liftLeft ?? 0 : body.liftRight ?? 0) * SHIN * scale
    const x = 0.5 + dx
    const kneeY = ANKLE_Y - SHIN * scale
    const hipX = x - (view === 'side' ? THIGH * scale * Math.sin(phi) : 0)
    const hipY = kneeY - THIGH * scale * Math.cos(phi)
    set(side === 'left' ? LM.leftAnkle : LM.rightAnkle, x, ANKLE_Y - lift)
    set(side === 'left' ? LM.leftKnee : LM.rightKnee, x, kneeY - lift / 2)
    set(side === 'left' ? LM.leftHip : LM.rightHip, hipX, hipY)
    set(side === 'left' ? LM.leftShoulder : LM.rightShoulder, hipX + dx * 0.4, hipY - TORSO * scale)
  }
  return pose
}

function noiseFn(rand: () => number, noise: number): () => number {
  return () => (rand() - 0.5) * 2 * noise
}

export interface ChairOptions {
  reps: number
  view: View
  fps?: number
  secondsPerRep?: number
  /** how far the thighs reach toward vertical on each rise: 1 = full stand */
  peak?: number
  noise?: number
  dropRate?: number
  seed?: number
  scale?: number
}

/**
 * Stands in frame for 1 s, sits down over 0.8 s, stays seated 1 s, then rises
 * and sits reps times (rise 40%, stand 10%, sit 40%, rest 10% of each rep), then
 * stays seated 1 s.
 */
export function chairSequence(o: ChairOptions): Frame[] {
  const fps = o.fps ?? 30
  const T = (o.secondsPerRep ?? 2) * 1000
  const peak = o.peak ?? 1
  const scale = o.scale ?? 1
  const rand = makeRng(o.seed ?? 1)
  const jitter = noiseFn(rand, o.noise ?? 0)
  const repsStart = 2800
  const end = repsStart + o.reps * T + 1000
  const frames: Frame[] = []
  for (let i = 0; (i * 1000) / fps <= end; i++) {
    const t = (i * 1000) / fps
    let pitch: number
    if (t < 1000) pitch = 0
    else if (t < 1800) pitch = (1 - Math.cos((Math.PI * (t - 1000)) / 800)) / 2
    else if (t < repsStart || t >= repsStart + o.reps * T) pitch = 1
    else {
      const u = ((t - repsStart) % T) / T
      const up = u < 0.4 ? u / 0.4 : u < 0.5 ? 1 : u < 0.9 ? 1 - (u - 0.5) / 0.4 : 0
      pitch = 1 - peak * ((1 - Math.cos(Math.PI * up)) / 2)
    }
    const dropped = rand() < (o.dropRate ?? 0)
    frames.push({ t, pose: dropped ? null : bodyPose({ pitch }, o.view, scale, jitter) })
  }
  return frames
}

/** Standing still, facing the camera, for ms milliseconds. */
export function standingSequence(ms: number, noise = 0.005, seed = 3): Frame[] {
  const rand = makeRng(seed)
  const jitter = noiseFn(rand, noise)
  const frames: Frame[] = []
  for (let i = 0; (i * 1000) / 30 <= ms; i++) frames.push({ t: (i * 1000) / 30, pose: bodyPose({ pitch: 0 }, 'front', 1, jitter) })
  return frames
}

export interface StanceOptions {
  holdMs: number
  side: 'left' | 'right'
  fps?: number
  /** lift height as a fraction of shin length (default 0.35) */
  lift?: number
  /** also lift the same foot for this long at 500 ms, before the real hold */
  blipMs?: number
  noise?: number
  seed?: number
  scale?: number
}

/** Stands facing the camera, lifts one foot at 1000 ms for holdMs, puts it down, and stands for 1 s more. */
export function stanceSequence(o: StanceOptions): Frame[] {
  const fps = o.fps ?? 30
  const lift = o.lift ?? 0.35
  const rand = makeRng(o.seed ?? 5)
  const jitter = noiseFn(rand, o.noise ?? 0)
  const end = 1000 + o.holdMs + 1000
  const frames: Frame[] = []
  for (let i = 0; (i * 1000) / fps <= end; i++) {
    const t = (i * 1000) / fps
    const inBlip = o.blipMs !== undefined && t >= 500 && t < 500 + o.blipMs
    const inHold = o.holdMs > 0 && t >= 1000 && t < 1000 + o.holdMs
    const up = inBlip || inHold ? lift : 0
    const body: Body = o.side === 'left' ? { pitch: 0, liftLeft: up } : { pitch: 0, liftRight: up }
    frames.push({ t, pose: bodyPose(body, 'front', o.scale ?? 1, jitter) })
  }
  return frames
}

/** One clean standing pose, facing the camera. */
export function standingPose(): Landmark[] {
  return bodyPose({ pitch: 0 }, 'front', 1, () => 0)
}
