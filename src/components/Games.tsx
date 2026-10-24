import { useState, type ReactNode } from 'react'
import { BottomSheet } from './BottomSheet'
import { DenyLogo } from './DenyLogo'
import { DenyRun, readBest } from './DenyRun'
import { JudeShoot, JudeThumb, readJude } from './JudeShoot'
import { STAGES } from '../lib/jude'

const MEDAL =
  'relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-glow/30 bg-[radial-gradient(circle_at_50%_40%,#18225a,#0e1640_70%)] shadow-[0_0_28px_rgba(46,91,255,.25)]'

function judeStatus() {
  const n = readJude().holes.length
  if (n >= STAGES.destroyed) return 'Détruit'
  if (n === 0) return 'Intact… pour l’instant'
  return `${n} ${n > 1 ? 'impacts' : 'impact'}`
}

/** Bouton « Jeux » de la page « Nous » et le menu des mini-jeux. */
export function Games() {
  const [menu, setMenu] = useState(false)
  const [game, setGame] = useState<'deny' | 'jude' | null>(null)
  const [version, setVersion] = useState(0) // redessine les vignettes après une partie

  const play = (g: 'deny' | 'jude') => {
    setMenu(false)
    setGame(g)
  }
  const close = () => {
    setGame(null)
    setVersion((v) => v + 1)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setMenu(true)}
        className="group mt-8 flex items-center gap-4 self-start rounded-full py-1 pr-5 pl-1 text-left transition-colors hover:bg-white/5"
      >
        <span className="flex -space-x-5 transition-transform group-hover:-translate-y-0.5">
          <span className={`${MEDAL} z-10 h-16 w-16`}>
            <DenyLogo className="h-12" />
          </span>
          <span className={`${MEDAL} h-16 w-16`}>
            <JudeThumb key={version} className="h-12 w-12" />
          </span>
        </span>
        <span>
          <span className="block font-display text-xl leading-tight">Jeux</span>
          <span className="block text-sm text-mist">Deny · Jude</span>
        </span>
      </button>

      <BottomSheet open={menu} onClose={() => setMenu(false)} label="Jeux">
        <h2 className="font-display text-3xl font-medium">Jeux</h2>
        <div className="mt-5 flex flex-col gap-3">
          <GameRow
            title="Deny"
            subtitle={readBest() > 0 ? `Record : ${readBest()}` : 'Saute par-dessus les cactus'}
            onClick={() => play('deny')}
          >
            <DenyLogo className="h-11" />
          </GameRow>
          <GameRow title="Jude" subtitle={judeStatus()} onClick={() => play('jude')}>
            <JudeThumb className="h-11 w-11" />
          </GameRow>
        </div>
      </BottomSheet>

      <DenyRun open={game === 'deny'} onClose={close} />
      <JudeShoot open={game === 'jude'} onClose={close} />
    </>
  )
}

function GameRow({ title, subtitle, onClick, children }: { title: string; subtitle: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-3 text-left transition-colors hover:bg-white/10"
    >
      <span className={`${MEDAL} h-14 w-14`}>{children}</span>
      <span>
        <span className="block font-display text-xl leading-tight">{title}</span>
        <span className="block text-sm text-mist tabular-nums">{subtitle}</span>
      </span>
    </button>
  )
}
