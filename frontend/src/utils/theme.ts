export type ThemeMode = 'light' | 'dark';

export const lightColors = {
  // Primary palette (warm)
  primary:       '#F59E0B',   // --accent
  community:     '#E07A5F',   // --community
  background:    '#FDF4E3',   // --bg-main
  // Accent cold
  notification:  '#3B82F6',   // --notif-blue
  myBubble:      '#0F766E',   // --chat-own
  // Neutrals
  text:          '#1F2937',   // --text-primary
  textSecondary: '#6B7280',   // --text-secondary
  // Surfaces
  card:          '#F3F4F6',   // --card-bg
  cardBg:        '#F3F4F6',   // alias
  surface:       '#FFFFFF',   // --surface
  navBg:         '#FFFFFF',   // --nav-bg
  white:         '#FFFFFF',
  // Borders & utility
  gray:          '#6B7280',
  border:        '#E5E7EB',   // --border
  lightGray:     '#F9FAFB',
  // Semantic
  danger:        '#EF4444',
  success:       '#22C55E',
  // Shadows (used as string in boxShadow on web)
  shadow:        'rgba(0,0,0,0.08)',
  shadowLg:      'rgba(0,0,0,0.12)',
};

export const darkColors = {
  primary:       '#F59E0B',
  community:     '#E07A5F',
  background:    '#1E1A17',
  notification:  '#3B82F6',
  myBubble:      '#0F766E',
  text:          '#FDF4E3',
  textSecondary: '#A8A29E',
  card:          '#2D2A27',
  cardBg:        '#2D2A27',
  surface:       '#2D2A27',
  navBg:         '#252220',
  white:         '#252220',
  gray:          '#A8A29E',
  border:        '#3D3A37',
  lightGray:     '#2D2A27',
  danger:        '#EF4444',
  success:       '#22C55E',
  shadow:        'rgba(0,0,0,0.35)',
  shadowLg:      'rgba(0,0,0,0.45)',
};

export const theme: { mode: ThemeMode; colors: typeof lightColors } = {
  mode: 'light',
  colors: lightColors,
};

export const applyTheme = (mode: ThemeMode) => {
  theme.mode = mode;
  theme.colors = (mode === 'dark' ? darkColors : lightColors) as typeof lightColors;
};
