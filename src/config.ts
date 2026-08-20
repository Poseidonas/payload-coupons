import type { CouponsConfig, ResolvedConfig } from './types.js'

const positiveInteger = (value: unknown, fallback: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback
  }

  const rounded = Math.trunc(value)

  return rounded > 0 ? rounded : fallback
}

const text = (value: unknown, fallback: string): string =>
  typeof value === 'string' && value !== '' ? value : fallback

const codes = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .filter((entry): entry is string => typeof entry === 'string' && entry.trim() !== '')
        .map((entry) => entry.trim().toUpperCase())
    : []

export const defaultPriceField = (currency: string): string => `priceIn${currency}`

export const resolveConfig = (incoming: CouponsConfig = {}): ResolvedConfig => ({
  attempts: positiveInteger(incoming.attempts, 25),
  cartsSlug: text(incoming.cartsSlug, 'carts'),
  categoriesSlug: text(incoming.categoriesSlug, 'categories'),
  categoryField: text(incoming.categoryField, 'categories'),
  couponsSlug: text(incoming.couponsSlug, 'coupons'),
  currencies: codes(incoming.currencies),
  customersSlug: text(incoming.customersSlug, 'users'),
  disabled: incoming.disabled === true,
  fieldName: text(incoming.fieldName, 'discount'),
  ordersSlug: text(incoming.ordersSlug, 'orders'),
  priceField: typeof incoming.priceField === 'function' ? incoming.priceField : defaultPriceField,
  productsSlug: text(incoming.productsSlug, 'products'),
  redemptionsSlug: text(incoming.redemptionsSlug, 'coupon-redemptions'),
  refuseOrderOnInvalidCoupon: incoming.refuseOrderOnInvalidCoupon === true,
  resolveLineAmount:
    typeof incoming.resolveLineAmount === 'function' ? incoming.resolveLineAmount : null,
  totalFieldName: text(incoming.totalFieldName, 'total'),
  variantsSlug: text(incoming.variantsSlug, 'variants'),
})
