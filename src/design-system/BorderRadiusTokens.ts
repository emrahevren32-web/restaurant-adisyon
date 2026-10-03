export type BorderRadiusTokenName =
  | 'none'
  | 'xs'
  | 'sm'
  | 'md'
  | 'lg'
  | 'xl'
  | 'xxl'
  | 'full'
  | 'circle'

export const BORDER_RADIUS_TOKEN_NAMES: BorderRadiusTokenName[] = [
  'none',
  'xs',
  'sm',
  'md',
  'lg',
  'xl',
  'xxl',
  'full',
  'circle'
]

export type BorderRadiusTokenMap = Record<BorderRadiusTokenName, string>

/* KESKİN KÖŞE KARARI (Emrah · 2026-10-03)
   ---------------------------------------------------------------------------
   Dörtgen yüzeylerin köşeleri yuvarlanmıyor: kart, panel, buton, girdi,
   tablo, modal — hepsi 0. Bu yüzden xs…xxl jetonlarının tamamı '0'.
   Jetonlar SİLİNMEDİ; adları yüzlerce yerde kullanılıyor ve bir gün
   yuvarlaklık geri istenirse tek dosyadan geri gelsin diye duruyorlar.

   İki istisna bilerek korundu:
     full   → hap biçimli rozetler (dörtgen değil, uçları yarım daire)
     circle → gerçek daireler (avatar, durum noktası)
   Bunlar "yuvarlatılmış kare" değil, baştan yuvarlak biçimler. */
export const BORDER_RADIUS_TOKENS: BorderRadiusTokenMap = {
  none: '0',
  xs: '0',
  sm: '0',
  md: '0',
  lg: '0',
  xl: '0',
  xxl: '0',
  full: '999px',
  circle: '50%'
}

export const getBorderRadiusToken = (token: BorderRadiusTokenName) => (
  BORDER_RADIUS_TOKENS[token]
)

export const getBorderRadiusVariable = (token: BorderRadiusTokenName) => (
  `var(--radius-${token})`
)

export const createBorderRadiusTokenCssVariables = () => (
  BORDER_RADIUS_TOKEN_NAMES
    .map(token => `--radius-${token}:${BORDER_RADIUS_TOKENS[token]};`)
    .join('')
)
