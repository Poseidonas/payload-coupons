import type { CollectionConfig, Config, Payload } from 'payload'

import { applyCartDiscount } from './cart.js'
import { resolveConfig } from './config.js'
import { couponsCollection } from './coupons.js'
import { applyCouponEndpoint, removeCouponEndpoint, validateCouponEndpoint } from './endpoints.js'
import { discountField, totalField } from './fields.js'
import { linkOrderRedemption, redeemOrderCoupon } from './order.js'
import { countUses, redemptionsCollection, releaseRedemption } from './redemptions.js'
import type { AvailableCollections, CouponsConfig, ResolvedConfig } from './types.js'

export { computeDiscount } from './discount.js'
export { allocate, percentageOf, toBasisPoints } from './money.js'
export { normalizeCode } from './normalize.js'
export { refusalMessage, refusalReasons } from './reasons.js'
export type { RefusalReason } from './reasons.js'
export type {
  Acceptance,
  CartLine,
  CouponScope,
  CouponsConfig,
  CouponType,
  DiscountLine,
  DiscountResult,
  EvaluationOutcome,
  LineAmountResolver,
  NormalizedCoupon,
  Refusal,
} from './types.js'

/**
 * Counts how many times a coupon has been redeemed, optionally for one customer.
 */
export const countCouponUses = async (args: {
  config?: CouponsConfig
  coupon: number | string
  customer?: string
  payload: Payload
}): Promise<number> =>
  countUses({
    config: resolveConfig(args.config),
    coupon: args.coupon,
    ...(args.customer === undefined ? {} : { customer: args.customer }),
    payload: args.payload,
  })

/**
 * Gives back a claimed use of a coupon. Call this when an order that claimed a
 * coupon was abandoned, so that the use returns to the pool.
 */
export const releaseCouponRedemption = async (args: {
  config?: CouponsConfig
  id: number | string
  payload: Payload
}): Promise<boolean> =>
  releaseRedemption({ config: resolveConfig(args.config), id: args.id, payload: args.payload })

const withCart = (collection: CollectionConfig, config: ResolvedConfig): CollectionConfig => {
  const hooks = collection.hooks ?? {}

  return {
    ...collection,
    endpoints:
      collection.endpoints === false
        ? false
        : [
            ...(collection.endpoints ?? []),
            applyCouponEndpoint(config),
            removeCouponEndpoint(config),
          ],
    fields: [...collection.fields, discountField(config), totalField(config)],
    hooks: {
      ...hooks,
      beforeChange: [...(hooks.beforeChange ?? []), applyCartDiscount(config)],
    },
  }
}

const withOrders = (collection: CollectionConfig, config: ResolvedConfig): CollectionConfig => {
  const hooks = collection.hooks ?? {}

  return {
    ...collection,
    fields: [...collection.fields, discountField(config)],
    hooks: {
      ...hooks,
      afterChange: [...(hooks.afterChange ?? []), linkOrderRedemption(config)],
      beforeChange: [...(hooks.beforeChange ?? []), redeemOrderCoupon(config)],
    },
  }
}

export const couponsPlugin =
  (incoming: CouponsConfig = {}) =>
  (incomingConfig: Config): Config => {
    const config = resolveConfig(incoming)
    const collections = incomingConfig.collections ?? []
    const has = (slug: string): boolean =>
      collections.some((collection) => collection.slug === slug)

    const available: AvailableCollections = {
      carts: has(config.cartsSlug),
      categories: has(config.categoriesSlug),
      customers: has(config.customersSlug),
      orders: has(config.ordersSlug),
      products: has(config.productsSlug),
      variants: has(config.variantsSlug),
    }

    const coupons = couponsCollection(config, available)

    return {
      ...incomingConfig,
      collections: [
        ...collections.map((collection) => {
          if (collection.slug === config.cartsSlug) {
            return withCart(collection, config)
          }

          if (collection.slug === config.ordersSlug) {
            return withOrders(collection, config)
          }

          return collection
        }),
        {
          ...coupons,
          endpoints: [...(coupons.endpoints === false ? [] : (coupons.endpoints ?? [])),
            validateCouponEndpoint(config)],
        },
        redemptionsCollection(config, available),
      ],
    }
  }
