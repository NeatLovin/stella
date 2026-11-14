import type { Transition, Variants } from 'motion/react'

// Réglages d'animation partagés, pour que tout le site bouge de la même façon.

/** Courbe douce qui freine en arrivant */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const
/** Ressort vif (boutons, pastilles, onglets) */
export const SPRING: Transition = { type: 'spring', damping: 22, stiffness: 320, mass: 0.8 }
/** Ressort souple (panneaux, cartes) */
export const SPRING_SOFT: Transition = { type: 'spring', damping: 26, stiffness: 180 }
/** Petit rebond (cœurs, coches) */
export const SPRING_POP: Transition = { type: 'spring', damping: 9, stiffness: 340 }

/** Conteneur qui fait apparaître ses enfants l'un après l'autre */
export const stagger = (step = 0.07, delay = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: step, delayChildren: delay } },
})

/** Apparition : fondu et légère montée (sans flou : un flou animé coûte cher sur téléphone) */
export const rise: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT } },
}

/** Même apparition, décalée dans le temps */
export const riseLater = (delay: number): Variants => ({
  hidden: rise.hidden,
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT, delay } },
})
