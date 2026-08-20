import { toBasisPoints, toInteger } from './money.js'
import { normalizeCode, toDate, toRelationID, toRelationIDs } from './normalize.js'
import type { CouponScope, CouponType, NormalizedCoupon } from './types.js'

const amountsRecord = (value: unknown): Record<string, number> => {
  if (!Array.isArray(value)) {
    return {}
  }

  const record: Record<string, number> = {}

  for (const entry of value) {
    if (!entry || typeof entry !== 'object') {
      continue
    }

    const { amount, currency } = entry as { amount?: unknown; currency?: unknown }
    const code = typeof currency === 'string' ? currency.trim().toUpperCase() : ''
    const minor = toInteger(amount)

    if (code === '' || minor === null || minor < 0 || code in record) {
      continue
    }

    record[code] = minor
  }

  return record
}

const limit = (value: unknown): null | number => {
  const whole = toInteger(value)

  return whole !== null && whole > 0 ? whole : null
}

const scope = (value: unknown): CouponScope =>
  value === 'products' || value === 'categories' ? value : 'cart'

const kind = (value: unknown): CouponType => (value === 'fixed' ? 'fixed' : 'percentage')

export const normalizeCoupon = (doc: unknown): null | NormalizedCoupon => {
  if (!doc || typeof doc !== 'object') {
    return null
  }

  const raw = doc as Record<string, unknown>
  const code = normalizeCode(raw.code)
  const id = toRelationID(raw.id)

  if (code === '' || id === '') {
    return null
  }

  return {
    amounts: amountsRecord(raw.amounts),
    appliesTo: scope(raw.appliesTo),
    basisPoints: toBasisPoints(raw.percentage),
    categories: toRelationIDs(raw.categories),
    code,
    enabled: raw.enabled !== false,
    excludedCategories: toRelationIDs(raw.excludedCategories),
    excludedProducts: toRelationIDs(raw.excludedProducts),
    freeShipping: raw.freeShipping === true,
    id,
    maximumAmounts: amountsRecord(raw.maximumAmounts),
    maxUses: limit(raw.maxUses),
    maxUsesPerCustomer: limit(raw.maxUsesPerCustomer),
    minimumAmounts: amountsRecord(raw.minimumAmounts),
    products: toRelationIDs(raw.products),
    type: kind(raw.type),
    validFrom: toDate(raw.validFrom),
    validUntil: toDate(raw.validUntil),
  }
}
