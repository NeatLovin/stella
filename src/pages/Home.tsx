import { differenceInCalendarDays, intervalToDuration } from 'date-fns'
import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useSettings, useShowWelcome } from '../context'
import { Page } from '../components/Page'
import { PhotoWall } from '../components/PhotoWall'
import { DESKTOP, useMediaQuery } from '../hooks/useMediaQuery'
import { formatLong, parse } from '../lib/dates'

const plural = (n: number, one: string, many: string) => (n > 1 ? many : one)

export function Home() {
  const { her_name, his_name, couple_start, welcome } = useSettings()
  const showWelcome = useShowWelcome()
  const desktop = useMediaQuery(DESKTOP)
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
    <Page wide>
      <motion.section
        className="flex min-h-[calc(100dvh-var(--tabbar-h)-6rem)] flex-col justify-center md:min-h-[70dvh] lg:grid lg:min-h-[calc(100dvh-var(--tabbar-h)-9rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-center lg:gap-16 xl:gap-24"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2 }}
      >
        <div className="flex flex-col">
          <h1 className="font-display glow-text text-[clamp(3.1rem,13.5vw,4.75rem)] lg:text-[clamp(4.5rem,6.2vw,6.5rem)] leading-[0.95] font-medium tracking-tight">
            {her_name}
            <span className="block pl-10 text-glow italic">&amp; {his_name}</span>
          </h1>
          <p className="mt-5 text-mist">Ensemble depuis le {formatLong(couple_start)}</p>

          <div className="mt-10 flex items-stretch gap-3">
            <div
              aria-label="Temps passé ensemble"
              className="grid shrink-0 grid-cols-[auto_auto] content-start items-baseline gap-x-4 gap-y-1"
            >
              {rows.map(({ n, unit, live }, i) => (
                <div key={i} className="contents">
                  <span
                    className={`font-display text-right text-[clamp(3.6rem,16.5vw,5rem)] lg:text-[clamp(4.25rem,5vw,5.75rem)] leading-none font-medium tabular-nums lining-nums ${live ? 'text-glow' : ''}`}
                  >
                    {n}
                  </span>
                  <span className="font-display text-[clamp(1.35rem,6vw,1.7rem)] lg:text-[1.9rem] text-mist italic">{unit}</span>
                </div>
              ))}
            </div>
            {!desktop && (
              <div className="relative min-h-64 min-w-0 flex-1 md:max-w-64">
                <PhotoWall />
              </div>
            )}
          </div>

          <p className="mt-12 flex items-center gap-2 text-sm text-mist">
            <span className="text-gold">✦</span>
            <span>
              {dayNumber}
              <sup>e</sup> jour ensemble
            </span>
          </p>
          {welcome && (
            <button type="button" onClick={showWelcome} className="mt-3 self-start text-sm text-glow underline-offset-4 hover:underline">
              Relire mon mot
            </button>
          )}
        </div>

        {desktop && (
          <div className="relative mx-auto aspect-[1/1] w-full max-w-[36rem]">
            <PhotoWall spread />
          </div>
        )}
      </motion.section>
    </Page>
  )
}
