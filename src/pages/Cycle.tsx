import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useMemo, useState } from 'react'
import { BottomSheet } from '../components/BottomSheet'
import { IconChevron } from '../components/icons'
import { ErrorNote, Page, Skeleton } from '../components/Page'
import { useLoad } from '../hooks/useLoad'
import { api } from '../lib/api'
import {
  computeCycle,
  markDay,
  PHASE_LABEL,
  periodEnd,
  type CycleState,
  type DayMark,
  type Ovulation,
  type Period,
  type Phase,
} from '../lib/cycle'
import { diffDays, formatLong, formatShort, plusDays, toISO, todayISO, type ISODate } from '../lib/dates'

const PHASE_COLOR: Record<Phase, string> = {
  menstruelle: '#FF6B9A',
  folliculaire: '#7DA2FF',
  ovulation: '#5CE1E6',
  luteale: '#A78BFA',
  retard: '#A9B3E0',
}

const loadAll = async () => {
  const [periods, ovulations] = await Promise.all([api.getPeriods(), api.getOvulations()])
  return { periods, ovulations }
}

export function Cycle() {
  const { data, error, loading, reload } = useLoad(loadAll)
  const today = todayISO()

  return (
    <Page wide title="Cycle">
      {loading && <Skeleton variant="cycle" />}
      {error && <ErrorNote message={error} onRetry={reload} />}
      {data && <CycleContent periods={data.periods} ovulations={data.ovulations} today={today} reload={reload} />}
    </Page>
  )
}

function CycleContent({
  periods,
  ovulations,
  today,
  reload,
}: {
  periods: Period[]
  ovulations: Ovulation[]
  today: ISODate
  reload: () => Promise<void>
}) {
  const state = useMemo(() => computeCycle(periods, ovulations, today), [periods, ovulations, today])
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState<ISODate | null>(null)

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setActionError(null)
    try {
      await fn()
      await reload()
      setSelectedDay(null)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const last = periods.filter((p) => p.start_date <= today).at(-1)
  const ongoing =
    last && !last.end_date && diffDays(today, last.start_date) < 10 && (state.status !== 'ok' || today <= plusDays(state.lastEnd, 4))
  const startedToday = periods.some((p) => p.start_date === today)
  const ovulationToday = ovulations.find((o) => o.date === today)

  return (
    <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-16 xl:gap-24">
      <div className="lg:sticky lg:top-10">
        {state.status === 'empty' ? (
          <EmptyStart onSave={(d) => run(() => api.addPeriod(d))} busy={busy} />
        ) : (
          <>
            <Ring state={state} />
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {ongoing ? (
                <button
                  type="button"
                  className="btn-primary"
                  disabled={busy}
                  onClick={() => run(() => api.updatePeriod(last!.id, { end_date: today }))}
                >
                  Mes règles sont terminées
                </button>
              ) : (
                !startedToday && (
                  <button
                    type="button"
                    className={state.status === 'ok' && state.daysUntilNext > 3 ? 'btn-ghost' : 'btn-primary'}
                    disabled={busy}
                    onClick={() => run(() => api.addPeriod(today))}
                  >
                    Mes règles ont commencé
                  </button>
                )
              )}
              <button
                type="button"
                className="btn-ghost"
                disabled={busy}
                onClick={() => run(() => (ovulationToday ? api.deleteOvulation(ovulationToday.id) : api.addOvulation(today)))}
              >
                {ovulationToday ? 'Retirer l’ovulation du jour' : 'Ovulation aujourd’hui'}
              </button>
            </div>
          </>
        )}

        {actionError && (
          <p role="alert" className="mt-4 text-center text-sm text-rose">
            Action impossible : {actionError}
          </p>
        )}
      </div>

      <div>
        <Calendar periods={periods} ovulations={ovulations} state={state} today={today} onSelect={setSelectedDay} />

        <p className="mt-8 text-sm leading-relaxed text-mist/80">
          Prévisions indicatives, calculées sur la moyenne de tes derniers cycles
          {state.status === 'ok' && state.usingDefaults ? ' (28 jours par défaut tant qu’il y a moins de 2 cycles)' : ''}. Ce n’est pas une
          méthode de contraception.
        </p>
      </div>

      <BottomSheet open={Boolean(selectedDay)} onClose={() => setSelectedDay(null)} label="Modifier ce jour">
        {selectedDay && (
          <DayActions day={selectedDay} today={today} periods={periods} ovulations={ovulations} state={state} busy={busy} run={run} />
        )}
      </BottomSheet>
    </div>
  )
}

function EmptyStart({ onSave, busy }: { onSave: (d: ISODate) => void; busy: boolean }) {
  const [date, setDate] = useState(todayISO())
  return (
    <section className="rounded-[1.25rem] border border-glow/20 bg-starlight/[0.04] p-6">
      <h2 className="font-display text-2xl">Pour commencer</h2>
      <p className="mt-2 text-mist">Indique le premier jour de tes dernières règles. Les prévisions s’affinent ensuite à chaque cycle.</p>
      <label className="mt-5 block">
        <span className="mb-1.5 block text-sm text-mist">Premier jour des dernières règles</span>
        <input type="date" className="field" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
      </label>
      <button type="button" className="btn-primary mt-5" disabled={busy || !date} onClick={() => onSave(date)}>
        Enregistrer
      </button>
    </section>
  )
}

function Ring({ state }: { state: Extract<CycleState, { status: 'ok' }> }) {
  const { cycleLength, periodLength, ovulation, lastStart, cycleDay, phase, daysUntilNext, delay } = state
  const R = 92
  const C = 2 * Math.PI * R
  const ovDay = diffDays(ovulation, lastStart) // index 0-based
  const segments: { from: number; to: number; color: string }[] = [
    { from: 0, to: periodLength, color: PHASE_COLOR.menstruelle },
    { from: periodLength, to: Math.max(periodLength, ovDay - 1), color: PHASE_COLOR.folliculaire },
    { from: Math.max(periodLength, ovDay - 1), to: Math.min(cycleLength, ovDay + 2), color: PHASE_COLOR.ovulation },
    { from: Math.min(cycleLength, ovDay + 2), to: cycleLength, color: PHASE_COLOR.luteale },
  ].filter((s) => s.to > s.from)

  const progress = Math.min(cycleDay - 1 + 0.5, cycleLength) / cycleLength
  const angle = progress * 2 * Math.PI - Math.PI / 2
  const dot = { x: 120 + R * Math.cos(angle), y: 120 + R * Math.sin(angle) }

  const next =
    phase === 'retard'
      ? `Retard de ${delay} jour${delay > 1 ? 's' : ''}`
      : daysUntilNext === 0
        ? 'Règles prévues aujourd’hui'
        : `Règles dans ${daysUntilNext} jour${daysUntilNext > 1 ? 's' : ''}`

  return (
    <section aria-label="Cycle en cours" className="flex flex-col items-center">
      <div className="relative w-full max-w-[18rem] lg:max-w-[22rem]">
        <svg viewBox="0 0 240 240" className="w-full -rotate-0" aria-hidden>
          <circle cx="120" cy="120" r={R} fill="none" stroke="rgb(125 162 255 / 0.12)" strokeWidth="14" />
          {segments.map((s) => (
            <circle
              key={s.color}
              cx="120"
              cy="120"
              r={R}
              fill="none"
              stroke={s.color}
              strokeOpacity="0.85"
              strokeWidth="14"
              strokeDasharray={`${((s.to - s.from) / cycleLength) * C - 3} ${C}`}
              strokeDashoffset={-(s.from / cycleLength) * C}
              transform="rotate(-90 120 120)"
            />
          ))}
          {phase !== 'retard' && (
            <>
              <circle cx={dot.x} cy={dot.y} r="13" fill={PHASE_COLOR[phase]} opacity="0.35" />
              <circle cx={dot.x} cy={dot.y} r="7.5" fill="#F4F6FF" />
            </>
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <p className="font-display max-w-[11rem] text-[1.6rem] leading-[1.05] font-medium" style={{ color: PHASE_COLOR[phase] }}>
            {PHASE_LABEL[phase]}
          </p>
          <p className="mt-1 text-sm text-mist">Jour {cycleDay}</p>
          <p className="mt-3 max-w-[11rem] text-[0.95rem] leading-snug">{next}</p>
        </div>
      </div>
      <div className="mt-4 text-center text-sm leading-relaxed text-mist">
        <p>Prochaines règles vers le {formatLong(state.nextPeriod)}</p>
        <p>
          Ovulation {state.ovulationIsManual ? 'notée' : 'estimée'} le {formatShort(ovulation)}
        </p>
      </div>
    </section>
  )
}

const MARK_STYLE: Record<Exclude<DayMark, null>, string> = {
  period: 'bg-rose text-night font-medium',
  'period-predicted': 'border border-dashed border-rose text-rose',
  ovulation: 'bg-teal text-night font-medium',
  'ovulation-predicted': 'border border-dashed border-teal text-teal',
}

function Calendar({
  periods,
  ovulations,
  state,
  today,
  onSelect,
}: {
  periods: Period[]
  ovulations: Ovulation[]
  state: CycleState
  today: ISODate
  onSelect: (d: ISODate) => void
}) {
  const [offset, setOffset] = useState(0)
  const month = addMonths(new Date(), offset)
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  })
  const currentMonth = month.getMonth()

  return (
    <section className="mt-12 lg:mt-0" aria-label="Calendrier">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          className="rounded-full p-2 text-mist hover:text-starlight"
          onClick={() => setOffset((o) => o - 1)}
          aria-label="Mois précédent"
        >
          <IconChevron dir="left" />
        </button>
        <h2 className="font-display text-2xl capitalize">{format(month, 'MMMM yyyy', { locale: fr })}</h2>
        <button
          type="button"
          className="rounded-full p-2 text-mist hover:text-starlight"
          onClick={() => setOffset((o) => o + 1)}
          aria-label="Mois suivant"
        >
          <IconChevron />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-y-1.5 text-center">
        {['lu', 'ma', 'me', 'je', 've', 'sa', 'di'].map((d) => (
          <span key={d} className="pb-1 text-xs text-mist/70">
            {d}
          </span>
        ))}
        {days.map((date) => {
          const iso = toISO(date)
          const inMonth = date.getMonth() === currentMonth
          const mark = markDay(iso, periods, ovulations, state)
          const isToday = iso === today
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelect(iso)}
              aria-label={`${formatLong(iso)}${mark ? `, ${MARK_LABEL[mark]}` : ''}`}
              className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full text-[0.95rem] tabular-nums transition-colors ${
                inMonth ? '' : 'opacity-30'
              } ${mark ? MARK_STYLE[mark] : 'text-starlight/85 hover:bg-glow/10'} ${
                isToday ? 'ring-2 ring-starlight ring-offset-2 ring-offset-night' : ''
              }`}
            >
              {date.getDate()}
            </button>
          )
        })}
      </div>

      <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-mist">
        <Legend className="bg-rose" label="Règles" />
        <Legend className="border border-dashed border-rose" label="Règles prévues" />
        <Legend className="bg-teal" label="Ovulation" />
        <Legend className="border border-dashed border-teal" label="Ovulation estimée" />
      </ul>
    </section>
  )
}

const MARK_LABEL: Record<Exclude<DayMark, null>, string> = {
  period: 'règles',
  'period-predicted': 'règles prévues',
  ovulation: 'ovulation',
  'ovulation-predicted': 'ovulation estimée',
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <span className={`h-3 w-3 rounded-full ${className}`} />
      {label}
    </li>
  )
}

function DayActions({
  day,
  today,
  periods,
  ovulations,
  state,
  busy,
  run,
}: {
  day: ISODate
  today: ISODate
  periods: Period[]
  ovulations: Ovulation[]
  state: CycleState
  busy: boolean
  run: (fn: () => Promise<void>) => Promise<void>
}) {
  const periodLength = state.status === 'ok' ? state.periodLength : 5
  const inPeriod = periods.find((p) => day >= p.start_date && day <= periodEnd(p, periodLength))
  // Règles commencées peu avant ce jour : on peut y fixer la fin
  const recent = periods.filter((p) => p.start_date < day && diffDays(day, p.start_date) <= 10).at(-1)
  const ovulation = ovulations.find((o) => o.date === day)
  const future = day > today

  const Action = ({ label, onClick, tone = 'ghost' }: { label: string; onClick: () => Promise<void>; tone?: 'ghost' | 'danger' }) => (
    <button
      type="button"
      disabled={busy}
      onClick={() => run(onClick)}
      className={tone === 'danger' ? 'w-full rounded-full border border-rose/40 px-5 py-3 text-rose' : 'btn-ghost w-full'}
    >
      {label}
    </button>
  )

  return (
    <div className="space-y-3 pb-2">
      <h2 className="font-display text-3xl font-medium first-letter:uppercase">
        {format(new Date(day + 'T12:00'), 'EEEE d MMMM', { locale: fr })}
      </h2>
      {future ? (
        <p className="text-mist">Ce jour est à venir : tu pourras le noter le moment venu.</p>
      ) : (
        <div className="space-y-3 pt-2">
          {!inPeriod && <Action label="Début des règles ce jour" onClick={() => api.addPeriod(day)} />}
          {inPeriod && day > inPeriod.start_date && inPeriod.end_date !== day && (
            <Action label="Fin des règles ce jour" onClick={() => api.updatePeriod(inPeriod.id, { end_date: day })} />
          )}
          {!inPeriod && recent && (
            <Action
              label={`Fin des règles ce jour (commencées le ${formatShort(recent.start_date)})`}
              onClick={() => api.updatePeriod(recent.id, { end_date: day })}
            />
          )}
          {ovulation ? (
            <Action label="Retirer l’ovulation" onClick={() => api.deleteOvulation(ovulation.id)} />
          ) : (
            <Action label="Ovulation ce jour" onClick={() => api.addOvulation(day)} />
          )}
          {inPeriod && (
            <Action
              tone="danger"
              label={`Supprimer ces règles (dès le ${formatShort(inPeriod.start_date)})`}
              onClick={() => api.deletePeriod(inPeriod.id)}
            />
          )}
        </div>
      )}
    </div>
  )
}
