import type { CycleState, Period } from './cycle'
import { diffDays, type ISODate } from './dates'

// Symptômes notés jour par jour, et ce qui revient d'un cycle à l'autre.

export type Flow = 'leger' | 'moyen' | 'abondant'

export interface SymptomEntry {
  day: ISODate
  items: string[]
  flow: Flow | null
  note: string | null
}

interface SymptomDef {
  id: string
  label: string
  emoji?: string
  /** Sujet de phrase pour l'info du jour (« Les crampes ») ; absent pour les ressentis positifs */
  subject?: string
  plural?: boolean
  /** Petit conseil qui suit (« bouillotte prête ? ») */
  care?: string
}

export const SYMPTOM_GROUPS: { title: string; items: SymptomDef[] }[] = [
  {
    title: 'Humeur',
    items: [
      { id: 'bien', label: 'Bien', emoji: '😊' },
      { id: 'calme', label: 'Calme', emoji: '😌' },
      { id: 'fatiguee', label: 'Fatiguée', emoji: '🥱', subject: 'La fatigue', care: 'garde-toi une soirée tranquille.' },
      { id: 'triste', label: 'Triste', emoji: '😢', subject: 'Les petits coups de blues', plural: true, care: 'sois douce avec toi-même.' },
      { id: 'irritable', label: 'Irritable', emoji: '😤', subject: 'L’irritabilité', care: 'ce sont les hormones, pas toi.' },
      { id: 'anxieuse', label: 'Anxieuse', emoji: '😰', subject: 'L’anxiété', care: 'respire, ça passe.' },
    ],
  },
  {
    title: 'Corps',
    items: [
      { id: 'crampes', label: 'Crampes', subject: 'Les crampes', plural: true, care: 'bouillotte prête ?' },
      { id: 'tete', label: 'Maux de tête', subject: 'Les maux de tête', plural: true, care: 'pense à bien boire.' },
      { id: 'ballonnements', label: 'Ballonnements', subject: 'Les ballonnements', plural: true, care: 'plutôt léger et moins salé.' },
      { id: 'seins', label: 'Seins sensibles', subject: 'La sensibilité des seins', care: 'vive les vêtements confortables.' },
      { id: 'dos', label: 'Mal de dos', subject: 'Le mal de dos', care: 'un peu de chaleur et d’étirements.' },
      { id: 'boutons', label: 'Boutons', subject: 'Les boutons', plural: true, care: 'douceur pour la peau.' },
      { id: 'nausees', label: 'Nausées', subject: 'Les nausées', plural: true, care: 'petits repas légers.' },
    ],
  },
  {
    title: 'Envies',
    items: [
      { id: 'sucre', label: 'Sucré', subject: 'Les envies de sucré', plural: true, care: 'chocolat noir à portée de main ?' },
      { id: 'sale', label: 'Salé', subject: 'Les envies de salé', plural: true, care: 'un grand verre d’eau à côté.' },
      { id: 'faim', label: 'Faim de loup', subject: 'La faim de loup', care: 'prévois de bons en-cas.' },
    ],
  },
  {
    title: 'Sommeil',
    items: [
      { id: 'bien-dormi', label: 'Bien dormi' },
      { id: 'mal-dormi', label: 'Mal dormi', subject: 'Les nuits agitées', plural: true, care: 'au lit un peu plus tôt ce soir.' },
    ],
  },
]

export const FLOWS: { id: Flow; label: string }[] = [
  { id: 'leger', label: 'Léger' },
  { id: 'moyen', label: 'Moyen' },
  { id: 'abondant', label: 'Abondant' },
]

export const SYMPTOMS: Record<string, SymptomDef> = Object.fromEntries(SYMPTOM_GROUPS.flatMap((g) => g.items.map((s) => [s.id, s])))

export const isEmptyEntry = (e: Pick<SymptomEntry, 'items' | 'flow' | 'note'>) => !e.items.length && !e.flow && !e.note?.trim()

export interface Pattern {
  id: string
  /** 'start' : compté depuis le 1er jour des règles ; 'before' : en jours avant les règles suivantes */
  anchor: 'start' | 'before'
  from: number
  to: number
  /** Nombre de fois vu dans la fenêtre, et sur combien de cycles */
  count: number
  cycles: number
}

const WINDOW = 3
const MIN_COUNT = 3
const MIN_CYCLES = 2
const RANGE = 10

/**
 * Ce qui revient : pour chaque symptôme, la fenêtre de 3 jours au plus (depuis le début des règles,
 * ou avant les suivantes) qui regroupe le plus de jours notés. Gardée si vue au moins 3 fois,
 * sur au moins 2 cycles, et si elle regroupe au moins la moitié des fois où le symptôme a été noté.
 */
export function recurringPatterns(entries: SymptomEntry[], periods: Period[], today: ISODate): Pattern[] {
  const starts = periods
    .map((p) => p.start_date)
    .filter((d) => d <= today)
    .sort()
  if (starts.length < 2) return []

  type Hit = { cycle: number; fromStart: number; before: number | null }
  const hits = new Map<string, Hit[]>()
  for (const e of entries) {
    if (e.day > today) continue
    let c = -1
    while (c + 1 < starts.length && starts[c + 1] <= e.day) c++
    if (c < 0) continue
    const fromStart = diffDays(e.day, starts[c]) + 1
    const before = c + 1 < starts.length ? diffDays(starts[c + 1], e.day) : null
    for (const id of e.items) {
      if (!SYMPTOMS[id]) continue
      hits.set(id, [...(hits.get(id) ?? []), { cycle: c, fromStart, before }])
    }
  }

  const patterns: Pattern[] = []
  for (const [id, list] of hits) {
    let best: Pattern | null = null
    for (const anchor of ['start', 'before'] as const) {
      const values = list.map((h) => ({ cycle: h.cycle, v: anchor === 'start' ? h.fromStart : h.before }))
      for (let from = 1; from <= RANGE; from++) {
        const to = from + WINDOW - 1
        const inside = values.filter((x) => x.v !== null && x.v >= from && x.v <= to)
        if (inside.length < MIN_COUNT) continue
        const cycles = new Set(inside.map((x) => x.cycle)).size
        if (cycles < MIN_CYCLES || inside.length * 2 < list.length) continue
        // Fenêtre resserrée sur les jours vraiment notés
        const vs = inside.map((x) => x.v!)
        const cand: Pattern = { id, anchor, from: Math.min(...vs), to: Math.max(...vs), count: inside.length, cycles }
        if (!best || cand.count > best.count || (cand.count === best.count && cand.to - cand.from < best.to - best.from)) best = cand
      }
    }
    if (best) patterns.push(best)
  }
  return patterns.sort((a, b) => b.count - a.count || a.id.localeCompare(b.id))
}

/** « souvent les jours 1 et 2 », « souvent 2 à 4 jours avant les règles »… */
export function describePattern(p: Pattern): string {
  if (p.anchor === 'start') {
    if (p.from === p.to) return `souvent le jour ${p.from}`
    if (p.to === p.from + 1) return `souvent les jours ${p.from} et ${p.to}`
    return `souvent du jour ${p.from} au jour ${p.to}`
  }
  if (p.from === p.to) return p.from === 1 ? 'souvent la veille des règles' : `souvent ${p.from} jours avant les règles`
  return `souvent ${p.from} à ${p.to} jours avant les règles`
}

/**
 * Info du jour personnalisée : un symptôme qui revient d'habitude aujourd'hui ou dès demain.
 * Rien pendant un retard (le compte « avant les règles » n'a plus de sens).
 */
export function personalTip(patterns: Pattern[], state: Extract<CycleState, { status: 'ok' }>): string | null {
  if (state.phase === 'retard') return null
  const posFor = (p: Pattern, shift: number) => (p.anchor === 'start' ? state.cycleDay + shift : state.daysUntilNext - shift)
  const inWindow = (p: Pattern, shift: number) => {
    const v = posFor(p, shift)
    return v >= p.from && v <= p.to
  }

  const relevant = patterns.filter((p) => SYMPTOMS[p.id].subject && SYMPTOMS[p.id].care)
  const now = relevant.find((p) => inWindow(p, 0))
  if (now) {
    const s = SYMPTOMS[now.id]
    return `${s.subject}, c’est souvent en ce moment chez toi : ${s.care}`
  }
  const soon = relevant.find((p) => inWindow(p, 1))
  if (soon) {
    const s = SYMPTOMS[soon.id]
    return `${s.subject} ${s.plural ? 'reviennent' : 'revient'} souvent dès demain chez toi : ${s.care}`
  }
  return null
}
