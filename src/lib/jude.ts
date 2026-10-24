// Jude, l'ours en peluche à salopette : dessin par morceaux qui se détachent au fil des tirs.
// Repère : 200 × 260, Jude de face, ses pieds touchent y = 248.

export type PartId = 'head' | 'earL' | 'earR' | 'armL' | 'armR' | 'body'

export interface Hole {
  part: PartId
  x: number // repère de Jude (avant tout déplacement du morceau)
  y: number
  r: number
  seed: number
}

export interface Placement {
  dx: number
  dy: number
  rot: number
}

const C = {
  fur: '#8b5a2b',
  furShade: '#6e4520',
  furLight: '#d6a874',
  nose: '#2b1a10',
  denim: '#4a78b8',
  denimDark: '#355d97',
  denimLight: '#7fa6dc',
  stitch: '#f0c27a',
  button: '#e9b949',
  stuffing: '#f7f3ea',
  stuffingShade: '#ddd5c4',
  hole: '#1d120a',
}

/** Point d'attache de chaque morceau (centre de rotation quand il penche ou tombe). */
export const PIVOT: Record<PartId, [number, number]> = {
  head: [100, 118],
  earL: [70, 46],
  earR: [130, 46],
  armL: [64, 128],
  armR: [136, 128],
  body: [100, 248],
}

/** Tirs nécessaires pour chaque étape de destruction. */
export const STAGES = {
  tufts: 10, // le rembourrage sort des trous
  tear1: 12,
  tear2: 17,
  earL: 20,
  eyeHangs: 24,
  strap: 27,
  earR: 30,
  armL: 33,
  headTilt: 36,
  armR: 40,
  head: 45,
  destroyed: 50,
}

const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

// ---------- Formes ----------
const ellipse = (cx: number, cy: number, rx: number, ry: number, rot = 0) => {
  const p = new Path2D()
  p.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2)
  return p
}

let shapes: ReturnType<typeof buildShapes> | null = null
function buildShapes() {
  const body = new Path2D()
  body.addPath(ellipse(100, 172, 50, 54))
  body.addPath(ellipse(72, 224, 25, 23))
  body.addPath(ellipse(128, 224, 25, 23))
  const head = new Path2D()
  head.addPath(ellipse(100, 76, 47, 43))
  return {
    head,
    earL: ellipse(64, 40, 18, 17),
    earR: ellipse(136, 40, 18, 17),
    armL: ellipse(52, 158, 16, 34, 0.42),
    armR: ellipse(148, 158, 16, 34, -0.42),
    body,
    // Salopette : bas (short) + bavette
    overalls: new Path2D(
      'M54 176 C52 200 50 214 50 226 C56 236 88 238 96 228 L100 214 L104 228 C112 238 144 236 150 226 C150 214 148 200 146 176 C130 186 70 186 54 176Z',
    ),
    bib: new Path2D('M76 140 L124 140 C126 156 128 170 132 182 C112 190 88 190 68 182 C72 170 74 156 76 140Z'),
  }
}
const S = () => (shapes ??= buildShapes())

export function partPath(part: PartId): Path2D {
  return S()[part]
}

const NONE: Placement = { dx: 0, dy: 0, rot: 0 }

/** Point (x, y) ramené dans le repère d'origine d'un morceau déplacé. */
function unplace(part: PartId, x: number, y: number, pl: Placement | null): [number, number] {
  if (!pl) return [x, y]
  const [px, py] = PIVOT[part]
  const ux = x - px - pl.dx
  const uy = y - py - pl.dy
  const c = Math.cos(-pl.rot)
  const s = Math.sin(-pl.rot)
  return [ux * c - uy * s + px, ux * s + uy * c + py]
}

/** Jude vacille autour de ses pieds : seuls les morceaux encore attachés bougent. */
export const WOBBLE_PIVOT: [number, number] = [100, 248]

export function isDetached(part: PartId, damage: number) {
  const pl = restingPlacement(part, damage)
  return Boolean(pl && pl.dy > 20)
}

let probe: CanvasRenderingContext2D | null = null

/**
 * Morceau touché au point (x, y) du repère de Jude, et l'endroit exact sur ce morceau.
 * null = tir à côté.
 */
export function hitTest(
  x: number,
  y: number,
  damage: number,
  placement: (p: PartId) => Placement | null,
  wobble = 0,
): { part: PartId; x: number; y: number } | null {
  if (damage >= STAGES.destroyed) return null
  probe ??= document.createElement('canvas').getContext('2d')!
  // Point dans le repère des morceaux attachés (on annule le vacillement)
  const [wx, wy] = WOBBLE_PIVOT
  const c = Math.cos(-wobble)
  const s = Math.sin(-wobble)
  const ax = (x - wx) * c - (y - wy) * s + wx
  const ay = (x - wx) * s + (y - wy) * c + wy

  const front: PartId[] = ['head', 'armL', 'armR', 'earL', 'earR', 'body']
  const attached = front.filter((p) => !isDetached(p, damage))
  const fallen = front.filter((p) => isDetached(p, damage))
  for (const p of attached) {
    const [lx, ly] = unplace(p, ax, ay, placement(p))
    if (probe.isPointInPath(partPath(p), lx, ly)) return { part: p, x: lx, y: ly }
  }
  for (const p of fallen) {
    const [lx, ly] = unplace(p, x, y, placement(p))
    if (probe.isPointInPath(partPath(p), lx, ly)) return { part: p, x: lx, y: ly }
  }
  return null
}

/** Position actuelle d'un point du repère d'origine d'un morceau (pour placer les bulles, etc.). */
export function placePoint(part: PartId, x: number, y: number, pl: Placement | null, wobble = 0, detached = false): [number, number] {
  const p = pl ?? NONE
  const [px, py] = PIVOT[part]
  const c = Math.cos(p.rot)
  const s = Math.sin(p.rot)
  let rx = (x - px) * c - (y - py) * s + px + p.dx
  let ry = (x - px) * s + (y - py) * c + py + p.dy
  if (!detached && wobble) {
    const [wx, wy] = WOBBLE_PIVOT
    const cw = Math.cos(wobble)
    const sw = Math.sin(wobble)
    ;[rx, ry] = [(rx - wx) * cw - (ry - wy) * sw + wx, (rx - wx) * sw + (ry - wy) * cw + wy]
  }
  return [rx, ry]
}

// ---------- Détails ----------
function fluff(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, seed: number) {
  ctx.fillStyle = C.stuffingShade
  for (let i = 0; i < 5; i++) {
    const a = hash(seed + i) * Math.PI * 2
    ctx.beginPath()
    ctx.arc(
      x + Math.cos(a) * size * 0.55 + 0.6,
      y + Math.sin(a) * size * 0.55 + 0.8,
      size * (0.45 + hash(seed + i + 9) * 0.3),
      0,
      Math.PI * 2,
    )
    ctx.fill()
  }
  ctx.fillStyle = C.stuffing
  for (let i = 0; i < 5; i++) {
    const a = hash(seed + i) * Math.PI * 2
    ctx.beginPath()
    ctx.arc(x + Math.cos(a) * size * 0.55, y + Math.sin(a) * size * 0.55, size * (0.42 + hash(seed + i + 9) * 0.3), 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawHole(ctx: CanvasRenderingContext2D, h: Hole, index: number, damage: number) {
  // Bord déchiré irrégulier
  ctx.fillStyle = 'rgba(40,24,12,.55)'
  ctx.beginPath()
  const n = 9
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2
    const rr = h.r * (1.35 + hash(h.seed + i) * 0.5)
    const px = h.x + Math.cos(a) * rr
    const py = h.y + Math.sin(a) * rr
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.fill()
  ctx.fillStyle = C.hole
  ctx.beginPath()
  ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2)
  ctx.fill()
  // Un peu de rembourrage visible au fond, puis qui déborde avec les dégâts
  if (damage >= STAGES.tufts && hash(h.seed + index) < 0.55) fluff(ctx, h.x + h.r * 0.3, h.y - h.r * 0.2, h.r * 1.1, h.seed)
  else {
    ctx.fillStyle = C.stuffing
    ctx.beginPath()
    ctx.arc(h.x - h.r * 0.25, h.y + h.r * 0.2, h.r * 0.35, 0, Math.PI * 2)
    ctx.fill()
  }
}

/** Déchirure de la salopette : un trou effiloché qui laisse voir la fourrure. */
function tear(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number) {
  ctx.beginPath()
  const n = 12
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2
    const k = 0.7 + hash(seed + i) * 0.45
    const px = x + Math.cos(a) * w * k
    const py = y + Math.sin(a) * h * k
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.fillStyle = C.fur
  ctx.fill()
  ctx.strokeStyle = C.denimLight
  ctx.lineWidth = 1.6
  ctx.setLineDash([2, 2])
  ctx.stroke()
  ctx.setLineDash([])
  fluff(ctx, x + w * 0.15, y, Math.min(w, h) * 0.45, seed + 3)
}

function stitches(ctx: CanvasRenderingContext2D, path: Path2D) {
  ctx.strokeStyle = C.stitch
  ctx.lineWidth = 1.1
  ctx.setLineDash([3, 2.5])
  ctx.stroke(path)
  ctx.setLineDash([])
}

// ---------- Morceaux ----------
function drawPart(ctx: CanvasRenderingContext2D, part: PartId, damage: number) {
  const s = S()
  if (part === 'earL' || part === 'earR') {
    const x = part === 'earL' ? 64 : 136
    ctx.fillStyle = C.fur
    ctx.fill(s[part])
    ctx.fillStyle = C.furLight
    ctx.beginPath()
    ctx.ellipse(x, 42, 9, 8.5, 0, 0, Math.PI * 2)
    ctx.fill()
    return
  }
  if (part === 'armL' || part === 'armR') {
    const left = part === 'armL'
    ctx.fillStyle = C.fur
    ctx.fill(s[part])
    ctx.fillStyle = C.furLight
    ctx.beginPath()
    ctx.ellipse(left ? 40 : 160, 184, 10, 11, left ? 0.42 : -0.42, 0, Math.PI * 2)
    ctx.fill()
    return
  }
  if (part === 'body') {
    ctx.fillStyle = C.fur
    ctx.fill(s.body)
    // Coussinets des pieds
    ctx.fillStyle = C.furLight
    for (const x of [72, 128]) {
      ctx.beginPath()
      ctx.ellipse(x, 230, 13, 12, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    // Salopette
    ctx.fillStyle = C.denim
    ctx.fill(s.overalls)
    ctx.fill(s.bib)
    ctx.fillStyle = C.denimDark
    ctx.fillRect(98.5, 196, 3, 32) // couture centrale
    stitches(ctx, s.bib)
    // Poche
    const pocket = new Path2D()
    pocket.roundRect(87, 150, 26, 22, [2, 2, 8, 8])
    ctx.fillStyle = C.denimDark
    ctx.fill(pocket)
    stitches(ctx, pocket)
    // Bretelles
    const strap = (x1: number, broken: boolean) => {
      ctx.strokeStyle = C.denim
      ctx.lineWidth = 9
      ctx.lineCap = 'round'
      ctx.beginPath()
      if (broken) {
        // Bretelle arrachée : pend le long de la bavette
        ctx.strokeStyle = C.denimDark
        ctx.moveTo(x1, 144)
        ctx.quadraticCurveTo(x1 + (x1 < 100 ? -10 : 10), 160, x1 + (x1 < 100 ? -6 : 6), 184)
      } else {
        ctx.moveTo(x1, 144)
        ctx.lineTo(x1 + (x1 < 100 ? -8 : 8), 116)
      }
      ctx.stroke()
      ctx.fillStyle = C.button
      ctx.beginPath()
      ctx.arc(x1, 145, 4.2, 0, Math.PI * 2)
      ctx.fill()
    }
    strap(80, false)
    strap(120, damage >= STAGES.strap)
    if (damage >= STAGES.tear1) tear(ctx, 118, 205, 13, 9, 7)
    if (damage >= STAGES.tear2) tear(ctx, 76, 186, 11, 8, 21)
    return
  }
  // Tête
  ctx.fillStyle = C.fur
  ctx.fill(s.head)
  ctx.fillStyle = C.furLight
  ctx.beginPath()
  ctx.ellipse(100, 92, 21, 16, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = C.nose
  ctx.beginPath()
  ctx.moveTo(91, 84)
  ctx.quadraticCurveTo(100, 79, 109, 84)
  ctx.quadraticCurveTo(104, 93, 100, 93)
  ctx.quadraticCurveTo(96, 93, 91, 84)
  ctx.fill()
  ctx.strokeStyle = C.nose
  ctx.lineWidth = 1.8
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(100, 93)
  ctx.lineTo(100, 99)
  ctx.moveTo(92, 101)
  ctx.quadraticCurveTo(96, 104, 100, 99)
  ctx.quadraticCurveTo(104, 104, 108, 101)
  ctx.stroke()
  // Yeux-boutons (le droit pend au bout de son fil)
  const eye = (x: number, y: number) => {
    ctx.fillStyle = C.nose
    ctx.beginPath()
    ctx.arc(x, y, 5.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,.75)'
    ctx.beginPath()
    ctx.arc(x - 1.6, y - 1.8, 1.5, 0, Math.PI * 2)
    ctx.fill()
  }
  eye(82, 68)
  if (damage >= STAGES.eyeHangs) {
    ctx.strokeStyle = C.nose
    ctx.lineWidth = 0.9
    ctx.beginPath()
    ctx.moveTo(118, 68)
    ctx.quadraticCurveTo(124, 86, 121, 104)
    ctx.stroke()
    ctx.fillStyle = C.hole
    ctx.beginPath()
    ctx.arc(118, 68, 3.5, 0, Math.PI * 2)
    ctx.fill()
    eye(121, 108)
  } else eye(118, 68)
}

/** Rembourrage qui sort là où un morceau a été arraché. */
function seam(ctx: CanvasRenderingContext2D, part: PartId) {
  const [x, y] = PIVOT[part]
  fluff(ctx, x, y + (part === 'head' ? -4 : 0), part === 'head' ? 14 : 8, x + y)
}

/** Position d'un morceau selon les dégâts (au repos : tombé par terre). */
export function restingPlacement(part: PartId, damage: number): Placement | null {
  const fallen: Partial<Record<PartId, [number, Placement]>> = {
    earL: [STAGES.earL, { dx: -52, dy: 200, rot: -0.6 }],
    earR: [STAGES.earR, { dx: 40, dy: 202, rot: 0.9 }],
    armL: [STAGES.armL, { dx: -30, dy: 96, rot: 1.45 }],
    armR: [STAGES.armR, { dx: 36, dy: 98, rot: -1.5 }],
    head: [STAGES.head, { dx: 76, dy: 104, rot: 1.1 }],
  }
  const f = fallen[part]
  if (f && damage >= f[0]) return f[1]
  if (part === 'head' && damage >= STAGES.headTilt) return { dx: 0, dy: 4, rot: -0.28 }
  return null
}

/**
 * Dessine Jude avec tous ses dégâts.
 * `placement` peut remplacer la position d'un morceau (animation de chute en cours).
 */
export function drawJude(
  ctx: CanvasRenderingContext2D,
  holes: Hole[],
  damage: number,
  placement: (p: PartId) => Placement | null = (p) => restingPlacement(p, damage),
  wobble = 0,
) {
  if (damage >= STAGES.destroyed) return drawRemains(ctx, holes)

  const layer = (part: PartId, attached: boolean) => {
    const pl = placement(part)
    ctx.save()
    if (attached && wobble) {
      const [wx, wy] = WOBBLE_PIVOT
      ctx.translate(wx, wy)
      ctx.rotate(wobble)
      ctx.translate(-wx, -wy)
    }
    if (pl) {
      const [px, py] = PIVOT[part]
      ctx.translate(px + pl.dx, py + pl.dy)
      ctx.rotate(pl.rot)
      ctx.translate(-px, -py)
    }
    drawPart(ctx, part, damage)
    // Trous de ce morceau (ils bougent avec lui)
    ctx.save()
    ctx.clip(partPath(part))
    holes.forEach((h, i) => h.part === part && drawHole(ctx, h, i, damage))
    ctx.restore()
    ctx.restore()
  }

  const detached = (p: PartId) => isDetached(p, damage)

  // Ombre au sol
  ctx.fillStyle = 'rgba(0,0,0,.3)'
  ctx.beginPath()
  ctx.ellipse(100, 250, 64, 7, 0, 0, Math.PI * 2)
  ctx.fill()

  // Rembourrage qui dépasse là où un morceau manque (suit Jude quand il vacille)
  const seamAt = (p: PartId) => {
    ctx.save()
    const [wx, wy] = WOBBLE_PIVOT
    ctx.translate(wx, wy)
    ctx.rotate(wobble)
    ctx.translate(-wx, -wy)
    if (p === 'earL' || p === 'earR') {
      const head = placement('head')
      if (head) {
        const [px, py] = PIVOT.head
        ctx.translate(px + head.dx, py + head.dy)
        ctx.rotate(head.rot)
        ctx.translate(-px, -py)
      }
    }
    seam(ctx, p)
    ctx.restore()
  }

  const order: PartId[] = ['earL', 'earR', 'body', 'armL', 'armR', 'head']
  // Morceaux tombés dessinés en premier (au sol, derrière Jude)
  for (const p of order) if (detached(p)) layer(p, false)
  for (const p of order) {
    if (detached(p)) {
      if (p === 'head' || p === 'armL' || p === 'armR') seamAt(p)
      continue
    }
    layer(p, true)
    if (p === 'head') for (const e of ['earL', 'earR'] as const) if (detached(e)) seamAt(e)
  }
}

/** Ce qui reste de Jude : un tas de rembourrage, des lambeaux de jean et ses yeux-boutons. */
export function drawRemains(ctx: CanvasRenderingContext2D, holes: Hole[] = []) {
  ctx.fillStyle = 'rgba(0,0,0,.3)'
  ctx.beginPath()
  ctx.ellipse(100, 250, 80, 8, 0, 0, Math.PI * 2)
  ctx.fill()
  // Tas de rembourrage (plus haut au centre)
  for (let i = 0; i < 46; i++) {
    const x = 34 + hash(i) * 132
    const y = 246 - hash(i + 40) * 52 * Math.max(0, 1 - Math.abs(x - 100) / 70)
    fluff(ctx, x, y, 8 + hash(i + 80) * 9, i * 13)
  }
  // Lambeaux de salopette
  const rag = (x: number, y: number, rot: number, w: number) => {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(rot)
    ctx.fillStyle = C.denim
    ctx.beginPath()
    ctx.moveTo(-w, -6)
    for (let i = 0; i <= 6; i++) ctx.lineTo(-w + (i * 2 * w) / 6, i % 2 ? -9 : -5)
    ctx.lineTo(w, 7)
    for (let i = 6; i >= 0; i--) ctx.lineTo(-w + (i * 2 * w) / 6, i % 2 ? 10 : 6)
    ctx.closePath()
    ctx.fill()
    stitches(ctx, ellipse(0, 0, w * 0.6, 3))
    ctx.restore()
  }
  rag(70, 240, -0.2, 22)
  rag(132, 242, 0.25, 18)
  rag(104, 228, 0.05, 14)
  // Fourrure arrachée
  ctx.fillStyle = C.fur
  for (const [x, y, r] of [
    [52, 243, 9],
    [150, 244, 8],
    [118, 236, 6],
  ])
    ctx.fill(ellipse(x, y, r, r * 0.7, 0.3))
  // Yeux-boutons par terre
  for (const [x, y] of [
    [88, 236],
    [160, 247],
  ]) {
    ctx.fillStyle = C.nose
    ctx.beginPath()
    ctx.arc(x, y, 5.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,.75)'
    ctx.beginPath()
    ctx.arc(x - 1.6, y - 1.8, 1.5, 0, Math.PI * 2)
    ctx.fill()
  }
  void holes
}
