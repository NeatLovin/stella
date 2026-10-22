import { createContext, useContext, useEffect, useState } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Loading } from './components/Page'
import { StarrySky } from './components/StarrySky'
import { TabBar } from './components/TabBar'
import { useLoad } from './hooks/useLoad'
import { api, configError, type Settings } from './lib/api'
import { Cycle } from './pages/Cycle'
import { Home } from './pages/Home'
import { Jar } from './pages/Jar'
import { Login } from './pages/Login'
import { Timeline } from './pages/Timeline'
import { Wishlist } from './pages/Wishlist'

const SettingsContext = createContext<Settings>({ her_name: '', his_name: '', couple_start: '2026-07-30' })
export const useSettings = () => useContext(SettingsContext)

function Hub() {
  const { data: settings } = useLoad(api.getSettings)
  if (!settings) return <Loading />
  return (
    <SettingsContext.Provider value={settings}>
      <HashRouter>
        <TabBar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/timeline" element={<Timeline />} />
          <Route path="/bocal" element={<Jar />} />
          <Route path="/wishlist" element={<Wishlist />} />
          <Route path="/cycle" element={<Cycle />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </SettingsContext.Provider>
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
