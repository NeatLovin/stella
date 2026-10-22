import { describe, expect, it } from 'vitest'
import { averageCycleLength, averagePeriodLength, computeCycle, markDay, type Period } from './cycle'

const p = (start: string, end: string | null = null): Period => ({ id: start, start_date: start, end_date: end })

describe('computeCycle', () => {
  it('returns empty without data', () => {
    expect(computeCycle([], [], '2026-10-22')).toEqual({ status: 'empty' })
  })

  it('ignores future periods', () => {
    expect(computeCycle([p('2026-11-01')], [], '2026-10-22').status).toBe('empty')
  })

  it('uses 28/5 defaults with a single period', () => {
    const s = computeCycle([p('2026-10-10')], [], '2026-10-12')
    if (s.status !== 'ok') throw new Error()
    expect(s.cycleLength).toBe(28)
    expect(s.periodLength).toBe(5)
    expect(s.cycleDay).toBe(3)
    expect(s.phase).toBe('menstruelle')
    expect(s.nextPeriod).toBe('2026-11-07')
    expect(s.ovulation).toBe('2026-10-24')
    expect(s.usingDefaults).toBe(true)
  })

  it('walks through the phases', () => {
    const periods = [p('2026-10-01', '2026-10-05')]
    const at = (d: string) => {
      const s = computeCycle(periods, [], d)
      return s.status === 'ok' ? s.phase : null
    }
    expect(at('2026-10-05')).toBe('menstruelle')
    expect(at('2026-10-06')).toBe('folliculaire')
    expect(at('2026-10-14')).toBe('ovulation') // ovulation prédite le 15
    expect(at('2026-10-15')).toBe('ovulation')
    expect(at('2026-10-16')).toBe('ovulation')
    expect(at('2026-10-17')).toBe('luteale')
    expect(at('2026-10-29')).toBe('luteale') // règles prévues aujourd'hui
    expect(at('2026-10-31')).toBe('retard')
  })

  it('reports delay days', () => {
    const s = computeCycle([p('2026-09-01', '2026-09-05')], [], '2026-10-02')
    if (s.status !== 'ok') throw new Error()
    expect(s.phase).toBe('retard')
    expect(s.delay).toBe(3)
  })

  it('averages irregular cycles and filters outliers', () => {
    const periods = [p('2026-03-01'), p('2026-03-31'), p('2026-04-26'), p('2026-07-30'), p('2026-08-30')]
    // gaps: 30, 26, 95 (ignored), 31 → 29
    expect(averageCycleLength(periods)).toEqual({ length: 29, samples: 3 })
  })

  it('averages logged period lengths', () => {
    expect(averagePeriodLength([p('2026-09-01', '2026-09-04'), p('2026-10-01', '2026-10-06')])).toBe(5)
    expect(averagePeriodLength([p('2026-09-01', '2026-09-03'), p('2026-10-01', '2026-10-03')])).toBe(3)
  })

  it('prefers a manual ovulation in the current cycle', () => {
    const s = computeCycle([p('2026-10-01', '2026-10-05')], [{ id: 'o', date: '2026-10-18' }], '2026-10-17')
    if (s.status !== 'ok') throw new Error()
    expect(s.ovulation).toBe('2026-10-18')
    expect(s.ovulationIsManual).toBe(true)
    expect(s.phase).toBe('ovulation')
  })

  it('ignores manual ovulations from previous cycles', () => {
    const s = computeCycle([p('2026-09-03'), p('2026-10-01')], [{ id: 'o', date: '2026-09-17' }], '2026-10-03')
    if (s.status !== 'ok') throw new Error()
    expect(s.ovulationIsManual).toBe(false)
  })
})

describe('markDay', () => {
  const periods = [p('2026-10-01', '2026-10-05')]
  const state = computeCycle(periods, [], '2026-10-10')

  it('marks logged and predicted days', () => {
    expect(markDay('2026-10-03', periods, [], state)).toBe('period')
    expect(markDay('2026-10-15', periods, [], state)).toBe('ovulation-predicted')
    expect(markDay('2026-10-29', periods, [], state)).toBe('period-predicted')
    expect(markDay('2026-11-02', periods, [], state)).toBe('period-predicted')
    expect(markDay('2026-11-03', periods, [], state)).toBe(null)
    expect(markDay('2026-11-12', periods, [], state)).toBe('ovulation-predicted')
  })

  it('marks manual ovulation', () => {
    const ovs = [{ id: 'o', date: '2026-10-16' }]
    const s = computeCycle(periods, ovs, '2026-10-10')
    expect(markDay('2026-10-16', periods, ovs, s)).toBe('ovulation')
    expect(markDay('2026-10-15', periods, ovs, s)).toBe(null)
  })
})
