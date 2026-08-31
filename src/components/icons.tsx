import type { ReactNode, SVGProps } from 'react';

export type IconName =
  | 'logo' | 'grid' | 'book' | 'book-open' | 'layers' | 'file-text' | 'news' | 'play' | 'calendar'
  | 'users' | 'user' | 'user-check' | 'grad-cap' | 'award' | 'wallet' | 'bag' | 'cart' | 'card'
  | 'receipt' | 'banknote' | 'gear' | 'globe' | 'menu' | 'layout' | 'list' | 'image' | 'search'
  | 'bell' | 'sun' | 'moon' | 'monitor' | 'chevron-down' | 'chevron-left' | 'chevron-right' | 'chevron-up'
  | 'plus' | 'pencil' | 'trash' | 'x' | 'check' | 'check-circle' | 'alert-triangle' | 'alert-circle'
  | 'info' | 'lock' | 'unlock' | 'eye' | 'eye-off' | 'download' | 'upload' | 'copy' | 'external'
  | 'logout' | 'clock' | 'star' | 'filter' | 'arrow-right' | 'arrow-left' | 'arrow-up' | 'arrow-down'
  | 'refresh' | 'key' | 'database' | 'server' | 'shield' | 'code' | 'terminal' | 'map-pin' | 'phone'
  | 'mail' | 'chat' | 'facebook' | 'instagram' | 'youtube' | 'tiktok' | 'link' | 'type' | 'tag'
  | 'home' | 'store' | 'settings' | 'chart' | 'send' | 'flag' | 'target' | 'briefcase' | 'file' | 'camera';

const P: Record<IconName, ReactNode> = {
  logo: <><rect x="3" y="3" width="18" height="18" rx="5" fill="currentColor" stroke="none" /><path d="M9 8v8M9 12l5-4M9 12l5 4" stroke="var(--logo-fg,#04211d)" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" fill="none" /></>,
  grid: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></>,
  book: <><path d="M4 5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2V5Z" /><path d="M4 19a2 2 0 0 1 2-2h14" /></>,
  'book-open': <><path d="M2.5 5A2.5 2.5 0 0 1 5 2.5h6V19H5A2.5 2.5 0 0 0 2.5 21.5V5Z" /><path d="M21.5 5A2.5 2.5 0 0 0 19 2.5h-6V19h6a2.5 2.5 0 0 1 2.5 2.5V5Z" /></>,
  layers: <><path d="m12 2.5 9 5-9 5-9-5 9-5Z" /><path d="m3 12.5 9 5 9-5" /><path d="m3 17.5 9 5 9-5" /></>,
  'file-text': <><path d="M14 2.5H6a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8.5l-6-6Z" /><path d="M14 2.5v6h6" /><path d="M9 13h6M9 17h6" /></>,
  news: <><rect x="2.5" y="4.5" width="19" height="16" rx="2" /><path d="M6.5 8.5h7v5h-7zM17 8.5h1M17 12h1M6.5 17h11" /></>,
  play: <><circle cx="12" cy="12" r="9.5" /><path d="m10 8.5 6 3.5-6 3.5v-7Z" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="16" rx="2" /><path d="M8 2.5V7M16 2.5V7M3.5 10.5h17" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20.5c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" /><circle cx="17" cy="9" r="2.6" /><path d="M16 14.7c2.9.3 5.5 2.4 5.5 5.8" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4.5 21c0-4 3.4-6.5 7.5-6.5s7.5 2.5 7.5 6.5" /></>,
  'user-check': <><circle cx="9.5" cy="8" r="3.5" /><path d="M3 20.5c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" /><path d="m15.5 10.5 2.5 2.5 4-4.5" /></>,
  'grad-cap': <><path d="m12 4 10 5-10 5L2 9l10-5Z" /><path d="M6.5 11.5V16c0 1.4 2.5 3 5.5 3s5.5-1.6 5.5-3v-4.5" /><path d="M22 9v5" /></>,
  award: <><circle cx="12" cy="9" r="6" /><path d="m8.5 14.5-2 7 5.5-3 5.5 3-2-7" /></>,
  wallet: <><rect x="2.5" y="5.5" width="19" height="14" rx="2.5" /><path d="M2.5 10h19" /><circle cx="16.5" cy="14.5" r="1" fill="currentColor" stroke="none" /></>,
  bag: <><path d="M5.5 7.5h13l1 13h-15l1-13Z" /><path d="M8.5 10V6.5a3.5 3.5 0 0 1 7 0V10" /></>,
  cart: <><circle cx="9" cy="20" r="1.4" /><circle cx="17.5" cy="20" r="1.4" /><path d="M2.5 3.5h3l2.6 12h10.6l2.3-8.5H6.6" /></>,
  card: <><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 10h19M6.5 15h4" /></>,
  receipt: <><path d="M5 2.5h14v19l-2.3-1.5-2.3 1.5-2.4-1.5-2.4 1.5-2.3-1.5L5 21.5v-19Z" /><path d="M9 7.5h6M9 11.5h6M9 15.5h3" /></>,
  banknote: <><rect x="2.5" y="6" width="19" height="12" rx="2" /><circle cx="12" cy="12" r="2.6" /><path d="M6 12h.01M18 12h.01" /></>,
  gear: <><circle cx="12" cy="12" r="3.2" /><path d="M19 12a7 7 0 0 0-.15-1.4l2.1-1.6-2-3.5-2.5 1a7 7 0 0 0-2.4-1.4L13.6 2.5h-3.2L10 5.1a7 7 0 0 0-2.4 1.4l-2.5-1-2 3.5 2.1 1.6a7 7 0 0 0 0 2.8l-2.1 1.6 2 3.5 2.5-1a7 7 0 0 0 2.4 1.4l.4 2.6h3.2l.4-2.6a7 7 0 0 0 2.4-1.4l2.5 1 2-3.5-2.1-1.6c.1-.45.15-.92.15-1.4Z" /></>,
  globe: <><circle cx="12" cy="12" r="9.5" /><path d="M2.5 12h19M12 2.5c2.7 2.6 4 5.8 4 9.5s-1.3 6.9-4 9.5c-2.7-2.6-4-5.8-4-9.5s1.3-6.9 4-9.5Z" /></>,
  menu: <><path d="M4 6.5h16M4 12h16M4 17.5h16" /></>,
  layout: <><rect x="3" y="3" width="18" height="18" rx="2.5" /><path d="M3 9.5h18M9.5 9.5V21" /></>,
  list: <><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1" fill="currentColor" stroke="none" /><circle cx="4.5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="4.5" cy="18" r="1" fill="currentColor" stroke="none" /></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="9" cy="10" r="1.8" /><path d="m3.5 17.5 5-4.5 4 3.5 4-4 4 4.5" /></>,
  search: <><circle cx="10.5" cy="10.5" r="7" /><path d="m20.5 20.5-4.5-4.5" /></>,
  bell: <><path d="M18 9a6 6 0 1 0-12 0c0 6-2.5 7-2.5 7h17S18 15 18 9Z" /><path d="M10 20a2.2 2.2 0 0 0 4 0" /></>,
  sun: <><circle cx="12" cy="12" r="4.5" /><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8" /></>,
  moon: <><path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z" /></>,
  monitor: <><rect x="2.5" y="3.5" width="19" height="13" rx="2" /><path d="M8.5 21h7M12 16.5V21" /></>,
  'chevron-down': <path d="m6 9.5 6 6 6-6" />,
  'chevron-up': <path d="m6 14.5 6-6 6 6" />,
  'chevron-left': <path d="m14.5 6-6 6 6 6" />,
  'chevron-right': <path d="m9.5 6 6 6-6 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  pencil: <><path d="M17 3.5a2.1 2.1 0 0 1 3 3L7.5 19 3 20.5 4.5 16 17 3.5Z" /><path d="m14.5 6 3 3" /></>,
  trash: <><path d="M3.5 6.5h17M8 6.5V4.5a1.5 1.5 0 0 1 1.5-1.5h5A1.5 1.5 0 0 1 16 4.5v2" /><path d="M5.5 6.5 6.5 21h11l1-14.5" /><path d="M10 11v6M14 11v6" /></>,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  check: <path d="m4.5 12.5 5 5 10-11" />,
  'check-circle': <><circle cx="12" cy="12" r="9.5" /><path d="m8 12.5 2.8 2.8L16.5 9" /></>,
  'alert-triangle': <><path d="M12 3 1.8 20.5h20.4L12 3Z" /><path d="M12 10v4.5" /><circle cx="12" cy="17.5" r="0.6" fill="currentColor" stroke="none" /></>,
  'alert-circle': <><circle cx="12" cy="12" r="9.5" /><path d="M12 7.5V13" /><circle cx="12" cy="16.5" r="0.6" fill="currentColor" stroke="none" /></>,
  info: <><circle cx="12" cy="12" r="9.5" /><path d="M12 11v5.5" /><circle cx="12" cy="7.8" r="0.6" fill="currentColor" stroke="none" /></>,
  lock: <><rect x="4.5" y="10.5" width="15" height="10.5" rx="2" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></>,
  unlock: <><rect x="4.5" y="10.5" width="15" height="10.5" rx="2" /><path d="M8 10.5V7.5a4 4 0 0 1 7.7-1.5" /></>,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" /></>,
  'eye-off': <><path d="M4 4l16 16" /><path d="M9.9 5.9A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3 3.7M6.3 6.9A16.5 16.5 0 0 0 2.5 12S6 18.5 12 18.5a9.4 9.4 0 0 0 4-.9" /></>,
  download: <><path d="M12 3v12M7.5 11 12 15.5 16.5 11" /><path d="M4 17v2.5A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5V17" /></>,
  upload: <><path d="M12 15V3M7.5 7 12 2.5 16.5 7" /><path d="M4 17v2.5A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5V17" /></>,
  copy: <><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5.5 15H4.5a2 2 0 0 1-2-2V4.5a2 2 0 0 1 2-2H13a2 2 0 0 1 2 2v1" /></>,
  external: <><path d="M14 3.5h6.5V10" /><path d="M20.5 3.5 11 13" /><path d="M18 13.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5.5" /></>,
  logout: <><path d="M9 21H5.5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2H9" /><path d="m15 16.5 4.5-4.5L15 7.5" /><path d="M19.5 12H9" /></>,
  clock: <><circle cx="12" cy="12" r="9.5" /><path d="M12 6.5V12l3.5 2.5" /></>,
  star: <path d="m12 2.8 2.9 5.8 6.4 1-4.6 4.5 1 6.4-5.7-3-5.7 3 1-6.4L2.7 9.6l6.4-1L12 2.8Z" />,
  filter: <path d="M3 5h18l-7 8.5V19l-4 2v-7.5L3 5Z" />,
  'arrow-right': <><path d="M4 12h16" /><path d="m14 6 6 6-6 6" /></>,
  'arrow-left': <><path d="M20 12H4" /><path d="m10 6-6 6 6 6" /></>,
  'arrow-up': <><path d="M12 20V4" /><path d="m6 10 6-6 6 6" /></>,
  'arrow-down': <><path d="M12 4v16" /><path d="m6 14 6 6 6-6" /></>,
  refresh: <><path d="M20.5 12a8.5 8.5 0 1 1-2.5-6" /><path d="M20.5 3v4h-4" /></>,
  key: <><circle cx="8" cy="15.5" r="4.5" /><path d="m11.5 12.5 8-8M17 7l2.5 2.5M14.5 9.5 17 12" /></>,
  database: <><ellipse cx="12" cy="5.5" rx="8.5" ry="3" /><path d="M3.5 5.5V18.5c0 1.7 3.8 3 8.5 3s8.5-1.3 8.5-3V5.5" /><path d="M3.5 12c0 1.7 3.8 3 8.5 3s8.5-1.3 8.5-3" /></>,
  server: <><rect x="2.5" y="3" width="19" height="7" rx="1.5" /><rect x="2.5" y="14" width="19" height="7" rx="1.5" /><circle cx="6.5" cy="6.5" r="0.7" fill="currentColor" stroke="none" /><circle cx="6.5" cy="17.5" r="0.7" fill="currentColor" stroke="none" /></>,
  shield: <><path d="M12 2.5 4 5.5v6c0 5 3.4 8.4 8 10 4.6-1.6 8-5 8-10v-6l-8-3Z" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>,
  code: <><path d="m8 7-5 5 5 5M16 7l5 5-5 5" /></>,
  terminal: <><rect x="2.5" y="4" width="19" height="16" rx="2" /><path d="m6.5 9 3 3-3 3M12.5 15.5h5" /></>,
  'map-pin': <><path d="M12 21.5s7.5-6.6 7.5-12a7.5 7.5 0 1 0-15 0c0 5.4 7.5 12 7.5 12Z" /><circle cx="12" cy="9.5" r="2.8" /></>,
  phone: <path d="M5.5 3.5h4L11 8l-2.2 1.7a13.5 13.5 0 0 0 5.5 5.5L16 13l4.5 1.5v4a2 2 0 0 1-2.2 2A17.5 17.5 0 0 1 3.5 5.7a2 2 0 0 1 2-2.2Z" />,
  mail: <><rect x="2.5" y="4.5" width="19" height="15" rx="2" /><path d="m3.5 6.5 8.5 7 8.5-7" /></>,
  chat: <><path d="M21 12a8.5 8.5 0 0 1-12.4 7.5L3 21l1.5-5.6A8.5 8.5 0 1 1 21 12Z" /></>,
  facebook: <path d="M14.5 8.5H17V5h-2.5A4.5 4.5 0 0 0 10 9.5V12H7.5v3.5H10v6h3.5v-6H16l.5-3.5h-3v-2a1.5 1.5 0 0 1 1-1.5Z" />,
  instagram: <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.2" cy="6.8" r="0.8" fill="currentColor" stroke="none" /></>,
  youtube: <><rect x="2.5" y="5.5" width="19" height="13" rx="3.5" /><path d="m10.2 9.3 5 2.7-5 2.7v-5.4Z" /></>,
  tiktok: <path d="M14.5 3.5v11a3.75 3.75 0 1 1-3-3.7M14.5 5.5a5.5 5.5 0 0 0 5 4.5" />,
  link: <><path d="M10 14a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.2 1.1" /><path d="M14 10a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.2-1.1" /></>,
  type: <><path d="M5 7V4h14v3M12 4v16M9 20h6" /></>,
  tag: <><path d="M3 11V3.5h7.5L21 14l-7 7L3 11Z" /><circle cx="8" cy="8.5" r="1.3" /></>,
  home: <><path d="m3 11 9-8 9 8" /><path d="M5.5 9.5V21h13V9.5" /><path d="M9.5 21v-6h5v6" /></>,
  store: <><path d="M4 7.5 5.5 3h13L20 7.5" /><path d="M4 7.5h16v2a3 3 0 0 1-3 3 3.2 3.2 0 0 1-2.5-1.3A3.2 3.2 0 0 1 12 12.5a3.2 3.2 0 0 1-2.5-1.3A3.2 3.2 0 0 1 7 12.5a3 3 0 0 1-3-3v-2Z" /><path d="M5 12.8V21h14v-8.2" /><path d="M9.5 21v-5h5v5" /></>,
  settings: <><path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h10M18 18h2" /><circle cx="16" cy="6" r="2" /><circle cx="8" cy="12" r="2" /><circle cx="16" cy="18" r="2" /></>,
  chart: <><path d="M3.5 3.5v17h17" /><path d="M8 16v-5M12.5 16V7M17 16v-8" /></>,
  send: <><path d="m21.5 2.5-10 10" /><path d="M21.5 2.5 15 21.5l-3.5-9-9-3.5 19-6.5Z" /></>,
  flag: <><path d="M5 21.5V3.5" /><path d="M5 4.5c4-2.5 7 2 12 0v9c-5 2-8-2.5-12 0" /></>,
  target: <><circle cx="12" cy="12" r="9.5" /><circle cx="12" cy="12" r="5.5" /><circle cx="12" cy="12" r="1.6" /></>,
  briefcase: <><rect x="2.5" y="7" width="19" height="13" rx="2" /><path d="M8.5 7V5A1.5 1.5 0 0 1 10 3.5h4A1.5 1.5 0 0 1 15.5 5v2" /><path d="M2.5 12.5h19" /></>,
  file: <><path d="M14 2.5H6a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8.5l-6-6Z" /><path d="M14 2.5v6h6" /></>,
  camera: <><path d="M4 8h3l2-3h6l2 3h3a1.5 1.5 0 0 1 1.5 1.5V19a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 19V9.5A1.5 1.5 0 0 1 4 8Z" /><circle cx="12" cy="13.5" r="3.5" /></>,
};

interface IconProps extends SVGProps<SVGSVGElement> { name: IconName; size?: number; }

export function Icon({ name, size = 18, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      {P[name]}
    </svg>
  );
}
