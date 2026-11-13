import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { MilestoneCelebration, milestoneSeen } from './components/MilestoneCelebration'
import { Loading } from './components/Page'
import { BackToTop } from './components/BackToTop'
import { Snow } from './components/Snow'
import { TabBar } from './components/TabBar'
import { WaterReminder } from './components/WaterReminder'
import { clearWelcomeFlag, hasWelcomeFlag, Welcome } from './components/Welcome'
import { SettingsContext, useAppReady, useSplashGone, WelcomeContext } from './context'
import { useLoad } from './hooks/useLoad'
import { api } from './lib/api'
import { todayISO, type ISODate } from './lib/dates'
import { milestoneOn } from './lib/milestones'
import { EASE_OUT } from './lib/motion'
import { Cine } from './pages/Cine'
import { Cycle } from './pages/Cycle'
import { Home } from './pages/Home'
import { Jar } from './pages/Jar'
import { Timeline } from './pages/Timeline'
import { Wishlist } from './pages/Wishlist'

/** Tout le site après connexion (chargé séparément de l'écran de mot de passe). */
export default function Hub() {
  const { data: settings } = useLoad(api.getSettings, 'settings')
  const [welcome, setWelcome] = useState(hasWelcomeFlag)
  const ready = useAppReady()
  useEffect(() => {
    if (settings) ready()
  }, [settings, ready])
  if (!settings) return <Loading />
  if (welcome && settings.welcome) {
    return (
      <Welcome
        text={settings.welcome}
        onDone={() => {
          clearWelcomeFlag()
          setWelcome(false)
        }}
      />
    )
  }
  return (
    <SettingsContext.Provider value={settings}>
      <WelcomeContext.Provider value={() => setWelcome(true)}>
        <HashRouter>
          <Snow />
          <BackToTop />
          <TabBar />
          <WaterReminder sponsor={settings.his_name} />
          <AnimatedRoutes />
          <MilestoneAuto start={settings.couple_start} />
        </HashRouter>
      </WelcomeContext.Provider>
    </SettingsContext.Provider>
  )
}

/** Le jour d'un jalon, la fête s'ouvre toute seule (une fois par appareil). */
function MilestoneAuto({ start }: { start: ISODate }) {
  const m = useMemo(() => milestoneOn(start, todayISO()), [start])
  const [open, setOpen] = useState(() => Boolean(m && !milestoneSeen(m)))
  const splashGone = useSplashGone()
  if (!m) return null
  return <MilestoneCelebration milestone={m} open={open && splashGone} onClose={() => setOpen(false)} />
}

const ORDER = ['/', '/timeline', '/bocal', '/wishlist', '/cine', '/cycle']

/** Transition douce entre onglets : fondu + léger glissement dans le sens de la navigation. */
function AnimatedRoutes() {
  const location = useLocation()
  const reduced = useReducedMotion()
  const [prev, setPrev] = useState(location.pathname)
  const [dir, setDir] = useState(0)
  if (prev !== location.pathname) {
    setDir(Math.sign(ORDER.indexOf(location.pathname) - ORDER.indexOf(prev)))
    setPrev(location.pathname)
  }
  const shift = reduced ? 0 : 24

  // Le ciel « voyage » dans le sens de la navigation
  useEffect(() => {
    if (dir) window.dispatchEvent(new CustomEvent('stella:warp', { detail: dir }))
  }, [location.pathname, dir])

  return (
    <AnimatePresence mode="wait" initial={false} custom={dir}>
      <motion.div
        key={location.pathname}
        custom={dir}
        variants={{
          enter: (d: number) => ({ opacity: 0, x: d * shift, filter: reduced ? 'none' : 'blur(3px)' }),
          center: {
            opacity: 1,
            x: 0,
            filter: 'blur(0px)',
            transitionEnd: { filter: 'none' },
            transition: { duration: reduced ? 0.01 : 0.34, ease: EASE_OUT },
          },
          exit: (d: number) => ({
            opacity: 0,
            x: -d * shift * 0.6,
            filter: reduced ? 'none' : 'blur(3px)',
            transition: { duration: reduced ? 0.01 : 0.16, ease: 'easeIn' },
          }),
        }}
        initial="enter"
        animate="center"
        exit="exit"
        onAnimationStart={(def) => def === 'center' && window.scrollTo({ top: 0 })}
      >
        <Routes location={location}>
          <Route path="/" element={<Home />} />
          <Route path="/timeline" element={<Timeline />} />
          <Route path="/bocal" element={<Jar />} />
          <Route path="/wishlist" element={<Wishlist />} />
          <Route path="/cine" element={<Cine />} />
          <Route path="/cycle" element={<Cycle />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  )
}
