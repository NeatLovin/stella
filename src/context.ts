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

export const WelcomeContext = createContext<() => void>(() => {})
/** Rouvre le mot d'accueil (lien « Relire mon mot » sur l'accueil). */
export const useShowWelcome = () => useContext(WelcomeContext)
