import { drawDeny, type Pose } from './deny'

// Deny Run : course infinie dans le désert, la nuit. Un seul geste : sauter.
// Tout est calculé dans un repère de hauteur fixe (H), quel que soit l'écran.

export type Status = 'ready' | 'running' | 'paused' | 'over'

const BASE_H = 300 // hauteur de référence (écran large)
const MIN_W = 540 // largeur visible minimale : assez d'avance pour voir venir les cactus sur téléphone
const FLOOR = 48 // épaisseur du sol sous Deny
const DENY_X = 64
const DENY_SCALE = 0.5 // sprite de 150 → 75 unités de haut

const START_SPEED = 340 // unités / s
const ACCEL = 7
const MAX_SPEED = 820
const JUMP_SPEED = 780
const GRAVITY_HOLD = 2100 // doigt maintenu : saut plus haut
const GRAVITY = 3000
const SHORT_JUMP = 380 // vitesse plafonnée quand on relâche tôt
const RESTART_DELAY = 450 // ms, évite de relancer par erreur juste après une chute

interface Obstacle {
  x: number
  w: number
  h: number
  kind: 'cactus' | 'duo' | 'trio' | 'rock'
  seed: number
}

export interface Game {
  press: () => void
  release: () => void
  restart: () => void
  pause: () => void
  destroy: () => void
}

/** Petit générateur pseudo-aléatoire stable (décor identique à chaque image). */
const hash = (n: number) => {
  const x = Math.sin(n * 127.1) * 43758.5453
  return x - Math.floor(x)
}

export function createGame(canvas: HTMLCanvasElement, onStatus: (status: Status, score: number) => void): Game {
  const ctx = canvas.getContext('2d')!
  let W = 600
  let H = BASE_H
  let GROUND = H - FLOOR
  let scale = 1
  let dpr = 1

  let status: Status = 'ready'
  let speed = START_SPEED
  let distance = 0
  let phase = 0
  let y = 0 // hauteur au-dessus du sol
  let vy = 0
  let holding = false
  let obstacles: Obstacle[] = []
  let nextGap = 0
  let overAt = 0
  let raf = 0
  let last = 0
  let clock = 0

  const score = () => Math.floor(distance / 12)

  const setStatus = (s: Status) => {
    status = s
    onStatus(s, score())
  }

  const reset = () => {
    speed = START_SPEED
    distance = 0
    y = 0
    vy = 0
    obstacles = []
    nextGap = W * 0.6
  }

  // ---------- Obstacles ----------
  const spawn = () => {
    const fast = speed > 520
    const r = Math.random()
    const seed = Math.random() * 1000
    let o: Obstacle
    if (r < 0.22) o = { kind: 'rock', w: 32, h: 20, x: 0, seed }
    else if (r < 0.62) o = { kind: 'cactus', w: 20, h: 40 + Math.random() * 18, x: 0, seed }
    else if (r < 0.88 || !fast) o = { kind: 'duo', w: 42, h: 44, x: 0, seed }
    else o = { kind: 'trio', w: 62, h: 42, x: 0, seed }
    o.x = W + 20
    obstacles.push(o)
    const minGap = 230 + speed * 0.55
    nextGap = minGap + Math.random() * 280
  }

  const hits = () => {
    const top = GROUND - y
    // Boîtes un peu indulgentes : corps + tête
    const boxes = [
      { l: DENY_X - 8, r: DENY_X + 8, t: top - 58, b: top - 2 },
      { l: DENY_X, r: DENY_X + 13, t: top - 62, b: top - 50 },
    ]
    return obstacles.some((o) => {
      const l = o.x + 3
      const r = o.x + o.w - 3
      const t = GROUND - o.h + 4
      return boxes.some((b) => b.r > l && b.l < r && b.b > t)
    })
  }

  // ---------- Dessin ----------
  const stars = Array.from({ length: 90 }, (_, i) => ({ x: hash(i) * 1600, y: hash(i + 99), r: 0.5 + hash(i + 7) * 1.1 }))

  const dunes = (offset: number, base: number, amp: number, color: string, freq: number) => {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(0, GROUND)
    for (let x = 0; x <= W + 20; x += 20) {
      const u = (x + offset) * freq
      ctx.lineTo(x, base - (Math.sin(u) * 0.6 + Math.sin(u * 2.3 + 1) * 0.4 + 1) * amp)
    }
    ctx.lineTo(W + 20, GROUND)
    ctx.closePath()
    ctx.fill()
  }

  const cactus = (x: number, w: number, h: number, seed: number) => {
    const trunk = Math.max(8, w * 0.42)
    const cx = x + w / 2
    ctx.fillStyle = '#26357a'
    ctx.strokeStyle = 'rgba(125,162,255,.55)'
    ctx.lineWidth = 1.5
    const path = new Path2D()
    path.roundRect(cx - trunk / 2, GROUND - h, trunk, h + 2, trunk / 2)
    const armH = h * (0.3 + hash(seed) * 0.15)
    path.roundRect(x, GROUND - h * 0.62 - armH, 5.5, armH, 3)
    path.roundRect(x, GROUND - h * 0.62 - 5, cx - x, 5.5, 3)
    const armH2 = h * (0.25 + hash(seed + 1) * 0.15)
    path.roundRect(x + w - 5.5, GROUND - h * 0.5 - armH2, 5.5, armH2, 3)
    path.roundRect(cx, GROUND - h * 0.5 - 5, x + w - cx, 5.5, 3)
    ctx.fill(path)
    ctx.stroke(path)
  }

  const drawObstacle = (o: Obstacle) => {
    if (o.kind === 'rock') {
      ctx.fillStyle = '#2b346c'
      ctx.strokeStyle = 'rgba(125,162,255,.45)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(o.x, GROUND + 1)
      ctx.quadraticCurveTo(o.x + 2, GROUND - o.h, o.x + o.w * 0.45, GROUND - o.h)
      ctx.quadraticCurveTo(o.x + o.w, GROUND - o.h + 2, o.x + o.w, GROUND + 1)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      return
    }
    if (o.kind === 'cactus') return cactus(o.x, o.w, o.h, o.seed)
    if (o.kind === 'duo') {
      cactus(o.x, 20, o.h, o.seed)
      cactus(o.x + 22, 20, o.h * 0.78, o.seed + 3)
      return
    }
    cactus(o.x, 20, o.h * 0.85, o.seed)
    cactus(o.x + 21, 20, o.h, o.seed + 3)
    cactus(o.x + 42, 20, o.h * 0.75, o.seed + 6)
  }

  const draw = () => {
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0)

    const sky = ctx.createLinearGradient(0, 0, 0, GROUND)
    sky.addColorStop(0, '#070b24')
    sky.addColorStop(1, '#141f58')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, W, H)

    // Étoiles (défilent très lentement)
    ctx.fillStyle = '#f4f6ff'
    for (const s of stars) {
      const x = (((s.x - distance * 0.03) % 1600) + 1600) % 1600
      if (x > W) continue
      ctx.globalAlpha = 0.35 + 0.5 * hash(s.x + Math.floor(clock * 1.5 + s.y * 50))
      ctx.fillRect(x, s.y * (GROUND - 60), s.r, s.r)
    }
    ctx.globalAlpha = 1

    // Lune
    const mx = W - 130
    const glow = ctx.createRadialGradient(mx, 62, 10, mx, 62, 70)
    glow.addColorStop(0, 'rgba(255,217,138,.25)')
    glow.addColorStop(1, 'rgba(255,217,138,0)')
    ctx.fillStyle = glow
    ctx.fillRect(mx - 70, 0, 140, 140)
    ctx.fillStyle = '#ffe6b0'
    ctx.beginPath()
    ctx.arc(mx, 62, 18, 0, Math.PI * 2)
    ctx.fill()

    dunes(distance * 0.12, GROUND - 26, 22, '#111a4c', 0.006)
    dunes(distance * 0.3 + 400, GROUND - 6, 16, '#162160', 0.011)

    // Sol + petits cailloux qui défilent
    ctx.fillStyle = '#0c1440'
    ctx.fillRect(0, GROUND, W, H - GROUND)
    ctx.fillStyle = 'rgba(125,162,255,.5)'
    ctx.fillRect(0, GROUND, W, 1.5)
    ctx.fillStyle = 'rgba(169,179,224,.35)'
    const step = 46
    const shift = distance % step
    for (let i = -1; i < W / step + 1; i++) {
      const n = Math.floor(distance / step) + i
      const px = i * step - shift + hash(n) * 30
      ctx.fillRect(px, GROUND + 7 + hash(n + 5) * 26, 2 + hash(n + 9) * 5, 1.5)
    }

    for (const o of obstacles) drawObstacle(o)

    // Deny
    const pose: Pose = status === 'over' ? 'hurt' : status === 'running' ? (y > 0 ? 'jump' : 'run') : 'stand'
    const blink = pose === 'stand' && clock % 3.4 < 0.14
    ctx.save()
    ctx.translate(DENY_X, GROUND - y)
    // Ombre au sol, plus petite quand il est en l'air
    ctx.fillStyle = 'rgba(0,0,0,.28)'
    ctx.beginPath()
    ctx.ellipse(0, y + 2, 16 * Math.max(0.4, 1 - y / 160), 3, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.scale(DENY_SCALE, DENY_SCALE)
    ctx.translate(-64, -150)
    drawDeny(ctx, pose, phase, blink)
    ctx.restore()

    // Score
    ctx.font = '500 15px Jost, system-ui, sans-serif'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'top'
    ctx.fillStyle = '#f4f6ff'
    ctx.fillText(String(score()).padStart(5, '0'), W - 18, 16)
  }

  // ---------- Boucle ----------
  const update = (dt: number) => {
    clock += dt
    if (status !== 'running') return
    speed = Math.min(MAX_SPEED, speed + ACCEL * dt)
    const dx = speed * dt
    distance += dx
    phase += dx * 0.045

    if (y > 0 || vy > 0) {
      vy -= (holding && vy > 0 ? GRAVITY_HOLD : GRAVITY) * dt
      y += vy * dt
      if (y <= 0) {
        y = 0
        vy = 0
      }
    }

    for (const o of obstacles) o.x -= dx
    obstacles = obstacles.filter((o) => o.x + o.w > -10)
    nextGap -= dx
    if (nextGap <= 0) spawn()

    if (hits()) {
      overAt = performance.now()
      setStatus('over')
    }
  }

  const loop = (t: number) => {
    const dt = Math.min(1 / 30, last ? (t - last) / 1000 : 0)
    last = t
    update(dt)
    draw()
    // À l'arrêt après une chute : plus besoin d'animer
    raf = status === 'over' ? 0 : requestAnimationFrame(loop)
  }

  const run = () => {
    if (raf) return
    last = 0
    raf = requestAnimationFrame(loop)
  }

  const resize = () => {
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    if (!w || !h) return
    dpr = Math.min(window.devicePixelRatio || 1, 2)
    scale = Math.min(h / BASE_H, w / MIN_W)
    W = w / scale
    H = h / scale
    GROUND = H - FLOOR
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    draw()
  }

  const start = () => {
    reset()
    setStatus('running')
    run()
  }

  const press = () => {
    if (status === 'ready') return start()
    if (status === 'paused') {
      setStatus('running')
      return run()
    }
    if (status === 'over') {
      if (performance.now() - overAt > RESTART_DELAY) start()
      return
    }
    holding = true
    if (y === 0) vy = JUMP_SPEED
  }

  const release = () => {
    holding = false
    if (vy > SHORT_JUMP) vy = SHORT_JUMP
  }

  const pause = () => {
    if (status === 'running') setStatus('paused')
  }

  const onVisibility = () => {
    if (document.hidden) pause()
  }

  const observer = new ResizeObserver(resize)
  observer.observe(canvas)
  document.addEventListener('visibilitychange', onVisibility)
  resize()
  reset()
  run()

  return {
    press,
    release,
    pause,
    restart: start,
    destroy: () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
    },
  }
}
