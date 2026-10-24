import { useEffect, useRef } from 'react'

interface Dust {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  life: number // 1 → 0
  decay: number // par seconde
  blue: boolean
}

const MAX = 140

/**
 * Traînée de poussière d'étoiles qui suit la souris (PC uniquement).
 * La boucle d'animation ne tourne que tant qu'il reste des particules : zéro coût au repos.
 * Désactivée sur écran tactile et si « réduire les animations » est activé.
 */
export function CursorTrail() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!fine || reduced) return

    const ctx = canvas.getContext('2d')!
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const dust: Dust[] = []
    let raf = 0
    let last = 0
    let px = -1
    let py = -1

    const resize = () => {
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const spawn = (x: number, y: number, speed: number) => {
      const n = Math.min(4, 2 + Math.floor(speed / 20))
      for (let i = 0; i < n && dust.length < MAX; i++) {
        const big = Math.random() < 0.12
        dust.push({
          x: x + (Math.random() - 0.5) * 6,
          y: y + (Math.random() - 0.5) * 6,
          vx: (Math.random() - 0.5) * 18,
          vy: 10 + Math.random() * 22, // la poussière retombe doucement
          r: big ? 2.4 + Math.random() * 1 : 1.1 + Math.random() * 1.2,
          life: 1,
          decay: 0.8 + Math.random() * 0.7,
          blue: Math.random() < 0.55,
        })
      }
    }

    const frame = (t: number) => {
      const dt = Math.min(0.05, last ? (t - last) / 1000 : 0.016)
      last = t
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr)
      for (let i = dust.length - 1; i >= 0; i--) {
        const d = dust[i]
        d.life -= d.decay * dt
        if (d.life <= 0) {
          dust.splice(i, 1)
          continue
        }
        d.x += d.vx * dt
        d.y += d.vy * dt
        const a = d.life * d.life
        const r = d.r * (0.5 + d.life * 0.5)
        // halo doux (cercle large, très transparent) puis cœur lumineux
        ctx.fillStyle = d.blue ? `rgba(46,91,255,${a * 0.28})` : `rgba(125,162,255,${a * 0.22})`
        ctx.beginPath()
        ctx.arc(d.x, d.y, r * 3.2, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = d.blue ? `rgba(160,190,255,${a})` : `rgba(244,246,255,${a})`
        ctx.beginPath()
        ctx.arc(d.x, d.y, r, 0, Math.PI * 2)
        ctx.fill()
        if (d.r > 2.4) {
          // petites étincelles en croix
          ctx.strokeStyle = `rgba(200,215,255,${a * 0.6})`
          ctx.lineWidth = 0.6
          ctx.beginPath()
          ctx.moveTo(d.x - d.r * 2.5, d.y)
          ctx.lineTo(d.x + d.r * 2.5, d.y)
          ctx.moveTo(d.x, d.y - d.r * 2.5)
          ctx.lineTo(d.x, d.y + d.r * 2.5)
          ctx.stroke()
        }
      }
      raf = dust.length ? requestAnimationFrame(frame) : 0
      if (!raf) last = 0
    }

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      const speed = px < 0 ? 0 : Math.hypot(e.clientX - px, e.clientY - py)
      px = e.clientX
      py = e.clientY
      if (speed < 2) return // souris quasi immobile : pas de poussière
      spawn(px, py, speed)
      if (!raf) raf = requestAnimationFrame(frame)
    }

    resize()
    window.addEventListener('resize', resize)
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onMove)
    }
  }, [])

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-[90] h-full w-full" />
}
