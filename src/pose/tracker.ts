import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision'
import type { CreatePoseTracker, Frame, Landmark, Pose } from '../contracts'
import { POSE_MODEL_URL, WASM_BASE_URL } from '../contracts'

const MSG_INSECURE = 'The camera only works on a secure page. Open the https link, then try again.'
const MSG_UNSUPPORTED = 'This browser cannot open the camera. Try a current version of Safari, Chrome or Firefox.'
const MSG_DENIED = 'Camera access was blocked. Allow camera access in your browser settings, then try again.'
const MSG_NO_CAMERA = 'No camera found. Connect a camera, then try again.'
const MSG_BUSY = 'The camera is busy in another app. Close that app, then try again.'
const MSG_CAMERA_OTHER = 'The camera could not start. Close other apps that use it, reload the page, then try again.'
const MSG_MODEL = 'The pose model could not load. Check your connection and try again.'

function errorName(err: unknown): string {
  if (typeof err === 'object' && err !== null && 'name' in err) return String((err as { name: unknown }).name)
  return ''
}

function cameraError(err: unknown): Error {
  switch (errorName(err)) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return new Error(MSG_DENIED)
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return new Error(MSG_NO_CAMERA)
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return new Error(MSG_BUSY)
    default:
      return new Error(MSG_CAMERA_OTHER)
  }
}

async function createLandmarker(): Promise<PoseLandmarker> {
  try {
    const fileset = await FilesetResolver.forVisionTasks(WASM_BASE_URL)
    const make = (delegate: 'GPU' | 'CPU') =>
      PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: POSE_MODEL_URL, delegate },
        runningMode: 'VIDEO',
        numPoses: 1,
      })
    try {
      return await make('GPU')
    } catch {
      return await make('CPU')
    }
  } catch {
    throw new Error(MSG_MODEL)
  }
}

function toPose(landmarks: ReadonlyArray<Landmark> | undefined): Pose {
  if (!landmarks || landmarks.length === 0) return null
  return landmarks.map((l) => ({ x: l.x, y: l.y, z: l.z, visibility: l.visibility }))
}

export const createPoseTracker: CreatePoseTracker = () => {
  let generation = 0
  let rafId: number | null = null
  let stream: MediaStream | null = null
  let landmarker: PoseLandmarker | null = null
  let videoEl: HTMLVideoElement | null = null

  function release(): void {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    if (stream) {
      for (const track of stream.getTracks()) track.stop()
      stream = null
    }
    if (videoEl) {
      try {
        videoEl.pause()
        videoEl.srcObject = null
      } catch {
        // the element may already be detached
      }
      videoEl = null
    }
    if (landmarker) {
      try {
        landmarker.close()
      } catch {
        // already closed
      }
      landmarker = null
    }
  }

  function stop(): void {
    generation++
    release()
  }

  async function start(
    video: HTMLVideoElement,
    onFrame: (frame: Frame) => void,
    opts?: { facingMode?: 'user' | 'environment' },
  ): Promise<void> {
    stop()
    const mine = generation
    const cancelled = () => mine !== generation

    if (typeof window !== 'undefined' && window.isSecureContext === false) throw new Error(MSG_INSECURE)
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error(MSG_UNSUPPORTED)
    }

    // Load the model while the person answers the camera prompt.
    const modelPromise = createLandmarker()
    modelPromise.catch(() => undefined)
    const discardModel = () => {
      modelPromise.then((l) => l.close()).catch(() => undefined)
    }

    let media: MediaStream
    try {
      media = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: opts?.facingMode ?? 'user' },
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      })
    } catch (err) {
      discardModel()
      throw cameraError(err)
    }
    if (cancelled()) {
      for (const track of media.getTracks()) track.stop()
      discardModel()
      return
    }
    stream = media
    videoEl = video

    let model: PoseLandmarker
    try {
      model = await modelPromise
    } catch (err) {
      if (!cancelled()) release()
      throw err
    }
    if (cancelled()) {
      model.close()
      return
    }
    landmarker = model

    try {
      video.playsInline = true
      video.muted = true
      video.setAttribute('playsinline', '')
      video.srcObject = media
      await video.play()
    } catch (err) {
      if (!cancelled()) release()
      if (cancelled()) return
      throw cameraError(err)
    }
    if (cancelled()) return

    let lastVideoTime = -1
    let lastTimestamp = 0
    const tick = () => {
      if (cancelled() || !landmarker) return
      rafId = requestAnimationFrame(tick)
      if (video.readyState < 2 || video.videoWidth === 0 || video.currentTime === lastVideoTime) return
      lastVideoTime = video.currentTime

      let timestamp = performance.now()
      if (timestamp <= lastTimestamp) timestamp = lastTimestamp + 1
      lastTimestamp = timestamp

      let pose: Pose
      try {
        pose = toPose(landmarker.detectForVideo(video, timestamp).landmarks[0])
      } catch {
        return
      }
      onFrame({ t: timestamp, pose })
    }
    rafId = requestAnimationFrame(tick)
  }

  return { start, stop }
}
