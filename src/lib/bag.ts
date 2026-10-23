/**
 * Tirage « sac » : on ne repioche pas une raison tant que toutes n'ont pas été tirées.
 * L'ordre reste aléatoire. Quand le sac est vide, il se remplit à nouveau,
 * sans jamais redonner tout de suite la dernière raison tirée.
 * Les raisons ajoutées entrent directement dans le sac ; les raisons supprimées sont ignorées.
 */
export function drawFromBag(ids: string[], seen: string[], last: string | null, random = Math.random): { id: string; seen: string[] } {
  if (!ids.length) throw new Error('Sac vide')
  const known = new Set(ids)
  let drawn = seen.filter((id) => known.has(id))
  let pool = ids.filter((id) => !drawn.includes(id))

  if (!pool.length) {
    // Tout a été tiré : nouveau tour, en évitant de répéter la dernière
    drawn = []
    pool = ids.length > 1 && last ? ids.filter((id) => id !== last) : ids
  }

  const id = pool[Math.floor(random() * pool.length)]
  return { id, seen: [...drawn, id] }
}

/** Marque une raison comme déjà vue (ex. la raison du jour), sans tirage. */
export function markSeen(ids: string[], seen: string[], id: string): string[] {
  const known = new Set(ids)
  const drawn = seen.filter((s) => known.has(s))
  return drawn.includes(id) ? drawn : [...drawn, id]
}
