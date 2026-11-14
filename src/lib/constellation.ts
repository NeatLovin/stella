// Géométrie de la constellation en 3D (page Timeline).
//
// Le « cœur caché » : chaque souvenir est posé sur la courbe d'un cœur, puis repoussé plus ou moins loin
// le long du rayon de la caméra. Vu de face, tout se projette exactement sur le cœur ; dès qu'on tourne,
// les étoiles se dispersent dans l'espace et le cœur disparaît.

/** Distance de la caméra au centre de la constellation (unités du cœur, qui tient dans [-1, 1]) */
export const CAM = 3.2

export interface Vec2 {
  x: number
  y: number
}

export interface Projected {
  x: number
  y: number
  /** Facteur de perspective : plus grand quand le point est proche */
  s: number
  /** Distance à la caméra, pour dessiner du plus loin au plus proche */
  depth: number
}

// Courbe classique du cœur, y vers le bas (repère écran). t = 0 : creux du haut ; t = π : pointe du bas.
const raw = (t: number): Vec2 => ({
  x: 16 * Math.sin(t) ** 3,
  y: -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)),
})

// Échantillonnage fin, pour placer les points à intervalles réguliers le long du tracé (et pas selon t)
const SAMPLES = 720
const table: Vec2[] = []
const lengths: number[] = [0]
{
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (let i = 0; i <= SAMPLES; i++) {
    const p = raw((i / SAMPLES) * Math.PI * 2)
    table.push(p)
    minX = Math.min(minX, p.x)
    maxX = Math.max(maxX, p.x)
    minY = Math.min(minY, p.y)
    maxY = Math.max(maxY, p.y)
  }
  // Centré, et la plus grande dimension ramenée à [-1, 1]
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const half = Math.max(maxX - minX, maxY - minY) / 2
  for (const p of table) {
    p.x = (p.x - cx) / half
    p.y = (p.y - cy) / half
  }
  for (let i = 1; i <= SAMPLES; i++) lengths.push(lengths[i - 1] + Math.hypot(table[i].x - table[i - 1].x, table[i].y - table[i - 1].y))
}
const TOTAL = lengths[SAMPLES]

/** Point du cœur à la fraction u du tracé (0 = creux du haut, puis lobe droit, pointe, lobe gauche) */
export function heartAt(u: number): Vec2 {
  const target = (((u % 1) + 1) % 1) * TOTAL
  let lo = 0
  let hi = SAMPLES
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (lengths[mid] < target) lo = mid
    else hi = mid
  }
  const span = lengths[hi] - lengths[lo] || 1
  const f = (target - lengths[lo]) / span
  return { x: table[lo].x + (table[hi].x - table[lo].x) * f, y: table[lo].y + (table[hi].y - table[lo].y) * f }
}

/** Nombre stable entre 0 et 1 tiré d'un identifiant */
export function hash01(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 10007) / 10007
}

export interface Node {
  /** Position sur le tracé du cœur */
  u: number
  /** Éloignement le long du rayon : 1 = plan du cœur, < 1 plus près, > 1 plus loin */
  k: number
}

/** Place n souvenirs (dans l'ordre chronologique) régulièrement sur le cœur, chacun à sa profondeur */
export function layout(ids: string[]): Node[] {
  return ids.map((id, i) => {
    // Un coup devant, un coup derrière, pour que le cœur se disperse vraiment quand on tourne
    const side = i % 2 === 0 ? 1 : -1
    return { u: i / ids.length, k: 1 + side * (0.16 + 0.3 * hash01(id)) }
  })
}

/** Position 3D d'un point du cœur repoussé à la profondeur k (sur le rayon de la caméra) */
export function toWorld(u: number, k: number): [number, number, number] {
  const h = heartAt(u)
  return [k * h.x, k * h.y, (k - 1) * CAM]
}

/** Tourne (lacet puis tangage) et projette en perspective. Sans rotation, on retombe pile sur le cœur. */
export function project([x, y, z]: [number, number, number], yaw: number, pitch: number): Projected {
  const cy = Math.cos(yaw)
  const sy = Math.sin(yaw)
  const x1 = x * cy + z * sy
  const z1 = -x * sy + z * cy
  const cp = Math.cos(pitch)
  const sp = Math.sin(pitch)
  const y2 = y * cp - z1 * sp
  const z2 = y * sp + z1 * cp
  const depth = Math.max(0.3, z2 + CAM)
  const s = CAM / depth
  return { x: x1 * s, y: y2 * s, s, depth }
}

/** Points intermédiaires du trait entre deux étoiles (le trait suit la courbe du cœur, en 3D) */
export function segment(a: Node, b: Node, steps = 10): [number, number, number][] {
  const ub = b.u <= a.u ? b.u + 1 : b.u
  const out: [number, number, number][] = []
  for (let i = 0; i <= steps; i++) {
    const f = i / steps
    const e = f * f * (3 - 2 * f)
    out.push(toWorld(a.u + (ub - a.u) * f, a.k + (b.k - a.k) * e))
  }
  return out
}
