import { addMonths, differenceInCalendarDays, lastDayOfMonth } from 'date-fns'
import { parse, plusDays, toISO, type ISODate } from './dates'

// Jalons du couple : mois-iversaires, centaines de jours, années.

export interface Milestone {
  /** Identifiant stable, aussi clé du message dans Supabase : 'months-4', 'days-100', 'years-1' */
  key: string
  kind: 'months' | 'days' | 'years'
  /** Nombre affiché en grand */
  n: number
  /** « mois ensemble », « jours ensemble », « an ensemble »… */
  label: string
  date: ISODate
}

const DAY_STEPS = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]
const isDayStep = (d: number) => DAY_STEPS.includes(d) || (d > 1000 && d % 500 === 0)

/**
 * Date du n-ième mois-iversaire. Pour un début le 30 ou le 31, les mois plus courts
 * tombent sur leur dernier jour (ex. 30 janvier → 28 février).
 */
export function monthiversary(start: ISODate, n: number): ISODate {
  const s = parse(start)
  const target = addMonths(new Date(s.getFullYear(), s.getMonth(), 1), n)
  const last = lastDayOfMonth(target).getDate()
  return toISO(new Date(target.getFullYear(), target.getMonth(), Math.min(s.getDate(), last)))
}

/** Le jalon qui tombe ce jour-là, s'il y en a un (les années passent avant les jours, puis les mois). */
export function milestoneOn(start: ISODate, day: ISODate): Milestone | null {
  const days = differenceInCalendarDays(parse(day), parse(start))
  if (days <= 0) return null

  // Nombre de mois entiers écoulés ce jour-là
  const s = parse(start)
  const d = parse(day)
  let months = (d.getFullYear() - s.getFullYear()) * 12 + (d.getMonth() - s.getMonth())
  if (monthiversary(start, months) > day) months -= 1
  const onMonth = months > 0 && monthiversary(start, months) === day

  if (onMonth && months % 12 === 0) {
    const y = months / 12
    return { key: `years-${y}`, kind: 'years', n: y, label: y > 1 ? 'ans ensemble' : 'an ensemble', date: day }
  }
  // Comme le compteur de l'accueil, le premier jour compte : le 100e jour, c'est début + 99
  const dayNumber = days + 1
  if (isDayStep(dayNumber)) return { key: `days-${dayNumber}`, kind: 'days', n: dayNumber, label: 'jours ensemble', date: day }
  if (onMonth) return { key: `months-${months}`, kind: 'months', n: months, label: 'mois ensemble', date: day }
  return null
}

/** Prochain jalon à partir de demain (cherche sur un an). */
export function nextMilestone(start: ISODate, today: ISODate): { milestone: Milestone; inDays: number } | null {
  for (let i = 1; i <= 366; i++) {
    const m = milestoneOn(start, plusDays(today, i))
    if (m) return { milestone: m, inDays: i }
  }
  return null
}

/** Mot par défaut si aucun message n'a été écrit pour ce jalon. */
export function defaultMessage(m: Milestone): string {
  if (m.kind === 'years') return 'Une année de plus à s’aimer. Et toutes les autres devant nous.'
  if (m.kind === 'days') return `${m.n} jours, et chacun d’eux compte.`
  return 'Un mois de plus à tes côtés. Le plus beau, jusqu’au prochain.'
}
