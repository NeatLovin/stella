import { DENY, FUR } from '../lib/deny'

/** Deny debout, en sentinelle (logo de la page « Nous »). Il cligne des yeux de temps en temps. */
export function DenyLogo({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="12 10 96 145" className={className} aria-hidden>
      <path d={DENY.tail} fill={FUR.shade} />
      <path d={DENY.tailTip} fill={FUR.dark} />
      <path d="M57 128 L57 146 M72 128 L72 146" stroke={FUR.shade} strokeWidth="10" strokeLinecap="round" />
      <ellipse cx="59" cy="148" rx="9" ry="4" fill={FUR.mid} />
      <ellipse cx="75" cy="148" rx="9" ry="4" fill={FUR.shade} />
      <path d={DENY.body} fill={FUR.body} />
      <path d={DENY.belly} fill={FUR.light} />
      <path d={DENY.arm2} stroke={FUR.shade} strokeWidth="7" strokeLinecap="round" fill="none" />
      <path d={DENY.arm1} stroke={FUR.mid} strokeWidth="7" strokeLinecap="round" fill="none" />
      <path d={DENY.head} fill={FUR.head} />
      <path d={DENY.muzzle} fill={FUR.light} />
      <ellipse cx="52" cy="29" rx="4.2" ry="5.5" fill={FUR.dark} />
      <ellipse cx="71" cy="29" rx="6.5" ry="4.8" transform="rotate(-12 71 29)" fill={FUR.dark} />
      <circle cx="72.5" cy="28" r="1.8" fill="#fff" className="deny-blink" />
      <circle cx="90" cy="35" r="2.8" fill={FUR.dark} />
    </svg>
  )
}
