import { createContext, useContext, useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Loading } from './components/Page'
import { clearWelcomeFlag, hasWelcomeFlag, Welcome } from './components/Welcome'
import { StarrySky } from './components/StarrySky'
import { TabBar } from './components/TabBar'
import { WaterReminder } from './components/WaterReminder'
import { useLoad } from './hooks/useLoad'
import { api, configError, type Settings } from './lib/api'
import { Cycle } from './pages/Cycle'
import { Home } from './pages/Home'
import { Jar } from './pages/Jar'
import { Login } from './pages/Login'
import { Timeline } from './pages/Timeline'
import { Wishlist } from './pages/Wishlist'

const SettingsContext = createContext<Settings>({ her_name: '', his_name: '', couple_start: '2026-07-30', welcome: '' })
export const useSettings = () => useContext(SettingsContext)

const WelcomeContext = createContext<() => void>(() => {})
/** Rouvre le mot d'accueil (lien « Relire mon mot » sur l'accueil). */
export const useShowWelcome = () => useContext(WelcomeContext)

function Hub() {
  const { data: settings } = useLoad(api.getSettings)
  const [welcome, setWelcome] = useState(hasWelcomeFlag)
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
          <TabBar />
          <WaterReminder sponsor={settings.his_name} />
          <AnimatedRoutes />
        </HashRouter>
      </WelcomeContext.Provider>
    </SettingsContext.Provider>
  )
}

const ORDER = ['/', '/timeline', '/bocal', '/wishlist', '/cycle']

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

  return (
    <AnimatePresence mode="wait" initial={false} custom={dir}>
      <motion.div
        key={location.pathname}
        custom={dir}
        variants={{
          enter: (d: number) => ({ opacity: 0, x: d * shift, filter: reduced ? 'none' : 'blur(4px)' }),
          center: { opacity: 1, x: 0, filter: 'blur(0px)' },
          exit: (d: number) => ({ opacity: 0, x: -d * shift, filter: reduced ? 'none' : 'blur(4px)' }),
        }}
        initial="enter"
        animate="center"
        exit="exit"
        transition={{ duration: reduced ? 0.01 : 0.28, ease: [0.22, 1, 0.36, 1] }}
        onAnimationStart={(def) => def === 'center' && window.scrollTo({ top: 0 })}
      >
        <Routes location={location}>
          <Route path="/" element={<Home />} />
          <Route path="/timeline" element={<Timeline />} />
          <Route path="/bocal" element={<Jar />} />
          <Route path="/wishlist" element={<Wishlist />} />
          <Route path="/cycle" element={<Cycle />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  )
}

function ConfigMissing() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6 text-center">
      <div className="max-w-sm">
        <h1 className="font-display text-3xl">Bientôt prêt</h1>
        <p className="mt-3 text-mist">Le site n’est pas encore relié à sa base de données.</p>
        <p className="mt-4 text-xs text-mist/60">{configError}</p>
      </div>
    </main>
  )
}

export default function App() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null)

  useEffect(() => {
    if (configError) return
    void api.getSession().then((s) => setSignedIn(Boolean(s)))
    return api.onAuthChange(setSignedIn)
  }, [])

  if (configError) {
    return (
      <>
        <StarrySky />
        <ConfigMissing />
      </>
    )
  }

  return (
    <>
      <StarrySky />
      {signedIn === null ? <Loading /> : signedIn ? <Hub /> : <Login />}
    </>
  )
}
