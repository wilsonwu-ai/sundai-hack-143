import type { CreateStanceTimer, Landmark, Pose, StanceState } from '../contracts'
import { LM } from '../contracts'

const MIN_VISIBILITY = 0.5
/** A lift must last this long to start a hold, and the foot must stay down this long to end it. */
const CONFIRM_MS = 300
/** An ankle this many torso lengths above the other counts as lifted. */
const LIFT_ON = 0.15
/** Once a hold has started, the foot counts as still lifted until the gap falls below this. */
const LIFT_OFF = 0.08
const MIN_TORSO = 0.02
const DEFAULT_MAX_MS = 30000

function seen(l: Landmark | undefined): l is Landmark {
  return l !== undefined && (l.visibility ?? 1) >= MIN_VISIBILITY
}

/**
 * How far the left ankle is above the right, in torso lengths (negative when the
 * right ankle is higher). Null when the ankles or the torso cannot be measured.
 */
function leftLift(pose: Pose): number | null {
  if (!pose) return null
  const la = pose[LM.leftAnkle]
  const ra = pose[LM.rightAnkle]
  if (!seen(la) || !seen(ra)) return null
  let torso = 0
  let n = 0
  for (const [s, h] of [
    [LM.leftShoulder, LM.leftHip],
    [LM.rightShoulder, LM.rightHip],
  ] as const) {
    const shoulder = pose[s]
    const hip = pose[h]
    if (!seen(shoulder) || !seen(hip)) continue
    torso += Math.hypot(shoulder.x - hip.x, shoulder.y - hip.y)
    n++
  }
  if (n === 0) return null
  torso /= n
  if (torso < MIN_TORSO) return null
  // y grows downward, so a higher ankle has the smaller y.
  return (ra.y - la.y) / torso
}

export const createStanceTimer: CreateStanceTimer = (opts) => {
  const maxMs = opts?.maxMs ?? DEFAULT_MAX_MS

  let status: StanceState['status'] = 'waiting'
  let heldMs = 0
  let liftedSide: StanceState['liftedSide'] = null
  let candidateSide: 'left' | 'right' | null = null
  let candidateStart = 0
  let startT = 0
  let downStart: number | null = null

  const snapshot = (): StanceState => ({ status, heldMs, liftedSide })

  return {
    push(frame) {
      if (status === 'ended') return snapshot()
      const lift = leftLift(frame.pose)
      if (lift === null) return snapshot()
      const t = frame.t

      if (status === 'waiting') {
        const side = lift >= LIFT_ON ? 'left' : -lift >= LIFT_ON ? 'right' : null
        if (side === null) {
          candidateSide = null
        } else {
          if (candidateSide !== side) {
            candidateSide = side
            candidateStart = t
          }
          if (t - candidateStart >= CONFIRM_MS) {
            status = 'holding'
            liftedSide = side
            startT = candidateStart
            downStart = null
          }
        }
      }

      if (status === 'holding') {
        const raised = liftedSide === 'left' ? lift : -lift
        if (raised >= LIFT_OFF) downStart = null
        else if (downStart === null) downStart = t

        const held = (downStart ?? t) - startT
        if (held >= maxMs) {
          status = 'ended'
          heldMs = maxMs
        } else if (downStart !== null && t - downStart >= CONFIRM_MS) {
          status = 'ended'
          heldMs = Math.max(0, held)
        } else {
          heldMs = Math.max(0, held)
        }
      }
      return snapshot()
    },

    reset() {
      status = 'waiting'
      heldMs = 0
      liftedSide = null
      candidateSide = null
      candidateStart = 0
      startT = 0
      downStart = null
    },
  }
}
