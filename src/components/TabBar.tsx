import { motion } from 'motion/react'
import { NavLink } from 'react-router-dom'
import { IconConstellation, IconGift, IconJar, IconMoon, IconStar } from './icons'

const tabs = [
  { to: '/', label: 'Nous', Icon: IconStar },
  { to: '/timeline', label: 'Timeline', Icon: IconConstellation },
  { to: '/bocal', label: 'Bocal', Icon: IconJar },
  { to: '/wishlist', label: 'Wishlist', Icon: IconGift },
  { to: '/cycle', label: 'Cycle', Icon: IconMoon },
]

/** Barre d'onglets flottante en verre, en bas de l'écran sur téléphone comme sur ordinateur. */
export function TabBar() {
  return (
    <nav aria-label="Navigation" className="tabbar-dock pointer-events-none fixed inset-x-0 z-40 flex justify-center px-3">
      <ul className="glass pointer-events-auto flex h-[var(--tabbar-h)] w-full max-w-[26rem] items-stretch rounded-full p-1.5">
        {tabs.map(({ to, label, Icon }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `relative flex h-full flex-col items-center justify-center gap-0.5 rounded-full text-[0.68rem] tracking-wide transition-colors duration-300 ${
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
                  <Icon
                    width={22}
                    height={22}
                    className={`relative ${isActive ? 'text-glow drop-shadow-[0_0_8px_rgb(125_162_255/0.9)]' : ''}`}
                  />
                  <span className="relative">{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
