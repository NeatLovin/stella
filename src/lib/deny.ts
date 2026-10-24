// Deny, le suricate : formes partagées entre le logo (SVG) et le jeu (canvas).
// Repère : 120 × 160, Deny regarde vers la droite, ses pieds touchent y = 150.

export const DENY = {
  head: 'M46 34 C46 22 56 15 67 16 C78 17 85 25 91 32 C94 36 92 41 87 42 C80 44 74 48 66 49 C55 50 46 44 46 34Z',
  muzzle: 'M60 40 C68 44 78 43 88 40 C82 46 72 49 64 48Z',
  body: 'M53 44 C46 57 42 76 42 98 C42 120 47 135 59 140 C66 143 74 142 79 137 C84 128 85 118 83 100 C81 77 77 58 72 45Z',
  belly: 'M63 62 C57 78 55 100 57 122 C59 133 66 135 70 126 C75 110 75 83 71 63Z',
  tail: 'M47 124 C38 135 29 144 16 149 C22 150 34 147 44 142 C49 139 53 134 53 129Z',
  tailTip: 'M16 149 C22 150 28 148 32 146 L26 142 C22 145 19 147 16 149Z',
  arm1: 'M66 66 C72 70 78 74 80 82',
  arm2: 'M62 70 C67 76 72 80 73 88',
}

export const FUR = {
  body: '#d9a86c',
  head: '#e2b578',
  shade: '#b9824a',
  mid: '#c99459',
  light: '#f3dcae',
  dark: '#3a2a22',
}

export type Pose = 'stand' | 'run' | 'jump' | 'hurt'

let paths: Record<keyof typeof DENY, Path2D> | null = null
const getPaths = () =>
  (paths ??= Object.fromEntries(Object.entries(DENY).map(([k, d]) => [k, new Path2D(d)])) as Record<keyof typeof DENY, Path2D>)

/** Fait pivoter ce qui suit autour du point (x, y). */
function pivot(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number) {
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.translate(-x, -y)
}

/**
 * Dessine Deny dans le repère 120 × 160 (à placer avec translate/scale avant l'appel).
 * `phase` fait avancer le cycle de course (en radians).
 */
export function drawDeny(ctx: CanvasRenderingContext2D, pose: Pose, phase: number, blink = false) {
  const p = getPaths()
  const run = pose === 'run'
  const jump = pose === 'jump'

  ctx.save()
  // Penché en avant quand il court, rebond à chaque foulée
  const lean = run ? 0.12 : jump ? 0.07 : pose === 'hurt' ? -0.14 : 0
  const bob = run ? -Math.abs(Math.sin(phase)) * 4 : 0
  pivot(ctx, 64, 150, lean)
  ctx.translate(0, bob)

  // Queue : ondule en courant, se relève en sautant
  ctx.save()
  pivot(ctx, 51, 130, run ? Math.sin(phase * 2) * 0.16 : jump ? -0.3 : 0)
  ctx.fillStyle = FUR.shade
  ctx.fill(p.tail)
  ctx.fillStyle = FUR.dark
  ctx.fill(p.tailTip)
  ctx.restore()

  // Pattes arrière : foulées alternées (la plus éloignée est plus foncée)
  const leg = (hipX: number, ph: number, color: string) => {
    let fx = hipX
    let fy = 150 - bob
    if (run) {
      fx = hipX + Math.cos(ph) * 15
      fy = 147 - bob - Math.max(0, Math.sin(ph)) * 11 // -3 : compense l'inclinaison vers l'avant
    } else if (jump) {
      fx = hipX + (hipX > 64 ? 9 : -7)
      fy = 141
    }
    ctx.strokeStyle = color
    ctx.lineWidth = 10
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(hipX, 128)
    ctx.lineTo(fx, fy - 4)
    ctx.stroke()
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.ellipse(fx + 3, fy - 2, 9, 4, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  leg(72, phase + Math.PI, FUR.shade)
  leg(57, phase, FUR.mid)

  ctx.fillStyle = FUR.body
  ctx.fill(p.body)
  ctx.fillStyle = FUR.light
  ctx.fill(p.belly)

  // Pattes avant : balancier opposé aux jambes, levées pendant le saut
  const arm = (path: Path2D, color: string, swing: number) => {
    ctx.save()
    pivot(ctx, 64, 67, run ? Math.sin(swing) * 0.45 : jump ? -0.7 : pose === 'hurt' ? -1.1 : 0)
    ctx.strokeStyle = color
    ctx.lineWidth = 7
    ctx.lineCap = 'round'
    ctx.stroke(path)
    ctx.restore()
  }
  arm(p.arm2, FUR.shade, phase)
  arm(p.arm1, FUR.mid, phase + Math.PI)

  // Tête
  ctx.fillStyle = FUR.head
  ctx.fill(p.head)
  ctx.fillStyle = FUR.light
  ctx.fill(p.muzzle)
  ctx.fillStyle = FUR.dark
  ctx.beginPath()
  ctx.ellipse(52, 29, 4.2, 5.5, 0, 0, Math.PI * 2) // oreille
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(71, 29, 6.5, 4.8, -0.21, 0, Math.PI * 2) // masque autour de l'œil
  ctx.fill()
  ctx.beginPath()
  ctx.arc(90, 35, 2.8, 0, Math.PI * 2) // truffe
  ctx.fill()

  ctx.strokeStyle = '#fff'
  ctx.fillStyle = '#fff'
  ctx.lineCap = 'round'
  if (pose === 'hurt') {
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.moveTo(69.5, 26.5)
    ctx.lineTo(74.5, 31)
    ctx.moveTo(74.5, 26.5)
    ctx.lineTo(69.5, 31)
    ctx.stroke()
  } else if (blink) {
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.moveTo(69.5, 29)
    ctx.lineTo(75, 28)
    ctx.stroke()
  } else {
    ctx.beginPath()
    ctx.arc(72.5, 28, 1.8, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}
