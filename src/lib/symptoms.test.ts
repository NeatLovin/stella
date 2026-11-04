import { describe, expect, it } from 'vitest'
import { computeCycle, type Period } from './cycle'
import { describePattern, personalTip, recurringPatterns, type SymptomEntry } from './symptoms'

const p = (start: string): Period => ({ id: start, start_date: start, end_date: null })
const e = (day: string, ...items: string[]): SymptomEntry => ({ day, items, flow: null, note: null })

// Trois cycles de 28 jours : 1er sept., 29 sept., 27 oct. (en cours)
const periods = [p('2026-09-01'), p('2026-09-29'), p('2026-10-27')]

describe('ce qui revient', () => {
  it('repère les crampes en début de règles', () => {
    const entries = [e('2026-09-01', 'crampes'), e('2026-09-02', 'crampes'), e('2026-09-29', 'crampes'), e('2026-10-27', 'crampes')]
    const [pat] = recurringPatterns(entries, periods, '2026-11-04')
    expect(pat).toMatchObject({ id: 'crampes', anchor: 'start', from: 1, to: 2, count: 4, cycles: 3 })
    expect(describePattern(pat)).toBe('souvent les jours 1 et 2')
  })

  it('compte avant les règles quand c’est plus parlant', () => {
    // Maux de tête 2 jours avant les règles, deux cycles de suite + la veille une fois
    const entries = [e('2026-08-30', 'tete'), e('2026-09-27', 'tete'), e('2026-09-28', 'tete')]
    const pats = recurringPatterns([...entries, e('2026-08-01', 'bien')], [p('2026-08-01'), ...periods], '2026-11-04')
    expect(pats.find((x) => x.id === 'tete')).toMatchObject({ anchor: 'before', from: 1, to: 2, count: 3 })
    expect(describePattern({ id: 'tete', anchor: 'before', from: 1, to: 1, count: 3, cycles: 2 })).toBe('souvent la veille des règles')
  })

  it('ignore ce qui n’est vu que sur un seul cycle ou trop rarement', () => {
    const oneCycle = [e('2026-09-01', 'dos'), e('2026-09-02', 'dos'), e('2026-09-03', 'dos')]
    expect(recurringPatterns(oneCycle, periods, '2026-11-04')).toEqual([])
    const twice = [e('2026-09-01', 'dos'), e('2026-09-29', 'dos')]
    expect(recurringPatterns(twice, periods, '2026-11-04')).toEqual([])
    // Noté partout dans le cycle : pas de moment qui ressort
    const scattered = ['01', '05', '10', '15', '20', '25'].map((d) => e(`2026-09-${d}`, 'fatiguee'))
    expect(recurringPatterns([...scattered, e('2026-09-29', 'fatiguee')], periods, '2026-11-04')).toEqual([])
  })

  it('rien sans au moins deux règles notées', () => {
    expect(recurringPatterns([e('2026-10-27', 'crampes')], [p('2026-10-27')], '2026-11-04')).toEqual([])
  })
})

describe('info du jour personnalisée', () => {
  const crampes = { id: 'crampes', anchor: 'start' as const, from: 1, to: 2, count: 4, cycles: 3 }
  const sucre = { id: 'sucre', anchor: 'before' as const, from: 2, to: 4, count: 4, cycles: 2 }
  const ok = (today: string) => {
    const s = computeCycle(periods, [], today)
    if (s.status !== 'ok') throw new Error()
    return s
  }

  it('annonce la veille et le jour même', () => {
    // Prochaines règles prévues le 24 nov.
    expect(personalTip([sucre], ok('2026-11-19'))).toBe(
      'Les envies de sucré reviennent souvent dès demain chez toi : chocolat noir à portée de main ?',
    )
    expect(personalTip([sucre], ok('2026-11-21'))).toBe(
      'Les envies de sucré, c’est souvent en ce moment chez toi : chocolat noir à portée de main ?',
    )
    expect(personalTip([crampes], ok('2026-10-28'))).toContain('Les crampes, c’est souvent en ce moment')
    expect(personalTip([crampes, sucre], ok('2026-11-10'))).toBeNull()
  })

  it('se tait pendant un retard et pour les ressentis positifs', () => {
    expect(personalTip([sucre], ok('2026-11-27'))).toBeNull()
    expect(personalTip([{ ...crampes, id: 'bien' }], ok('2026-10-28'))).toBeNull()
  })
})
