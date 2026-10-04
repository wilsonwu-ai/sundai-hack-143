import type { DrawPose, Landmark } from '../contracts'
import { LM } from '../contracts'

const MIN_VISIBILITY = 0.5
const FALLBACK_COLOUR = '#4fc9bd'

const BONES: ReadonlyArray<readonly [number, number]> = [
  [LM.leftShoulder, LM.rightShoulder],
  [LM.leftHip, LM.rightHip],
  [LM.leftShoulder, LM.leftHip],
  [LM.rightShoulder, LM.rightHip],
  [LM.leftHip, LM.leftKnee],
  [LM.leftKnee, LM.leftAnkle],
  [LM.rightHip, LM.rightKnee],
  [LM.rightKnee, LM.rightAnkle],
]

const JOINTS: readonly number[] = [
  LM.leftShoulder,
  LM.rightShoulder,
  LM.leftHip,
  LM.rightHip,
  LM.leftKnee,
  LM.rightKnee,
  LM.leftAnkle,
  LM.rightAnkle,
]

function seen(l: Landmark | undefined): l is Landmark {
  return l !== undefined && (l.visibility ?? 1) >= MIN_VISIBILITY
}

function colourFor(canvas: HTMLCanvasElement): string {
  try {
    const value = getComputedStyle(canvas).getPropertyValue('--pose').trim()
    return value || FALLBACK_COLOUR
  } catch {
    return FALLBACK_COLOUR
  }
}

export const drawPose: DrawPose = (ctx, pose, mirror) => {
  const w = ctx.canvas.width
  const h = ctx.canvas.height
  ctx.clearRect(0, 0, w, h)
  if (!pose) return

  const px = (l: Landmark) => (mirror ? 1 - l.x : l.x) * w
  const py = (l: Landmark) => l.y * h

  const colour = colourFor(ctx.canvas)
  const unit = Math.min(w, h)

  ctx.save()
  ctx.strokeStyle = colour
  ctx.fillStyle = colour
  ctx.lineWidth = Math.max(2, unit * 0.008)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  ctx.beginPath()
  for (const [a, b] of BONES) {
    const la = pose[a]
    const lb = pose[b]
    if (!seen(la) || !seen(lb)) continue
    ctx.moveTo(px(la), py(la))
    ctx.lineTo(px(lb), py(lb))
  }
  ctx.stroke()

  const radius = Math.max(3, unit * 0.014)
  for (const i of JOINTS) {
    const l = pose[i]
    if (!seen(l)) continue
    ctx.beginPath()
    ctx.arc(px(l), py(l), radius, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}
