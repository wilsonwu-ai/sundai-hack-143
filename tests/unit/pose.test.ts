import { describe, expect, it } from 'vitest'
import type { Frame } from '../../src/contracts'
import { LM } from '../../src/contracts'
import { createChairCounter } from '../../src/pose/chair'
import { checkFraming } from '../../src/pose/framing'
import { createStanceTimer } from '../../src/pose/stance'
import { chairSequence, stanceSequence, standingPose, standingSequence } from '../fixtures/synthPose'

function run<T>(frames: Frame[], m: { push(frame: Frame): T }): T {
  let state: T | undefined
  for (const f of frames) state = m.push(f)
  return state as T
}

describe('chair counter on synthetic sequences', () => {
  for (const view of ['side', 'front'] as const) {
    it(`counts 5 clean reps seen from the ${view}`, () => {
      const s = run(chairSequence({ reps: 5, view }), createChairCounter())
      expect(s.reps).toBe(5)
      expect(s.repTimesMs).toHaveLength(5)
      expect(s.phase).toBe('sitting')
    })

    it(`counts 10 noisy reps with dropped frames from the ${view}, within one`, () => {
      const s = run(chairSequence({ reps: 10, view, noise: 0.01, dropRate: 0.1, seed: 7 }), createChairCounter())
      expect(Math.abs(s.reps - 10)).toBeLessThanOrEqual(1)
    })

    it(`does not count half rises seen from the ${view}`, () => {
      expect(run(chairSequence({ reps: 4, view, peak: 0.5 }), createChairCounter()).reps).toBe(0)
    })
  }

  it('counts the same farther from the camera', () => {
    expect(run(chairSequence({ reps: 6, view: 'front', scale: 0.6 }), createChairCounter()).reps).toBe(6)
  })

  it('counts fast reps at 15 frames per second', () => {
    expect(run(chairSequence({ reps: 5, view: 'side', fps: 15, secondsPerRep: 1.4 }), createChairCounter()).reps).toBe(5)
  })

  it('counts nothing while the person stands still', () => {
    expect(run(standingSequence(5000), createChairCounter()).reps).toBe(0)
  })

  it('reset clears the count', () => {
    const counter = createChairCounter()
    run(chairSequence({ reps: 3, view: 'side' }), counter)
    counter.reset()
    expect(counter.push({ t: 0, pose: null }).reps).toBe(0)
  })
})

describe('stance timer on synthetic sequences', () => {
  it('times a 12-second hold on the left foot', () => {
    const s = run(stanceSequence({ holdMs: 12000, side: 'left' }), createStanceTimer())
    expect(s.status).toBe('ended')
    expect(s.liftedSide).toBe('left')
    expect(Math.abs(s.heldMs - 12000)).toBeLessThanOrEqual(100)
  })

  it('times a noisy 8-second hold on the right foot', () => {
    const s = run(stanceSequence({ holdMs: 8000, side: 'right', noise: 0.004 }), createStanceTimer())
    expect(s.status).toBe('ended')
    expect(s.liftedSide).toBe('right')
    expect(Math.abs(s.heldMs - 8000)).toBeLessThanOrEqual(150)
  })

  it('ignores a lift shorter than 300 ms', () => {
    const s = run(stanceSequence({ holdMs: 0, side: 'left', blipMs: 150 }), createStanceTimer())
    expect(s.status).toBe('waiting')
    expect(s.heldMs).toBe(0)
  })

  it('stops at maxMs', () => {
    const s = run(stanceSequence({ holdMs: 40000, side: 'right' }), createStanceTimer({ maxMs: 30000 }))
    expect(s.status).toBe('ended')
    expect(s.heldMs).toBe(30000)
  })
})

describe('framing check', () => {
  it('passes a full standing pose', () => {
    expect(checkFraming(standingPose())).toEqual({ ok: true, issues: [] })
  })

  it('reports no person', () => {
    expect(checkFraming(null)).toEqual({ ok: false, issues: ['no-person'] })
  })

  it('reports hidden ankles', () => {
    const pose = standingPose()
    pose[LM.leftAnkle] = { ...pose[LM.leftAnkle], visibility: 0.1 }
    expect(checkFraming(pose)).toEqual({ ok: false, issues: ['ankles'] })
  })
})
