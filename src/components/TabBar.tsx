import { NavLink } from 'react-router-dom'
import { IconConstellation, IconGift, IconJar, IconMoon, IconStar } from './icons'

const tabs = [
  { to: '/', label: 'Nous', Icon: IconStar },
  { to: '/timeline', label: 'Timeline', Icon: IconConstellation },
  { to: '/bocal', label: 'Bocal', Icon: IconJar },
  { to: '/wishlist', label: 'Wishlist', Icon: IconGift },
  { to: '/cycle', label: 'Cycle', Icon: IconMoon },
]

export function TabBar() {
  return (
    <nav
      aria-label="Navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-glow/15 bg-night/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:top-0 md:bottom-auto md:border-t-0 md:border-b md:pb-0"
    >
      <ul className="mx-auto flex h-[var(--tabbar-h)] max-w-xl items-stretch justify-around px-2">
        {tabs.map(({ to, label, Icon }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex h-full flex-col items-center justify-center gap-1 text-[0.72rem] tracking-wide transition-colors ${
                  isActive ? 'text-glow' : 'text-mist/70 hover:text-starlight'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={isActive ? 'drop-shadow-[0_0_8px_rgb(125_162_255/0.9)]' : ''} />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
