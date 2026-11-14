import { useEffect, useRef, useState } from 'react'
import type { TimelineEvent } from '../lib/api'
import { layout, project, segment, toWorld, type Node } from '../lib/constellation'
import { formatShort } from '../lib/dates'

/**
 * Notre constellation, en 3D : les souvenirs flottent dans l'espace et, vus sous le bon angle,
 * dessinent un cœur. À l'arrivée les étoiles semblent dispersées, puis la constellation pivote et
 * le cœur apparaît. On la fait tourner au doigt ou à la souris ; lâchée, elle revient doucement au cœur.
 * Toucher une étoile ouvre son souvenir ; passer au suivant fait voyager une lueur le long du trait.
 *
 * Tout est dessiné dans un seul canvas (pas de dépendance 3D) ; la liste accessible est à côté.
 */

interface Props {
  /** Souvenirs dans l'ordre chronologique */
  events: TimelineEvent[]
  urls: Record<string, string>
  activeId: string | null
  onSelect: (e: TimelineEvent) => void
}

const SEEN_KEY = 'stella.heart.seen'
const DRAG_KEY = 'stella.heart.dragged'
const YAW_MAX = 1.4
const PITCH_MAX = 0.95

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2)
const store = {
  get: (k: string, s: Storage | null) => {
    try {
      return s?.getItem(k) ?? null
    } catch {
      return null
    }
  },
  set: (k: string, s: Storage | null) => {
    try {
      s?.setItem(k, '1')
    } catch {
      /* navigation privée */
    }
  },
}
const session = () => (typeof sessionStorage === 'undefined' ? null : sessionStorage)
const local = () => (typeof localStorage === 'undefined' ? null : localStorage)

/** Halo d'étoile pré-dessiné une fois (bien moins cher qu'un dégradé par image) */
function glowSprite(rgb: string) {
  const c = document.createElement('canvas')
  c.width = c.height = 96
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(48, 48, 0, 48, 48, 48)
  grad.addColorStop(0, `rgba(${rgb},0.75)`)
  grad.addColorStop(0.25, `rgba(${rgb},0.32)`)
  grad.addColorStop(1, `rgba(${rgb},0)`)
  g.fillStyle = grad
  g.fillRect(0, 0, 96, 96)
  return c
}

interface Live {
  events: TimelineEvent[]
  activeId: string | null
  hoverId: string | null
  onSelect: (e: TimelineEvent) => void
}

export function HeartConstellation({ events, urls, activeId, onSelect }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const tagRef = useRef<HTMLDivElement>(null)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [hint, setHint] = useState(() => !store.get(DRAG_KEY, local()))
  const live = useRef<Live>({ events, activeId, hoverId, onSelect })
  // Effets ponctuels lus par la boucle de dessin
  const fx = useRef({ comet: null as null | { from: number; to: number; at: number }, prevActive: activeId })

  useEffect(() => {
    live.current = { events, activeId, hoverId, onSelect }
  })

  // Passage d'un souvenir au voisin : une lueur voyage le long du trait
  useEffect(() => {
    const f = fx.current
    const from = events.findIndex((e) => e.id === f.prevActive)
    const to = events.findIndex((e) => e.id === activeId)
    if (from >= 0 && to >= 0 && Math.abs(from - to) === 1) f.comet = { from, to, at: performance.now() }
    f.prevActive = activeId
  }, [activeId, events])

  useEffect(() => {
    const canvas = canvasRef.current!
    const el = box.current!
    const ctx = canvas.getContext('2d')!
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const blue = glowSprite('125,162,255')
    const gold = glowSprite('255,217,138')

    let W = 0
    let H = 0
    let S = 0
    let raf = 0
    let last = 0
    let visible = true

    // Arrivée : grand pivot la première fois de la session, plus court ensuite
    const first = !store.get(SEEN_KEY, session())
    const introMs = reduced ? 0 : first ? 2800 : 1300
    const from = first ? { yaw: 1.15, pitch: -0.5 } : { yaw: 0.55, pitch: -0.22 }
    const t0 = performance.now()
    const stagger = first ? 1500 : 500
    let introDone = introMs === 0
    let pulseAt = -1
    let yaw = introDone ? 0 : from.yaw
    let pitch = introDone ? 0 : from.pitch
    let vYaw = 0
    let vPitch = 0
    let releasedAt = -Infinity

    // Géométrie, recalculée seulement quand la liste des souvenirs change
    let key = ''
    let nodes: Node[] = []
    let phases: number[] = []
    let world: [number, number, number][] = []
    let path: [number, number, number][][] = []
    let closing: [number, number, number][] = []
    const rebuild = (list: TimelineEvent[]) => {
      const k = list.map((e) => e.id).join(',')
      if (k === key) return
      key = k
      nodes = layout(list.map((e) => e.id))
      phases = list.map((_, i) => i * 2.39)
      world = nodes.map((n) => toWorld(n.u, n.k))
      const steps = (a: Node, b: Node) => Math.max(6, Math.ceil(((b.u <= a.u ? b.u + 1 : b.u) - a.u) * 90))
      path = nodes.slice(1).map((n, i) => segment(nodes[i], n, steps(nodes[i], n)))
      closing = nodes.length ? segment(nodes[nodes.length - 1], nodes[0], steps(nodes[nodes.length - 1], nodes[0])) : []
    }

    // Positions à l'écran de la dernière image, pour viser au doigt
    let screen: { i: number; x: number; y: number; s: number }[] = []

    const resize = () => {
      W = el.clientWidth
      H = Math.round(clamp(W * 0.92, 300, Math.min(window.innerHeight * 0.66, 620)))
      el.style.height = `${H}px`
      canvas.width = Math.round(W * dpr)
      canvas.height = Math.round(H * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      S = Math.min(W / 2 - 36, H / 2 - 30) * 0.86
    }

    const hit = (x: number, y: number) => {
      let best = -1
      let bestD = Infinity
      for (const p of screen) {
        const d = Math.hypot(p.x - x, p.y - y)
        if (d < Math.max(22, 16 * p.s) && d < bestD) {
          best = p.i
          bestD = d
        }
      }
      return best
    }

    // Toucher : pression, glisser pour tourner, ou simple tape pour ouvrir
    let press: null | { id: number; x0: number; y0: number; x: number; y: number; t: number; drag: boolean } = null
    let burst: null | { i: number; at: number } = null
    const local2 = (ev: PointerEvent) => {
      const r = canvas.getBoundingClientRect()
      return { x: ev.clientX - r.left, y: ev.clientY - r.top }
    }
    const onDown = (ev: PointerEvent) => {
      const p = local2(ev)
      press = { id: ev.pointerId, x0: p.x, y0: p.y, x: p.x, y: p.y, t: performance.now(), drag: false }
      vYaw = vPitch = 0
    }
    const onMove = (ev: PointerEvent) => {
      const p = local2(ev)
      if (!press || press.id !== ev.pointerId) {
        if (ev.pointerType !== 'mouse') return
        const i = hit(p.x, p.y)
        const id = i >= 0 ? (live.current.events[i]?.id ?? null) : null
        if (id !== live.current.hoverId) setHoverId(id)
        canvas.style.cursor = i >= 0 ? 'pointer' : 'grab'
        return
      }
      if (!press.drag && Math.hypot(p.x - press.x0, p.y - press.y0) > 6) {
        press.drag = true
        introDone = true // on reprend la main pendant l'arrivée
        canvas.setPointerCapture(ev.pointerId)
        canvas.style.cursor = 'grabbing'
        if (live.current.hoverId) setHoverId(null)
      }
      if (press.drag) {
        const now = performance.now()
        const dt = Math.max(0.008, (now - press.t) / 1000)
        const dy = (p.x - press.x) * 0.0085
        const dp = (p.y - press.y) * 0.0065
        yaw = clamp(yaw + dy, -YAW_MAX, YAW_MAX)
        pitch = clamp(pitch + dp, -PITCH_MAX, PITCH_MAX)
        vYaw = vYaw * 0.6 + (dy / dt) * 0.4
        vPitch = vPitch * 0.6 + (dp / dt) * 0.4
        press.x = p.x
        press.y = p.y
        press.t = now
      }
    }
    const onUp = (ev: PointerEvent) => {
      if (!press || press.id !== ev.pointerId) return
      const p = local2(ev)
      if (press.drag) {
        releasedAt = performance.now()
        // Trop vieux mouvement : pas d'élan
        if (performance.now() - press.t > 90) vYaw = vPitch = 0
        if (!store.get(DRAG_KEY, local())) {
          store.set(DRAG_KEY, local())
          setHint(false)
        }
      } else if (Math.hypot(p.x - press.x0, p.y - press.y0) < 8) {
        const i = hit(p.x, p.y)
        const e = live.current.events[i]
        if (e) {
          burst = { i, at: performance.now() }
          window.setTimeout(() => live.current.onSelect(e), 200)
        }
      }
      press = null
      canvas.style.cursor = 'grab'
    }
    const onCancel = () => {
      // Le navigateur a pris le geste pour faire défiler la page
      if (press?.drag) releasedAt = performance.now()
      press = null
    }
    const onLeave = (ev: PointerEvent) => {
      if (ev.pointerType === 'mouse' && live.current.hoverId) setHoverId(null)
    }

    const draw = (now: number, dt: number) => {
      const { events: list, activeId: active, hoverId: hover } = live.current
      rebuild(list)
      const n = nodes.length

      // Mouvement
      if (!introDone) {
        const p = Math.min(1, (now - t0) / introMs)
        const e = easeInOut(p)
        yaw = from.yaw * (1 - e)
        pitch = from.pitch * (1 - e)
        if (p >= 1) {
          introDone = true
          pulseAt = now
          store.set(SEEN_KEY, session())
        }
      } else if (!press?.drag) {
        yaw = clamp(yaw + vYaw * dt, -YAW_MAX, YAW_MAX)
        pitch = clamp(pitch + vPitch * dt, -PITCH_MAX, PITCH_MAX)
        const damp = Math.exp(-4 * dt)
        vYaw *= damp
        vPitch *= damp
        // Lâchée un instant, elle revient au cœur
        if (now - releasedAt > 1100) {
          const back = 1 - Math.exp(-2.4 * dt)
          yaw += (0 - yaw) * back
          pitch += (0 - pitch) * back
        }
      }
      // Léger balancement, pour sentir la profondeur même au repos
      const sway = reduced ? 0 : clamp((now - t0 - introMs) / 1500, 0, 1)
      const ry = yaw + Math.sin(now / 2500) * 0.05 * sway
      const rp = pitch + Math.sin(now / 3200) * 0.028 * sway
      const aligned = clamp(1 - Math.hypot(yaw, pitch) / 0.55, 0, 1)

      const cx = W / 2
      const cy = H / 2 + 4
      const toScreen = (w: [number, number, number]) => {
        const p = project(w, ry, rp)
        return { x: cx + p.x * S, y: cy + p.y * S, s: p.s, depth: p.depth }
      }

      ctx.clearRect(0, 0, W, H)
      if (!n) return

      const appear = (i: number) => (reduced ? 1 : clamp((now - t0 - (i / Math.max(1, n)) * stagger) / 380, 0, 1))
      const linesIn = reduced ? 1 : clamp((now - t0 - 250) / 900, 0, 1)

      // Le trait, qui suit le cœur ; plus lumineux quand le cœur est aligné
      const traced = (pts: [number, number, number][]) => {
        pts.forEach((w, j) => {
          const p = toScreen(w)
          if (j === 0) ctx.moveTo(p.x, p.y)
          else ctx.lineTo(p.x, p.y)
        })
      }
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      for (const pts of path) traced(pts)
      ctx.strokeStyle = `rgba(125,162,255,${(0.2 + 0.42 * aligned) * linesIn})`
      ctx.lineWidth = 1.2
      ctx.stroke()
      // Le cœur s'illumine une fois aligné
      if (pulseAt > 0 && now - pulseAt < 1700) {
        const q = Math.sin(Math.PI * ((now - pulseAt) / 1700))
        ctx.save()
        ctx.shadowColor = 'rgba(125,162,255,0.9)'
        ctx.shadowBlur = 14
        ctx.strokeStyle = `rgba(190,210,255,${0.55 * q})`
        ctx.lineWidth = 2.2
        ctx.stroke()
        ctx.restore()
      }
      // La partie qui reste à écrire, en pointillés
      ctx.beginPath()
      traced(closing)
      ctx.setLineDash([2, 6])
      ctx.strokeStyle = `rgba(169,179,224,${(0.12 + 0.22 * aligned) * linesIn})`
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.setLineDash([])

      // Les étoiles, de la plus lointaine à la plus proche
      const pts = world.map((w, i) => ({ i, ...toScreen(w) })).sort((a, b) => b.depth - a.depth)
      screen = pts
      const t = now / 1000
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      for (const p of pts) {
        const e = list[p.i]
        if (!e) continue
        const a = appear(p.i)
        if (a <= 0) continue
        const isActive = e.id === active
        const isHover = e.id === hover
        const twinkle = reduced ? 1 : 0.86 + 0.14 * Math.sin(t * 1.7 + phases[p.i])
        const near = clamp(p.s, 0.6, 1.5)
        const pop = reduced ? 1 : 0.4 + 0.6 * easeInOut(a)
        ctx.globalAlpha = a * twinkle * (0.55 + 0.45 * Math.min(1, near))
        const r = (e.highlight ? 26 : 20) * near * pop * (isActive ? 1.35 : isHover ? 1.2 : 1)
        ctx.drawImage(e.highlight ? gold : blue, p.x - r, p.y - r, r * 2, r * 2)
        ctx.fillStyle = e.highlight ? '#ffd98a' : '#f4f6ff'
        ctx.beginPath()
        ctx.arc(p.x, p.y, (e.highlight ? 3 : 2.2) * near * pop, 0, Math.PI * 2)
        ctx.fill()
        // Son emoji, côté extérieur du cœur
        if (e.icon) {
          const dx = p.x - cx
          const dy = p.y - cy
          const len = Math.hypot(dx, dy) || 1
          const off = 17 * near
          ctx.globalAlpha = a * (0.55 + 0.4 * aligned)
          ctx.font = `${Math.round(11 * near)}px system-ui, sans-serif`
          ctx.fillText(e.icon, p.x + (dx / len) * off, p.y + (dy / len) * off)
        }
        if (isActive) {
          ctx.globalAlpha = a
          ctx.strokeStyle = e.highlight ? 'rgba(255,217,138,0.8)' : 'rgba(125,162,255,0.85)'
          ctx.lineWidth = 1.2
          ctx.beginPath()
          ctx.arc(p.x, p.y, 12 * near + (reduced ? 0 : Math.sin(t * 2.4)) * 1.2, 0, Math.PI * 2)
          ctx.stroke()
        }
      }
      ctx.globalAlpha = 1

      // Étoile touchée : une onde lumineuse
      if (burst) {
        const q = (now - burst.at) / 600
        const p = pts.find((s) => s.i === burst!.i)
        if (q >= 1 || !p) burst = null
        else {
          ctx.strokeStyle = `rgba(190,210,255,${0.9 * (1 - q)})`
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.arc(p.x, p.y, 4 + 50 * (1 - (1 - q) ** 3), 0, Math.PI * 2)
          ctx.stroke()
        }
      }

      // La lueur qui voyage d'un souvenir au suivant
      const comet = fx.current.comet
      if (comet && !reduced) {
        const q = (now - comet.at) / 750
        const lo = Math.min(comet.from, comet.to)
        const seg = path[lo]
        if (q >= 1 || !seg) fx.current.comet = null
        else {
          const forward = comet.to > comet.from
          for (let k = 6; k >= 0; k--) {
            const f = clamp(easeInOut(clamp(q, 0, 1)) - k * 0.035, 0, 1)
            const idx = (forward ? f : 1 - f) * (seg.length - 1)
            const j = Math.floor(idx)
            const w0 = seg[j]
            const w1 = seg[Math.min(seg.length - 1, j + 1)]
            const m = idx - j
            const p = toScreen([w0[0] + (w1[0] - w0[0]) * m, w0[1] + (w1[1] - w0[1]) * m, w0[2] + (w1[2] - w0[2]) * m])
            const r = (k === 0 ? 16 : 10 - k) * p.s
            ctx.globalAlpha = (k === 0 ? 1 : 0.5 - k * 0.06) * Math.sin(Math.PI * Math.min(1, q * 1.15))
            ctx.drawImage(blue, p.x - r, p.y - r, r * 2, r * 2)
          }
          ctx.globalAlpha = 1
        }
      }

      // L'étiquette suit l'étoile survolée ou ouverte
      const tag = tagRef.current
      const focus = hover ?? active
      const fp = focus ? pts.find((s) => list[s.i]?.id === focus) : undefined
      if (tag) {
        if (fp) {
          const left = fp.x > cx
          tag.style.transform = `translate(${fp.x}px, ${fp.y}px) translate(${left ? 'calc(-100% - 20px)' : '20px'}, -50%)`
          tag.style.opacity = String(appear(fp.i))
        } else tag.style.opacity = '0'
      }
    }

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 0)
      last = now
      if (!visible || document.body.dataset.playing) return
      draw(now, dt)
    }

    const onVisibility = () => {
      cancelAnimationFrame(raf)
      last = 0
      if (!document.hidden) raf = requestAnimationFrame(loop)
    }
    const io = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting))
    io.observe(el)
    const ro = new ResizeObserver(resize)
    ro.observe(el)
    resize()
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onCancel)
    canvas.addEventListener('pointerleave', onLeave)
    document.addEventListener('visibilitychange', onVisibility)
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      ro.disconnect()
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onCancel)
      canvas.removeEventListener('pointerleave', onLeave)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  const focus = events.find((e) => e.id === (hoverId ?? activeId))
  const src = focus?.image_path ? urls[focus.image_path] : undefined

  return (
    <div ref={box} className="relative -mx-2 select-none" style={{ height: 360 }}>
      <canvas
        ref={canvasRef}
        aria-hidden
        className="absolute inset-0 h-full w-full cursor-grab"
        style={{
          touchAction: 'pan-y',
          // Quand on tourne, les étoiles qui sortent du cadre s'effacent au lieu d'être coupées net
          maskImage: 'linear-gradient(to right, transparent, #000 7%, #000 93%, transparent)',
          WebkitMaskImage: 'linear-gradient(to right, transparent, #000 7%, #000 93%, transparent)',
        }}
      />
      <div
        ref={tagRef}
        aria-hidden
        className="pointer-events-none absolute top-0 left-0 flex max-w-[13.5rem] items-center gap-2.5 rounded-2xl border border-glow/20 bg-night/85 py-2 pr-3.5 pl-2 opacity-0 shadow-[0_10px_30px_rgb(0_0_0/0.4)] transition-opacity duration-200"
      >
        {focus && (
          <>
            {src && (
              <img decoding="async" src={src} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-starlight/20" />
            )}
            <span className="min-w-0">
              <span className="font-display block truncate text-[1.1rem] leading-tight text-starlight">{focus.title}</span>
              <span className="block text-xs text-mist/80">{formatShort(focus.date_start)}</span>
            </span>
          </>
        )}
      </div>
      {hint && events.length > 1 && (
        <p className="pointer-events-none absolute inset-x-0 bottom-1 text-center text-xs tracking-wide text-mist/60">
          ↻ Fais-la tourner {typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches ? 'à la souris' : 'du doigt'}
        </p>
      )}
    </div>
  )
}
