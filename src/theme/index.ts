// src/theme/index.ts
// PocketDev IDE - Complete Theme System

export const Colors = {
  // === DARK THEME (Default - VS Code inspired but distinct) ===
  dark: {
    // Background layers
    bg: {
      primary: '#0D1117',        // Main editor background
      secondary: '#161B22',      // Sidebar, panels
      tertiary: '#1C2128',       // Tab bar, status bar
      elevated: '#21262D',       // Dropdowns, tooltips
      overlay: 'rgba(0,0,0,0.7)',// Modal overlays
    },
    // Surface colors
    surface: {
      default: '#1C2128',
      hover: '#262C36',
      active: '#2D333B',
      selected: '#1F4068',
      border: '#30363D',
    },
    // Text
    text: {
      primary: '#E6EDF3',
      secondary: '#8B949E',
      muted: '#6E7681',
      disabled: '#484F58',
      inverse: '#0D1117',
      link: '#58A6FF',
    },
    // Accent / Brand
    accent: {
      blue: '#58A6FF',
      green: '#3FB950',
      yellow: '#D29922',
      orange: '#F0883E',
      red: '#F85149',
      purple: '#BC8CFF',
      cyan: '#39D353',
      teal: '#56D364',
    },
    // Syntax highlighting
    syntax: {
      keyword: '#FF7B72',
      string: '#A5D6FF',
      number: '#F2CC60',
      comment: '#8B949E',
      function: '#D2A8FF',
      variable: '#E6EDF3',
      type: '#FFA657',
      operator: '#79C0FF',
      constant: '#79C0FF',
      class: '#FFA657',
      property: '#79C0FF',
      tag: '#7EE787',
      attribute: '#A5D6FF',
    },
    // Status colors
    status: {
      error: '#F85149',
      warning: '#D29922',
      info: '#58A6FF',
      success: '#3FB950',
      errorBg: 'rgba(248, 81, 73, 0.15)',
      warningBg: 'rgba(210, 153, 34, 0.15)',
      infoBg: 'rgba(88, 166, 255, 0.15)',
      successBg: 'rgba(63, 185, 80, 0.15)',
    },
  },

  // === LIGHT THEME ===
  light: {
    bg: {
      primary: '#FFFFFF',
      secondary: '#F6F8FA',
      tertiary: '#EAEEF2',
      elevated: '#FFFFFF',
      overlay: 'rgba(0,0,0,0.4)',
    },
    surface: {
      default: '#F6F8FA',
      hover: '#EEF2F6',
      active: '#E1E8EF',
      selected: '#DDF4FF',
      border: '#D0D7DE',
    },
    text: {
      primary: '#1F2328',
      secondary: '#57606A',
      muted: '#6E7781',
      disabled: '#8C959F',
      inverse: '#FFFFFF',
      link: '#0969DA',
    },
    accent: {
      blue: '#0969DA',
      green: '#1A7F37',
      yellow: '#9A6700',
      orange: '#BC4C00',
      red: '#CF222E',
      purple: '#8250DF',
      cyan: '#1A7F37',
      teal: '#1A7F37',
    },
    syntax: {
      keyword: '#CF222E',
      string: '#0A3069',
      number: '#0550AE',
      comment: '#6E7781',
      function: '#8250DF',
      variable: '#1F2328',
      type: '#953800',
      operator: '#0550AE',
      constant: '#0550AE',
      class: '#953800',
      property: '#0550AE',
      tag: '#116329',
      attribute: '#0A3069',
    },
    status: {
      error: '#CF222E',
      warning: '#9A6700',
      info: '#0969DA',
      success: '#1A7F37',
      errorBg: 'rgba(207, 34, 46, 0.1)',
      warningBg: 'rgba(154, 103, 0, 0.1)',
      infoBg: 'rgba(9, 105, 218, 0.1)',
      successBg: 'rgba(26, 127, 55, 0.1)',
    },
  },
};

export const Typography = {
  // Code font stack
  code: {
    fontFamily: 'JetBrains Mono, Fira Code, Courier New, monospace',
    sizes: {
      xs: 10,
      sm: 12,
      md: 14,
      lg: 16,
      xl: 18,
    },
  },
  // UI font stack
  ui: {
    fontFamily: 'SF Pro Display, -apple-system, Roboto, sans-serif',
    sizes: {
      xs: 10,
      sm: 12,
      md: 14,
      lg: 16,
      xl: 18,
      xxl: 22,
      xxxl: 28,
    },
    weights: {
      regular: '400' as const,
      medium: '500' as const,
      semibold: '600' as const,
      bold: '700' as const,
    },
  },
};

export const Spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
  massive: 64,
};

export const BorderRadius = {
  none: 0,
  sm: 3,
  md: 6,
  lg: 10,
  xl: 14,
  xxl: 20,
  full: 9999,
};

export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
};

// Language color indicators (like GitHub's language colors)
export const LanguageColors: Record<string, string> = {
  javascript: '#F7DF1E',
  typescript: '#3178C6',
  python: '#3776AB',
  java: '#ED8B00',
  'c++': '#00599C',
  c: '#A8B9CC',
  go: '#00ADD8',
  rust: '#CE422B',
  php: '#777BB4',
  html: '#E34F26',
  css: '#1572B6',
  json: '#292929',
  markdown: '#083FA1',
  yaml: '#CB171E',
  dockerfile: '#384D54',
  shell: '#89E051',
  sql: '#E38C00',
};

// File icon mapping
export const FileIcons: Record<string, { icon: string; color: string }> = {
  js: { icon: 'language-javascript', color: '#F7DF1E' },
  jsx: { icon: 'react', color: '#61DAFB' },
  ts: { icon: 'language-typescript', color: '#3178C6' },
  tsx: { icon: 'react', color: '#61DAFB' },
  py: { icon: 'language-python', color: '#3776AB' },
  java: { icon: 'language-java', color: '#ED8B00' },
  cpp: { icon: 'language-cpp', color: '#00599C' },
  c: { icon: 'language-c', color: '#A8B9CC' },
  go: { icon: 'language-go', color: '#00ADD8' },
  rs: { icon: 'cog', color: '#CE422B' },
  php: { icon: 'language-php', color: '#777BB4' },
  html: { icon: 'language-html5', color: '#E34F26' },
  css: { icon: 'language-css3', color: '#1572B6' },
  json: { icon: 'code-json', color: '#FFCA28' },
  md: { icon: 'language-markdown', color: '#083FA1' },
  yml: { icon: 'cogs', color: '#CB171E' },
  yaml: { icon: 'cogs', color: '#CB171E' },
  sh: { icon: 'console', color: '#89E051' },
  dockerfile: { icon: 'docker', color: '#2496ED' },
  gitignore: { icon: 'git', color: '#F05032' },
  env: { icon: 'lock', color: '#ECD53F' },
  default: { icon: 'file-outline', color: '#8B949E' },
};

export type ThemeMode = 'dark' | 'light';
export type Theme = typeof Colors.dark;
