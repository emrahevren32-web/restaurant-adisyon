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

/* TEK TİP KÖŞE KARARI (Emrah · 2026-10-03)
   ---------------------------------------------------------------------------
   Ekrandaki YATAY DİKDÖRTGEN her kutu tek bir yarıcapta: 4px.
   Kart, panel, buton, girdi, arama kutusu, sekme, rozet, açılır menü, tablo,
   modal, bildirim — hepsi aynı. Ne keskin köşe (0) ne hap (999px); ikisi de
   aynı ekranda yan yana durunca dağınık görünüyordu.

   Jeton adları (xs…xxl, full) SİLİNMEDİ; yüzlerce yerde kullanılıyorlar ve
   hepsi aynı değere bakıyor. Ölçüyü değiştirmek isteyen TEK yeri burası:
   aşağıdaki KUTU_YARICAPI.

   Tek istisna `circle`: avatar ve durum noktası gibi GERÇEK daireler.
   Onlar dikdörtgen değil, bu yüzden tek tip kuralının dışında. */
const KUTU_YARICAPI = '4px'

export const BORDER_RADIUS_TOKENS: BorderRadiusTokenMap = {
  none: '0',
  xs: KUTU_YARICAPI,
  sm: KUTU_YARICAPI,
  md: KUTU_YARICAPI,
  lg: KUTU_YARICAPI,
  xl: KUTU_YARICAPI,
  xxl: KUTU_YARICAPI,
  full: KUTU_YARICAPI,
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
