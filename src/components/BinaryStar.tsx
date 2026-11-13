import { useEffect, useRef } from 'react'

// L'étoile binaire : deux étoiles liées qui tournent l'une autour de l'autre sans jamais se quitter.
// Elle encadre le compteur de l'accueil. L'une est bleu électrique, l'autre d'un blanc rosé ;
// leur orbite est une ellipse inclinée, avec une fine traînée lumineuse derrière chacune.

const PERIOD = 22 // secondes pour un tour complet
const TILT = -0.32 // inclinaison de l'orbite (radians)
const TRAIL = 1.1 // longueur de la traînée (radians d'orbite)

interface Body {
  core: string
  glow: string
  /** Rayon relatif de l'orbite (les deux étoiles n'ont pas la même masse) */
  orbit: number
  size: number
  phase: number
}

const BODIES: Body[] = [
  { core: '244,246,255', glow: '125,162,255', orbit: 1, size: 3.4, phase: 0 },
  { core: '255,240,246', glow: '255,150,200', orbit: 0.86, size: 2.9, phase: Math.PI },
]

export function BinaryStar({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let w = 0
    let h = 0
    let raf = 0
    const start = performance.now()

    const resize = () => {
      const r = canvas.getBoundingClientRect()
      w = r.width
      h = r.height
      canvas.width = Math.max(1, w * dpr)
      canvas.height = Math.max(1, h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      draw(performance.now())
    }

    // Point sur l'ellipse inclinée ; z > 0 : devant
    const at = (angle: number, k: number) => {
      const rx = (w / 2 - 14) * k
      const ry = (h / 2 - 14) * k * 0.92
      const ex = Math.cos(angle) * rx
      const ey = Math.sin(angle) * ry
      return {
        x: w / 2 + ex * Math.cos(TILT) - ey * Math.sin(TILT),
        y: h / 2 + ex * Math.sin(TILT) + ey * Math.cos(TILT),
        z: Math.sin(angle),
      }
    }

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h)
      if (w < 40 || h < 40) return
      const base = reduced ? 0.6 : ((t - start) / 1000 / PERIOD) * Math.PI * 2

      // Orbites : fines ellipses pointillées
      ctx.setLineDash([2, 7])
      ctx.lineWidth = 1
      for (const b of BODIES) {
        ctx.strokeStyle = 'rgba(125,162,255,0.16)'
        ctx.beginPath()
        for (let i = 0; i <= 96; i++) {
          const p = at((i / 96) * Math.PI * 2, b.orbit)
          if (i) ctx.lineTo(p.x, p.y)
          else ctx.moveTo(p.x, p.y)
        }
        ctx.stroke()
      }
      ctx.setLineDash([])

      for (const b of BODIES) {
        const angle = base + b.phase
        // Traînée : arc qui s'estompe derrière l'étoile
        const steps = 28
        for (let i = steps; i > 0; i--) {
          const a0 = angle - (i / steps) * TRAIL
          const a1 = angle - ((i - 1) / steps) * TRAIL
          const p0 = at(a0, b.orbit)
          const p1 = at(a1, b.orbit)
          const fade = 1 - i / steps
          ctx.strokeStyle = `rgba(${b.glow},${0.55 * fade * fade})`
          ctx.lineWidth = 0.6 + fade * 1.6
          ctx.lineCap = 'round'
          ctx.beginPath()
          ctx.moveTo(p0.x, p0.y)
          ctx.lineTo(p1.x, p1.y)
          ctx.stroke()
        }

        // L'étoile : plus grande et plus vive quand elle passe devant
        const p = at(angle, b.orbit)
        const depth = 0.75 + 0.25 * p.z
        const r = b.size * depth
        const halo = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 9)
        halo.addColorStop(0, `rgba(${b.glow},${0.55 * depth})`)
        halo.addColorStop(0.35, `rgba(${b.glow},${0.16 * depth})`)
        halo.addColorStop(1, `rgba(${b.glow},0)`)
        ctx.fillStyle = halo
        ctx.beginPath()
        ctx.arc(p.x, p.y, r * 9, 0, Math.PI * 2)
        ctx.fill()

        // Aigrettes en croix
        ctx.strokeStyle = `rgba(${b.core},${0.5 * depth})`
        ctx.lineWidth = 0.8
        ctx.beginPath()
        ctx.moveTo(p.x - r * 5, p.y)
        ctx.lineTo(p.x + r * 5, p.y)
        ctx.moveTo(p.x, p.y - r * 5)
        ctx.lineTo(p.x, p.y + r * 5)
        ctx.stroke()

        ctx.fillStyle = `rgba(${b.core},${0.95 * depth + 0.05})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    const loop = (t: number) => {
      raf = requestAnimationFrame(loop)
      if (document.body.dataset.playing) return
      draw(t)
    }

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()
    const onVisibility = () => {
      cancelAnimationFrame(raf)
      if (!document.hidden && !reduced) raf = requestAnimationFrame(loop)
    }
    document.addEventListener('visibilitychange', onVisibility)
    if (!reduced) raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return <canvas ref={ref} aria-hidden className={`pointer-events-none ${className}`} />
}
