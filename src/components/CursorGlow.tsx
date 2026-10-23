import { useEffect, useRef } from 'react'

/**
 * Halo lumineux qui suit la souris sur toute la largeur de l'écran (PC uniquement).
 * Placé derrière le contenu, au-dessus du ciel. Sur téléphone, rien ne s'affiche.
 */
export function CursorGlow() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    let raf = 0
    let x = 0
    let y = 0

    const paint = () => {
      raf = 0
      el.style.setProperty('--cx', `${x}px`)
      el.style.setProperty('--cy', `${y}px`)
    }
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      x = e.clientX
      y = e.clientY
      el.dataset.on = 'true'
      if (!raf) raf = requestAnimationFrame(paint)
    }
    const onLeave = () => {
      el.dataset.on = 'false'
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    document.documentElement.addEventListener('mouseleave', onLeave)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('mouseleave', onLeave)
    }
  }, [])

  return <div ref={ref} className="cursor-glow pointer-events-none fixed inset-0 -z-[8]" data-on="false" aria-hidden />
}
