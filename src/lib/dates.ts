import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

/** Date locale au format 'YYYY-MM-DD' (évite les décalages UTC). */
export type ISODate = string

export const toISO = (d: Date): ISODate => format(d, 'yyyy-MM-dd')
export const todayISO = (): ISODate => toISO(new Date())
export const parse = (d: ISODate): Date => parseISO(d)
export const diffDays = (a: ISODate, b: ISODate): number => differenceInCalendarDays(parse(a), parse(b))
export const plusDays = (d: ISODate, n: number): ISODate => toISO(addDays(parse(d), n))

export const formatLong = (d: ISODate): string => format(parse(d), 'd MMMM yyyy', { locale: fr })
export const formatShort = (d: ISODate): string => format(parse(d), 'd MMM', { locale: fr })

/** « 16 – 29 juillet 2026 » ou « 30 juillet 2026 ». */
export function formatRange(start: ISODate, end?: ISODate | null): string {
  if (!end || end === start) return formatLong(start)
  const s = parse(start)
  const e = parse(end)
  if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()) {
    return `${format(s, 'd')} – ${format(e, 'd MMMM yyyy', { locale: fr })}`
  }
  if (s.getFullYear() === e.getFullYear()) {
    return `${format(s, 'd MMMM', { locale: fr })} – ${format(e, 'd MMMM yyyy', { locale: fr })}`
  }
  return `${formatLong(start)} – ${formatLong(end)}`
}
