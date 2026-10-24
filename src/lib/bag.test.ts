import { describe, expect, it } from 'vitest'
import { cooldownSize, drawFromBag, emptyBag, markSeen, textKey, uniqueByText, type BagState } from './bag'

const ids = Array.from({ length: 12 }, (_, i) => `r${i}`)

function drawMany(n: number, list = ids, start: BagState = emptyBag(), random = Math.random) {
  let state = start
  const out: string[] = []
  for (let i = 0; i < n; i++) {
    const r = drawFromBag(list, state, random)
    out.push(r.id)
    state = r.state
  }
  return { out, state }
}

describe('drawFromBag', () => {
  it('never repeats a reason within a round', () => {
    for (let run = 0; run < 300; run++) {
      const { out } = drawMany(ids.length)
      expect(new Set(out).size).toBe(ids.length)
    }
  })

  it('every round contains every reason exactly once', () => {
    for (let run = 0; run < 100; run++) {
      const { out } = drawMany(ids.length * 5)
      for (let r = 0; r < 5; r++) expect(new Set(out.slice(r * 12, r * 12 + 12)).size).toBe(12)
    }
  })

  it('keeps repeats far apart across rounds (at least cooldown + 1 draws)', () => {
    const k = cooldownSize(ids.length)
    for (let run = 0; run < 300; run++) {
      const { out } = drawMany(ids.length * 6)
      const last = new Map<string, number>()
      out.forEach((id, i) => {
        if (last.has(id)) expect(i - last.get(id)!).toBeGreaterThan(k)
        last.set(id, i)
      })
    }
  })

  it('keeps the order random from round to round (small and large jars)', () => {
    for (const list of [ids.slice(0, 4), ids]) {
      const firsts = new Set<string>()
      for (let run = 0; run < 200; run++) firsts.add(drawMany(list.length * 2, list).out[list.length])
      expect(firsts.size).toBeGreaterThan(1)
    }
  })

  it('handles tiny jars', () => {
    expect(drawMany(5, ['a']).out).toEqual(['a', 'a', 'a', 'a', 'a'])
    const { out } = drawMany(10, ['a', 'b'])
    for (let i = 1; i < out.length; i++) expect(out[i]).not.toBe(out[i - 1])
  })

  it('skips the reason of the day once marked seen', () => {
    for (let run = 0; run < 100; run++) {
      const start = markSeen(ids, emptyBag(), 'r5')
      const { out } = drawMany(ids.length - 1, ids, start)
      expect(out).not.toContain('r5')
      expect(new Set(out).size).toBe(ids.length - 1)
    }
  })

  it('never shows the reason of the day right after it was displayed, even when a round ends', () => {
    for (let run = 0; run < 300; run++) {
      // Tour presque fini, la raison du jour (r0) avait été tirée tôt dans le tour
      let state = markSeen(ids, { seen: [...ids], cooldown: [] }, 'r0')
      const first = drawFromBag(ids, state)
      expect(first.id).not.toBe('r0')
      state = first.state
    }
  })

  it('handles added and removed reasons', () => {
    const r = drawFromBag(['b', 'z'], { seen: ['a', 'b'], cooldown: ['x'] }, () => 0)
    expect(r.id).toBe('z')
    expect(r.state).toEqual({ seen: ['b', 'z'], cooldown: [] })
  })
})

describe('duplicates', () => {
  it('treats the same text as one reason', () => {
    expect(textKey('Parce que je n’ai jamais eu autant envie.')).toBe(textKey("parce que  je n'ai jamais eu autant envie. "))
    const list = uniqueByText([
      { id: '1', text: 'Ton rire.' },
      { id: '2', text: 'Ton  rire.' },
      { id: '3', text: 'Tes yeux.' },
    ])
    expect(list.map((r) => r.id)).toEqual(['1', '3'])
  })
})
