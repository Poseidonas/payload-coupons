export const normalizeCode = (value: unknown): string =>
  typeof value === 'string' ? value.trim().toUpperCase() : ''

export const toRelationID = (value: unknown): string => {
  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number') {
    return String(value)
  }

  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id

    if (typeof id === 'string' || typeof id === 'number') {
      return String(id)
    }
  }

  return ''
}

export const toRelationIDs = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    const single = toRelationID(value)

    return single ? [single] : []
  }

  return value.map(toRelationID).filter((id) => id !== '')
}

export const toDate = (value: unknown): Date | null => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value)

    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  return null
}
