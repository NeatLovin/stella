import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { useDialog } from '../hooks/useDialog'
import { drawJude, STAGES } from '../lib/jude'
import { createJudeGame, EMPTY_SAVE, type JudeSave, type Weapon } from '../lib/judeGame'

const SAVE_KEY = 'stella.jude'

export function readJude(): JudeSave {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null') as JudeSave | null
    return raw && Array.isArray(raw.holes) ? raw : EMPTY_SAVE
  } catch {
    return EMPTY_SAVE
  }
}
function writeJude(save: JudeSave) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save))
  } catch {
    /* stockage indisponible : Jude repart neuf à la prochaine visite */
  }
}

const precision = (s: JudeSave) => (s.shots ? Math.round((s.hits / s.shots) * 100) : 100)

/** Petit Jude dans son état actuel (menu des jeux). */
export function JudeThumb({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current!
    const draw = () => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (!w) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = w * dpr
      canvas.height = h * dpr
      const ctx = canvas.getContext('2d')!
      const s = Math.min(w / 200, h / 262)
      ctx.setTransform(dpr * s, 0, 0, dpr * s, ((w - 200 * s) / 2) * dpr, 0)
      const save = readJude()
      drawJude(ctx, save.holes, save.holes.length)
    }
    draw()
    void document.fonts?.ready.then(draw)
  }, [])
  return <canvas ref={ref} aria-hidden className={className} />
}

/** Stand de tir plein écran sur Jude. */
export function JudeShoot({ open, onClose }: { open: boolean; onClose: () => void }) {
  const root = useRef<HTMLDivElement>(null)
  useDialog(open, root, onClose)

  useEffect(() => {
    if (!open) return
    document.body.dataset.playing = '1'
    return () => {
      delete document.body.dataset.playing
    }
  }, [open])

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={root}
          tabIndex={-1}
          role="dialog"
          aria-modal
          aria-label="Jude, le stand de tir"
          className="fixed inset-0 z-[65] flex flex-col bg-night outline-none select-none [-webkit-touch-callout:none]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <Range onClose={onClose} />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

function Range({ onClose }: { onClose: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const game = useRef<ReturnType<typeof createJudeGame> | null>(null)
  const [save, setSave] = useState(readJude)
  const [weapon, setWeapon] = useState<Weapon>('pistol')
  const [sound, setSound] = useState(false)
  const destroyed = save.holes.length >= STAGES.destroyed

  useEffect(() => {
    const g = createJudeGame(canvas.current!, readJude(), (s) => {
      writeJude(s)
      setSave({ ...s })
    })
    game.current = g
    return () => g.destroy()
  }, [])

  useEffect(() => game.current?.setWeapon(weapon), [weapon])
  useEffect(() => game.current?.setSound(sound), [sound])

  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const box = e.currentTarget.getBoundingClientRect()
    game.current?.fire(e.clientX - box.left, e.clientY - box.top)
  }

  return (
    <div className="relative flex flex-1 flex-col">
      <header className="flex items-start justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-2">
        <div>
          <h2 className="font-display text-3xl font-medium">Jude</h2>
          <p className="text-sm text-mist tabular-nums">
            {save.shots} {save.shots > 1 ? 'tirs' : 'tir'} · {precision(save)} % de précision
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer le jeu"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-2xl leading-none text-starlight backdrop-blur"
        >
          ×
        </button>
      </header>

      <div className="relative min-h-0 flex-1">
        <canvas
          ref={canvas}
          role="img"
          aria-label={
            destroyed
              ? 'Il ne reste de Jude qu’un tas de rembourrage'
              : `Jude, l’ours en peluche à salopette, ${save.holes.length} ${save.holes.length > 1 ? 'impacts' : 'impact'}`
          }
          onPointerDown={onPointerDown}
          className="crosshair absolute inset-0 h-full w-full touch-none"
        />

        <AnimatePresence>
          {destroyed && (
            <motion.div
              className="pointer-events-none absolute inset-0 flex items-center justify-center px-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { delay: 1.1 } }}
              exit={{ opacity: 0 }}
            >
              <div role="status" className="glass pointer-events-auto rounded-3xl px-7 py-5 text-center">
                <p className="font-display text-2xl">Jude a été détruit 💥</p>
                <p className="mt-1 text-sm text-mist tabular-nums">
                  En {save.shots} tirs · {precision(save)} % de précision
                </p>
                <button
                  type="button"
                  onClick={() => game.current?.reset()}
                  className="mt-4 rounded-full bg-electric px-6 py-2.5 text-sm font-medium text-white shadow-[0_0_24px_rgba(46,91,255,.45)]"
                >
                  Nouveau Jude
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-center gap-3 bg-[#0c1440] px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div role="radiogroup" aria-label="Arme" className="glass flex rounded-full p-1">
          {(
            [
              ['pistol', 'Pistolet'],
              ['shotgun', 'Fusil à pompe'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={weapon === id}
              onClick={() => setWeapon(id)}
              className={`rounded-full px-4 py-2 text-sm transition-colors ${weapon === id ? 'bg-electric text-white' : 'text-mist hover:text-starlight'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setSound((s) => !s)}
          aria-pressed={sound}
          aria-label={sound ? 'Couper le son' : 'Activer le son'}
          className="glass flex h-11 w-11 items-center justify-center rounded-full text-mist"
        >
          {sound ? <IconSound /> : <IconMute />}
        </button>
      </div>
    </div>
  )
}

function IconSound() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <path d="M4 9h3l5-4v14l-5-4H4z" strokeLinejoin="round" />
      <path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" />
    </svg>
  )
}
function IconMute() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <path d="M4 9h3l5-4v14l-5-4H4z" strokeLinejoin="round" />
      <path d="M16 9.5l5 5M21 9.5l-5 5" />
    </svg>
  )
}
