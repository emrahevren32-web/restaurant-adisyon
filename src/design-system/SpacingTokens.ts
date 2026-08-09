export type SpacingToken =
  | '0'
  | '2'
  | '4'
  | '8'
  | '12'
  | '16'
  | '20'
  | '24'
  | '32'
  | '40'
  | '48'
  | '56'
  | '64'
  | '80'
  | '96'
  | '128'

export const SPACING_TOKEN_KEYS: SpacingToken[] = [
  '0',
  '2',
  '4',
  '8',
  '12',
  '16',
  '20',
  '24',
  '32',
  '40',
  '48',
  '56',
  '64',
  '80',
  '96',
  '128'
]

export const SPACING_TOKENS: Record<SpacingToken, string> = {
  0: '0',
  2: '2px',
  4: '4px',
  8: '8px',
  12: '12px',
  16: '16px',
  20: '20px',
  24: '24px',
  32: '32px',
  40: '40px',
  48: '48px',
  56: '56px',
  64: '64px',
  80: '80px',
  96: '96px',
  128: '128px'
}

export const getSpacingToken = (token: SpacingToken) => SPACING_TOKENS[token]

export const getSpacingVariable = (token: SpacingToken) => `var(--space-${token})`

const tokenNumbers = SPACING_TOKEN_KEYS.map(token => Number(token))

export const resolveNearestSpacingToken = (value: number): SpacingToken => {
  const absoluteValue = Math.abs(value)
  const nearest = tokenNumbers.reduce((current, candidate) => (
    Math.abs(candidate - absoluteValue) < Math.abs(current - absoluteValue) ? candidate : current
  ), tokenNumbers[0])

  return String(nearest) as SpacingToken
}

export const createSpacingTokenCssVariables = () => (
  SPACING_TOKEN_KEYS
    .map(token => `--space-${token}:${SPACING_TOKENS[token]};`)
    .join('')
)
