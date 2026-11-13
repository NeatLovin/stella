import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { rise, stagger } from '../lib/motion'

/**
 * Gabarit de page. Sur téléphone : colonne étroite.
 * Sur ordinateur (≥ 1024 px) : `wide` élargit la page pour les mises en page en colonnes.
 */
export function Page({
  title,
  eyebrow,
  intro,
  wide,
  children,
}: {
  title?: string
  /** Petit surtitre en capitales espacées au-dessus du titre */
  eyebrow?: string
  intro?: string
  wide?: boolean
  children: ReactNode
}) {
  // Titre éditorial : le premier mot droit, la suite en italique lumineuse (« Notre *constellation* »)
  const [head, ...rest] = (title ?? '').split(' ')
  const accent = rest.join(' ')
  return (
    <main className={`safe-top safe-bottom mx-auto w-full max-w-xl px-5 ${wide ? 'lg:max-w-6xl lg:px-10 2xl:max-w-7xl' : ''}`}>
      {title && (
        <motion.header className="mb-9 pt-4 lg:mb-14" variants={stagger(0.08, 0.05)} initial="hidden" animate="show">
          {eyebrow && (
            <motion.p
              variants={rise}
              className="mb-3 flex items-center gap-2.5 text-[0.68rem] font-medium tracking-[0.42em] text-gold/90 uppercase"
            >
              <span aria-hidden className="text-[0.8rem] tracking-normal">
                ✦
              </span>
              {eyebrow}
            </motion.p>
          )}
          <motion.h1
            variants={rise}
            className="font-display text-[clamp(3rem,13.5vw,4.4rem)] leading-[0.92] font-medium tracking-[-0.02em] lg:text-[clamp(4.6rem,6.4vw,6.6rem)]"
          >
            {head}
            {accent && (
              <>
                {' '}
                <span className="title-accent italic">{accent}</span>
              </>
            )}
          </motion.h1>
          {intro && (
            <motion.p variants={rise} className="mt-4 max-w-[38ch] text-mist lg:mt-5 lg:text-lg">
              {intro}
            </motion.p>
          )}
        </motion.header>
      )}
      {children}
    </main>
  )
}

/** Petite étoile qui tourne et respire, comme sur l'écran de chargement. */
export function Loading() {
  return (
    <div className="flex justify-center py-16" role="status" aria-label="Chargement">
      <motion.svg
        viewBox="0 0 64 64"
        className="h-7 w-7 text-glow drop-shadow-[0_0_10px_rgb(125_162_255/0.8)]"
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: [0.55, 1, 0.55], scale: [0.85, 1.05, 0.85], rotate: [0, 90] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        aria-hidden
      >
        <path d="M32 8 C34 24 40 30 56 32 C40 34 34 40 32 56 C30 40 24 34 8 32 C24 30 30 24 32 8 Z" fill="currentColor" />
      </motion.svg>
    </div>
  )
}

/** Silhouettes scintillantes pendant le chargement, à la forme du contenu attendu. */
export function Skeleton({ variant }: { variant: 'timeline' | 'cards' | 'jar' | 'cycle' }) {
  return (
    <div role="status" aria-label="Chargement" className="animate-[fade-in_0.4s_ease-out]">
      {variant === 'timeline' && (
        <div className="relative h-[34rem]">
          {[0.22, 0.68, 0.4, 0.78].map((x, i) => (
            <div key={i} className="absolute flex items-center gap-3" style={{ left: `calc(${x * 100}% - 6px)`, top: 30 + i * 132 }}>
              <span className="shimmer h-3 w-3 rounded-full" />
              {x < 0.5 && (
                <span className="space-y-2">
                  <span className="shimmer block h-4 w-32 rounded-full" />
                  <span className="shimmer block h-3 w-14 rounded-full" />
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      {variant === 'cards' && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-6 xl:grid-cols-5">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i}>
              <span className="shimmer block aspect-[4/5] rounded-[1.1rem]" />
              <span className="shimmer mt-3 block h-4 w-3/4 rounded-full" />
            </div>
          ))}
        </div>
      )}
      {variant === 'jar' && (
        <div className="flex flex-col items-center">
          <span className="shimmer block h-48 w-full rounded-[1.25rem]" />
          <span className="shimmer mt-10 block h-44 w-32 rounded-[2.5rem]" />
        </div>
      )}
      {variant === 'cycle' && (
        <div className="flex flex-col items-center">
          <span className="shimmer-ring block aspect-square w-full max-w-[18rem] rounded-full" />
          <span className="shimmer mt-8 block h-12 w-60 rounded-full" />
        </div>
      )}
    </div>
  )
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-2xl border border-rose/30 bg-rose/10 p-4 text-sm">
      <p>Impossible de charger les données : {message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-2 underline underline-offset-4">
          Réessayer
        </button>
      )}
    </div>
  )
}
