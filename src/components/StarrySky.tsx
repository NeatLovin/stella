import { useEffect, useRef } from 'react'

// Ciel de nuit en fond fixe, en profondeur :
// - trois couches d'étoiles (lointaines, moyennes, proches) qui glissent à des vitesses différentes
//   quand on défile la page ou qu'on bouge la souris ;
// - une Voie lactée en nuages très doux qui dérive lentement ;
// - un « voyage » entre les onglets : les étoiles filent un instant dans le sens du déplacement ;
// - de temps en temps, une étoile filante.
// Statique si l'appareil demande de réduire les animations.

interface Star {
  x: number
  y: number
  r: number
  base: number
  speed: number
  phase: number
  tint: 0 | 1 | 2 // blanche, bleue, dorée
  layer: 0 | 1 | 2
}

interface Shooting {
  x: number
  y: number
  vx: number
  vy: number
  life: number
}

/** Vitesse de parallaxe de chaque couche (fraction du défilement), de la plus lointaine à la plus proche */
const DEPTH = [0.025, 0.07, 0.15] as const
/** Part des étoiles par couche */
const SHARE = [0.62, 0.28, 0.1] as const
const TINTS = ['244,246,255', '170,195,255', '255,226,170'] as const
/** Durée du voyage entre onglets (ms) */
const WARP_MS = 700

const wrap = (v: number, m: number) => ((v % m) + m) % m

export function StarrySky() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let stars: Star[] = []
    let nebula: HTMLCanvasElement | null = null
    let shooting: Shooting | null = null
    let nextShot = performance.now() + 6000 + Math.random() * 8000
    let raf = 0
    let last = 0
    let w = 0
    let h = 0

    // Décalages lissés : défilement, souris, voyage
    let scrollY = window.scrollY
    let smoothScroll = scrollY
    let mouseX = 0
    let mouseY = 0
    let smoothMX = 0
    let smoothMY = 0
    let warpX = 0 // décalage horizontal accumulé par les voyages
    let warpStart = -1
    let warpDir = 0

    /**
     * Voie lactée : bande diagonale de nuages, dessinée une fois, à la résolution de l'écran.
     * (En basse résolution agrandie, les très faibles transparences faisaient apparaître un quadrillage.)
     */
    const buildNebula = () => {
      const scale = dpr
      const c = document.createElement('canvas')
      c.width = Math.max(1, Math.round(w * 1.3 * scale))
      c.height = Math.max(1, Math.round(h * 1.3 * scale))
      const n = c.getContext('2d')!
      const cw = c.width
      const ch = c.height
      // Bande du coin haut-droit vers le bas-gauche
      const blobs = Math.round(26 + (((cw * ch) / (scale * scale)) * 0.1225) / 9000)
      for (let i = 0; i < blobs; i++) {
        const t = Math.random()
        const x = cw * (0.95 - t * 0.9) + (Math.random() - 0.5) * cw * 0.22
        const y = ch * (0.05 + t * 0.9) + (Math.random() - 0.5) * ch * 0.18
        const r = (0.08 + Math.random() * 0.2) * Math.max(cw, ch)
        const hue = Math.random()
        const color = hue < 0.55 ? '46,91,255' : hue < 0.85 ? '120,90,220' : '255,140,190'
        const a = 0.035 + Math.random() * 0.05
        const g = n.createRadialGradient(x, y, 0, x, y, r)
        g.addColorStop(0, `rgba(${color},${a})`)
        g.addColorStop(1, `rgba(${color},0)`)
        n.fillStyle = g
        n.fillRect(x - r, y - r, r * 2, r * 2)
      }
      // Poussière d'étoiles très fine dans la bande (petits points ronds, pas de carrés)
      const dust = Math.round((cw * ch) / (2600 * scale * scale))
      for (let i = 0; i < dust; i++) {
        const t = Math.random()
        const x = cw * (0.95 - t * 0.9) + (Math.random() - 0.5) * cw * 0.16
        const y = ch * (0.05 + t * 0.9) + (Math.random() - 0.5) * ch * 0.12
        n.fillStyle = `rgba(220,230,255,${0.12 + Math.random() * 0.28})`
        n.beginPath()
        n.arc(x, y, 0.35 * scale, 0, Math.PI * 2)
        n.fill()
      }
      nebula = c
    }

    const resize = () => {
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const count = Math.min(380, Math.round((w * h) / 3300))
      stars = Array.from({ length: count }, () => {
        const roll = Math.random()
        const layer = (roll < SHARE[0] ? 0 : roll < SHARE[0] + SHARE[1] ? 1 : 2) as Star['layer']
        const sizes = [
          [0.3, 0.45],
          [0.55, 0.6],
          [0.9, 1.1],
        ][layer]
        const tintRoll = Math.random()
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          r: sizes[0] + Math.random() * sizes[1],
          base: [0.3, 0.5, 0.7][layer] + Math.random() * 0.3,
          speed: 0.4 + Math.random() * 1.4,
          phase: Math.random() * Math.PI * 2,
          tint: (tintRoll < 0.28 ? 1 : tintRoll < 0.34 ? 2 : 0) as Star['tint'],
          layer,
        }
      })
      buildNebula()
      draw(performance.now(), 0)
    }

    const draw = (t: number, warpSpeed: number) => {
      ctx.clearRect(0, 0, w, h)
      const time = t / 1000

      // Voie lactée : dérive lente + parallaxe très faible
      if (nebula) {
        const driftX = Math.sin(time / 47) * w * 0.03
        const driftY = Math.cos(time / 61) * h * 0.02
        const nx = -w * 0.15 + driftX - smoothMX * 6 + warpX * 0.01
        const ny = -h * 0.15 + driftY - wrap(smoothScroll * 0.012, h * 0.3) - smoothMY * 6
        ctx.globalAlpha = reduced ? 0.9 : 0.75 + 0.25 * Math.sin(time / 9)
        ctx.drawImage(nebula, nx, ny, w * 1.3, h * 1.3)
        ctx.globalAlpha = 1
      }

      for (const s of stars) {
        const depth = DEPTH[s.layer]
        // Position avec parallaxe (défilement + souris) et voyage, en boucle sur l'écran
        const x = wrap(s.x - smoothMX * depth * 120 + warpX * depth * 6, w)
        const y = wrap(s.y - smoothScroll * depth - smoothMY * depth * 80, h)
        const tw = reduced ? 1 : 0.6 + 0.4 * Math.sin(time * s.speed + s.phase)
        const a = s.base * tw
        const rgb = TINTS[s.tint]

        if (warpSpeed > 0.02) {
          // Pendant le voyage : traînées dans le sens du déplacement, plus longues pour les étoiles proches
          const len = warpSpeed * (8 + depth * 420)
          ctx.strokeStyle = `rgba(${rgb},${Math.min(1, a * (0.6 + warpSpeed))})`
          ctx.lineWidth = s.r * 1.4
          ctx.lineCap = 'round'
          ctx.beginPath()
          ctx.moveTo(x, y)
          ctx.lineTo(x + warpDir * len, y)
          ctx.stroke()
          continue
        }

        ctx.fillStyle = `rgba(${rgb},${a})`
        ctx.beginPath()
        ctx.arc(x, y, s.r, 0, Math.PI * 2)
        ctx.fill()
        if (s.layer === 2 && s.r > 1.3) {
          // Croix de diffraction sur les étoiles proches et brillantes
          ctx.strokeStyle = `rgba(170,195,255,${a * 0.4})`
          ctx.lineWidth = 0.6
          ctx.beginPath()
          ctx.moveTo(x - s.r * 4.5, y)
          ctx.lineTo(x + s.r * 4.5, y)
          ctx.moveTo(x, y - s.r * 4.5)
          ctx.lineTo(x, y + s.r * 4.5)
          ctx.stroke()
        }
      }

      if (shooting) {
        const { x, y, vx, vy, life } = shooting
        const tail = 0.6
        const grad = ctx.createLinearGradient(x, y, x - vx * tail, y - vy * tail)
        grad.addColorStop(0, `rgba(244,246,255,${life})`)
        grad.addColorStop(1, 'rgba(125,162,255,0)')
        ctx.strokeStyle = grad
        ctx.lineWidth = 1.4
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x - vx * tail, y - vy * tail)
        ctx.stroke()
      }
    }

    // Cadence native de l'écran ; tout est calculé au temps écoulé
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop)
      const dt = Math.min(0.05, last ? (t - last) / 1000 : 0)
      last = t

      // Lissage : le ciel suit avec un léger retard, comme s'il était loin
      const k = 1 - Math.exp(-dt * 6)
      smoothScroll += (scrollY - smoothScroll) * k
      smoothMX += (mouseX - smoothMX) * k * 0.6
      smoothMY += (mouseY - smoothMY) * k * 0.6

      // Voyage : vitesse en cloche sur WARP_MS
      let warpSpeed = 0
      if (warpStart >= 0) {
        const p = (t - warpStart) / WARP_MS
        if (p >= 1) warpStart = -1
        else {
          warpSpeed = Math.sin(Math.PI * p)
          warpX -= warpDir * warpSpeed * dt * 2600
        }
      }

      if (!shooting && t > nextShot) {
        const angle = Math.PI / 5 + Math.random() * 0.3
        shooting = {
          x: Math.random() * w * 0.7 + w * 0.2,
          y: Math.random() * h * 0.35,
          vx: -Math.cos(angle) * 270,
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
      // Un jeu ou un écran plein est ouvert par-dessus : inutile de redessiner le ciel caché
      if (document.body.dataset.playing) return
      draw(t, warpSpeed)
    }

    const onScroll = () => {
      scrollY = window.scrollY
    }
    const onPointer = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      mouseX = e.clientX / w - 0.5
      mouseY = e.clientY / h - 0.5
    }
    const onWarp = (e: Event) => {
      const d = (e as CustomEvent<number>).detail
      if (!d) return
      warpDir = d
      warpStart = performance.now()
    }
    const onVisibility = () => {
      cancelAnimationFrame(raf)
      last = 0
      if (!document.hidden && !reduced) raf = requestAnimationFrame(loop)
    }

    resize()
    window.addEventListener('resize', resize)
    document.addEventListener('visibilitychange', onVisibility)
    if (!reduced) {
      window.addEventListener('scroll', onScroll, { passive: true })
      if (finePointer) window.addEventListener('pointermove', onPointer, { passive: true })
      window.addEventListener('stella:warp', onWarp)
      raf = requestAnimationFrame(loop)
    }
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('pointermove', onPointer)
      window.removeEventListener('stella:warp', onWarp)
    }
  }, [])

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 -z-10 h-full w-full" />
}
