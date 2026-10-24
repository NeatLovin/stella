import type { ReactNode } from 'react'

/**
 * Gabarit de page. Sur téléphone : colonne étroite.
 * Sur ordinateur (≥ 1024 px) : `wide` élargit la page pour les mises en page en colonnes.
 */
export function Page({ title, intro, wide, children }: { title?: string; intro?: string; wide?: boolean; children: ReactNode }) {
  return (
    <main className={`safe-top safe-bottom mx-auto w-full max-w-xl px-5 ${wide ? 'lg:max-w-6xl lg:px-10 2xl:max-w-7xl' : ''}`}>
      {title && (
        <header className="mb-8 pt-4 lg:mb-12">
          <h1 className="font-display text-[clamp(2.4rem,10vw,3.25rem)] leading-none font-medium tracking-tight">{title}</h1>
          {intro && <p className="mt-3 max-w-[36ch] text-mist">{intro}</p>}
        </header>
      )}
      {children}
    </main>
  )
}

export function Loading() {
  return (
    <div className="flex justify-center py-16" role="status" aria-label="Chargement">
      <span className="h-2 w-2 animate-ping rounded-full bg-glow" />
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
