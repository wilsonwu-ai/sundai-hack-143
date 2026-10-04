import type { CheckFraming, FramingIssue, Landmark } from '../contracts'
import { LM } from '../contracts'

const MIN_VISIBILITY = 0.5

function seen(l: Landmark | undefined): boolean {
  return l !== undefined && (l.visibility ?? 1) >= MIN_VISIBILITY
}

const GROUPS: ReadonlyArray<readonly [FramingIssue, number, number]> = [
  ['hips', LM.leftHip, LM.rightHip],
  ['knees', LM.leftKnee, LM.rightKnee],
  ['ankles', LM.leftAnkle, LM.rightAnkle],
]

export const checkFraming: CheckFraming = (pose) => {
  if (!pose || pose.length === 0) return { ok: false, issues: ['no-person'] }
  const issues: FramingIssue[] = []
  for (const [issue, left, right] of GROUPS) {
    if (!seen(pose[left]) || !seen(pose[right])) issues.push(issue)
  }
  return { ok: issues.length === 0, issues }
}
