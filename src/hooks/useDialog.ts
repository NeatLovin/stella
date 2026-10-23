import { useEffect, useRef, type RefObject } from 'react'

// Pile des fenêtres ouvertes : seule celle du dessus réagit à Échap et garde le focus.
const stack: symbol[] = []

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Comportement accessible d'une fenêtre (fiche, plein écran, pop-up) :
 * focus déplacé dedans à l'ouverture, Tab qui boucle à l'intérieur, Échap qui ferme
 * uniquement la fenêtre du dessus, focus rendu à l'élément d'origine à la fermeture.
 */
export function useDialog(open: boolean, ref: RefObject<HTMLElement | null>, onClose: () => void) {
  const close = useRef(onClose)
  close.current = onClose

  useEffect(() => {
    if (!open) return
    const id = Symbol('dialog')
    stack.push(id)
    const opener = document.activeElement as HTMLElement | null
    const isTop = () => stack[stack.length - 1] === id

    // Attend le rendu du contenu animé avant de déplacer le focus
    const raf = requestAnimationFrame(() => {
      const el = ref.current
      if (!el) return
      const target = el.querySelector<HTMLElement>('[data-autofocus]') ?? el
      target.focus({ preventScroll: true })
    })

    const onKey = (e: KeyboardEvent) => {
      if (!isTop()) return
      if (e.key === 'Escape') {
        e.preventDefault()
        close.current()
        return
      }
      if (e.key !== 'Tab' || !ref.current) return
      const items = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (n) => n.offsetParent !== null || n === document.activeElement,
      )
      if (!items.length) {
        e.preventDefault()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || active === ref.current)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', onKey)
      stack.splice(stack.indexOf(id), 1)
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true })
    }
  }, [open, ref])
}
