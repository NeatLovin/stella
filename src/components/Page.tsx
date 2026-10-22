import type { ReactNode } from 'react'

export function Page({ title, intro, children }: { title?: string; intro?: string; children: ReactNode }) {
  return (
    <main className="safe-top safe-bottom mx-auto w-full max-w-xl px-5">
      {title && (
        <header className="mb-8 pt-4">
          <h1 className="font-display text-[2.6rem] leading-none font-medium tracking-tight">{title}</h1>
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
