import type { ThemeMode } from './ThemeColors'

export type { ThemeMode } from './ThemeColors'

export type PremiumAccentName =
  | 'miyopBlue'
  | 'softGreen'
  | 'blue'
  | 'indigo'
  | 'purple'
  | 'emerald'
  | 'teal'
  | 'orange'
  | 'rose'
  | 'slate'
  | 'graphite'
  | 'red'
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
  'softGreen',
  'blue',
  'indigo',
  'purple',
  'emerald',
  'teal',
  'orange',
  'rose',
  'slate',
  'graphite',
  'red'
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
      base: '#1f5eff',
      hover: '#174ad6',
      soft: '#eef4ff',
      subtle: '#dce8ff',
      line: '#b9cdfd',
      contrast: '#ffffff'
    },
    softGreen: {
      base: '#2f7a5f',
      hover: '#255f4b',
      soft: '#f0f8f2',
      subtle: '#def0e5',
      line: '#b9dfc8',
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
    indigo: {
      base: '#4f46e5',
      hover: '#4338ca',
      soft: '#eef2ff',
      subtle: '#e0e7ff',
      line: '#c7d2fe',
      contrast: '#ffffff'
    },
    purple: {
      base: '#7c3aed',
      hover: '#6d28d9',
      soft: '#f5f3ff',
      subtle: '#ede9fe',
      line: '#c4b5fd',
      contrast: '#ffffff'
    },
    emerald: {
      base: '#047857',
      hover: '#065f46',
      soft: '#ecfdf5',
      subtle: '#d1fae5',
      line: '#a7f3d0',
      contrast: '#ffffff'
    },
    teal: {
      base: '#0f766e',
      hover: '#115e59',
      soft: '#f0fdfa',
      subtle: '#ccfbf1',
      line: '#99f6e4',
      contrast: '#ffffff'
    },
    orange: {
      base: '#c2410c',
      hover: '#9a3412',
      soft: '#fff7ed',
      subtle: '#ffedd5',
      line: '#fed7aa',
      contrast: '#ffffff'
    },
    rose: {
      base: '#be123c',
      hover: '#9f1239',
      soft: '#fff1f2',
      subtle: '#ffe4e6',
      line: '#fecdd3',
      contrast: '#ffffff'
    },
    slate: {
      base: '#475569',
      hover: '#334155',
      soft: '#f8fafc',
      subtle: '#f1f5f9',
      line: '#cbd5e1',
      contrast: '#ffffff'
    },
    graphite: {
      base: '#374151',
      hover: '#1f2937',
      soft: '#f7f7f8',
      subtle: '#eceef1',
      line: '#c8cdd4',
      contrast: '#ffffff'
    },
    red: {
      base: '#be123c',
      hover: '#9f1239',
      soft: '#fff1f2',
      subtle: '#ffe4e6',
      line: '#fecdd3',
      contrast: '#ffffff'
    }
  },
  dark: {
    miyopBlue: {
      base: '#7aa7ff',
      hover: '#a7c4ff',
      soft: 'rgba(74, 116, 255, .18)',
      subtle: 'rgba(74, 116, 255, .25)',
      line: 'rgba(154, 183, 255, .40)',
      contrast: '#111827'
    },
    softGreen: {
      base: '#8fd9ad',
      hover: '#b6eac9',
      soft: 'rgba(78, 160, 108, .18)',
      subtle: 'rgba(78, 160, 108, .25)',
      line: 'rgba(182, 234, 201, .38)',
      contrast: '#111827'
    },
    blue: {
      base: '#60a5fa',
      hover: '#93c5fd',
      soft: 'rgba(37, 99, 235, .18)',
      subtle: 'rgba(37, 99, 235, .25)',
      line: 'rgba(147, 197, 253, .38)',
      contrast: '#111827'
    },
    indigo: {
      base: '#818cf8',
      hover: '#a5b4fc',
      soft: 'rgba(99, 102, 241, .18)',
      subtle: 'rgba(99, 102, 241, .25)',
      line: 'rgba(165, 180, 252, .40)',
      contrast: '#111827'
    },
    purple: {
      base: '#c084fc',
      hover: '#d8b4fe',
      soft: 'rgba(147, 51, 234, .18)',
      subtle: 'rgba(147, 51, 234, .25)',
      line: 'rgba(216, 180, 254, .38)',
      contrast: '#111827'
    },
    emerald: {
      base: '#34d399',
      hover: '#6ee7b7',
      soft: 'rgba(16, 185, 129, .18)',
      subtle: 'rgba(16, 185, 129, .25)',
      line: 'rgba(110, 231, 183, .38)',
      contrast: '#111827'
    },
    teal: {
      base: '#2dd4bf',
      hover: '#5eead4',
      soft: 'rgba(20, 184, 166, .18)',
      subtle: 'rgba(20, 184, 166, .25)',
      line: 'rgba(94, 234, 212, .38)',
      contrast: '#111827'
    },
    orange: {
      base: '#fb923c',
      hover: '#fdba74',
      soft: 'rgba(249, 115, 22, .18)',
      subtle: 'rgba(249, 115, 22, .25)',
      line: 'rgba(253, 186, 116, .38)',
      contrast: '#111827'
    },
    rose: {
      base: '#fb7185',
      hover: '#fda4af',
      soft: 'rgba(244, 63, 94, .18)',
      subtle: 'rgba(244, 63, 94, .25)',
      line: 'rgba(253, 164, 175, .38)',
      contrast: '#111827'
    },
    slate: {
      base: '#cbd5e1',
      hover: '#e2e8f0',
      soft: 'rgba(148, 163, 184, .18)',
      subtle: 'rgba(148, 163, 184, .25)',
      line: 'rgba(203, 213, 225, .36)',
      contrast: '#111827'
    },
    graphite: {
      base: '#d1d5db',
      hover: '#f3f4f6',
      soft: 'rgba(156, 163, 175, .18)',
      subtle: 'rgba(156, 163, 175, .25)',
      line: 'rgba(209, 213, 219, .36)',
      contrast: '#111827'
    },
    red: {
      base: '#fb7185',
      hover: '#fda4af',
      soft: 'rgba(244, 63, 94, .18)',
      subtle: 'rgba(244, 63, 94, .25)',
      line: 'rgba(253, 164, 175, .38)',
      contrast: '#111827'
    }
  }
}

export const PREMIUM_THEME_TOKENS: Record<ThemeMode, PremiumThemeTokens> = {
  light: {
    mode: 'light',
    app: {
      bg: '#f4f6f1',
      muted: '#edf2eb',
      canvas: 'linear-gradient(180deg, #fbfaf6 0%, #f3f6f1 45%, #edf1e9 100%)'
    },
    color: {
      white: '#fffdf8',
      black: '#111827'
    },
    text: {
      primary: '#0f172a',
      secondary: '#26364a',
      muted: '#66758a',
      mutedStrong: '#3f5066',
      inverse: '#ffffff'
    },
    icon: {
      default: '#334155',
      muted: '#64748b',
      inverse: '#ffffff'
    },
    surface: {
      0: '#fffdf8',
      1: '#fafaf4',
      2: '#f2f5ef',
      3: '#e9eee6',
      4: '#dbe3d8'
    },
    card: {
      background: 'var(--theme-surface-0)',
      raised: 'var(--theme-surface-1)'
    },
    border: {
      subtle: '#e3e7dc',
      default: '#d3dbcf',
      strong: '#b8c4b6',
      focus: '#1f5eff'
    },
    semantic: {
      primary: PREMIUM_ACCENT_PALETTES.light.miyopBlue,
      secondary: {
        base: '#7c3aed',
        hover: '#6d28d9',
        soft: '#f5f3ff',
        subtle: '#ede9fe',
        line: '#c4b5fd',
        contrast: '#ffffff'
      },
      success: {
        base: '#15803d',
        hover: '#166534',
        soft: '#ecfdf3',
        subtle: '#dcfce7',
        line: '#bbf7d0',
        contrast: '#ffffff'
      },
      warning: {
        base: '#92400e',
        hover: '#78350f',
        soft: '#fffbeb',
        subtle: '#fef3c7',
        line: '#fde68a',
        contrast: '#ffffff'
      },
      danger: {
        base: '#b42318',
        hover: '#991b1b',
        soft: '#fff5f5',
        subtle: '#fee2e2',
        line: '#fecaca',
        contrast: '#ffffff'
      },
      error: {
        base: '#b42318',
        hover: '#991b1b',
        soft: '#fff5f5',
        subtle: '#fee2e2',
        line: '#fecaca',
        contrast: '#ffffff'
      },
      info: {
        base: '#0284c7',
        hover: '#0369a1',
        soft: '#f0f9ff',
        subtle: '#e0f2fe',
        line: '#bae6fd',
        contrast: '#ffffff'
      },
      neutral: {
        base: '#475569',
        hover: '#334155',
        soft: '#f8fafc',
        subtle: '#f1f5f9',
        line: '#dbe3ee',
        contrast: '#ffffff'
      }
    },
    state: {
      hover: '#f7f8f4',
      active: '#eef4ff',
      selected: '#e8f0ff',
      disabledBackground: '#edf2eb',
      disabledText: '#94a3b8',
      focusRing: '0 0 0 3px rgba(31, 94, 255, .18)'
    },
    shadow: {
      none: 'none',
      xs: '0 1px 2px rgba(30, 41, 59, .04)',
      sm: '0 1px 2px rgba(30, 41, 59, .035), 0 12px 28px rgba(30, 41, 59, .045)',
      md: '0 18px 42px rgba(30, 41, 59, .075)',
      lg: '0 24px 58px rgba(30, 41, 59, .105)',
      xl: '0 32px 82px rgba(30, 41, 59, .14)',
      floating: '0 28px 76px rgba(30, 41, 59, .16)',
      overlay: '0 36px 96px rgba(30, 41, 59, .22)'
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
        background: 'rgba(250, 250, 244, .88)',
        border: 'rgba(211, 219, 207, .52)',
        shadow: '0 16px 42px rgba(30, 41, 59, .06)',
        blur: 'var(--theme-blur-glass)'
      },
      topbar: {
        background: 'rgba(255, 253, 248, .90)',
        border: 'rgba(211, 219, 207, .48)',
        shadow: '0 12px 30px rgba(30, 41, 59, .055)',
        blur: 'var(--theme-blur-glass)'
      },
      card: {
        background: 'rgba(255, 253, 248, .78)',
        border: 'rgba(211, 219, 207, .44)',
        shadow: '0 18px 48px rgba(30, 41, 59, .07)',
        blur: 'var(--theme-blur-md)'
      },
      modal: {
        background: 'rgba(255, 253, 248, .96)',
        border: 'rgba(211, 219, 207, .72)',
        shadow: '0 34px 88px rgba(30, 41, 59, .20)',
        blur: 'var(--theme-blur-lg)'
      },
      drawer: {
        background: 'rgba(255, 253, 248, .92)',
        border: 'rgba(211, 219, 207, .66)',
        shadow: '0 28px 76px rgba(30, 41, 59, .16)',
        blur: 'var(--theme-blur-glass)'
      },
      dropdown: {
        background: 'rgba(255, 253, 248, .96)',
        border: 'rgba(211, 219, 207, .70)',
        shadow: '0 24px 60px rgba(30, 41, 59, .14)',
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
      bg: '#24282f',
      muted: '#2a3037',
      canvas: 'linear-gradient(180deg, #303640 0%, #262c34 48%, #222830 100%)'
    },
    color: {
      white: '#ffffff',
      black: '#24282f'
    },
    text: {
      primary: '#f5f7fa',
      secondary: '#d7dde6',
      muted: '#9aa4b2',
      mutedStrong: '#c5cbd5',
      inverse: '#20242b'
    },
    icon: {
      default: '#d7dde6',
      muted: '#9aa4b2',
      inverse: '#20242b'
    },
    surface: {
      0: '#292f37',
      1: '#303740',
      2: '#38414c',
      3: '#424c58',
      4: '#505b68'
    },
    card: {
      background: 'var(--theme-surface-1)',
      raised: 'var(--theme-surface-2)'
    },
    border: {
      subtle: 'rgba(226, 232, 240, .10)',
      default: 'rgba(226, 232, 240, .16)',
      strong: 'rgba(226, 232, 240, .26)',
      focus: '#8fb5ff'
    },
    semantic: {
      primary: PREMIUM_ACCENT_PALETTES.dark.miyopBlue,
      secondary: {
        base: '#a78bfa',
        hover: '#c4b5fd',
        soft: 'rgba(124, 58, 237, .20)',
        subtle: 'rgba(124, 58, 237, .28)',
        line: 'rgba(196, 181, 253, .44)',
        contrast: '#111827'
      },
      success: {
        base: '#4ade80',
        hover: '#86efac',
        soft: 'rgba(22, 163, 74, .18)',
        subtle: 'rgba(22, 163, 74, .26)',
        line: 'rgba(134, 239, 172, .42)',
        contrast: '#111827'
      },
      warning: {
        base: '#fbbf24',
        hover: '#fcd34d',
        soft: 'rgba(217, 119, 6, .18)',
        subtle: 'rgba(217, 119, 6, .26)',
        line: 'rgba(252, 211, 77, .44)',
        contrast: '#111827'
      },
      danger: {
        base: '#f87171',
        hover: '#fca5a5',
        soft: 'rgba(220, 38, 38, .18)',
        subtle: 'rgba(220, 38, 38, .26)',
        line: 'rgba(252, 165, 165, .44)',
        contrast: '#111827'
      },
      error: {
        base: '#f87171',
        hover: '#fca5a5',
        soft: 'rgba(220, 38, 38, .18)',
        subtle: 'rgba(220, 38, 38, .26)',
        line: 'rgba(252, 165, 165, .44)',
        contrast: '#111827'
      },
      info: {
        base: '#38bdf8',
        hover: '#7dd3fc',
        soft: 'rgba(14, 165, 233, .18)',
        subtle: 'rgba(14, 165, 233, .26)',
        line: 'rgba(125, 211, 252, .42)',
        contrast: '#111827'
      },
      neutral: {
        base: '#cbd5e1',
        hover: '#e2e8f0',
        soft: 'rgba(148, 163, 184, .16)',
        subtle: 'rgba(148, 163, 184, .24)',
        line: 'rgba(203, 213, 225, .34)',
        contrast: '#111827'
      }
    },
    state: {
      hover: 'rgba(226, 232, 240, .09)',
      active: 'rgba(122, 167, 255, .16)',
      selected: 'rgba(122, 167, 255, .20)',
      disabledBackground: 'rgba(226, 232, 240, .08)',
      disabledText: '#7f8a99',
      focusRing: '0 0 0 3px rgba(122, 167, 255, .30)'
    },
    shadow: {
      none: 'none',
      xs: '0 1px 2px rgba(7, 12, 18, .14)',
      sm: '0 1px 2px rgba(7, 12, 18, .14), 0 12px 28px rgba(7, 12, 18, .15)',
      md: '0 18px 42px rgba(7, 12, 18, .20)',
      lg: '0 24px 58px rgba(7, 12, 18, .26)',
      xl: '0 32px 82px rgba(7, 12, 18, .32)',
      floating: '0 30px 78px rgba(7, 12, 18, .34)',
      overlay: '0 36px 96px rgba(7, 12, 18, .42)'
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
        background: 'rgba(48, 55, 64, .88)',
        border: 'rgba(226, 232, 240, .12)',
        shadow: '0 18px 48px rgba(7, 12, 18, .20)',
        blur: 'var(--theme-blur-glass)'
      },
      topbar: {
        background: 'rgba(48, 55, 64, .86)',
        border: 'rgba(226, 232, 240, .12)',
        shadow: '0 14px 36px rgba(7, 12, 18, .20)',
        blur: 'var(--theme-blur-glass)'
      },
      card: {
        background: 'rgba(56, 65, 76, .80)',
        border: 'rgba(226, 232, 240, .11)',
        shadow: '0 20px 54px rgba(7, 12, 18, .24)',
        blur: 'var(--theme-blur-md)'
      },
      modal: {
        background: 'rgba(48, 55, 64, .96)',
        border: 'rgba(226, 232, 240, .18)',
        shadow: '0 34px 90px rgba(7, 12, 18, .40)',
        blur: 'var(--theme-blur-lg)'
      },
      drawer: {
        background: 'rgba(48, 55, 64, .92)',
        border: 'rgba(226, 232, 240, .16)',
        shadow: '0 30px 84px rgba(7, 12, 18, .36)',
        blur: 'var(--theme-blur-glass)'
      },
      dropdown: {
        background: 'rgba(48, 55, 64, .96)',
        border: 'rgba(226, 232, 240, .18)',
        shadow: '0 26px 62px rgba(7, 12, 18, .32)',
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
