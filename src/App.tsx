import { AnimatePresence, MotionConfig, useReducedMotion } from 'motion/react'
import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { CursorGlow } from './components/CursorGlow'
import { CursorTrail } from './components/CursorTrail'
import { OfflineBanner } from './components/OfflineBanner'
import { Splash } from './components/Splash'
import { Loading } from './components/Page'
import { StarrySky } from './components/StarrySky'
import { AppReadyContext, SplashGoneContext } from './context'
import { api, configError } from './lib/api'
import { forgetTrusted, isTrusted, markTrusted } from './lib/offline'
import { Login } from './pages/Login'

const loadHub = () => import('./Hub')
const Hub = lazy(loadHub)

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

// L'écran de chargement reste au moins le temps de son animation, et au plus quelques secondes
const SPLASH_MIN = 1900
const SPLASH_MIN_REDUCED = 500
const SPLASH_MAX = 7000

export default function App() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const reduced = useReducedMotion()
  const [minDone, setMinDone] = useState(false)
  const [maxDone, setMaxDone] = useState(false)
  const [hubReady, setHubReady] = useState(false)
  const [splashGone, setSplashGone] = useState(false)
  const markReady = useCallback(() => setHubReady(true), [])

  useEffect(() => {
    const min = window.setTimeout(() => setMinDone(true), reduced ? SPLASH_MIN_REDUCED : SPLASH_MIN)
    const max = window.setTimeout(() => setMaxDone(true), SPLASH_MAX)
    return () => {
      window.clearTimeout(min)
      window.clearTimeout(max)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const ready = signedIn === false || (signedIn === true && hubReady)
  const showSplash = !configError && !maxDone && !(minDone && ready)

  useEffect(() => {
    if (configError) return
    // Hors-ligne, la session ne peut pas être renouvelée : un appareil déjà connecté
    // rouvre quand même le site avec les données gardées en mémoire.
    const offlineOk = () => !navigator.onLine && isTrusted()
    void api
      .getSession()
      .then((s) => setSignedIn(Boolean(s) || offlineOk()))
      .catch(() => setSignedIn(offlineOk()))
    // Précharge le reste du site pendant que l'écran de connexion s'affiche
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 300))
    idle(() => void loadHub())
    return api.onAuthChange((ok, event) => {
      if (ok) markTrusted()
      if (event === 'SIGNED_OUT') forgetTrusted()
      setSignedIn(ok || offlineOk())
    })
  }, [])

  if (configError) {
    return (
      <>
        <StarrySky />
        <CursorGlow />
        <CursorTrail />
        <ConfigMissing />
      </>
    )
  }

  return (
    <MotionConfig reducedMotion="user">
      <StarrySky />
      <CursorGlow />
      <CursorTrail />
      <OfflineBanner />
      <AppReadyContext.Provider value={markReady}>
        <SplashGoneContext.Provider value={splashGone}>
          {signedIn === null ? (
            <Loading />
          ) : signedIn ? (
            <Suspense fallback={<Loading />}>
              <Hub />
            </Suspense>
          ) : (
            <Login />
          )}
        </SplashGoneContext.Provider>
      </AppReadyContext.Provider>
      <AnimatePresence onExitComplete={() => setSplashGone(true)}>{showSplash && <Splash key="splash" />}</AnimatePresence>
    </MotionConfig>
  )
}
