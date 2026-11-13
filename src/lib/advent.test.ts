import { describe, expect, it } from 'vitest'
import { adventDate, adventDayOf, adventYear, isDecember, isUnlocked, treeLayout, treeLines } from './advent'

describe('calendrier de l’Avent', () => {
  it('trouve l’année et le jour', () => {
    expect(adventYear('2026-12-10')).toBe(2026)
    expect(adventYear('2027-01-03')).toBe(2026)
    expect(adventDate(2026, 1)).toBe('2026-12-01')
    expect(adventDayOf('2026-12-24')).toBe(24)
    expect(adventDayOf('2026-12-25')).toBeNull()
    expect(adventDayOf('2026-11-30')).toBeNull()
    expect(isDecember('2026-12-31')).toBe(true)
    expect(isDecember('2026-11-30')).toBe(false)
  })

  it('ouvre les étoiles à partir de leur jour, et laisse rattraper', () => {
    expect(isUnlocked('2026-12-05', '2026-12-05')).toBe(true)
    expect(isUnlocked('2026-12-03', '2026-12-05')).toBe(true)
    expect(isUnlocked('2026-12-06', '2026-12-05')).toBe(false)
  })

  it('dessine un sapin de 24 étoiles, chaque jour une seule fois', () => {
    const stars = treeLayout()
    expect(stars).toHaveLength(24)
    expect(new Set(stars.map((s) => s.day)).size).toBe(24)
    expect(Math.min(...stars.map((s) => s.day))).toBe(1)
    expect(Math.max(...stars.map((s) => s.day))).toBe(24)
    for (const s of stars) {
      expect(s.x).toBeGreaterThan(0)
      expect(s.x).toBeLessThan(300)
      expect(s.y).toBeLessThan(440)
    }
    expect(treeLines(stars).length).toBeGreaterThan(10)
  })
})
