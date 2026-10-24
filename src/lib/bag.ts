/**
 * Tirage « sac » : on ne repioche pas une raison tant que toutes n'ont pas été tirées.
 * L'ordre reste aléatoire. Quand le sac est vide, il se remplit à nouveau, et les dernières
 * raisons du tour précédent ne peuvent pas sortir dans les premiers tirages du nouveau tour.
 * Les raisons ajoutées entrent directement dans le sac ; les raisons supprimées sont ignorées.
 */
export interface BagState {
  /** Raisons déjà tirées dans le tour en cours */
  seen: string[]
  /** Fin du tour précédent, interdite au tout début du tour suivant */
  cooldown: string[]
}

export const emptyBag = (): BagState => ({ seen: [], cooldown: [] })

/** Combien de raisons de la fin d'un tour sont tenues à l'écart au début du suivant. */
// 1 pour un petit bocal, jusqu'à 3 dès 9 raisons : assez pour éviter les répétitions, sans figer l'ordre
export const cooldownSize = (n: number) => Math.max(n > 1 ? 1 : 0, Math.min(3, Math.floor(n / 3)))

function clean(ids: string[], state: BagState): BagState {
  const known = new Set(ids)
  return {
    seen: [...new Set(state.seen.filter((id) => known.has(id)))],
    cooldown: state.cooldown.filter((id) => known.has(id)),
  }
}

export function drawFromBag(ids: string[], state: BagState, random = Math.random): { id: string; state: BagState } {
  if (!ids.length) throw new Error('Sac vide')
  let { seen, cooldown } = clean(ids, state)
  let candidates = ids.filter((id) => !seen.includes(id))

  if (!candidates.length) {
    // Tout a été tiré : nouveau tour. La fin du tour précédent attend un peu.
    cooldown = seen.slice(-cooldownSize(ids.length))
    seen = []
    candidates = ids
  }

  // Au début d'un tour, on écarte la fin du tour précédent
  const inCooldown = seen.length < cooldown.length
  const preferred = inCooldown ? candidates.filter((id) => !cooldown.includes(id)) : candidates
  const pool = preferred.length ? preferred : candidates

  const id = pool[Math.floor(random() * pool.length)]
  return { id, state: { seen: [...seen, id], cooldown } }
}

/**
 * Marque une raison comme vue à l'instant (ex. la raison du jour affichée), sans tirage.
 * Elle passe en fin de liste : si le tour s'achève, elle fait partie de la fin de tour tenue à l'écart.
 */
export function markSeen(ids: string[], state: BagState, id: string): BagState {
  const s = clean(ids, state)
  return { ...s, seen: [...s.seen.filter((x) => x !== id), id] }
}

/** Normalise un texte pour repérer les doublons (casse, espaces, apostrophes, guillemets). */
export function textKey(text: string): string {
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/[«»“”"]/g, '"')
    .replace(/\s+/g, ' ')
    .replace(/\s*([.!?…])\s*$/u, '$1')
    .trim()
}

/** Garde une seule raison par texte (la plus ancienne). */
export function uniqueByText<T extends { text: string }>(items: T[]): T[] {
  const seen = new Set<string>()
  return items.filter((r) => {
    const k = textKey(r.text)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}
