import type { ThemeMode } from './ThemeColors'

export type { ThemeMode } from './ThemeColors'

export type PremiumAccentName = 'blue' | 'emerald' | 'purple' | 'orange' | 'red'
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
export const DEFAULT_THEME_ACCENT: PremiumAccentName = 'blue'

export const PREMIUM_ACCENT_NAMES: PremiumAccentName[] = [
  'blue',
  'emerald',
  'purple',
  'orange',
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
      soft: '#ecfdf5',
      subtle: '#d1fae5',
      line: '#a7f3d0',
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
    orange: {
      base: '#c2410c',
      hover: '#9a3412',
      soft: '#fff7ed',
      subtle: '#ffedd5',
      line: '#fed7aa',
      contrast: '#ffffff'
    },
    red: {
      base: '#dc2626',
      hover: '#b91c1c',
      soft: '#fff5f5',
      subtle: '#fee2e2',
      line: '#fecaca',
      contrast: '#ffffff'
    }
  },
  dark: {
    blue: {
      base: '#60a5fa',
      hover: '#93c5fd',
      soft: 'rgba(37, 99, 235, .18)',
      subtle: 'rgba(37, 99, 235, .26)',
      line: 'rgba(147, 197, 253, .42)',
      contrast: '#07111f'
    },
    emerald: {
      base: '#34d399',
      hover: '#6ee7b7',
      soft: 'rgba(5, 150, 105, .18)',
      subtle: 'rgba(5, 150, 105, .26)',
      line: 'rgba(110, 231, 183, .42)',
      contrast: '#07111f'
    },
    purple: {
      base: '#a78bfa',
      hover: '#c4b5fd',
      soft: 'rgba(124, 58, 237, .20)',
      subtle: 'rgba(124, 58, 237, .28)',
      line: 'rgba(196, 181, 253, .44)',
      contrast: '#07111f'
    },
    orange: {
      base: '#fb923c',
      hover: '#fdba74',
      soft: 'rgba(234, 88, 12, .18)',
      subtle: 'rgba(234, 88, 12, .26)',
      line: 'rgba(253, 186, 116, .44)',
      contrast: '#07111f'
    },
    red: {
      base: '#f87171',
      hover: '#fca5a5',
      soft: 'rgba(220, 38, 38, .18)',
      subtle: 'rgba(220, 38, 38, .26)',
      line: 'rgba(252, 165, 165, .44)',
      contrast: '#07111f'
    }
  }
}

export const PREMIUM_THEME_TOKENS: Record<ThemeMode, PremiumThemeTokens> = {
  light: {
    mode: 'light',
    app: {
      bg: '#f5f7fb',
      muted: '#eef2f7',
      canvas: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 48%, #edf2f7 100%)'
    },
    color: {
      white: '#ffffff',
      black: '#111827'
    },
    text: {
      primary: '#111827',
      secondary: '#334155',
      muted: '#64748b',
      mutedStrong: '#475569',
      inverse: '#ffffff'
    },
    icon: {
      default: '#334155',
      muted: '#64748b',
      inverse: '#ffffff'
    },
    surface: {
      0: '#ffffff',
      1: '#fbfdff',
      2: '#f8fafc',
      3: '#f1f5f9',
      4: '#e2e8f0'
    },
    card: {
      background: 'var(--theme-surface-0)',
      raised: 'var(--theme-surface-1)'
    },
    border: {
      subtle: '#e9eef6',
      default: '#dbe3ee',
      strong: '#b9c6d8',
      focus: '#2563eb'
    },
    semantic: {
      primary: PREMIUM_ACCENT_PALETTES.light.blue,
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
      hover: '#f8fafc',
      active: '#eff6ff',
      selected: '#eff6ff',
      disabledBackground: '#eef2f7',
      disabledText: '#94a3b8',
      focusRing: '0 0 0 3px rgba(37, 99, 235, .18)'
    },
    shadow: {
      none: 'none',
      xs: '0 1px 2px rgba(15, 23, 42, .05)',
      sm: '0 1px 2px rgba(15, 23, 42, .05), 0 8px 22px rgba(15, 23, 42, .04)',
      md: '0 12px 32px rgba(15, 23, 42, .08)',
      lg: '0 18px 44px rgba(15, 23, 42, .12)',
      xl: '0 24px 70px rgba(15, 23, 42, .18)',
      floating: '0 24px 64px rgba(15, 23, 42, .20)',
      overlay: '0 28px 80px rgba(15, 23, 42, .24)'
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
      fast: '140ms',
      normal: '220ms',
      slow: '360ms',
      surface: 'background var(--motion-fast) var(--motion-ease-standard), border-color var(--motion-fast) var(--motion-ease-standard), box-shadow var(--motion-fast) var(--motion-ease-standard), transform var(--motion-fast) var(--motion-ease-standard)',
      focus: 'border-color var(--motion-fast) var(--motion-ease-standard), box-shadow var(--motion-fast) var(--motion-ease-standard), outline-color var(--motion-fast) var(--motion-ease-standard)'
    },
    glass: {
      sidebar: {
        background: 'rgba(255, 255, 255, .86)',
        border: 'rgba(219, 227, 238, .88)',
        shadow: '0 18px 46px rgba(15, 23, 42, .08)',
        blur: 'var(--theme-blur-glass)'
      },
      topbar: {
        background: 'rgba(255, 255, 255, .90)',
        border: 'rgba(219, 227, 238, .92)',
        shadow: '0 12px 30px rgba(15, 23, 42, .07)',
        blur: 'var(--theme-blur-glass)'
      },
      card: {
        background: 'rgba(255, 255, 255, .78)',
        border: 'rgba(219, 227, 238, .72)',
        shadow: '0 16px 42px rgba(15, 23, 42, .08)',
        blur: 'var(--theme-blur-md)'
      },
      modal: {
        background: 'rgba(255, 255, 255, .94)',
        border: 'rgba(219, 227, 238, .94)',
        shadow: '0 28px 80px rgba(15, 23, 42, .22)',
        blur: 'var(--theme-blur-lg)'
      },
      drawer: {
        background: 'rgba(255, 255, 255, .92)',
        border: 'rgba(219, 227, 238, .88)',
        shadow: '0 24px 70px rgba(15, 23, 42, .18)',
        blur: 'var(--theme-blur-glass)'
      },
      dropdown: {
        background: 'rgba(255, 255, 255, .96)',
        border: 'rgba(219, 227, 238, .94)',
        shadow: '0 22px 54px rgba(15, 23, 42, .16)',
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
        background: 'var(--theme-glass-card-background)',
        border: 'var(--theme-glass-card-border)',
        shadow: 'var(--theme-shadow-floating)',
        blur: 'var(--theme-blur-glass)'
      }
    }
  },
  dark: {
    mode: 'dark',
    app: {
      bg: '#0b1220',
      muted: '#0f172a',
      canvas: 'linear-gradient(180deg, #07111f 0%, #0b1220 54%, #111827 100%)'
    },
    color: {
      white: '#ffffff',
      black: '#07111f'
    },
    text: {
      primary: '#f8fafc',
      secondary: '#dbe7f5',
      muted: '#94a3b8',
      mutedStrong: '#cbd5e1',
      inverse: '#07111f'
    },
    icon: {
      default: '#dbe7f5',
      muted: '#94a3b8',
      inverse: '#07111f'
    },
    surface: {
      0: '#0f172a',
      1: '#111c2e',
      2: '#17233a',
      3: '#1f2d46',
      4: '#2a3a56'
    },
    card: {
      background: 'var(--theme-surface-1)',
      raised: 'var(--theme-surface-2)'
    },
    border: {
      subtle: 'rgba(148, 163, 184, .18)',
      default: 'rgba(148, 163, 184, .28)',
      strong: 'rgba(203, 213, 225, .38)',
      focus: '#60a5fa'
    },
    semantic: {
      primary: PREMIUM_ACCENT_PALETTES.dark.blue,
      secondary: {
        base: '#a78bfa',
        hover: '#c4b5fd',
        soft: 'rgba(124, 58, 237, .20)',
        subtle: 'rgba(124, 58, 237, .28)',
        line: 'rgba(196, 181, 253, .44)',
        contrast: '#07111f'
      },
      success: {
        base: '#4ade80',
        hover: '#86efac',
        soft: 'rgba(22, 163, 74, .18)',
        subtle: 'rgba(22, 163, 74, .26)',
        line: 'rgba(134, 239, 172, .42)',
        contrast: '#07111f'
      },
      warning: {
        base: '#fbbf24',
        hover: '#fcd34d',
        soft: 'rgba(217, 119, 6, .18)',
        subtle: 'rgba(217, 119, 6, .26)',
        line: 'rgba(252, 211, 77, .44)',
        contrast: '#07111f'
      },
      danger: {
        base: '#f87171',
        hover: '#fca5a5',
        soft: 'rgba(220, 38, 38, .18)',
        subtle: 'rgba(220, 38, 38, .26)',
        line: 'rgba(252, 165, 165, .44)',
        contrast: '#07111f'
      },
      error: {
        base: '#f87171',
        hover: '#fca5a5',
        soft: 'rgba(220, 38, 38, .18)',
        subtle: 'rgba(220, 38, 38, .26)',
        line: 'rgba(252, 165, 165, .44)',
        contrast: '#07111f'
      },
      info: {
        base: '#38bdf8',
        hover: '#7dd3fc',
        soft: 'rgba(14, 165, 233, .18)',
        subtle: 'rgba(14, 165, 233, .26)',
        line: 'rgba(125, 211, 252, .42)',
        contrast: '#07111f'
      },
      neutral: {
        base: '#cbd5e1',
        hover: '#e2e8f0',
        soft: 'rgba(148, 163, 184, .16)',
        subtle: 'rgba(148, 163, 184, .24)',
        line: 'rgba(203, 213, 225, .34)',
        contrast: '#07111f'
      }
    },
    state: {
      hover: 'rgba(148, 163, 184, .12)',
      active: 'rgba(96, 165, 250, .16)',
      selected: 'rgba(96, 165, 250, .20)',
      disabledBackground: 'rgba(148, 163, 184, .12)',
      disabledText: '#64748b',
      focusRing: '0 0 0 3px rgba(96, 165, 250, .32)'
    },
    shadow: {
      none: 'none',
      xs: '0 1px 2px rgba(0, 0, 0, .28)',
      sm: '0 1px 2px rgba(0, 0, 0, .30), 0 8px 22px rgba(0, 0, 0, .24)',
      md: '0 14px 34px rgba(0, 0, 0, .36)',
      lg: '0 20px 48px rgba(0, 0, 0, .44)',
      xl: '0 28px 76px rgba(0, 0, 0, .54)',
      floating: '0 28px 70px rgba(0, 0, 0, .52)',
      overlay: '0 34px 90px rgba(0, 0, 0, .64)'
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
      fast: '140ms',
      normal: '220ms',
      slow: '360ms',
      surface: 'background var(--motion-fast) var(--motion-ease-standard), border-color var(--motion-fast) var(--motion-ease-standard), box-shadow var(--motion-fast) var(--motion-ease-standard), transform var(--motion-fast) var(--motion-ease-standard)',
      focus: 'border-color var(--motion-fast) var(--motion-ease-standard), box-shadow var(--motion-fast) var(--motion-ease-standard), outline-color var(--motion-fast) var(--motion-ease-standard)'
    },
    glass: {
      sidebar: {
        background: 'rgba(15, 23, 42, .82)',
        border: 'rgba(148, 163, 184, .24)',
        shadow: '0 22px 58px rgba(0, 0, 0, .36)',
        blur: 'var(--theme-blur-glass)'
      },
      topbar: {
        background: 'rgba(15, 23, 42, .78)',
        border: 'rgba(148, 163, 184, .26)',
        shadow: '0 16px 38px rgba(0, 0, 0, .34)',
        blur: 'var(--theme-blur-glass)'
      },
      card: {
        background: 'rgba(17, 28, 46, .74)',
        border: 'rgba(148, 163, 184, .24)',
        shadow: '0 18px 48px rgba(0, 0, 0, .34)',
        blur: 'var(--theme-blur-md)'
      },
      modal: {
        background: 'rgba(17, 28, 46, .94)',
        border: 'rgba(203, 213, 225, .28)',
        shadow: '0 34px 90px rgba(0, 0, 0, .62)',
        blur: 'var(--theme-blur-lg)'
      },
      drawer: {
        background: 'rgba(15, 23, 42, .92)',
        border: 'rgba(148, 163, 184, .28)',
        shadow: '0 28px 80px rgba(0, 0, 0, .54)',
        blur: 'var(--theme-blur-glass)'
      },
      dropdown: {
        background: 'rgba(17, 28, 46, .96)',
        border: 'rgba(203, 213, 225, .30)',
        shadow: '0 26px 62px rgba(0, 0, 0, .52)',
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
        background: 'var(--theme-glass-card-background)',
        border: 'var(--theme-glass-card-border)',
        shadow: 'var(--theme-shadow-floating)',
        blur: 'var(--theme-blur-glass)'
      }
    }
  }
}
