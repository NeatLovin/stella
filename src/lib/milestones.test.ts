import { describe, expect, it } from 'vitest'
import { milestoneOn, monthiversary, nextMilestone } from './milestones'

const START = '2026-07-30'

describe('jalons', () => {
  it('fête les mois-iversaires le 30', () => {
    expect(milestoneOn(START, '2026-08-30')?.key).toBe('months-1')
    expect(milestoneOn(START, '2026-10-30')?.key).toBe('months-3')
    expect(milestoneOn(START, '2026-10-29')).toBeNull()
  })

  it('tombe sur le dernier jour des mois trop courts', () => {
    expect(monthiversary(START, 7)).toBe('2027-02-28')
    expect(milestoneOn(START, '2027-02-28')?.key).toBe('months-7')
    expect(milestoneOn(START, '2027-03-30')?.key).toBe('months-8')
  })

  it('fête les 100 jours le 6 novembre, le 100e jour comme sur l’accueil', () => {
    const m = milestoneOn(START, '2026-11-06')
    expect(milestoneOn(START, '2026-11-07')).toBeNull()
    expect(m?.key).toBe('days-100')
    expect(m?.label).toBe('jours ensemble')
  })

  it("l'anniversaire passe avant le reste", () => {
    expect(milestoneOn(START, '2027-07-30')?.key).toBe('years-1')
    expect(milestoneOn(START, '2028-07-30')?.label).toBe('ans ensemble')
  })

  it('rien le jour même du début', () => {
    expect(milestoneOn(START, START)).toBeNull()
  })

  it('trouve le prochain jalon', () => {
    expect(nextMilestone(START, '2026-11-02')).toEqual({ milestone: expect.objectContaining({ key: 'days-100' }), inDays: 4 })
    expect(nextMilestone(START, '2026-11-06')?.milestone.key).toBe('months-4')
  })
})
