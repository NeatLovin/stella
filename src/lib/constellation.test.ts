import { describe, expect, it } from 'vitest'
import { hash01, heartAt, layout, project, segment, toWorld } from './constellation'

describe('constellation en cœur', () => {
  it('tient dans [-1, 1], creux en haut et pointe en bas', () => {
    for (let i = 0; i < 100; i++) {
      const p = heartAt(i / 100)
      expect(Math.abs(p.x)).toBeLessThanOrEqual(1.0001)
      expect(Math.abs(p.y)).toBeLessThanOrEqual(1.0001)
    }
    expect(heartAt(0).x).toBeCloseTo(0)
    expect(heartAt(0.5).x).toBeCloseTo(0, 2)
    expect(heartAt(0.5).y).toBeGreaterThan(0.9)
    expect(heartAt(0.25).x).toBeGreaterThan(0)
  })

  it('vu de face, chaque étoile retombe exactement sur le cœur, quelle que soit sa profondeur', () => {
    const nodes = layout(['a', 'b', 'c', 'd', 'e'])
    for (const n of nodes) {
      const p = project(toWorld(n.u, n.k), 0, 0)
      const h = heartAt(n.u)
      expect(p.x).toBeCloseTo(h.x, 6)
      expect(p.y).toBeCloseTo(h.y, 6)
    }
  })

  it('se disperse quand on tourne', () => {
    const [, n] = layout(['a', 'b', 'c'])
    const p = project(toWorld(n.u, n.k), 0.8, 0.3)
    const h = heartAt(n.u)
    expect(Math.hypot(p.x - h.x, p.y - h.y)).toBeGreaterThan(0.1)
  })

  it('donne des profondeurs stables et alternées', () => {
    expect(hash01('x')).toBe(hash01('x'))
    const nodes = layout(['a', 'b', 'c', 'd'])
    expect(nodes.map((n) => n.k > 1)).toEqual([true, false, true, false])
    expect(nodes.map((n) => n.u)).toEqual([0, 0.25, 0.5, 0.75])
  })

  it('fait suivre au trait la courbe, y compris pour refermer le cœur', () => {
    const nodes = layout(['a', 'b', 'c'])
    const close = segment(nodes[2], nodes[0])
    // À mi-chemin entre la dernière étoile (u = 2/3) et la première (u = 1, soit 0), vu de face
    const mid = project(close[5], 0, 0)
    const h = heartAt((nodes[2].u + 1) / 2)
    expect(mid.x).toBeCloseTo(h.x, 5)
    expect(mid.y).toBeCloseTo(h.y, 5)
  })
})
