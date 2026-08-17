import type { ThemeMode } from './ThemeColors'

export type { ThemeMode } from './ThemeColors'

export type PremiumAccentName =
  | 'miyopBlue'
  | 'blue'
  | 'emerald'
  | 'teal'
  | 'indigo'
  | 'purple'
  | 'orange'
  | 'rose'
  | 'slate'
  | 'graphite'
export type PremiumSurfaceLevel = 0 | 1 | 2 | 3 | 4
export type PremiumElevationLevel = 0 | 1 | 2 | 3
export type PremiumGlassSurface =
  | 'sidebar'
  | 'topbar'
  | 'card'
  | 'modal'
  | 'drawer'
  | 'dropdown'

export type PremiumSemanticColor =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'error'
  | 'info'
  | 'neutral'

export type PremiumColorRole = {
  base: string
  hover: string
  soft: string
  subtle: string
  line: string
  contrast: string
}

export type PremiumGlassTokens = {
  background: string
  border: string
  shadow: string
  blur: string
}

export type PremiumElevationTokens = {
  background: string
  border: string
  shadow: string
  blur: string
}

export type PremiumThemeTokens = {
  mode: ThemeMode
  app: {
    bg: string
    muted: string
    canvas: string
  }
  color: {
    white: string
    black: string
  }
  text: {
    primary: string
    secondary: string
    muted: string
    mutedStrong: string
    inverse: string
  }
  icon: {
    default: string
    muted: string
    inverse: string
  }
  surface: Record<PremiumSurfaceLevel, string>
  card: {
    background: string
    raised: string
  }
  border: {
    subtle: string
    default: string
    strong: string
    focus: string
  }
  semantic: Record<PremiumSemanticColor, PremiumColorRole>
  state: {
    hover: string
    active: string
    selected: string
    disabledBackground: string
    disabledText: string
    focusRing: string
  }
  shadow: {
    none: string
    xs: string
    sm: string
    md: string
    lg: string
    xl: string
    floating: string
    overlay: string
  }
  blur: {
    none: string
    sm: string
    md: string
    lg: string
    glass: string
  }
  radius: {
    surface: string
    control: string
    modal: string
    pill: string
  }
  typography: {
    body: string
    heading: string
    mono: string
  }
  motion: {
    fast: string
    normal: string
    slow: string
    surface: string
    focus: string
  }
  glass: Record<PremiumGlassSurface, PremiumGlassTokens>
  elevation: Record<PremiumElevationLevel, PremiumElevationTokens>
}

export const DEFAULT_THEME_MODE: ThemeMode = 'light'
export const DEFAULT_THEME_ACCENT: PremiumAccentName = 'miyopBlue'

export const PREMIUM_ACCENT_NAMES: PremiumAccentName[] = [
  'miyopBlue',
  'blue',
  'emerald',
  'teal',
  'indigo',
  'purple',
  'orange',
  'rose',
  'slate',
  'graphite'
]

export const PREMIUM_SURFACE_LEVELS: PremiumSurfaceLevel[] = [0, 1, 2, 3, 4]
export const PREMIUM_ELEVATION_LEVELS: PremiumElevationLevel[] = [0, 1, 2, 3]

export const PREMIUM_GLASS_SURFACES: PremiumGlassSurface[] = [
  'sidebar',
  'topbar',
  'card',
  'modal',
  'drawer',
  'dropdown'
]

export const PREMIUM_ACCENT_PALETTES: Record<ThemeMode, Record<PremiumAccentName, PremiumColorRole>> = {
  light: {
    miyopBlue: {
      base: '#2557d6',
      hover: '#1f49b8',
      soft: '#edf3ff',
      subtle: '#dfe9ff',
      line: '#b9cdfb',
      contrast: '#ffffff'
    },
    blue: {
      base: '#2563eb',
      hover: '#1d4ed8',
      soft: '#eff6ff',
      subtle: '#dbeafe',
      line: '#bfdbfe',
      contrast: '#ffffff'
    },
    emerald: {
      base: '#047857',
      hover: '#065f46',
      soft: '#edfdf6',
      subtle: '#d8f7e8',
      line: '#a9e8ca',
      contrast: '#ffffff'
    },
    teal: {
      base: '#0f766e',
      hover: '#115e59',
      soft: '#eefbf8',
      subtle: '#d7f3ee',
      line: '#a8ded7',
      contrast: '#ffffff'
    },
    indigo: {
      base: '#4f46e5',
      hover: '#4338ca',
      soft: '#f1f3ff',
      subtle: '#e3e7ff',
      line: '#c5cef8',
      contrast: '#ffffff'
    },
    purple: {
      base: '#7c3aed',
      hover: '#6d28d9',
      soft: '#f6f2ff',
      subtle: '#eee6ff',
      line: '#d2c0fb',
      contrast: '#ffffff'
    },
    orange: {
      base: '#b45309',
      hover: '#92400e',
      soft: '#fff6ed',
      subtle: '#ffead1',
      line: '#f5c389',
      contrast: '#ffffff'
    },
    rose: {
      base: '#be123c',
      hover: '#9f1239',
      soft: '#fff1f4',
      subtle: '#ffe3e9',
      line: '#f6bdc8',
      contrast: '#ffffff'
    },
    slate: {
      base: '#475569',
      hover: '#334155',
      soft: '#f3f6f9',
      subtle: '#e7edf3',
      line: '#c4cedb',
      contrast: '#ffffff'
    },
    graphite: {
      base: '#374151',
      hover: '#1f2937',
      soft: '#f3f3f4',
      subtle: '#e8e9ec',
      line: '#c7cbd1',
      contrast: '#ffffff'
    }
  },
  dark: {
    miyopBlue: {
      base: '#8ab4ff',
      hover: '#a8c8ff',
      soft: 'rgba(77, 123, 255, .18)',
      subtle: 'rgba(77, 123, 255, .25)',
      line: 'rgba(154, 189, 255, .42)',
      contrast: '#23272e'
    },
    blue: {
      base: '#93c5fd',
      hover: '#bfdbfe',
      soft: 'rgba(59, 130, 246, .18)',
      subtle: 'rgba(59, 130, 246, .25)',
      line: 'rgba(147, 197, 253, .40)',
      contrast: '#23272e'
    },
    emerald: {
      base: '#6ee7b7',
      hover: '#a7f3d0',
      soft: 'rgba(16, 185, 129, .18)',
      subtle: 'rgba(16, 185, 129, .25)',
      line: 'rgba(110, 231, 183, .40)',
      contrast: '#23272e'
    },
    teal: {
      base: '#5eead4',
      hover: '#99f6e4',
      soft: 'rgba(20, 184, 166, .18)',
      subtle: 'rgba(20, 184, 166, .25)',
      line: 'rgba(94, 234, 212, .40)',
      contrast: '#23272e'
    },
    indigo: {
      base: '#a5b4fc',
      hover: '#c7d2fe',
      soft: 'rgba(99, 102, 241, .18)',
      subtle: 'rgba(99, 102, 241, .25)',
      line: 'rgba(165, 180, 252, .42)',
      contrast: '#23272e'
    },
    purple: {
      base: '#c4a5ff',
      hover: '#d9c4ff',
      soft: 'rgba(147, 51, 234, .18)',
      subtle: 'rgba(147, 51, 234, .25)',
      line: 'rgba(196, 165, 255, .40)',
      contrast: '#23272e'
    },
    orange: {
      base: '#f5a45b',
      hover: '#fdc68b',
      soft: 'rgba(249, 115, 22, .18)',
      subtle: 'rgba(249, 115, 22, .25)',
      line: 'rgba(245, 164, 91, .40)',
      contrast: '#23272e'
    },
    rose: {
      base: '#ff8da1',
      hover: '#ffb3c0',
      soft: 'rgba(244, 63, 94, .18)',
      subtle: 'rgba(244, 63, 94, .25)',
      line: 'rgba(255, 141, 161, .40)',
      contrast: '#23272e'
    },
    slate: {
      base: '#cbd5e1',
      hover: '#e2e8f0',
      soft: 'rgba(148, 163, 184, .18)',
      subtle: 'rgba(148, 163, 184, .25)',
      line: 'rgba(203, 213, 225, .38)',
      contrast: '#23272e'
    },
    graphite: {
      base: '#d8dce2',
      hover: '#f1f3f5',
      soft: 'rgba(156, 163, 175, .18)',
      subtle: 'rgba(156, 163, 175, .25)',
      line: 'rgba(216, 220, 226, .38)',
      contrast: '#23272e'
    }
  }
}

export const PREMIUM_THEME_TOKENS: Record<ThemeMode, PremiumThemeTokens> = {
  light: {
    mode: 'light',
    app: {
      bg: '#f5f4f0',
      muted: '#eceae4',
      canvas: 'linear-gradient(180deg, #fbfaf6 0%, #f4f3ef 46%, #eceae4 100%)'
    },
    color: {
      white: '#fffdf8',
      black: '#161b22'
    },
    text: {
      primary: '#161b22',
      secondary: '#303a46',
      muted: '#687382',
      mutedStrong: '#4b5563',
      inverse: '#ffffff'
    },
    icon: {
      default: '#3f4854',
      muted: '#687382',
      inverse: '#ffffff'
    },
    surface: {
      0: '#fffdf8',
      1: '#faf9f5',
      2: '#f3f1ec',
      3: '#ebe7df',
      4: '#ddd8ce'
    },
    card: {
      background: 'var(--theme-surface-0)',
      raised: 'var(--theme-surface-1)'
    },
    border: {
      subtle: '#e6e1d8',
      default: '#d5cec2',
      strong: '#b9afa1',
      focus: '#2557d6'
    },
    semantic: {
      primary: PREMIUM_ACCENT_PALETTES.light.miyopBlue,
      secondary: {
        base: '#475569',
        hover: '#334155',
        soft: '#f3f6f9',
        subtle: '#e7edf3',
        line: '#c4cedb',
        contrast: '#ffffff'
      },
      success: {
        base: '#047857',
        hover: '#065f46',
        soft: '#edfdf6',
        subtle: '#d8f7e8',
        line: '#a9e8ca',
        contrast: '#ffffff'
      },
      warning: {
        base: '#b45309',
        hover: '#92400e',
        soft: '#fff8ed',
        subtle: '#ffedcf',
        line: '#f3ca8f',
        contrast: '#ffffff'
      },
      danger: {
        base: '#b42318',
        hover: '#991b1b',
        soft: '#fff3f2',
        subtle: '#ffe3e1',
        line: '#f6bbb6',
        contrast: '#ffffff'
      },
      error: {
        base: '#b42318',
        hover: '#991b1b',
        soft: '#fff3f2',
        subtle: '#ffe3e1',
        line: '#f6bbb6',
        contrast: '#ffffff'
      },
      info: {
        base: '#2563eb',
        hover: '#1d4ed8',
        soft: '#eff6ff',
        subtle: '#dbeafe',
        line: '#bfdbfe',
        contrast: '#ffffff'
      },
      neutral: {
        base: '#475569',
        hover: '#334155',
        soft: '#f3f4f6',
        subtle: '#e8eaee',
        line: '#ccd2da',
        contrast: '#ffffff'
      }
    },
    state: {
      hover: '#f0eee8',
      active: '#edf3ff',
      selected: '#e7efff',
      disabledBackground: '#eceae4',
      disabledText: '#94a3b8',
      focusRing: '0 0 0 3px rgba(37, 87, 214, .18)'
    },
    shadow: {
      none: 'none',
      xs: '0 1px 2px rgba(22, 27, 34, .035)',
      sm: '0 1px 2px rgba(22, 27, 34, .03), 0 12px 28px rgba(22, 27, 34, .045)',
      md: '0 18px 42px rgba(22, 27, 34, .07)',
      lg: '0 24px 58px rgba(22, 27, 34, .095)',
      xl: '0 32px 82px rgba(22, 27, 34, .13)',
      floating: '0 28px 76px rgba(22, 27, 34, .15)',
      overlay: '0 36px 96px rgba(22, 27, 34, .22)'
    },
    blur: {
      none: 'none',
      sm: 'blur(6px)',
      md: 'blur(10px)',
      lg: 'blur(16px)',
      glass: 'saturate(160%) blur(14px)'
    },
    radius: {
      surface: '8px',
      control: '6px',
      modal: '8px',
      pill: '999px'
    },
    typography: {
      body: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      heading: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
    },
    motion: {
      fast: '150ms',
      normal: '190ms',
      slow: '220ms',
      surface: 'background var(--motion-fast) var(--motion-ease-standard), border-color var(--motion-fast) var(--motion-ease-standard), box-shadow var(--motion-fast) var(--motion-ease-standard), transform var(--motion-fast) var(--motion-ease-standard)',
      focus: 'border-color var(--motion-fast) var(--motion-ease-standard), box-shadow var(--motion-fast) var(--motion-ease-standard), outline-color var(--motion-fast) var(--motion-ease-standard)'
    },
    glass: {
      sidebar: {
        background: 'rgba(250, 249, 245, .92)',
        border: 'rgba(213, 206, 194, .48)',
        shadow: '0 16px 42px rgba(22, 27, 34, .055)',
        blur: 'var(--theme-blur-glass)'
      },
      topbar: {
        background: 'rgba(255, 253, 248, .92)',
        border: 'rgba(213, 206, 194, .42)',
        shadow: '0 12px 30px rgba(22, 27, 34, .05)',
        blur: 'var(--theme-blur-glass)'
      },
      card: {
        background: 'rgba(255, 253, 248, .78)',
        border: 'rgba(213, 206, 194, .38)',
        shadow: '0 18px 48px rgba(22, 27, 34, .065)',
        blur: 'var(--theme-blur-md)'
      },
      modal: {
        background: 'rgba(255, 253, 248, .96)',
        border: 'rgba(213, 206, 194, .66)',
        shadow: '0 34px 88px rgba(22, 27, 34, .20)',
        blur: 'var(--theme-blur-lg)'
      },
      drawer: {
        background: 'rgba(255, 253, 248, .92)',
        border: 'rgba(213, 206, 194, .58)',
        shadow: '0 28px 76px rgba(22, 27, 34, .16)',
        blur: 'var(--theme-blur-glass)'
      },
      dropdown: {
        background: 'rgba(255, 253, 248, .96)',
        border: 'rgba(213, 206, 194, .62)',
        shadow: '0 24px 60px rgba(22, 27, 34, .14)',
        blur: 'var(--theme-blur-md)'
      }
    },
    elevation: {
      0: {
        background: 'var(--theme-surface-0)',
        border: 'var(--theme-border-subtle)',
        shadow: 'var(--theme-shadow-none)',
        blur: 'var(--theme-blur-none)'
      },
      1: {
        background: 'var(--theme-surface-0)',
        border: 'var(--theme-border-subtle)',
        shadow: 'var(--theme-shadow-sm)',
        blur: 'var(--theme-blur-none)'
      },
      2: {
        background: 'var(--theme-surface-1)',
        border: 'var(--theme-border-default)',
        shadow: 'var(--theme-shadow-md)',
        blur: 'var(--theme-blur-sm)'
      },
      3: {
        background: 'var(--theme-surface-1)',
        border: 'var(--theme-border-default)',
        shadow: 'var(--theme-shadow-floating)',
        blur: 'var(--theme-blur-none)'
      }
    }
  },
  dark: {
    mode: 'dark',
    app: {
      bg: '#272b31',
      muted: '#30343b',
      canvas: 'linear-gradient(180deg, #343943 0%, #2c3037 48%, #262a31 100%)'
    },
    color: {
      white: '#ffffff',
      black: '#23272e'
    },
    text: {
      primary: '#f3f5f7',
      secondary: '#d8dde4',
      muted: '#a5afbd',
      mutedStrong: '#c7ced8',
      inverse: '#23272e'
    },
    icon: {
      default: '#d8dde4',
      muted: '#a5afbd',
      inverse: '#23272e'
    },
    surface: {
      0: '#2d3138',
      1: '#333841',
      2: '#3b414b',
      3: '#454c57',
      4: '#505865'
    },
    card: {
      background: 'var(--theme-surface-1)',
      raised: 'var(--theme-surface-2)'
    },
    border: {
      subtle: 'rgba(232, 236, 242, .10)',
      default: 'rgba(232, 236, 242, .16)',
      strong: 'rgba(232, 236, 242, .25)',
      focus: '#8ab4ff'
    },
    semantic: {
      primary: PREMIUM_ACCENT_PALETTES.dark.miyopBlue,
      secondary: {
        base: '#cbd5e1',
        hover: '#e2e8f0',
        soft: 'rgba(148, 163, 184, .18)',
        subtle: 'rgba(148, 163, 184, .25)',
        line: 'rgba(203, 213, 225, .38)',
        contrast: '#23272e'
      },
      success: {
        base: '#6ee7b7',
        hover: '#a7f3d0',
        soft: 'rgba(22, 163, 74, .18)',
        subtle: 'rgba(22, 163, 74, .26)',
        line: 'rgba(110, 231, 183, .42)',
        contrast: '#23272e'
      },
      warning: {
        base: '#f5c56b',
        hover: '#f8d796',
        soft: 'rgba(217, 119, 6, .18)',
        subtle: 'rgba(217, 119, 6, .26)',
        line: 'rgba(245, 197, 107, .44)',
        contrast: '#23272e'
      },
      danger: {
        base: '#ff8b8b',
        hover: '#ffb0b0',
        soft: 'rgba(220, 38, 38, .18)',
        subtle: 'rgba(220, 38, 38, .26)',
        line: 'rgba(255, 139, 139, .44)',
        contrast: '#23272e'
      },
      error: {
        base: '#ff8b8b',
        hover: '#ffb0b0',
        soft: 'rgba(220, 38, 38, .18)',
        subtle: 'rgba(220, 38, 38, .26)',
        line: 'rgba(255, 139, 139, .44)',
        contrast: '#23272e'
      },
      info: {
        base: '#93c5fd',
        hover: '#bfdbfe',
        soft: 'rgba(14, 165, 233, .18)',
        subtle: 'rgba(14, 165, 233, .26)',
        line: 'rgba(147, 197, 253, .42)',
        contrast: '#23272e'
      },
      neutral: {
        base: '#cbd5e1',
        hover: '#e2e8f0',
        soft: 'rgba(148, 163, 184, .16)',
        subtle: 'rgba(148, 163, 184, .24)',
        line: 'rgba(203, 213, 225, .34)',
        contrast: '#23272e'
      }
    },
    state: {
      hover: 'rgba(232, 236, 242, .08)',
      active: 'rgba(138, 180, 255, .16)',
      selected: 'rgba(138, 180, 255, .20)',
      disabledBackground: 'rgba(232, 236, 242, .08)',
      disabledText: '#818b99',
      focusRing: '0 0 0 3px rgba(138, 180, 255, .30)'
    },
    shadow: {
      none: 'none',
      xs: '0 1px 2px rgba(17, 21, 27, .14)',
      sm: '0 1px 2px rgba(17, 21, 27, .14), 0 12px 28px rgba(17, 21, 27, .16)',
      md: '0 18px 42px rgba(17, 21, 27, .22)',
      lg: '0 24px 58px rgba(17, 21, 27, .28)',
      xl: '0 32px 82px rgba(17, 21, 27, .34)',
      floating: '0 30px 78px rgba(17, 21, 27, .36)',
      overlay: '0 36px 96px rgba(17, 21, 27, .44)'
    },
    blur: {
      none: 'none',
      sm: 'blur(6px)',
      md: 'blur(10px)',
      lg: 'blur(16px)',
      glass: 'saturate(150%) blur(16px)'
    },
    radius: {
      surface: '8px',
      control: '6px',
      modal: '8px',
      pill: '999px'
    },
    typography: {
      body: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      heading: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
    },
    motion: {
      fast: '150ms',
      normal: '190ms',
      slow: '220ms',
      surface: 'background var(--motion-fast) var(--motion-ease-standard), border-color var(--motion-fast) var(--motion-ease-standard), box-shadow var(--motion-fast) var(--motion-ease-standard), transform var(--motion-fast) var(--motion-ease-standard)',
      focus: 'border-color var(--motion-fast) var(--motion-ease-standard), box-shadow var(--motion-fast) var(--motion-ease-standard), outline-color var(--motion-fast) var(--motion-ease-standard)'
    },
    glass: {
      sidebar: {
        background: 'rgba(51, 56, 65, .90)',
        border: 'rgba(232, 236, 242, .11)',
        shadow: '0 18px 48px rgba(17, 21, 27, .22)',
        blur: 'var(--theme-blur-glass)'
      },
      topbar: {
        background: 'rgba(51, 56, 65, .88)',
        border: 'rgba(232, 236, 242, .11)',
        shadow: '0 14px 36px rgba(17, 21, 27, .22)',
        blur: 'var(--theme-blur-glass)'
      },
      card: {
        background: 'rgba(59, 65, 75, .78)',
        border: 'rgba(232, 236, 242, .10)',
        shadow: '0 20px 54px rgba(17, 21, 27, .26)',
        blur: 'var(--theme-blur-md)'
      },
      modal: {
        background: 'rgba(51, 56, 65, .96)',
        border: 'rgba(232, 236, 242, .17)',
        shadow: '0 34px 90px rgba(17, 21, 27, .42)',
        blur: 'var(--theme-blur-lg)'
      },
      drawer: {
        background: 'rgba(51, 56, 65, .92)',
        border: 'rgba(232, 236, 242, .15)',
        shadow: '0 30px 84px rgba(17, 21, 27, .38)',
        blur: 'var(--theme-blur-glass)'
      },
      dropdown: {
        background: 'rgba(51, 56, 65, .96)',
        border: 'rgba(232, 236, 242, .17)',
        shadow: '0 26px 62px rgba(17, 21, 27, .34)',
        blur: 'var(--theme-blur-md)'
      }
    },
    elevation: {
      0: {
        background: 'var(--theme-surface-0)',
        border: 'var(--theme-border-subtle)',
        shadow: 'var(--theme-shadow-none)',
        blur: 'var(--theme-blur-none)'
      },
      1: {
        background: 'var(--theme-surface-1)',
        border: 'var(--theme-border-subtle)',
        shadow: 'var(--theme-shadow-sm)',
        blur: 'var(--theme-blur-none)'
      },
      2: {
        background: 'var(--theme-surface-2)',
        border: 'var(--theme-border-default)',
        shadow: 'var(--theme-shadow-md)',
        blur: 'var(--theme-blur-sm)'
      },
      3: {
        background: 'var(--theme-surface-2)',
        border: 'var(--theme-border-default)',
        shadow: 'var(--theme-shadow-floating)',
        blur: 'var(--theme-blur-none)'
      }
    }
  }
}
