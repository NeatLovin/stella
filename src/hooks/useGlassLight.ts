import { useEffect } from 'react'

/**
 * Le verre accroche la lumière : la position du pointeur est posée sur la carte en verre survolée
 * (ou touchée), et son liseré s'illumine à cet endroit (voir .glass dans index.css).
 */
export function useGlassLight() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let raf = 0
    let pending: { el: HTMLElement; x: number; y: number } | null = null
    const apply = () => {
      raf = 0
      if (!pending) return
      const { el, x, y } = pending
      const r = el.getBoundingClientRect()
      el.style.setProperty('--gx', `${x - r.left}px`)
      el.style.setProperty('--gy', `${y - r.top}px`)
      pending = null
    }
    const onMove = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.('.glass') as HTMLElement | null
      if (!el) return
      pending = { el, x: e.clientX, y: e.clientY }
      if (!raf) raf = requestAnimationFrame(apply)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerdown', onMove, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onMove)
    }
  }, [])
}
