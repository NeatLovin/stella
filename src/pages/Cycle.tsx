import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from 'date-fns'
import { fr } from 'date-fns/locale'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { BottomSheet } from '../components/BottomSheet'
import { IconChevron } from '../components/icons'
import { ErrorNote, Page, Skeleton } from '../components/Page'
import { useLoad } from '../hooks/useLoad'
import { api } from '../lib/api'
import {
  computeCycle,
  cycleHistory,
  markDay,
  PHASE_LABEL,
  periodEnd,
  type CycleState,
  type DayMark,
  type Ovulation,
  type Period,
  type Phase,
} from '../lib/cycle'
import { dailyTip } from '../lib/cycleTips'
import { EASE_OUT, rise, riseLater, SPRING_POP, stagger } from '../lib/motion'
import {
  describePattern,
  FLOWS,
  personalTip,
  recurringPatterns,
  SYMPTOM_GROUPS,
  SYMPTOMS,
  type Pattern,
  type SymptomEntry,
} from '../lib/symptoms'
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
// À part : si la table des symptômes manque encore, le reste de la page fonctionne quand même
const loadSymptoms = () => api.getSymptoms()

export function Cycle() {
  const { data, error, loading, reload } = useLoad(loadAll, 'cycle')
  const today = todayISO()

  return (
    <Page wide eyebrow="Prendre soin de toi" title="Cycle">
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
  const sym = useLoad(loadSymptoms, 'cycle.symptoms')
  const symptoms = useMemo(() => sym.data ?? [], [sym.data])
  const patterns = useMemo(() => recurringPatterns(symptoms, periods, today), [symptoms, periods, today])
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
  const todayEntry = symptoms.find((x) => x.day === today)

  const saveSymptoms = async (entry: SymptomEntry) => {
    sym.setData((prev) => [...(prev ?? []).filter((x) => x.day !== entry.day), entry].sort((a, b) => a.day.localeCompare(b.day)))
    await api.saveSymptoms(entry)
  }

  return (
    <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-16 xl:gap-24">
      <motion.div className="lg:sticky lg:top-10" variants={stagger(0.09, 0.1)} initial="hidden" animate="show">
        {state.status === 'empty' ? (
          <EmptyStart onSave={(d) => run(() => api.addPeriod(d))} busy={busy} />
        ) : (
          <>
            <motion.div variants={rise}>
              <Ring state={state} />
            </motion.div>
            <motion.div variants={rise} className="mt-8 flex flex-wrap justify-center gap-3">
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
            </motion.div>
            <motion.div variants={rise}>
              <FeelingButton entry={todayEntry} onOpen={() => setSelectedDay(today)} />
            </motion.div>
            <motion.div variants={rise}>
              <DailyTip state={state} today={today} patterns={patterns} />
            </motion.div>
          </>
        )}

        {actionError && (
          <p role="alert" className="mt-4 text-center text-sm text-rose">
            Action impossible : {actionError}
          </p>
        )}
      </motion.div>

      <motion.div variants={riseLater(0.3)} initial="hidden" animate="show">
        <Calendar periods={periods} ovulations={ovulations} symptoms={symptoms} state={state} today={today} onSelect={setSelectedDay} />

        {state.status === 'ok' && (
          <History periods={periods} state={state} today={today} patterns={patterns} hasSymptoms={symptoms.length > 0} />
        )}

        <p className="mt-8 text-sm leading-relaxed text-mist/80">
          Prévisions indicatives, calculées sur la moyenne de tes derniers cycles
          {state.status === 'ok' && state.usingDefaults ? ' (28 jours par défaut tant qu’il y a moins de 2 cycles)' : ''}. Ce n’est pas une
          méthode de contraception. Les infos du jour sont des repères généraux : chaque corps est différent.
        </p>
      </motion.div>

      <BottomSheet open={Boolean(selectedDay)} onClose={() => setSelectedDay(null)} label="Modifier ce jour">
        {selectedDay && (
          <DayActions
            day={selectedDay}
            today={today}
            periods={periods}
            ovulations={ovulations}
            state={state}
            busy={busy}
            run={run}
            entry={symptoms.find((x) => x.day === selectedDay)}
            onSaveSymptoms={saveSymptoms}
          />
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
          {segments.map((s, i) => (
            <motion.circle
              key={s.color}
              cx="120"
              cy="120"
              r={R}
              fill="none"
              stroke={s.color}
              strokeOpacity="0.85"
              strokeWidth="14"
              initial={{ strokeDasharray: `0 ${C}` }}
              animate={{ strokeDasharray: `${Math.max(0, ((s.to - s.from) / cycleLength) * C - 3)} ${C}` }}
              transition={{ delay: 0.25 + i * 0.16, duration: 0.6, ease: EASE_OUT }}
              strokeDashoffset={-(s.from / cycleLength) * C}
              transform="rotate(-90 120 120)"
            />
          ))}
          {phase !== 'retard' && (
            <motion.g
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ ...SPRING_POP, delay: 0.25 + segments.length * 0.16 + 0.2 }}
            >
              <motion.circle
                cx={dot.x}
                cy={dot.y}
                fill={PHASE_COLOR[phase]}
                initial={{ r: 13, opacity: 0.35 }}
                animate={{ r: [13, 17, 13], opacity: [0.35, 0.12, 0.35] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut', delay: 1.4 }}
              />
              <circle cx={dot.x} cy={dot.y} r="7.5" fill="#F4F6FF" />
            </motion.g>
          )}
        </svg>
        <motion.div
          className="absolute inset-0 flex flex-col items-center justify-center text-center"
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.45, duration: 0.6, ease: EASE_OUT }}
        >
          <p className="font-display max-w-[11rem] text-[1.6rem] leading-[1.05] font-medium" style={{ color: PHASE_COLOR[phase] }}>
            {PHASE_LABEL[phase]}
          </p>
          <p className="mt-1 text-sm text-mist">Jour {cycleDay}</p>
          <p className="mt-3 max-w-[11rem] text-[0.95rem] leading-snug">{next}</p>
        </motion.div>
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

function FeelingButton({ entry, onOpen }: { entry: SymptomEntry | undefined; onOpen: () => void }) {
  const noted = entry ? entry.items.map((id) => SYMPTOMS[id]).filter(Boolean) : []
  return (
    <button
      type="button"
      onClick={onOpen}
      className="mx-auto mt-6 flex w-full max-w-[26rem] items-center justify-between gap-3 rounded-3xl border border-glow/25 bg-starlight/[0.04] px-5 py-3.5 text-left transition-colors hover:border-glow/50"
    >
      <span className="min-w-0">
        <span className="block">{noted.length || entry?.flow || entry?.note ? 'Aujourd’hui' : 'Comment tu te sens aujourd’hui ?'}</span>
        {noted.length > 0 && (
          <span className="mt-0.5 block truncate text-sm text-mist">
            {noted.map((x) => (x.emoji ? `${x.emoji} ${x.label}` : x.label)).join(' · ')}
          </span>
        )}
      </span>
      <span className="flex-none text-sm text-glow">{entry ? 'Modifier' : 'Noter'}</span>
    </button>
  )
}

function DailyTip({ state, today, patterns }: { state: Extract<CycleState, { status: 'ok' }>; today: ISODate; patterns: Pattern[] }) {
  const personal = personalTip(patterns, state)
  return (
    <section aria-label="Info du jour" className="glass mx-auto mt-4 max-w-[26rem] rounded-3xl px-5 py-4">
      <p className="flex items-center gap-2 text-xs tracking-[0.2em] uppercase" style={{ color: PHASE_COLOR[state.phase] }}>
        <span aria-hidden>✦</span> {personal ? 'Rien que pour toi' : 'Info du jour'}
      </p>
      <p className="mt-2 leading-relaxed text-starlight/90">{personal ?? dailyTip(state, today)}</p>
    </section>
  )
}

function History({
  periods,
  state,
  today,
  patterns,
  hasSymptoms,
}: {
  periods: Period[]
  state: Extract<CycleState, { status: 'ok' }>
  today: ISODate
  patterns: Pattern[]
  hasSymptoms: boolean
}) {
  const h = useMemo(() => cycleHistory(periods, today), [periods, today])
  const ongoing = state.phase === 'retard' ? state.cycleLength + state.delay : state.cycleDay
  const scale = Math.max(35, ...h.cycles.map((c) => c.length), ongoing)
  const pct = (n: number) => `${(Math.min(n, scale) / scale) * 100}%`

  return (
    <section className="mt-12" aria-labelledby="cycle-history">
      <h2 id="cycle-history" className="font-display text-2xl">
        Historique
      </h2>

      {h.cycles.length === 0 ? (
        <p className="mt-3 text-sm text-mist">L’historique apparaîtra dès le début des prochaines règles, avec la durée de chaque cycle.</p>
      ) : (
        <>
          <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
            <Stat label="Cycle moyen" value={`${h.avgCycle} j`} />
            <Stat label="Règles" value={`${h.avgPeriod} j`} />
            <Stat label="Écart" value={h.spread === null ? '–' : `${h.spread} j`} />
          </dl>
          {h.spread !== null && (
            <p className="mt-3 text-sm leading-relaxed text-mist">
              {h.spread <= 7
                ? `Cycles réguliers : de ${h.shortest} à ${h.longest} jours.`
                : `Cycles de ${h.shortest} à ${h.longest} jours. Jusqu’à 7 jours d’écart, on parle de cycles réguliers ; au-delà, c’est fréquent aussi, surtout en période de stress.`}
            </p>
          )}

          <ul className="mt-5 space-y-2.5" aria-label="Derniers cycles">
            {h.cycles.map((c, i) => (
              <li key={c.start} className="grid grid-cols-[3.75rem_1fr_4rem] items-center gap-3 text-sm">
                <span className="text-mist">{formatShort(c.start)}</span>
                <span
                  className="relative h-3 overflow-hidden rounded-full bg-starlight/[0.06]"
                  role="img"
                  aria-label={`Cycle de ${c.length} jours${c.periodLength ? `, règles de ${c.periodLength} jours` : ''}${c.outlier ? ', hors moyenne' : ''}`}
                >
                  <motion.span
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{ background: PHASE_COLOR.folliculaire, opacity: c.outlier ? 0.35 : 0.75 }}
                    initial={{ width: 0 }}
                    whileInView={{ width: pct(c.length) }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 + i * 0.08, duration: 0.8, ease: EASE_OUT }}
                  />
                  <motion.span
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{ background: PHASE_COLOR.menstruelle, opacity: c.periodLength ? 0.95 : 0.4 }}
                    initial={{ width: 0 }}
                    whileInView={{ width: pct(c.periodLength ?? state.periodLength) }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 + i * 0.08, duration: 0.5, ease: EASE_OUT }}
                  />
                </span>
                <span className="text-right tabular-nums">{c.length} j</span>
              </li>
            ))}
            <li className="grid grid-cols-[3.75rem_1fr_4rem] items-center gap-3 text-sm">
              <span className="text-mist">{formatShort(state.lastStart)}</span>
              <span
                className="relative h-3 overflow-hidden rounded-full bg-starlight/[0.06]"
                role="img"
                aria-label={`Cycle en cours, jour ${ongoing}`}
              >
                <motion.span
                  className="absolute inset-y-0 left-0 rounded-full border border-dashed"
                  style={{ borderColor: PHASE_COLOR.folliculaire }}
                  initial={{ width: 0 }}
                  whileInView={{ width: pct(ongoing) }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 + h.cycles.length * 0.08, duration: 0.8, ease: EASE_OUT }}
                />
              </span>
              <span className="text-right whitespace-nowrap text-mist">en cours</span>
            </li>
          </ul>
          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-mist">
            <Legend className="bg-rose" label="Règles" />
            <Legend className="bg-glow" label="Cycle" />
            <Legend className="border border-dashed border-glow" label="Cycle en cours" />
          </ul>

          <h3 className="font-display mt-8 text-xl">Ce qui revient</h3>
          {patterns.length ? (
            <ul className="mt-3 space-y-2">
              {patterns.map((p) => {
                const s = SYMPTOMS[p.id]
                return (
                  <li key={p.id} className="flex items-baseline gap-2 leading-snug">
                    <span className="flex-none">
                      {s.emoji && <span aria-hidden>{s.emoji} </span>}
                      {s.label}
                    </span>
                    <span className="text-sm text-mist">· {describePattern(p)}</span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="mt-2 text-sm leading-relaxed text-mist">
              {hasSymptoms
                ? 'Rien de régulier pour l’instant. Il faut un symptôme noté au moins 3 fois, au même moment, sur 2 cycles.'
                : 'Note tes ressentis quelques jours par cycle : ce qui revient au même moment apparaîtra ici.'}
            </p>
          )}
        </>
      )}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-glow/15 bg-starlight/[0.03] px-2 py-3">
      <dt className="text-xs text-mist">{label}</dt>
      <dd className="font-display mt-0.5 text-2xl tabular-nums lining-nums">{value}</dd>
    </div>
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
  symptoms,
  state,
  today,
  onSelect,
}: {
  periods: Period[]
  ovulations: Ovulation[]
  symptoms: SymptomEntry[]
  state: CycleState
  today: ISODate
  onSelect: (d: ISODate) => void
}) {
  const [offset, setOffset] = useState(0)
  const [dir, setDir] = useState(0)
  const go = (d: number) => {
    setDir(d)
    setOffset((o) => o + d)
  }
  const noted = useMemo(() => new Set(symptoms.map((x) => x.day)), [symptoms])
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
          className="press rounded-full p-2 text-mist hover:text-starlight"
          onClick={() => go(-1)}
          aria-label="Mois précédent"
        >
          <IconChevron dir="left" />
        </button>
        <AnimatePresence mode="wait" initial={false}>
          <motion.h2
            key={offset}
            className="font-display text-2xl capitalize"
            initial={{ opacity: 0, y: dir * 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -dir * 8 }}
            transition={{ duration: 0.18 }}
          >
            {format(month, 'MMMM yyyy', { locale: fr })}
          </motion.h2>
        </AnimatePresence>
        <button
          type="button"
          className="press rounded-full p-2 text-mist hover:text-starlight"
          onClick={() => go(1)}
          aria-label="Mois suivant"
        >
          <IconChevron />
        </button>
      </div>

      <div className="grid grid-cols-7 text-center">
        {['lu', 'ma', 'me', 'je', 've', 'sa', 'di'].map((d) => (
          <span key={d} className="pb-2.5 text-xs text-mist/70">
            {d}
          </span>
        ))}
      </div>
      <div className="overflow-hidden">
        <AnimatePresence mode="wait" initial={false} custom={dir}>
          <motion.div
            key={offset}
            custom={dir}
            className="grid grid-cols-7 gap-y-1.5 text-center"
            variants={{
              enter: (d: number) => ({ opacity: 0, x: d * 40 }),
              center: { opacity: 1, x: 0 },
              exit: (d: number) => ({ opacity: 0, x: -d * 40 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.22, ease: EASE_OUT }}
          >
            {days.map((date) => {
              const iso = toISO(date)
              const inMonth = date.getMonth() === currentMonth
              const mark = markDay(iso, periods, ovulations, state)
              const isToday = iso === today
              const hasNote = noted.has(iso)
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => onSelect(iso)}
                  aria-label={`${formatLong(iso)}${mark ? `, ${MARK_LABEL[mark]}` : ''}${hasNote ? ', ressenti noté' : ''}`}
                  className={`press relative mx-auto flex h-10 w-10 items-center justify-center rounded-full text-[0.95rem] tabular-nums ${
                    inMonth ? '' : 'opacity-30'
                  } ${mark ? MARK_STYLE[mark] : 'text-starlight/85 hover:bg-glow/10'} ${
                    isToday ? 'ring-2 ring-starlight ring-offset-2 ring-offset-night' : ''
                  }`}
                >
                  {date.getDate()}
                  {hasNote && (
                    <span
                      aria-hidden
                      className={`absolute bottom-[3px] left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${mark === 'period' || mark === 'ovulation' ? 'bg-night' : 'bg-starlight'}`}
                    />
                  )}
                </button>
              )
            })}
          </motion.div>
        </AnimatePresence>
      </div>

      <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-mist">
        <Legend className="bg-rose" label="Règles" />
        <Legend className="border border-dashed border-rose" label="Règles prévues" />
        <Legend className="bg-teal" label="Ovulation" />
        <Legend className="border border-dashed border-teal" label="Ovulation estimée" />
        <li className="flex items-center gap-2">
          <span className="flex h-3 w-3 items-center justify-center">
            <span className="h-1 w-1 rounded-full bg-starlight" />
          </span>
          Ressenti noté
        </li>
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
  entry,
  onSaveSymptoms,
}: {
  day: ISODate
  today: ISODate
  periods: Period[]
  ovulations: Ovulation[]
  state: CycleState
  busy: boolean
  run: (fn: () => Promise<void>) => Promise<void>
  entry: SymptomEntry | undefined
  onSaveSymptoms: (e: SymptomEntry) => Promise<void>
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
        <SymptomPicker key={day} day={day} entry={entry} inPeriod={Boolean(inPeriod)} onSave={onSaveSymptoms} />
      )}
      {!future && (
        <div className="space-y-3 pt-4">
          <p className="text-xs tracking-[0.2em] text-mist uppercase">Cycle</p>
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

/** Pastilles de ressenti : chaque toucher enregistre tout de suite. */
function SymptomPicker({
  day,
  entry,
  inPeriod,
  onSave,
}: {
  day: ISODate
  entry: SymptomEntry | undefined
  inPeriod: boolean
  onSave: (e: SymptomEntry) => Promise<void>
}) {
  const [value, setValue] = useState<SymptomEntry>(entry ?? { day, items: [], flow: null, note: null })
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const latest = useRef(value)
  const noteTimer = useRef<number | undefined>(undefined)

  const save = async (next: SymptomEntry) => {
    latest.current = next
    setValue(next)
    setStatus('saving')
    try {
      await onSave(next)
      if (latest.current === next) setStatus('saved')
    } catch {
      if (latest.current === next) setStatus('error')
    }
  }

  // Note : enregistrée après une courte pause de frappe, et en quittant la fiche
  useEffect(
    () => () => {
      if (noteTimer.current !== undefined) {
        window.clearTimeout(noteTimer.current)
        void onSave(latest.current)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const toggle = (id: string) => {
    const cur = latest.current
    void save({ ...cur, items: cur.items.includes(id) ? cur.items.filter((x) => x !== id) : [...cur.items, id] })
  }

  const chip = (pressed: boolean) =>
    `press rounded-full border px-3.5 py-2 text-[0.95rem] ${
      pressed
        ? 'border-glow bg-glow/20 text-starlight shadow-[0_0_14px_rgb(46_91_255/0.35)]'
        : 'border-glow/20 text-starlight/80 hover:border-glow/45'
    }`

  return (
    <div className="space-y-5 pt-1">
      {SYMPTOM_GROUPS.map((g) => (
        <fieldset key={g.title}>
          <legend className="mb-2 text-xs tracking-[0.2em] text-mist uppercase">{g.title}</legend>
          <div className="flex flex-wrap gap-2">
            {g.items.map((s) => {
              const on = value.items.includes(s.id)
              return (
                <button key={s.id} type="button" aria-pressed={on} onClick={() => toggle(s.id)} className={chip(on)}>
                  {s.emoji && <span aria-hidden>{s.emoji} </span>}
                  {s.label}
                </button>
              )
            })}
          </div>
        </fieldset>
      ))}

      {(inPeriod || value.flow) && (
        <fieldset>
          <legend className="mb-2 text-xs tracking-[0.2em] text-mist uppercase">Flux</legend>
          <div className="flex flex-wrap gap-2">
            {FLOWS.map((f) => {
              const on = value.flow === f.id
              return (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => save({ ...latest.current, flow: on ? null : f.id })}
                  className={chip(on)}
                >
                  {f.label}
                </button>
              )
            })}
          </div>
        </fieldset>
      )}

      <label className="block">
        <span className="mb-2 block text-xs tracking-[0.2em] text-mist uppercase">Note</span>
        <textarea
          className="field min-h-[4.5rem] resize-none"
          rows={2}
          maxLength={280}
          placeholder="Facultatif"
          value={value.note ?? ''}
          onChange={(e) => {
            const next = { ...latest.current, note: e.target.value }
            latest.current = next
            setValue(next)
            window.clearTimeout(noteTimer.current)
            noteTimer.current = window.setTimeout(() => {
              noteTimer.current = undefined
              void save(latest.current)
            }, 700)
          }}
        />
      </label>

      <p aria-live="polite" className={`h-5 text-sm ${status === 'error' ? 'text-rose' : 'text-mist'}`}>
        {status === 'saving'
          ? 'Enregistrement…'
          : status === 'saved'
            ? 'Enregistré ✓'
            : status === 'error'
              ? 'Pas enregistré, réessaie dans un instant.'
              : ''}
      </p>
    </div>
  )
}
