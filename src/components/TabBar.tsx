import { motion } from 'motion/react'
import type { MouseEvent } from 'react'
import { SPRING, SPRING_POP } from '../lib/motion'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAdventBadge } from './Advent'
import { IconConstellation, IconFilm, IconGift, IconJar, IconMoon, IconStar } from './icons'

const tabs = [
  { to: '/', label: 'Nous', Icon: IconStar },
  { to: '/timeline', label: 'Timeline', Icon: IconConstellation },
  { to: '/bocal', label: 'Bocal', Icon: IconJar },
  { to: '/wishlist', label: 'Wishlist', Icon: IconGift },
  { to: '/cine', label: 'Ciné', Icon: IconFilm },
  { to: '/cycle', label: 'Cycle', Icon: IconMoon },
]

/** Barre d'onglets flottante en verre, en bas de l'écran sur téléphone comme sur ordinateur. */
export function TabBar() {
  const location = useLocation()
  const navigate = useNavigate()
  const adventBadge = useAdventBadge()
  const reselect = (to: string) => (e: MouseEvent) => {
    const here = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)
    if (!here) return
    e.preventDefault()
    window.dispatchEvent(new CustomEvent('stella:tab-reselect', { detail: to }))
    if (location.search) navigate(to, { replace: true })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  return (
    <nav aria-label="Navigation" className="tabbar-dock pointer-events-none fixed inset-x-0 z-40 flex justify-center px-3">
      <ul className="glass pointer-events-auto flex h-[var(--tabbar-h)] w-full max-w-[29rem] items-stretch rounded-full p-1.5">
        {tabs.map(({ to, label, Icon }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={to === '/'}
              onClick={reselect(to)}
              className={({ isActive }) =>
                `press relative flex h-full flex-col items-center justify-center gap-0.5 rounded-full text-[0.68rem] tracking-wide transition-colors duration-300 ${
                  isActive ? 'text-starlight' : 'text-mist/75 hover:text-starlight'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="tab-bubble"
                      className="tab-bubble absolute inset-0 rounded-full"
                      transition={{ type: 'spring', damping: 26, stiffness: 320 }}
                      aria-hidden
                    />
                  )}
                  <motion.span
                    className="relative"
                    animate={isActive ? { y: -1, scale: 1.12, rotate: [0, -10, 0] } : { y: 0, scale: 1, rotate: 0 }}
                    transition={isActive ? { ...SPRING_POP, rotate: { duration: 0.45 } } : SPRING}
                  >
                    <Icon width={22} height={22} className={isActive ? 'text-glow drop-shadow-[0_0_8px_rgb(125_162_255/0.9)]' : ''} />
                  </motion.span>
                  <span className="relative">{label}</span>
                  {to === '/' && adventBadge && (
                    <span
                      aria-label="Une étoile du calendrier t’attend"
                      className="absolute top-2 right-[calc(50%-1.1rem)] h-2 w-2 rounded-full bg-gold shadow-[0_0_8px_#ffd98a]"
                    />
                  )}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
