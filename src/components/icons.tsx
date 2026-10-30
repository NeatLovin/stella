import type { SVGProps } from 'react'

const base = (props: SVGProps<SVGSVGElement>) => ({
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  ...props,
})

export const IconStar = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 3c.8 5.2 3.8 8.2 9 9-5.2.8-8.2 3.8-9 9-.8-5.2-3.8-8.2-9-9 5.2-.8 8.2-3.8 9-9Z" />
  </svg>
)

export const IconConstellation = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M5 18 9 9l6 3 4-7" strokeDasharray="0.1 0" opacity=".55" />
    <circle cx="5" cy="18" r="1.6" fill="currentColor" />
    <circle cx="9" cy="9" r="1.6" fill="currentColor" />
    <circle cx="15" cy="12" r="1.6" fill="currentColor" />
    <circle cx="19" cy="5" r="1.6" fill="currentColor" />
  </svg>
)

export const IconJar = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M8 3h8M9 3v3c-2.5 1.2-4 3.3-4 6v6a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-6c0-2.7-1.5-4.8-4-6V3" />
    <path d="M10 14.5c0-1 .8-1.6 1.6-1.6.5 0 .9.3 1.1.6.2-.3.6-.6 1.1-.6.8 0 1.6.6 1.6 1.6 0 1.6-2.7 3-2.7 3s-2.7-1.4-2.7-3Z" />
  </svg>
)

export const IconGift = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="3.5" y="8" width="17" height="4" rx="1" />
    <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7M12 8v13" />
    <path d="M12 8C10.5 5 7 4.5 7 6.5S10 8 12 8Zm0 0c1.5-3 5-3.5 5-1.5S14 8 12 8Z" />
  </svg>
)

export const IconMoon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
  </svg>
)

export const IconCheck = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="m5 12.5 4.2 4.2L19 7" />
  </svg>
)

export const IconPlus = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)

export const IconExternal = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
  </svg>
)

export const IconImage = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="3" y="4" width="18" height="16" rx="2.5" />
    <circle cx="9" cy="10" r="1.8" />
    <path d="m4 18 5-5 4 4 2.5-2.5L20 19" />
  </svg>
)

export const IconChevron = (p: SVGProps<SVGSVGElement> & { dir?: 'left' | 'right' }) => {
  const { dir = 'right', ...rest } = p
  return (
    <svg {...base(rest)}>
      <path d={dir === 'right' ? 'm9 5 7 7-7 7' : 'm15 5-7 7 7 7'} />
    </svg>
  )
}

export const IconHeart = (p: SVGProps<SVGSVGElement> & { filled?: boolean }) => {
  const { filled, ...rest } = p
  return (
    <svg {...base(rest)} fill={filled ? 'currentColor' : 'none'}>
      <path d="M12 20s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10Z" />
    </svg>
  )
}
