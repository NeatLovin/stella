import { lazy, Suspense, useEffect, useState } from 'react'
import { CursorGlow } from './components/CursorGlow'
import { CursorTrail } from './components/CursorTrail'
import { OfflineBanner } from './components/OfflineBanner'
import { Loading } from './components/Page'
import { StarrySky } from './components/StarrySky'
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

export default function App() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null)

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
    <>
      <StarrySky />
      <CursorGlow />
      <CursorTrail />
      <OfflineBanner />
      {signedIn === null ? (
        <Loading />
      ) : signedIn ? (
        <Suspense fallback={<Loading />}>
          <Hub />
        </Suspense>
      ) : (
        <Login />
      )}
    </>
  )
}
