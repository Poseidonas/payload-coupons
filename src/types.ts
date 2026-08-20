import type { PayloadRequest } from 'payload'

import type { RefusalReason } from './reasons.js'

/**
 * Resolves the amount of one cart line in integer minor units, including its
 * quantity. Return null to fall back to the built in price lookup.
 */
export type LineAmountResolver = (args: {
  currency: string
  item: Record<string, unknown>
  req: PayloadRequest
}) => null | number | Promise<null | number>

export type CouponsConfig = {
  /**
   * How many times to try claiming a redemption slot before giving up.
   * Each attempt is one insert into the redemptions collection. Defaults to 25.
   */
  attempts?: number
  /**
   * Slug of the carts collection. Defaults to 'carts'.
   */
  cartsSlug?: string
  /**
   * Slug of the categories collection used by category scope and category
   * exclusions. Defaults to 'categories'.
   */
  categoriesSlug?: string
  /**
   * Name of the field on a product that holds its categories.
   * Defaults to 'categories'.
   */
  categoryField?: string
  /**
   * Slug of the coupons collection this plugin creates. Defaults to 'coupons'.
   */
  couponsSlug?: string
  /**
   * Currency codes offered as a select in the admin for the per currency
   * amounts. When empty the currency is a free text field, uppercased on save.
   * Defaults to an empty list.
   */
  currencies?: string[]
  /**
   * Slug of the customers collection. Defaults to 'users'.
   */
  customersSlug?: string
  /**
   * Stops evaluating and claiming coupons while leaving every field and
   * collection in place, so that an existing database keeps its shape.
   */
  disabled?: boolean
  /**
   * Name of the group field holding the applied discount on carts and orders.
   * Defaults to 'discount'.
   */
  fieldName?: string
  /**
   * Slug of the orders collection. Defaults to 'orders'.
   */
  ordersSlug?: string
  /**
   * Builds the name of the price field to read for a currency.
   * Defaults to `priceIn${currency}`, the name used by the official
   * ecommerce plugin.
   */
  priceField?: (currency: string) => string
  /**
   * Slug of the products collection. Defaults to 'products'.
   */
  productsSlug?: string
  /**
   * Slug of the collection holding one document per redemption.
   * Defaults to 'coupon-redemptions'.
   */
  redemptionsSlug?: string
  /**
   * Throws when an order carries a code that cannot be redeemed, instead of
   * saving the order without the discount. Defaults to false.
   */
  refuseOrderOnInvalidCoupon?: boolean
  /**
   * Overrides how the amount of a cart line is resolved.
   */
  resolveLineAmount?: LineAmountResolver
  /**
   * Name of the number field holding the cart total after the discount.
   * Defaults to 'total'.
   */
  totalFieldName?: string
  /**
   * Slug of the variants collection. Defaults to 'variants'.
   */
  variantsSlug?: string
}

export type ResolvedConfig = Omit<
  Required<CouponsConfig>,
  'disabled' | 'resolveLineAmount'
> & {
  disabled: boolean
  resolveLineAmount: LineAmountResolver | null
}

export type CouponScope = 'cart' | 'categories' | 'products'

export type CouponType = 'fixed' | 'percentage'

/**
 * A coupon document reduced to the plain values the calculation needs.
 */
export type NormalizedCoupon = {
  amounts: Record<string, number>
  appliesTo: CouponScope
  basisPoints: number
  categories: string[]
  code: string
  enabled: boolean
  excludedCategories: string[]
  excludedProducts: string[]
  freeShipping: boolean
  id: string
  maximumAmounts: Record<string, number>
  maxUses: null | number
  maxUsesPerCustomer: null | number
  minimumAmounts: Record<string, number>
  products: string[]
  type: CouponType
  validFrom: Date | null
  validUntil: Date | null
}

/**
 * One cart line with its amount in integer minor units, quantity included.
 */
export type CartLine = {
  amount: number
  categories: string[]
  index: number
  product: string
  quantity: number
  variant: string
}

export type DiscountLine = {
  amount: number
  index: number
}

/**
 * The discount as it is written to a cart or an order. `value` is the basis
 * points of a percentage coupon or the fixed amount of a fixed coupon, and
 * `amount` is what was actually deducted.
 */
export type DiscountResult = {
  amount: number
  code: string
  coupon: string
  currency: string
  freeShipping: boolean
  lines: DiscountLine[]
  type: CouponType
  value: number
}

export type Refusal = {
  message: string
  reason: RefusalReason
  valid: false
}

export type Acceptance = {
  discount: DiscountResult
  redemptionID: null | number | string
  valid: true
}

export type EvaluationOutcome = Acceptance | Refusal

/**
 * Which optional collections exist in the host config. Relationship fields are
 * only added for collections that are actually present.
 */
export type AvailableCollections = {
  carts: boolean
  categories: boolean
  customers: boolean
  orders: boolean
  products: boolean
  variants: boolean
}
