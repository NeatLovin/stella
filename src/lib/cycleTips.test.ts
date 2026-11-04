import { describe, expect, it } from 'vitest'
import { computeCycle, type Period } from './cycle'
import { cycleMoment, dailyTip, TIPS } from './cycleTips'

const periods: Period[] = [{ id: 'a', start_date: '2026-10-01', end_date: '2026-10-05' }]
const at = (d: string) => {
  const s = computeCycle(periods, [], d)
  if (s.status !== 'ok') throw new Error()
  return cycleMoment(s, d)
}

describe('info du jour', () => {
  it('suit le cycle jour après jour', () => {
    expect(at('2026-10-01')).toBe('regles-j1')
    expect(at('2026-10-02')).toBe('regles-j2')
    expect(at('2026-10-03')).toBe('regles')
    expect(at('2026-10-05')).toBe('regles-fin')
    expect(at('2026-10-07')).toBe('apres-regles')
    expect(at('2026-10-09')).toBe('folliculaire')
    expect(at('2026-10-11')).toBe('fertile') // ovulation estimée le 15
    expect(at('2026-10-14')).toBe('ovulation-veille')
    expect(at('2026-10-15')).toBe('ovulation')
    expect(at('2026-10-16')).toBe('ovulation-lendemain')
    expect(at('2026-10-18')).toBe('luteale-debut')
    expect(at('2026-10-22')).toBe('luteale')
    expect(at('2026-10-25')).toBe('premenstruel')
    expect(at('2026-10-29')).toBe('regles-prevues')
    expect(at('2026-10-31')).toBe('retard-court')
    expect(at('2026-11-04')).toBe('retard')
    expect(at('2026-11-10')).toBe('retard-long')
  })

  it('a toujours une phrase, et change d’un jour à l’autre dans un même moment', () => {
    for (let d = 1; d <= 45; d++) {
      const iso = `2026-${d <= 31 ? '10' : '11'}-${String(d <= 31 ? d : d - 31).padStart(2, '0')}`
      const s = computeCycle(periods, [], iso)
      if (s.status !== 'ok') throw new Error()
      expect(dailyTip(s, iso).length).toBeGreaterThan(20)
    }
    const s1 = computeCycle(periods, [], '2026-10-22')
    const s2 = computeCycle(periods, [], '2026-10-23')
    if (s1.status !== 'ok' || s2.status !== 'ok') throw new Error()
    expect(dailyTip(s1, '2026-10-22')).not.toBe(dailyTip(s2, '2026-10-23'))
    expect(Object.values(TIPS).every((l) => l.length > 0)).toBe(true)
  })
})
