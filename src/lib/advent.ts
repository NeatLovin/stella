import { toISO, type ISODate } from './dates'

// Calendrier de l'Avent : 24 étoiles qui dessinent un sapin, une par jour du 1er au 24 décembre.

export type AdventKind = 'mot' | 'lettre' | 'bon' | 'souvenir' | 'son' | 'film' | 'defi' | 'quiz' | 'jeu' | 'rdv' | 'voeu'

export interface QuizQuestion {
  q: string
  options: string[]
  /** Index de la bonne réponse */
  answer: number
  /** Petit mot affiché après la réponse */
  comment?: string
}

export interface AdventExtra {
  /** Bon : ce qu'il permet (« un massage ») */
  coupon?: string
  /** Souvenir : photo dans le stockage privé */
  photo?: string
  /** Son : fichier audio dans le stockage privé, et son titre */
  audio?: string
  track?: string
  /** Film : titre tel qu'il est dans le Ciné */
  film?: string
  /** Jeu : lequel, en version Noël */
  game?: 'deny' | 'jude'
  /** Rendez-vous : heure à laquelle je viens te chercher, tenue, indices dévoilés un par un */
  time?: string
  outfit?: string
  clues?: string[]
  /** Quiz */
  questions?: QuizQuestion[]
}

export interface AdventDay {
  date: ISODate
  kind: AdventKind
  title: string
  body: string
  extra: AdventExtra
}

export interface AdventState {
  date: ISODate
  opened_at: string | null
  /** Bon utilisé / défi relevé */
  used_at: string | null
  /** Vœu écrit, résultat du quiz… */
  answer: string | null
}

export const DAYS = 24

/** Année du calendrier en cours : celle de décembre qui vient (ou qui se termine, en janvier). */
export function adventYear(today: ISODate): number {
  const [y, m] = today.split('-').map(Number)
  return m === 1 ? y - 1 : y
}

export const adventDate = (year: number, day: number): ISODate => toISO(new Date(year, 11, day))

/** Numéro du jour (1 à 24) si on est pendant l'Avent, sinon null */
export function adventDayOf(today: ISODate): number | null {
  const [, m, d] = today.split('-').map(Number)
  return m === 12 && d <= DAYS ? d : null
}

/** La carte d'accueil se montre tout décembre (les jours d'après, pour relire) */
export const isDecember = (today: ISODate) => today.split('-')[1] === '12'

/** Une étoile s'ouvre à partir de son jour (on peut rattraper les jours manqués) */
export const isUnlocked = (date: ISODate, today: ISODate) => date <= today

// ---------- La constellation en sapin ----------

export interface TreeStar {
  day: number
  x: number
  y: number
}

/**
 * 24 positions dans un repère 300 × 440 : six étages de 1 à 6 étoiles (21) et un tronc de 3.
 * Les numéros sont mélangés, comme sur un vrai calendrier de l'Avent.
 */
export function treeLayout(): TreeStar[] {
  const pos: { x: number; y: number }[] = []
  for (let row = 0; row < 6; row++) {
    const count = row + 1
    const y = 92 + row * 50
    const half = 14 + row * 23
    for (let i = 0; i < count; i++) {
      const x = count === 1 ? 150 : 150 - half + (i * (half * 2)) / (count - 1)
      // Petit décalage naturel, toujours le même
      const jitter = ((row * 7 + i * 13) % 5) - 2
      pos.push({ x: x + jitter, y: y + (((row + i) % 3) - 1) * 4 })
    }
  }
  pos.push({ x: 138, y: 392 }, { x: 162, y: 392 }, { x: 150, y: 418 })
  // Ordre des numéros, mélangé une fois pour toutes
  const order = [12, 7, 19, 3, 22, 15, 9, 1, 17, 5, 24, 11, 20, 2, 14, 8, 23, 6, 18, 10, 4, 21, 16, 13]
  return pos.map((p, i) => ({ ...p, day: order[i] }))
}

/** Sommet du sapin : la grande étoile qui s'allume quand tout est ouvert (ou le 24) */
export const TREE_TOP = { x: 150, y: 40 }

/** Lignes de la constellation : le contour du sapin et le tronc */
export function treeLines(stars: TreeStar[]): [number, number, number, number][] {
  const rows: TreeStar[][] = []
  let k = 0
  for (let r = 0; r < 6; r++) {
    rows.push(stars.slice(k, k + r + 1))
    k += r + 1
  }
  const lines: [number, number, number, number][] = []
  const top = rows[0][0]
  lines.push([TREE_TOP.x, TREE_TOP.y, top.x, top.y])
  for (let r = 0; r < 5; r++) {
    const a = rows[r]
    const b = rows[r + 1]
    lines.push([a[0].x, a[0].y, b[0].x, b[0].y]) // bord gauche
    lines.push([a[a.length - 1].x, a[a.length - 1].y, b[b.length - 1].x, b[b.length - 1].y]) // bord droit
  }
  const base = rows[5]
  lines.push([base[0].x, base[0].y, base[base.length - 1].x, base[base.length - 1].y])
  const [t1, t2, t3] = stars.slice(21)
  lines.push([t1.x, base[0].y, t1.x, t1.y], [t2.x, base[0].y, t2.x, t2.y], [t1.x, t1.y, t3.x, t3.y], [t2.x, t2.y, t3.x, t3.y])
  return lines
}

// ---------- Badge « une étoile t'attend » (par appareil, pour la barre d'onglets) ----------

const OPENED_KEY = 'stella.advent.opened'

export function readOpened(): string[] {
  try {
    return JSON.parse(localStorage.getItem(OPENED_KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}

export function writeOpened(dates: string[]) {
  try {
    localStorage.setItem(OPENED_KEY, JSON.stringify([...new Set(dates)]))
  } catch {
    /* rien à retenir */
  }
  window.dispatchEvent(new Event('stella:advent'))
}

// ---------- Neige ----------

const SNOW_KEY = 'stella.snow'
export function snowEnabled(): boolean {
  try {
    return localStorage.getItem(SNOW_KEY) !== 'off'
  } catch {
    return true
  }
}
export function setSnow(on: boolean) {
  try {
    localStorage.setItem(SNOW_KEY, on ? 'on' : 'off')
  } catch {
    /* rien à retenir */
  }
  window.dispatchEvent(new Event('stella:snow'))
}
