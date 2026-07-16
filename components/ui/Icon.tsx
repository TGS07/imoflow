type IconName =
  | 'dashboard' | 'leads' | 'pipeline' | 'people' | 'building' | 'home'
  | 'calendar' | 'chart' | 'settings' | 'zap' | 'form' | 'mail'
  | 'whatsapp' | 'team' | 'plus' | 'pencil' | 'trash' | 'close'
  | 'send' | 'bell' | 'check' | 'x' | 'chevron-down' | 'logout' | 'phone'
  | 'search' | 'command' | 'help'

const PATHS: Record<IconName, React.ReactNode> = {
  dashboard: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
  leads: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="0.5" /></>,
  pipeline: <><rect x="3" y="4" width="5" height="16" rx="1.5" /><rect x="10" y="4" width="5" height="11" rx="1.5" /><rect x="17" y="4" width="5" height="7" rx="1.5" /></>,
  people: <><circle cx="9" cy="8" r="3.5" /><path d="M3.5 20c0-3 2.5-5 5.5-5s5.5 2 5.5 5" /><circle cx="17" cy="9" r="2.5" /><path d="M17 14.5c2.2 0 4 1.6 4 4" /></>,
  building: <><rect x="5" y="3" width="14" height="18" rx="1.5" /><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10.5 21v-3h3v3" /></>,
  home: <><path d="M3.5 10.5 12 3.5l8.5 7" /><path d="M5.5 9.5V20a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.5" /><path d="M9.5 21v-6h5v6" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="16" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  chart: <><path d="M4 4v16h16" /><path d="M8 16v-5M12 16V8M16 16v-3" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4 5.3 5.3" /></>,
  zap: <path d="M13 2.5 4.5 13.5h6l-1 8L18 10.5h-6l1-8Z" />,
  form: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3.5 6.5 8.5 6.5 8.5-6.5" /></>,
  whatsapp: <><path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.7-1.2A9 9 0 1 0 12 3Z" /><path d="M9 8.5c0 4 2.5 6.5 6.5 6.5l.8-1.8-2-1.2-1 .8c-1-.5-1.6-1.1-2.1-2.1l.8-1-1.2-2L9 8.5Z" /></>,
  team: <><circle cx="12" cy="7.5" r="3" /><path d="M6 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  pencil: <><path d="m14.5 5 4.5 4.5L8 20.5l-5 1 1-5L14.5 5Z" /></>,
  trash: <><path d="M4 7h16M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7" /><path d="M6.5 7 7.5 20a1.5 1.5 0 0 0 1.5 1.4h6A1.5 1.5 0 0 0 16.5 20l1-13" /><path d="M10 11.5v5.5M14 11.5v5.5" /></>,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  send: <><path d="M21 3 10.5 13.5" /><path d="M21 3 14 21l-3.5-7.5L3 10l18-7Z" /></>,
  bell: <><path d="M18 9a6 6 0 1 0-12 0c0 6-2.5 7-2.5 7h17S18 15 18 9Z" /><path d="M10 19.5a2.2 2.2 0 0 0 4 0" /></>,
  check: <path d="m4.5 12.5 5 5 10-11" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  'chevron-down': <path d="m6 9 6 6 6-6" />,
  logout: <><path d="M14 4h-7a1.5 1.5 0 0 0-1.5 1.5v13A1.5 1.5 0 0 0 7 20h7" /><path d="m17 8 4 4-4 4M21 12H10" /></>,
  phone: <path d="M5 4h4l1.5 4.5L8 10a12 12 0 0 0 6 6l1.5-2.5L20 15v4a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2Z" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  command: <path d="M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6Z" />,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 0 1 5 .3c0 1.7-2.5 2.2-2.5 3.7" /><circle cx="12" cy="16.8" r="0.5" /></>,
}

type Props = {
  name: IconName
  size?: number
  className?: string
  style?: React.CSSProperties
}

export function Icon({ name, size = 18, className, style }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  )
}

export type { IconName }
