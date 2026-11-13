import { useEffect, useRef, useState } from 'react'
import { isDecember, snowEnabled } from '../lib/advent'
import { todayISO } from '../lib/dates'

/**
 * Neige d'étoiles en décembre : de petits flocons lumineux qui tombent doucement, derrière le contenu.
 * Désactivable (bouton dans le calendrier et sur la carte de l'accueil), absente si les animations sont réduites.
 */
export function Snow() {
  const [on, setOn] = useState(() => isDecember(todayISO()) && snowEnabled())

  useEffect(() => {
    const sync = () => setOn(isDecember(todayISO()) && snowEnabled())
    window.addEventListener('stella:snow', sync)
    return () => window.removeEventListener('stella:snow', sync)
  }, [])

  if (!on) return null
  return <SnowCanvas />
}

interface Flake {
  x: number
  y: number
  r: number
  vy: number
  sway: number
  phase: number
  a: number
}

function SnowCanvas() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let w = 0
    let h = 0
    let flakes: Flake[] = []
    let raf = 0
    let last = 0

    const make = (y?: number): Flake => {
      const near = Math.random() < 0.18
      return {
        x: Math.random() * w,
        y: y ?? Math.random() * h,
        r: near ? 1.6 + Math.random() * 1.4 : 0.6 + Math.random() * 1,
        vy: near ? 38 + Math.random() * 22 : 14 + Math.random() * 18,
        sway: 8 + Math.random() * 18,
        phase: Math.random() * Math.PI * 2,
        a: near ? 0.75 : 0.35 + Math.random() * 0.35,
      }
    }

    const resize = () => {
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      flakes = Array.from({ length: Math.min(140, Math.round((w * h) / 9000)) }, () => make())
    }

    const loop = (t: number) => {
      raf = requestAnimationFrame(loop)
      const dt = Math.min(0.05, last ? (t - last) / 1000 : 0)
      last = t
      if (document.body.dataset.playing) return
      ctx.clearRect(0, 0, w, h)
      const time = t / 1000
      for (const f of flakes) {
        f.y += f.vy * dt
        if (f.y > h + 6) Object.assign(f, make(-6))
        const x = f.x + Math.sin(time * 0.6 + f.phase) * f.sway
        const g = ctx.createRadialGradient(x, f.y, 0, x, f.y, f.r * 3)
        g.addColorStop(0, `rgba(244,246,255,${f.a})`)
        g.addColorStop(0.4, `rgba(200,215,255,${f.a * 0.5})`)
        g.addColorStop(1, 'rgba(170,195,255,0)')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(x, f.y, f.r * 3, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    const onVisibility = () => {
      cancelAnimationFrame(raf)
      last = 0
      if (!document.hidden) raf = requestAnimationFrame(loop)
    }
    resize()
    window.addEventListener('resize', resize)
    document.addEventListener('visibilitychange', onVisibility)
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 -z-[5] h-full w-full" />
}
