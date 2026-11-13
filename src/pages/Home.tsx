import { differenceInCalendarDays, intervalToDuration } from 'date-fns'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSettings, useShowWelcome } from '../context'
import { Page } from '../components/Page'
import { PhotoWall } from '../components/PhotoWall'
import { AdventCard } from '../components/Advent'
import { BackupButton } from '../components/Backup'
import { BinaryStar } from '../components/BinaryStar'
import { Games } from '../components/Games'
import { LilyEgg } from '../components/LilyEgg'
import { MilestoneCelebration } from '../components/MilestoneCelebration'
import { DESKTOP, useMediaQuery } from '../hooks/useMediaQuery'
import { formatLong, parse, toISO, todayISO } from '../lib/dates'
import { isDecember } from '../lib/advent'
import { milestoneOn, nextMilestone } from '../lib/milestones'
import { EASE_OUT, rise, stagger } from '../lib/motion'

const plural = (n: number, one: string, many: string) => (n > 1 ? many : one)

export function Home() {
  const { her_name, his_name, couple_start, welcome } = useSettings()
  const showWelcome = useShowWelcome()
  const desktop = useMediaQuery(DESKTOP)
  const [now, setNow] = useState(() => new Date())
  // Surprise cachée : taper plusieurs fois d'affilée sur son prénom fait éclore le lys
  const [lily, setLily] = useState(false)
  const [party, setParty] = useState(false)
  const [bump, setBump] = useState(0)
  const taps = useRef<number[]>([])
  const tapName = () => {
    const t = Date.now()
    taps.current = [...taps.current.filter((x) => t - x < 2000), t]
    if (taps.current.length >= 3) setBump((b) => b + 1)
    if (taps.current.length >= 6) {
      taps.current = []
      setLily(true)
    }
  }

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
  const today = toISO(now)
  const todayMilestone = useMemo(() => milestoneOn(couple_start, today), [couple_start, today])
  const upcoming = useMemo(() => nextMilestone(couple_start, today), [couple_start, today])

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
        variants={stagger(0.1, 0.1)}
        initial="hidden"
        animate="show"
      >
        <motion.div className="flex flex-col" variants={stagger(0.09)}>
          <motion.h1
            variants={rise}
            className="font-display glow-text text-[clamp(3.1rem,13.5vw,4.75rem)] lg:text-[clamp(4.5rem,6.2vw,6.5rem)] leading-[0.95] font-medium tracking-tight"
          >
            <motion.span
              key={bump}
              className="inline-block cursor-default select-none [touch-action:manipulation]"
              animate={bump ? { scale: [1, 1.05, 1] } : undefined}
              transition={{ duration: 0.22 }}
              onClick={tapName}
            >
              {her_name}
            </motion.span>
            <span className="block pl-10 text-glow italic">&amp; {his_name}</span>
          </motion.h1>
          <motion.p variants={rise} className="mt-5 text-mist">
            Ensemble depuis le {formatLong(couple_start)}
          </motion.p>

          <motion.div variants={rise} className="mt-10 flex items-stretch gap-3">
            <div
              aria-label="Temps passé ensemble"
              className="relative isolate grid shrink-0 grid-cols-[auto_auto] content-start items-baseline gap-x-4 gap-y-1"
            >
              {/* L'étoile binaire : nos deux étoiles en orbite autour du compteur */}
              <BinaryStar className="absolute -top-8 -left-4 -z-10 h-[calc(100%+4rem)] w-[calc(100%+3rem)] lg:-inset-x-12 lg:-inset-y-10 lg:h-[calc(100%+5rem)] lg:w-[calc(100%+6rem)]" />
              {rows.map(({ n, unit, live }, i) => (
                <div key={i} className="contents">
                  <span
                    className={`font-display text-right text-[clamp(3.6rem,16.5vw,5rem)] lg:text-[clamp(4.25rem,5vw,5.75rem)] leading-none font-medium tabular-nums lining-nums ${live ? 'text-glow' : ''}`}
                  >
                    <Rolling n={n} />
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
          </motion.div>

          <motion.p variants={rise} className="mt-12 flex items-center gap-2 text-sm text-mist">
            <span className="text-gold">✦</span>
            <span>
              {dayNumber}
              <sup>e</sup> jour ensemble
            </span>
          </motion.p>
          {todayMilestone ? (
            <motion.button
              variants={rise}
              type="button"
              onClick={() => setParty(true)}
              className="mt-2 self-start text-sm text-gold underline-offset-4 hover:underline"
            >
              Aujourd’hui : {todayMilestone.n} {todayMilestone.label} ✦
            </motion.button>
          ) : (
            upcoming &&
            upcoming.inDays <= 14 && (
              <motion.p variants={rise} className="mt-2 text-sm text-mist/80">
                {upcoming.milestone.n} {upcoming.milestone.label} {upcoming.inDays === 1 ? 'demain' : `dans ${upcoming.inDays} jours`}
              </motion.p>
            )
          )}
          {welcome && (
            <motion.button
              variants={rise}
              type="button"
              onClick={showWelcome}
              className="mt-3 self-start text-sm text-glow underline-offset-4 hover:underline"
            >
              Relire mon mot
            </motion.button>
          )}

          {isDecember(todayISO()) && (
            <motion.div variants={rise} className="flex flex-col">
              <AdventCard />
            </motion.div>
          )}

          <motion.div variants={rise} className="flex flex-col">
            <Games />
          </motion.div>

          <motion.div variants={rise} className="flex flex-col">
            <BackupButton />
          </motion.div>
        </motion.div>

        {desktop && (
          <motion.div
            className="relative mx-auto aspect-[1/1] w-full max-w-[36rem]"
            variants={{
              hidden: { opacity: 0, scale: 0.94, filter: 'blur(6px)' },
              show: {
                opacity: 1,
                scale: 1,
                filter: 'blur(0px)',
                transitionEnd: { filter: 'none' },
                transition: { duration: 0.9, ease: EASE_OUT },
              },
            }}
          >
            <PhotoWall spread />
          </motion.div>
        )}
      </motion.section>
      <LilyEgg open={lily} onClose={() => setLily(false)} />
      {todayMilestone && <MilestoneCelebration milestone={todayMilestone} open={party} onClose={() => setParty(false)} />}
    </Page>
  )
}

/** Chiffre qui défile vers le haut quand il change (secondes, minutes…). */
function Rolling({ n }: { n: number }) {
  return (
    <span className="relative inline-flex overflow-hidden align-bottom">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={n}
          className="inline-block"
          initial={{ y: '55%', opacity: 0, filter: 'blur(3px)' }}
          animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
          exit={{ y: '-55%', opacity: 0, filter: 'blur(3px)' }}
          transition={{ duration: 0.38, ease: EASE_OUT }}
        >
          {n}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}
