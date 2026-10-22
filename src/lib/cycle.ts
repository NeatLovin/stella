import { diffDays, plusDays, type ISODate } from './dates'

export interface Period {
  id: string
  start_date: ISODate
  end_date: ISODate | null
}

export interface Ovulation {
  id: string
  date: ISODate
}

export type Phase = 'menstruelle' | 'folliculaire' | 'ovulation' | 'luteale' | 'retard'

export const DEFAULT_CYCLE = 28
export const DEFAULT_PERIOD = 5
const LUTEAL = 14
const MAX_CYCLES = 6

export type CycleState =
  | { status: 'empty' }
  | {
      status: 'ok'
      phase: Phase
      cycleDay: number
      cycleLength: number
      periodLength: number
      lastStart: ISODate
      lastEnd: ISODate
      nextPeriod: ISODate
      daysUntilNext: number
      delay: number
      ovulation: ISODate
      ovulationIsManual: boolean
      /** true si moins de 2 cycles complets : les prédictions utilisent les valeurs par défaut */
      usingDefaults: boolean
    }

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

export function averageCycleLength(periods: Period[]): { length: number; samples: number } {
  const starts = [...periods].map((p) => p.start_date).sort()
  const gaps: number[] = []
  for (let i = 1; i < starts.length; i++) {
    const g = diffDays(starts[i], starts[i - 1])
    if (g >= 21 && g <= 45) gaps.push(g)
  }
  const recent = gaps.slice(-MAX_CYCLES)
  return recent.length ? { length: Math.round(mean(recent)), samples: recent.length } : { length: DEFAULT_CYCLE, samples: 0 }
}

export function averagePeriodLength(periods: Period[]): number {
  const lengths = periods
    .filter((p) => p.end_date)
    .map((p) => diffDays(p.end_date!, p.start_date) + 1)
    .filter((l) => l >= 2 && l <= 10)
    .slice(-MAX_CYCLES)
  return lengths.length ? Math.round(mean(lengths)) : DEFAULT_PERIOD
}

/** Dernier jour (inclus) d'une période de règles, réel ou estimé. */
export function periodEnd(p: Period, periodLength: number): ISODate {
  return p.end_date ?? plusDays(p.start_date, periodLength - 1)
}

export function computeCycle(periods: Period[], ovulations: Ovulation[], today: ISODate): CycleState {
  const past = periods.filter((p) => p.start_date <= today).sort((a, b) => a.start_date.localeCompare(b.start_date))
  if (!past.length) return { status: 'empty' }

  const { length: cycleLength, samples } = averageCycleLength(past)
  const periodLength = averagePeriodLength(past)
  const last = past[past.length - 1]
  const lastStart = last.start_date
  const lastEnd = periodEnd(last, periodLength)
  const nextPeriod = plusDays(lastStart, cycleLength)
  const cycleDay = diffDays(today, lastStart) + 1
  const daysUntilNext = diffDays(nextPeriod, today)

  const manual = ovulations
    .map((o) => o.date)
    .filter((d) => d >= lastStart && d < nextPeriod)
    .sort()
    .pop()
  const ovulation = manual ?? plusDays(nextPeriod, -LUTEAL)

  let phase: Phase
  if (today <= lastEnd) phase = 'menstruelle'
  else if (daysUntilNext < 0) phase = 'retard'
  else if (Math.abs(diffDays(today, ovulation)) <= 1) phase = 'ovulation'
  else if (today < ovulation) phase = 'folliculaire'
  else phase = 'luteale'

  return {
    status: 'ok',
    phase,
    cycleDay,
    cycleLength,
    periodLength,
    lastStart,
    lastEnd,
    nextPeriod,
    daysUntilNext,
    delay: Math.max(0, -daysUntilNext),
    ovulation,
    ovulationIsManual: Boolean(manual),
    usingDefaults: samples < 2,
  }
}

export type DayMark = 'period' | 'period-predicted' | 'ovulation' | 'ovulation-predicted' | null

/** Marquage d'un jour du calendrier : réel > prédit. Prédit sur les 3 prochains cycles. */
export function markDay(day: ISODate, periods: Period[], ovulations: Ovulation[], state: CycleState): DayMark {
  const periodLength = state.status === 'ok' ? state.periodLength : DEFAULT_PERIOD
  if (periods.some((p) => day >= p.start_date && day <= periodEnd(p, periodLength))) return 'period'
  if (ovulations.some((o) => o.date === day)) return 'ovulation'
  if (state.status !== 'ok') return null

  for (let k = 0; k < 3; k++) {
    const start = plusDays(state.nextPeriod, k * state.cycleLength)
    if (day >= start && day <= plusDays(start, state.periodLength - 1)) return 'period-predicted'
    const ovulation = k === 0 ? state.ovulation : plusDays(start, -LUTEAL)
    const isManual = k === 0 && state.ovulationIsManual
    if (day === ovulation && !isManual) return 'ovulation-predicted'
  }
  return null
}

export const PHASE_LABEL: Record<Phase, string> = {
  menstruelle: 'Règles',
  folliculaire: 'Phase folliculaire',
  ovulation: 'Ovulation',
  luteale: 'Phase lutéale',
  retard: 'Retard',
}
