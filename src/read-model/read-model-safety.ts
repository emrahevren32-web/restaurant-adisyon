export const resolveReadModel = <TValue>(
  factory: () => TValue,
  fallback: TValue
) => {
  try {
    return factory()
  } catch {
    return fallback
  }
}

export const resolveReadModelList = <TRecord>(
  factory: () => TRecord[]
) => resolveReadModel(factory, [])
