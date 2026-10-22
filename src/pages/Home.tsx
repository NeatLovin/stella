import { differenceInCalendarDays, intervalToDuration } from 'date-fns'
import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useSettings } from '../App'
import { Page } from '../components/Page'
import { formatLong, parse } from '../lib/dates'

const plural = (n: number, one: string, many: string) => (n > 1 ? many : one)

export function Home() {
  const { her_name, his_name, couple_start } = useSettings()
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const start = parse(couple_start)
  const d = intervalToDuration({ start, end: now })
  const years = d.years ?? 0
  const months = d.months ?? 0
  const days = d.days ?? 0
  const dayNumber = differenceInCalendarDays(now, start) + 1

  const rows = [
    years > 0 && { n: years, unit: plural(years, 'an', 'ans') },
    (years > 0 || months > 0) && { n: months, unit: 'mois' },
    { n: days, unit: plural(days, 'jour', 'jours') },
    { n: d.hours ?? 0, unit: plural(d.hours ?? 0, 'heure', 'heures') },
    { n: d.minutes ?? 0, unit: plural(d.minutes ?? 0, 'minute', 'minutes') },
    { n: d.seconds ?? 0, unit: plural(d.seconds ?? 0, 'seconde', 'secondes'), live: true },
  ].filter(Boolean) as { n: number; unit: string; live?: boolean }[]

  return (
    <Page>
      <motion.section
        className="flex min-h-[calc(100dvh-var(--tabbar-h)-6rem)] flex-col justify-center md:min-h-[70dvh]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2 }}
      >
        <h1 className="font-display glow-text text-[3.4rem] leading-[0.95] font-medium tracking-tight sm:text-7xl">
          {her_name}
          <span className="block pl-10 text-glow italic">&amp; {his_name}</span>
        </h1>
        <p className="mt-5 text-mist">Ensemble depuis le {formatLong(couple_start)}</p>

        <div aria-label="Temps passé ensemble" className="mt-10 grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-1">
          {rows.map(({ n, unit, live }, i) => (
            <div key={i} className="contents">
              <span className={`font-display text-right text-7xl leading-none font-medium tabular-nums lining-nums ${live ? 'text-glow' : ''}`}>{n}</span>
              <span className="font-display text-2xl text-mist italic">{unit}</span>
            </div>
          ))}
        </div>

        <p className="mt-12 flex items-center gap-2 text-sm text-mist">
          <span className="text-gold">✦</span>
          <span>
            {dayNumber}
            <sup>e</sup> jour ensemble
          </span>
        </p>
      </motion.section>
    </Page>
  )
}
