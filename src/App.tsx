import { lazy, Suspense, useEffect, useState } from 'react'
import { CursorGlow } from './components/CursorGlow'
import { Loading } from './components/Page'
import { StarrySky } from './components/StarrySky'
import { api, configError } from './lib/api'
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
    void api.getSession().then((s) => setSignedIn(Boolean(s)))
    // Précharge le reste du site pendant que l'écran de connexion s'affiche
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 300))
    idle(() => void loadHub())
    return api.onAuthChange(setSignedIn)
  }, [])

  if (configError) {
    return (
      <>
        <StarrySky />
      <CursorGlow />
        <ConfigMissing />
      </>
    )
  }

  return (
    <>
      <StarrySky />
      <CursorGlow />
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
