import { drawJude, hitTest, isDetached, placePoint, restingPlacement, STAGES, type Hole, type PartId, type Placement } from './jude'

// Jude : stand de tir. Chaque tir laisse un trou exactement là où on a visé.

export type Weapon = 'pistol' | 'shotgun'

export interface JudeSave {
  holes: Hole[]
  shots: number // gâchette pressée
  hits: number // tirs qui ont touché
}

export const EMPTY_SAVE: JudeSave = { holes: [], shots: 0, hits: 0 }

export interface JudeGame {
  setWeapon: (w: Weapon) => void
  setSound: (on: boolean) => void
  reset: () => void
  destroy: () => void
}

const PARTS: PartId[] = ['head', 'earL', 'earR', 'armL', 'armR', 'body']
const COOLDOWN: Record<Weapon, number> = { pistol: 110, shotgun: 750 }
const FALL_MS = 700

const BUBBLES = [
  ['Aïe !', 'Hé !', 'Ça pique !', 'Mais euh !', 'Ouille !'],
  ['Arrête !', 'J’ai rien fait moi !', 'Pas ma salopette !', 'Mon rembourrage !'],
  ['Pitié…', 'Mon oreille !!', 'Je vois plus rien', 'Appelle un couturier'],
  ['Adieu monde cruel', 'Dis à Deny que je l’aimais', '…', 'C’est la fin'],
]

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  life: number
  max: number
  color: string
}

interface Transition {
  from: Placement
  to: Placement
  start: number
  fall: boolean
}

const ZERO: Placement = { dx: 0, dy: 0, rot: 0 }
const same = (a: Placement | null, b: Placement | null) =>
  (a ?? ZERO).dx === (b ?? ZERO).dx && (a ?? ZERO).dy === (b ?? ZERO).dy && (a ?? ZERO).rot === (b ?? ZERO).rot

export function createJudeGame(
  canvas: HTMLCanvasElement,
  initial: JudeSave,
  onChange: (save: JudeSave) => void,
): JudeGame & { fire: (cssX: number, cssY: number) => void } {
  const ctx = canvas.getContext('2d')!
  let save: JudeSave = { ...initial, holes: [...initial.holes] }
  let weapon: Weapon = 'pistol'
  let sound = false
  let audio: AudioContext | null = null

  // Vue
  let cssW = 0
  let cssH = 0
  let dpr = 1
  let scale = 1
  let ox = 0
  let oy = 0
  let groundY = 0

  // Animation
  let raf = 0
  let last = 0
  let lastShot = -1e9
  let wobble = 0
  let spin = 0
  let shake = 0
  let particles: Particle[] = []
  let flashes: { x: number; y: number; t: number }[] = []
  let misses: { x: number; y: number; t: number }[] = []
  let bubble: { text: string; t: number } | null = null
  const transitions: Partial<Record<PartId, Transition>> = {}

  const damage = () => save.holes.length
  const now = () => performance.now()

  const placement = (p: PartId): Placement | null => {
    const tr = transitions[p]
    if (!tr) return restingPlacement(p, damage())
    const k = Math.min(1, (now() - tr.start) / FALL_MS)
    if (k >= 1) {
      delete transitions[p]
      return tr.to
    }
    const ease = tr.fall ? k * k : 1 - (1 - k) * (1 - k)
    // Petit rebond à l'arrivée au sol
    const bounce = tr.fall && k > 0.8 ? Math.sin(((k - 0.8) / 0.2) * Math.PI) * -6 : 0
    return {
      dx: tr.from.dx + (tr.to.dx - tr.from.dx) * k,
      dy: tr.from.dy + (tr.to.dy - tr.from.dy) * ease + bounce,
      rot: tr.from.rot + (tr.to.rot - tr.from.rot) * (tr.fall ? k : ease),
    }
  }

  // ---------- Vue ----------
  const toWorld = (x: number, y: number): [number, number] => [(x - ox) / scale, (y - oy) / scale]

  const resize = () => {
    cssW = canvas.clientWidth
    cssH = canvas.clientHeight
    if (!cssW || !cssH) return
    dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)
    groundY = cssH - Math.max(56, cssH * 0.14)
    scale = Math.min(cssW / 330, (groundY - 24) / 235, 3)
    ox = cssW / 2 - 100 * scale
    oy = groundY - 250 * scale
    draw()
  }

  // ---------- Son (coupé par défaut) ----------
  const bang = () => {
    if (!sound) return
    try {
      audio ??= new AudioContext()
      const len = weapon === 'shotgun' ? 0.45 : 0.22
      const buffer = audio.createBuffer(1, Math.floor(audio.sampleRate * len), audio.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < data.length; i++)
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, weapon === 'shotgun' ? 2.2 : 3.5)
      const src = audio.createBufferSource()
      src.buffer = buffer
      const filter = audio.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = weapon === 'shotgun' ? 1400 : 2600
      const gain = audio.createGain()
      gain.gain.value = 0.5
      src.connect(filter).connect(gain).connect(audio.destination)
      src.start()
    } catch {
      /* pas de son disponible */
    }
  }

  // ---------- Effets ----------
  const puff = (x: number, y: number, n: number, speed: number, colors: string[]) => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2
      const v = speed * (0.4 + Math.random() * 0.8)
      const max = 0.7 + Math.random() * 0.9
      particles.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - speed * 0.5,
        r: 1.5 + Math.random() * 3.5,
        life: max,
        max,
        color: colors[Math.floor(Math.random() * colors.length)],
      })
    }
  }

  const say = () => {
    if (bubble && now() - bubble.t < 1400) return
    if (Math.random() > 0.4) return
    const d = damage()
    const level = d < 10 ? 0 : d < 25 ? 1 : d < 40 ? 2 : 3
    const list = BUBBLES[level]
    bubble = { text: list[Math.floor(Math.random() * list.length)], t: now() }
  }

  // ---------- Tir ----------
  const fire = (cssX: number, cssY: number) => {
    const t = now()
    if (t - lastShot < COOLDOWN[weapon]) return
    if (damage() >= STAGES.destroyed) return
    lastShot = t
    bang()
    shake = weapon === 'shotgun' ? 1 : 0.55

    const before = new Map(PARTS.map((p) => [p, restingPlacement(p, damage())]))
    const [cx, cy] = toWorld(cssX, cssY)
    const pellets: [number, number][] =
      weapon === 'pistol'
        ? [[cx, cy]]
        : Array.from({ length: 4 }, () => {
            const a = Math.random() * Math.PI * 2
            const r = Math.sqrt(Math.random()) * 17
            return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as [number, number]
          })

    let touched = 0
    for (const [x, y] of pellets) {
      if (damage() >= STAGES.destroyed) break
      flashes.push({ x, y, t })
      const hit = hitTest(x, y, damage(), placement, wobble)
      if (!hit) continue
      touched++
      save.holes.push({
        part: hit.part,
        x: hit.x,
        y: hit.y,
        r: weapon === 'pistol' ? 3.4 + Math.random() * 0.8 : 2.2 + Math.random() * 0.6,
        seed: Math.random() * 1000,
      })
      puff(x, y, weapon === 'pistol' ? 6 : 3, 120, ['#f7f3ea', '#ddd5c4', '#f7f3ea'])
      if (!isDetached(hit.part, damage() - 1)) spin += ((x - 100) / 100) * -2.2 + (Math.random() - 0.5) * 0.8
    }

    save = { holes: save.holes, shots: save.shots + 1, hits: save.hits + (touched ? 1 : 0) }

    if (!touched) misses.push({ x: cx, y: cy, t })
    else say()

    // Morceaux qui se détachent ou penchent : on anime le passage
    for (const p of PARTS) {
      const to = restingPlacement(p, damage())
      if (!same(before.get(p) ?? null, to)) {
        transitions[p] = { from: placement(p) ?? ZERO, to: to ?? ZERO, start: t, fall: Boolean(to && to.dy > 20) }
        const [px, py] = placePoint(p, ...pivotOf(p), null, wobble)
        puff(px, py, 14, 160, ['#f7f3ea', '#ddd5c4'])
      }
    }

    // Destruction : explosion de rembourrage et de jean
    if (damage() >= STAGES.destroyed) {
      puff(100, 170, 110, 420, ['#f7f3ea', '#f7f3ea', '#ddd5c4', '#8b5a2b', '#4a78b8', '#355d97'])
      bubble = null
      shake = 2.2
    }

    onChange(save)
    run()
  }

  const pivotOf = (p: PartId): [number, number] =>
    p === 'head'
      ? [100, 112]
      : p === 'earL'
        ? [70, 46]
        : p === 'earR'
          ? [130, 46]
          : p === 'armL'
            ? [64, 128]
            : p === 'armR'
              ? [136, 128]
              : [100, 248]

  // ---------- Dessin ----------
  const draw = () => {
    if (!cssW) return
    const t = now()
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const sky = ctx.createLinearGradient(0, 0, 0, groundY)
    sky.addColorStop(0, '#070b24')
    sky.addColorStop(1, '#141f58')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, cssW, cssH)

    // Projecteur sur Jude
    const spot = ctx.createRadialGradient(cssW / 2, groundY - 110 * scale, 10, cssW / 2, groundY - 110 * scale, 190 * scale)
    spot.addColorStop(0, 'rgba(125,162,255,.22)')
    spot.addColorStop(1, 'rgba(125,162,255,0)')
    ctx.fillStyle = spot
    ctx.fillRect(0, 0, cssW, cssH)

    ctx.fillStyle = '#0c1440'
    ctx.fillRect(0, groundY, cssW, cssH - groundY)
    ctx.fillStyle = 'rgba(125,162,255,.45)'
    ctx.fillRect(0, groundY, cssW, 1.5)

    // Recul : léger tremblement de l'image
    if (shake > 0.01) ctx.translate((Math.random() - 0.5) * 6 * shake, (Math.random() - 0.5) * 6 * shake)

    ctx.save()
    ctx.translate(ox, oy)
    ctx.scale(scale, scale)
    drawJude(ctx, save.holes, damage(), placement, wobble)

    for (const p of particles) {
      ctx.globalAlpha = Math.min(1, p.life / p.max + 0.2)
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1

    // Éclats d'impact
    for (const f of flashes) {
      const k = (t - f.t) / 120
      if (k > 1) continue
      ctx.fillStyle = `rgba(255,217,138,${1 - k})`
      ctx.beginPath()
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2
        const r = (i % 2 ? 3 : 9) * (1 + k)
        ctx.lineTo(f.x + Math.cos(a) * r, f.y + Math.sin(a) * r)
      }
      ctx.fill()
    }

    // Bulle de Jude
    if (bubble && damage() < STAGES.destroyed) {
      const age = (t - bubble.t) / 1000
      if (age < 1.6) {
        const head = placement('head')
        const [hx, hy] = placePoint('head', 128, 34, head, wobble, isDetached('head', damage()))
        ctx.globalAlpha = age > 1.3 ? (1.6 - age) / 0.3 : 1
        ctx.font = '600 11px Jost, system-ui, sans-serif'
        const w = ctx.measureText(bubble.text).width + 16
        const bx = Math.min(hx + 4, 240 - w)
        const by = hy - 30
        ctx.fillStyle = '#f4f6ff'
        ctx.beginPath()
        ctx.roundRect(bx, by, w, 22, 11)
        ctx.moveTo(bx + 10, by + 21)
        ctx.lineTo(bx + 4, by + 30)
        ctx.lineTo(bx + 18, by + 21)
        ctx.fill()
        ctx.fillStyle = '#070b24'
        ctx.textBaseline = 'middle'
        ctx.textAlign = 'left'
        ctx.fillText(bubble.text, bx + 8, by + 11.5)
        ctx.globalAlpha = 1
      }
    }

    // « Raté ! » là où on a tiré
    for (const m of misses) {
      const k = (t - m.t) / 900
      if (k > 1) continue
      ctx.globalAlpha = 1 - k * k
      ctx.font = '700 15px Jost, system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.lineWidth = 3
      ctx.strokeStyle = '#070b24'
      ctx.strokeText('Raté !', m.x, m.y - 14 - k * 22)
      ctx.fillStyle = '#ff6b9a'
      ctx.fillText('Raté !', m.x, m.y - 14 - k * 22)
      ctx.globalAlpha = 1
    }
    ctx.restore()
  }

  // ---------- Boucle (uniquement quand quelque chose bouge) ----------
  const busy = () => {
    const t = now()
    return (
      particles.length > 0 ||
      Math.abs(wobble) > 0.002 ||
      Math.abs(spin) > 0.01 ||
      shake > 0.01 ||
      Object.keys(transitions).length > 0 ||
      flashes.some((f) => t - f.t < 120) ||
      misses.some((m) => t - m.t < 900) ||
      Boolean(bubble && t - bubble.t < 1600)
    )
  }

  const step = (dt: number) => {
    // Ressort amorti : Jude vacille puis se stabilise
    spin += (-wobble * 90 - spin * 7) * dt
    wobble = Math.max(-0.35, Math.min(0.35, wobble + spin * dt))
    shake = Math.max(0, shake - dt * 6)
    for (const p of particles) {
      p.vy += 520 * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      if (p.y > 249 - p.r) {
        p.y = 249 - p.r
        p.vy *= -0.25
        p.vx *= 0.6
      }
      p.life -= dt
    }
    particles = particles.filter((p) => p.life > 0)
    const t = now()
    flashes = flashes.filter((f) => t - f.t < 120)
    misses = misses.filter((m) => t - m.t < 900)
  }

  const loop = (t: number) => {
    const dt = Math.min(1 / 30, last ? (t - last) / 1000 : 0)
    last = t
    step(dt)
    draw()
    if (busy()) raf = requestAnimationFrame(loop)
    else {
      raf = 0
      wobble = 0
      spin = 0
      draw()
    }
  }

  const run = () => {
    if (raf) return
    last = 0
    raf = requestAnimationFrame(loop)
  }

  const observer = new ResizeObserver(resize)
  observer.observe(canvas)
  resize()
  // Les polices peuvent arriver après le premier dessin
  void document.fonts?.ready.then(draw)

  return {
    fire,
    setWeapon: (w) => {
      weapon = w
    },
    setSound: (on) => {
      sound = on
    },
    reset: () => {
      save = { holes: [], shots: 0, hits: 0 }
      particles = []
      for (const p of PARTS) delete transitions[p]
      bubble = null
      onChange(save)
      draw()
    },
    destroy: () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
      void audio?.close()
    },
  }
}
