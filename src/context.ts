import { createContext, useContext } from 'react'
import type { Settings } from './lib/api'

export const SettingsContext = createContext<Settings>({
  her_name: '',
  his_name: '',
  couple_start: '2026-07-30',
  welcome: '',
  flower_message: '',
})
export const useSettings = () => useContext(SettingsContext)

/** Le site est prêt à s'afficher (réglages chargés) : l'écran de chargement peut partir. */
export const AppReadyContext = createContext<() => void>(() => {})
export const useAppReady = () => useContext(AppReadyContext)

/** L'écran de chargement a fini de disparaître (pour ne rien lancer derrière lui). */
export const SplashGoneContext = createContext(true)
export const useSplashGone = () => useContext(SplashGoneContext)

export const WelcomeContext = createContext<() => void>(() => {})
/** Rouvre le mot d'accueil (lien « Relire mon mot » sur l'accueil). */
export const useShowWelcome = () => useContext(WelcomeContext)
