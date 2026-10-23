import { useEffect, useRef } from 'react'

interface Star {
  x: number
  y: number
  r: number
  base: number
  speed: number
  phase: number
  blue: boolean
}

interface Shooting {
  x: number
  y: number
  vx: number
  vy: number
  life: number
}

/** Ciel de nuit animé en fond fixe. Statique si l'utilisateur préfère réduire les animations. */
export function StarrySky() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let stars: Star[] = []
    let shooting: Shooting | null = null
    let nextShot = performance.now() + 6000 + Math.random() * 8000
    let raf = 0
    let last = 0
    let w = 0
    let h = 0

    const resize = () => {
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const count = Math.min(320, Math.round((w * h) / 3800))
      stars = Array.from({ length: count }, () => {
        const big = Math.random() < 0.06
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          r: big ? 1.2 + Math.random() * 0.9 : 0.35 + Math.random() * 0.75,
          base: 0.35 + Math.random() * 0.55,
          speed: 0.4 + Math.random() * 1.4,
          phase: Math.random() * Math.PI * 2,
          blue: Math.random() < 0.3,
        }
      })
      draw(performance.now())
    }

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h)
      const time = t / 1000
      for (const s of stars) {
        const tw = reduced ? 1 : 0.65 + 0.35 * Math.sin(time * s.speed + s.phase)
        const a = s.base * tw
        ctx.fillStyle = s.blue ? `rgba(170,195,255,${a})` : `rgba(244,246,255,${a})`
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fill()
        if (s.r > 1.2) {
          // petite croix de diffraction sur les étoiles brillantes
          ctx.strokeStyle = `rgba(170,195,255,${a * 0.45})`
          ctx.lineWidth = 0.6
          ctx.beginPath()
          ctx.moveTo(s.x - s.r * 4, s.y)
          ctx.lineTo(s.x + s.r * 4, s.y)
          ctx.moveTo(s.x, s.y - s.r * 4)
          ctx.lineTo(s.x, s.y + s.r * 4)
          ctx.stroke()
        }
      }
      if (shooting) {
        const { x, y, vx, vy, life } = shooting
        const tail = 0.6 // longueur de la traînée, en secondes de trajet
        const grad = ctx.createLinearGradient(x, y, x - vx * tail, y - vy * tail)
        grad.addColorStop(0, `rgba(244,246,255,${life})`)
        grad.addColorStop(1, 'rgba(125,162,255,0)')
        ctx.strokeStyle = grad
        ctx.lineWidth = 1.4
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x - vx * tail, y - vy * tail)
        ctx.stroke()
      }
    }

    // Fréquence native de l'écran (60 Hz sur iPhone/Safari, jusqu'à 120+ Hz sur PC).
    // Les mouvements sont calculés au temps écoulé : même vitesse quel que soit l'écran.
    // En mode économie d'énergie, iOS ralentit lui-même la cadence.
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop)
      const dt = Math.min(0.05, last ? (t - last) / 1000 : 0) // secondes, plafonné après une pause
      last = t
      if (!shooting && t > nextShot) {
        const angle = Math.PI / 5 + Math.random() * 0.3
        shooting = {
          x: Math.random() * w * 0.7 + w * 0.2,
          y: Math.random() * h * 0.35,
          vx: -Math.cos(angle) * 270, // px / s
          vy: Math.sin(angle) * 270,
          life: 1,
        }
      }
      if (shooting) {
        shooting.x += shooting.vx * dt
        shooting.y += shooting.vy * dt
        shooting.life -= 1.05 * dt
        if (shooting.life <= 0) {
          shooting = null
          nextShot = t + 9000 + Math.random() * 12000
        }
      }
      draw(t)
    }

    const onVisibility = () => {
      cancelAnimationFrame(raf)
      last = 0
      if (!document.hidden && !reduced) raf = requestAnimationFrame(loop)
    }

    resize()
    window.addEventListener('resize', resize)
    document.addEventListener('visibilitychange', onVisibility)
    if (!reduced) raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 -z-10 h-full w-full" />
}
