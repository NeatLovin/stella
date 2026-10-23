import { describe, expect, it } from 'vitest'
import { drawFromBag, markSeen } from './bag'

const ids = ['a', 'b', 'c', 'd', 'e']

function drawMany(n: number, start: string[] = [], random = Math.random) {
  let seen = start
  let last: string | null = start.at(-1) ?? null
  const out: string[] = []
  for (let i = 0; i < n; i++) {
    const r = drawFromBag(ids, seen, last, random)
    out.push(r.id)
    seen = r.seen
    last = r.id
  }
  return out
}

describe('drawFromBag', () => {
  it('never repeats a reason before every reason was drawn', () => {
    for (let run = 0; run < 200; run++) {
      const out = drawMany(ids.length)
      expect(new Set(out).size).toBe(ids.length)
    }
  })

  it('starts a new round once the bag is empty, without repeating the last one', () => {
    for (let run = 0; run < 200; run++) {
      const out = drawMany(ids.length * 3)
      for (let round = 0; round < 3; round++) {
        expect(new Set(out.slice(round * 5, round * 5 + 5)).size).toBe(5)
      }
      for (let i = 1; i < out.length; i++) expect(out[i]).not.toBe(out[i - 1])
    }
  })

  it('skips reasons already seen (e.g. reason of the day)', () => {
    const seen = markSeen(ids, [], 'c')
    for (let run = 0; run < 100; run++) {
      const out = drawMany(4, seen)
      expect(out).not.toContain('c')
      expect(new Set(out).size).toBe(4)
    }
  })

  it('handles added and removed reasons', () => {
    const r = drawFromBag(['b', 'z'], ['a', 'b'], 'b', () => 0)
    expect(r.id).toBe('z')
    expect(r.seen).toEqual(['b', 'z'])
  })

  it('works with a single reason', () => {
    expect(drawFromBag(['a'], ['a'], 'a').id).toBe('a')
  })
})
