import type { ChairPhase, CreateChairCounter, Landmark, Pose } from '../contracts'
import { LM } from '../contracts'

// The signal is the height of the hips above the ankles divided by the
// shoulder-to-hip torso length. Both lengths are measured in the image, so the
// ratio does not change with distance. Sitting lowers the hips a lot whether the
// camera is at the side or in front (the thigh foreshortens from the front, but
// the hips still drop), and the torso stays about the same length. The ratio is
// compared with the person's own first standing posture, so body proportions
// and camera height cancel out.

const MIN_VISIBILITY = 0.5
/** Valid samples used to learn the standing reference. */
const CALIBRATION_SAMPLES = 8
/** Fraction of the standing reference at or above which the person counts as standing. */
const STAND_FRACTION = 0.9
/** Fraction of the standing reference at or below which the person counts as sitting. */
const SIT_FRACTION = 0.72
/** Far above any standing posture: the reference was taken while seated, so learn it again. */
const IMPLAUSIBLE_FRACTION = 1.4
/** Standing readings in this band slowly refine the reference. */
const ADAPT_MIN_FRACTION = 0.95
const ADAPT_MAX_FRACTION = 1.3
const ADAPT_RATE = 0.02
const MIN_TORSO = 0.02

function seen(l: Landmark | undefined): l is Landmark {
  return l !== undefined && (l.visibility ?? 1) >= MIN_VISIBILITY
}

const SIDES = [
  [LM.leftShoulder, LM.leftHip, LM.leftAnkle],
  [LM.rightShoulder, LM.rightHip, LM.rightAnkle],
] as const

/** Hip height above the ankles over torso length, or null when no side is fully visible. */
function signal(pose: Pose): number | null {
  if (!pose) return null
  let rise = 0
  let torso = 0
  let n = 0
  for (const [s, h, a] of SIDES) {
    const shoulder = pose[s]
    const hip = pose[h]
    const ankle = pose[a]
    if (!seen(shoulder) || !seen(hip) || !seen(ankle)) continue
    rise += ankle.y - hip.y
    torso += Math.hypot(shoulder.x - hip.x, shoulder.y - hip.y)
    n++
  }
  if (n === 0) return null
  rise /= n
  torso /= n
  if (torso < MIN_TORSO) return null
  return rise / torso
}

function median3(values: number[]): number {
  const v = [...values].sort((a, b) => a - b)
  return v[Math.floor(v.length / 2)]
}

export const createChairCounter: CreateChairCounter = () => {
  let phase: ChairPhase = 'unknown'
  let reps = 0
  let repTimesMs: number[] = []
  let reference: number | null = null
  let calibration: number[] = []
  let recent: number[] = []

  const snapshot = () => ({ phase, reps, repTimesMs: [...repTimesMs] })

  return {
    push(frame) {
      const raw = signal(frame.pose)
      if (raw === null) return snapshot()

      recent.push(raw)
      if (recent.length > 3) recent.shift()
      const smooth = median3(recent)

      if (reference === null) {
        calibration.push(raw)
        if (calibration.length < CALIBRATION_SAMPLES) return snapshot()
        // A little above the median, so a person who starts to sit during the
        // window does not drag the standing reference down.
        const sorted = [...calibration].sort((a, b) => a - b)
        const ref = sorted[Math.floor(sorted.length * 0.6)]
        calibration = []
        if (!(ref > 0)) return snapshot()
        reference = ref
      }

      let fraction = smooth / reference
      if (fraction > IMPLAUSIBLE_FRACTION) {
        // The person was seated when the reference was learned and has now stood up.
        reference = smooth
        fraction = 1
        phase = 'standing'
      } else if (phase !== 'standing' && fraction >= STAND_FRACTION) {
        if (phase === 'sitting') {
          reps++
          repTimesMs.push(frame.t)
        }
        phase = 'standing'
      } else if (phase !== 'sitting' && fraction <= SIT_FRACTION) {
        phase = 'sitting'
      }

      if (phase === 'standing' && fraction >= ADAPT_MIN_FRACTION && fraction <= ADAPT_MAX_FRACTION) {
        reference += ADAPT_RATE * (smooth - reference)
      }
      return snapshot()
    },

    reset() {
      phase = 'unknown'
      reps = 0
      repTimesMs = []
      reference = null
      calibration = []
      recent = []
    },
  }
}
