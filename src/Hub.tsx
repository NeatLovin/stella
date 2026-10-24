import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Loading } from './components/Page'
import { TabBar } from './components/TabBar'
import { WaterReminder } from './components/WaterReminder'
import { clearWelcomeFlag, hasWelcomeFlag, Welcome } from './components/Welcome'
import { SettingsContext, WelcomeContext } from './context'
import { useLoad } from './hooks/useLoad'
import { api } from './lib/api'
import { Cycle } from './pages/Cycle'
import { Home } from './pages/Home'
import { Jar } from './pages/Jar'
import { Timeline } from './pages/Timeline'
import { Wishlist } from './pages/Wishlist'

/** Tout le site après connexion (chargé séparément de l'écran de mot de passe). */
export default function Hub() {
  const { data: settings } = useLoad(api.getSettings, 'settings')
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
          enter: (d: number) => ({ opacity: 0, x: d * shift }),
          center: { opacity: 1, x: 0 },
          exit: (d: number) => ({ opacity: 0, x: -d * shift }),
        }}
        initial="enter"
        animate="center"
        exit="exit"
        transition={{ duration: reduced ? 0.01 : 0.22, ease: [0.22, 1, 0.36, 1] }}
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
