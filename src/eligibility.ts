import type { RefusalReason } from './reasons.js'
import type { CartLine, NormalizedCoupon } from './types.js'

export type EvaluationContext = {
  basis: number
  currency: string
  customer: string
  customerUses: number
  lines: CartLine[]
  now: Date
  uses: number
}

const intersects = (left: string[], right: string[]): boolean =>
  left.some((entry) => right.includes(entry))

const inScope = (coupon: NormalizedCoupon, line: CartLine): boolean => {
  if (coupon.appliesTo === 'products') {
    return coupon.products.includes(line.product)
  }

  if (coupon.appliesTo === 'categories') {
    return intersects(line.categories, coupon.categories)
  }

  return true
}

const excluded = (coupon: NormalizedCoupon, line: CartLine): boolean =>
  coupon.excludedProducts.includes(line.product) ||
  intersects(line.categories, coupon.excludedCategories)

export const selectEligibleLines = (
  coupon: NormalizedCoupon,
  lines: CartLine[],
): CartLine[] =>
  lines.filter((line) => line.amount > 0 && inScope(coupon, line) && !excluded(coupon, line))

/**
 * Runs the conditions that need no cart lines, so that a code can be refused
 * before any price is read.
 */
export const checkCouponBasics = (
  coupon: NormalizedCoupon,
  args: { currency: string; now: Date },
): null | RefusalReason => {
  if (!coupon.enabled) {
    return 'DISABLED'
  }

  if (coupon.validFrom && args.now.getTime() < coupon.validFrom.getTime()) {
    return 'NOT_STARTED'
  }

  if (coupon.validUntil && args.now.getTime() > coupon.validUntil.getTime()) {
    return 'EXPIRED'
  }

  if (coupon.type === 'fixed' && typeof coupon.amounts[args.currency] !== 'number') {
    return 'CURRENCY_NOT_SUPPORTED'
  }

  return null
}

/**
 * Runs every condition in a fixed order and returns the first reason the coupon
 * is refused, or null when it may be applied.
 */
export const checkCoupon = (
  coupon: NormalizedCoupon,
  context: EvaluationContext,
): null | RefusalReason => {
  const basics = checkCouponBasics(coupon, { currency: context.currency, now: context.now })

  if (basics) {
    return basics
  }

  if (context.lines.length === 0) {
    return 'EMPTY_CART'
  }

  if (selectEligibleLines(coupon, context.lines).length === 0) {
    return 'NO_ELIGIBLE_ITEMS'
  }

  const minimum = coupon.minimumAmounts[context.currency]

  if (typeof minimum === 'number' && context.basis < minimum) {
    return 'MINIMUM_NOT_MET'
  }

  const maximum = coupon.maximumAmounts[context.currency]

  if (typeof maximum === 'number' && context.basis > maximum) {
    return 'MAXIMUM_EXCEEDED'
  }

  if (coupon.maxUsesPerCustomer !== null) {
    if (context.customer === '') {
      return 'CUSTOMER_REQUIRED'
    }

    if (context.customerUses >= coupon.maxUsesPerCustomer) {
      return 'CUSTOMER_LIMIT_REACHED'
    }
  }

  if (coupon.maxUses !== null && context.uses >= coupon.maxUses) {
    return 'USAGE_LIMIT_REACHED'
  }

  return null
}
