import type { CycleState } from './cycle'
import { diffDays, type ISODate } from './dates'

// Petite info du jour sur la page Cycle : un repère général selon le moment du cycle.
// Plusieurs phrases par moment, qui tournent d'un jour à l'autre.

type Moment =
  | 'regles-j1'
  | 'regles-j2'
  | 'regles'
  | 'regles-fin'
  | 'apres-regles'
  | 'folliculaire'
  | 'fertile'
  | 'ovulation-veille'
  | 'ovulation'
  | 'ovulation-lendemain'
  | 'luteale-debut'
  | 'luteale'
  | 'premenstruel'
  | 'regles-prevues'
  | 'retard-court'
  | 'retard'
  | 'retard-long'

export const TIPS: Record<Moment, string[]> = {
  'regles-j1': [
    'Jour 1 : la muqueuse de l’utérus se détache, un nouveau cycle commence. Les hormones sont au plus bas, d’où la fatigue possible.',
    'Les crampes viennent des prostaglandines, qui font se contracter l’utérus. La chaleur d’une bouillotte aide à le détendre.',
  ],
  'regles-j2': [
    'Le flux est souvent le plus abondant le 1er et le 2e jour. Boire beaucoup d’eau et se reposer si le corps le demande.',
    'Les règles font perdre un peu de fer : lentilles, épinards, viande rouge ou chocolat noir aident à refaire le plein.',
  ],
  regles: [
    'Le flux diminue en général à partir du 3e jour, et les œstrogènes recommencent doucement à monter.',
    'Une marche ou quelques étirements peuvent soulager les douleurs restantes : bouger améliore la circulation dans le bas-ventre.',
    'Le fer s’absorbe mieux avec un peu de vitamine C : des lentilles avec un jus d’orange, par exemple.',
  ],
  'regles-fin': ['Sans doute le dernier jour des règles. Dans les ovaires, de nouveaux follicules ont déjà commencé à grandir.'],
  'apres-regles': [
    'Les œstrogènes remontent : l’énergie, l’humeur et la motivation reviennent souvent dans les jours qui suivent les règles.',
    'Dans les ovaires, plusieurs follicules grandissent. Un seul deviendra dominant et libérera l’ovule.',
  ],
  folliculaire: [
    'Phase folliculaire : c’est souvent le moment où l’on se sent le plus en forme, idéal pour le sport ou les projets qui demandent de l’énergie.',
    'Les œstrogènes rendent souvent la peau plus nette et l’humeur plus légère pendant cette phase.',
    'Beaucoup se sentent plus sociables et créatives en ce moment : les œstrogènes agissent aussi sur le cerveau.',
  ],
  fertile: [
    'Fenêtre fertile : les spermatozoïdes peuvent survivre jusqu’à 5 jours, ces jours-ci comptent donc déjà.',
    'Signe discret que l’ovulation approche : les sécrétions deviennent plus fluides et transparentes, comme du blanc d’œuf.',
    'Les œstrogènes atteignent leur pic juste avant l’ovulation : l’énergie et le désir sont souvent au plus haut.',
  ],
  'ovulation-veille': ['Un pic d’hormone LH déclenche l’ovulation dans les 24 à 36 heures qui suivent.'],
  ovulation: [
    'Jour de l’ovulation : l’ovule est libéré et ne vit que 12 à 24 heures.',
    'Certaines ressentent une petite douleur d’un côté du bas-ventre au moment de l’ovulation : c’est l’ovaire qui libère l’ovule.',
  ],
  'ovulation-lendemain': ['Après l’ovulation, la température du corps monte de 0,2 à 0,5 °C et reste plus haute jusqu’aux règles.'],
  'luteale-debut': [
    'Phase lutéale : ce qui reste du follicule, le corps jaune, produit de la progestérone. Elle peut rendre plus calme, et un peu plus fatiguée.',
    'La progestérone fait légèrement monter la température et l’appétit : le corps dépense un peu plus d’énergie en ce moment.',
    'Seins plus sensibles ces jours-ci ? C’est fréquent en phase lutéale, à cause de la progestérone.',
  ],
  luteale: [
    'Le sommeil peut devenir plus léger en seconde moitié de cycle, la température du corps étant plus haute : une chambre fraîche aide.',
    'Envie de sucré ? En phase lutéale, le corps réclame souvent plus de glucides. Le chocolat noir apporte en plus du magnésium.',
    'Bon moment pour des activités plus douces : yoga, marche, natation.',
  ],
  premenstruel: [
    'Les hormones baissent avant les règles : irritabilité, ballonnements ou émotions plus fortes sont fréquents, c’est le syndrome prémenstruel.',
    'Le magnésium (chocolat noir, banane, amandes) et un bon sommeil peuvent atténuer les symptômes prémenstruels.',
    'Moins de sel et plus d’eau aident à limiter la sensation de ballonnement avant les règles.',
    'Plus à fleur de peau ces jours-ci ? C’est normal : la chute de la progestérone touche aussi l’humeur.',
  ],
  'regles-prevues': ['Règles prévues aujourd’hui : bon moment pour avoir ce qu’il faut dans son sac.'],
  'retard-court': [
    'Un décalage de quelques jours est courant : stress, fatigue, voyage ou maladie peuvent retarder l’ovulation, et donc les règles.',
    'Si les règles ont déjà commencé, pense à les noter pour garder des prévisions justes.',
  ],
  retard: [
    'La date des règles dépend de celle de l’ovulation : si elle arrive plus tard, les règles aussi. Une semaine de décalage reste fréquente.',
  ],
  'retard-long': [
    'Après une semaine de retard, un test de grossesse permet de lever le doute. Si le retard dure, un avis médical peut rassurer.',
  ],
}

export function cycleMoment(state: Extract<CycleState, { status: 'ok' }>, today: ISODate): Moment {
  const { phase, cycleDay, lastEnd, ovulation, daysUntilNext, delay } = state
  switch (phase) {
    case 'menstruelle':
      if (cycleDay === 1) return 'regles-j1'
      if (cycleDay === 2) return 'regles-j2'
      return today === lastEnd ? 'regles-fin' : 'regles'
    case 'folliculaire': {
      const toOvulation = diffDays(ovulation, today)
      if (toOvulation <= 5) return 'fertile'
      return diffDays(today, lastEnd) <= 3 ? 'apres-regles' : 'folliculaire'
    }
    case 'ovulation': {
      const d = diffDays(today, ovulation)
      return d < 0 ? 'ovulation-veille' : d > 0 ? 'ovulation-lendemain' : 'ovulation'
    }
    case 'luteale':
      if (daysUntilNext === 0) return 'regles-prevues'
      if (daysUntilNext <= 5) return 'premenstruel'
      return diffDays(today, ovulation) <= 5 ? 'luteale-debut' : 'luteale'
    case 'retard':
      return delay <= 3 ? 'retard-court' : delay <= 7 ? 'retard' : 'retard-long'
  }
}

/** L'info du jour : change chaque jour à l'intérieur d'un même moment du cycle. */
export function dailyTip(state: Extract<CycleState, { status: 'ok' }>, today: ISODate): string {
  const list = TIPS[cycleMoment(state, today)]
  return list[state.cycleDay % list.length]
}
