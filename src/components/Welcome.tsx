import { motion, useReducedMotion } from 'motion/react'

// Drapeau posé par le login : le mot s'affiche après une vraie saisie du mot de passe,
// pas à chaque réouverture du site (la session reste mémorisée).
let pending = false
export const setWelcomeFlag = () => {
  pending = true
}
export const hasWelcomeFlag = () => pending
export const clearWelcomeFlag = () => {
  pending = false
}

interface Props {
  text: string
  onDone: () => void
}

/** Mot d'accueil : les paragraphes apparaissent un à un, comme une lettre qu'on déplie. */
export function Welcome({ text, onDone }: Props) {
  const reduced = useReducedMotion()
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
  const step = reduced ? 0 : 1.1
  const fade = (i: number) => ({
    initial: { opacity: 0, y: reduced ? 0 : 8, filter: reduced ? 'none' : 'blur(4px)' },
    animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
    transition: { delay: 0.4 + i * step, duration: reduced ? 0.01 : 1.1, ease: 'easeOut' as const },
  })

  return (
    <main className="safe-top mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-7 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <article className="font-display">
        {paragraphs.map((p, i) => {
          const first = i === 0
          const signature = i === paragraphs.length - 1 && p.startsWith('—')
          const Tag = first ? motion.h1 : motion.p // le premier paragraphe (« Sarah, ») sert de titre
          return (
            <Tag
              key={i}
              {...fade(i)}
              className={
                first
                  ? 'glow-text mb-6 text-[2.75rem] leading-none font-medium'
                  : signature
                    ? 'mt-8 text-right text-2xl text-glow italic'
                    : 'mb-5 text-[1.4rem] leading-[1.45] text-starlight/90'
              }
            >
              {p}
            </Tag>
          )
        })}
      </article>
      <motion.div {...fade(paragraphs.length)} className="mt-10">
        <button type="button" className="btn-primary w-full" onClick={onDone}>
          Découvrir
        </button>
      </motion.div>
    </main>
  )
}
