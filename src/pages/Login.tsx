import { motion } from 'motion/react'
import { useState, type FormEvent } from 'react'
import { setWelcomeFlag } from '../components/Welcome'
import { api, isDemo } from '../lib/api'

export function Login() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!password) return
    setBusy(true)
    setError(null)
    try {
      setWelcomeFlag()
      await api.signIn(password)
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      setError(msg === 'wrong-password' ? 'Ce n’est pas le bon mot de passe.' : `Connexion impossible : ${msg}`)
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <motion.form
        onSubmit={submit}
        className="flex w-full max-w-xs flex-col items-center text-center"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: 'easeOut' }}
      >
        <motion.svg
          viewBox="0 0 24 24"
          className="mb-8 h-14 w-14 text-glow drop-shadow-[0_0_18px_rgb(125_162_255/0.9)]"
          aria-hidden
          animate={{ scale: [1, 1.08, 1], opacity: [0.85, 1, 0.85] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <path fill="currentColor" d="M12 2c.9 5.8 4.2 9.1 10 10-5.8.9-9.1 4.2-10 10-.9-5.8-4.2-9.1-10-10 5.8-.9 9.1-4.2 10-10Z" />
        </motion.svg>

        <label htmlFor="password" className="font-display mb-5 text-3xl italic">
          Pour toi seulement
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          className="field text-center tracking-widest"
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'login-error' : undefined}
        />
        <button type="submit" className="btn-primary mt-4 w-full" disabled={busy || !password}>
          {busy ? 'Connexion…' : 'Entrer'}
        </button>
        <p id="login-error" role="alert" className="mt-4 min-h-6 text-sm text-rose">
          {error}
        </p>
        {isDemo && <p className="text-xs text-mist/60">Mode démo : mot de passe « demo »</p>}
      </motion.form>
    </main>
  )
}
