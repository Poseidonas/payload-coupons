import type { CollectionConfig, Payload, Where } from 'payload'

import type { RefusalReason } from './reasons.js'
import type { AvailableCollections, NormalizedCoupon, ResolvedConfig } from './types.js'

export const redemptionsCollection = (
  config: ResolvedConfig,
  available: AvailableCollections,
): CollectionConfig => ({
  slug: config.redemptionsSlug,
  access: {
    create: () => false,
    delete: () => false,
    read: () => false,
    update: () => false,
  },
  admin: {
    hidden: true,
  },
  fields: [
    {
      name: 'coupon',
      type: 'relationship',
      index: true,
      relationTo: config.couponsSlug,
      required: true,
    },
    {
      name: 'code',
      type: 'text',
      index: true,
    },
    ...(available.customers
      ? [
          {
            name: 'customer',
            type: 'relationship' as const,
            index: true,
            relationTo: config.customersSlug,
          },
        ]
      : []),
    ...(available.orders
      ? [
          {
            name: 'order',
            type: 'relationship' as const,
            index: true,
            relationTo: config.ordersSlug,
          },
        ]
      : []),
    {
      name: 'amount',
      type: 'number',
    },
    {
      name: 'currency',
      type: 'text',
    },
    {
      name: 'slot',
      type: 'text',
      index: true,
      unique: true,
    },
    {
      name: 'customerSlot',
      type: 'text',
      index: true,
      unique: true,
    },
    {
      name: 'useIndex',
      type: 'number',
      index: true,
    },
    {
      name: 'customerUseIndex',
      type: 'number',
      index: true,
    },
  ],
  timestamps: true,
})

const highestIndex = async (args: {
  config: ResolvedConfig
  field: string
  payload: Payload
  where: Where
}): Promise<number> => {
  const result = await args.payload.find({
    collection: args.config.redemptionsSlug,
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    sort: `-${args.field}`,
    where: args.where,
  })

  const top = result.docs[0] as Record<string, unknown> | undefined
  const value = top?.[args.field]

  return typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : 0
}

export type ClaimResult =
  | { id: number | string; valid: true }
  | { reason: RefusalReason; valid: false }

/**
 * Claims one use of a coupon by inserting a redemption whose slot value is
 * unique. The insert runs outside the request transaction so that a second
 * request arriving at the same instant sees it and takes the next slot.
 */
export const claimRedemption = async (args: {
  amount: number
  config: ResolvedConfig
  coupon: NormalizedCoupon
  currency: string
  customer: string
  payload: Payload
}): Promise<ClaimResult> => {
  const { amount, config, coupon, currency, customer, payload } = args
  const unlimited = coupon.maxUses === null && coupon.maxUsesPerCustomer === null
  const attempts = unlimited ? 1 : config.attempts

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    let useIndex: null | number = null
    let customerUseIndex: null | number = null

    if (coupon.maxUses !== null) {
      const highest = await highestIndex({
        config,
        field: 'useIndex',
        payload,
        where: {
          and: [{ coupon: { equals: coupon.id } }, { useIndex: { greater_than: 0 } }],
        },
      })

      useIndex = highest + 1

      if (useIndex > coupon.maxUses) {
        return { reason: 'USAGE_LIMIT_REACHED', valid: false }
      }
    }

    if (coupon.maxUsesPerCustomer !== null) {
      if (customer === '') {
        return { reason: 'CUSTOMER_REQUIRED', valid: false }
      }

      const highest = await highestIndex({
        config,
        field: 'customerUseIndex',
        payload,
        where: {
          and: [
            { coupon: { equals: coupon.id } },
            { customer: { equals: customer } },
            { customerUseIndex: { greater_than: 0 } },
          ],
        },
      })

      customerUseIndex = highest + 1

      if (customerUseIndex > coupon.maxUsesPerCustomer) {
        return { reason: 'CUSTOMER_LIMIT_REACHED', valid: false }
      }
    }

    try {
      const created = await payload.create({
        collection: config.redemptionsSlug,
        data: {
          amount,
          code: coupon.code,
          coupon: coupon.id,
          currency,
          ...(customer === '' ? {} : { customer }),
          ...(useIndex === null ? {} : { slot: `${coupon.id}#${useIndex}`, useIndex }),
          ...(customerUseIndex === null
            ? {}
            : {
                customerSlot: `${coupon.id}#${customer}#${customerUseIndex}`,
                customerUseIndex,
              }),
        },
        depth: 0,
        overrideAccess: true,
      })

      return { id: created.id as number | string, valid: true }
    } catch {
      continue
    }
  }

  return { reason: 'REDEMPTION_CONFLICT', valid: false }
}

/**
 * Counts how many times a coupon has been redeemed.
 */
export const countUses = async (args: {
  config: ResolvedConfig
  coupon: number | string
  customer?: string
  payload: Payload
}): Promise<number> => {
  const where: Where =
    args.customer === undefined || args.customer === ''
      ? { coupon: { equals: args.coupon } }
      : { and: [{ coupon: { equals: args.coupon } }, { customer: { equals: args.customer } }] }

  const result = await args.payload.count({
    collection: args.config.redemptionsSlug,
    overrideAccess: true,
    where,
  })

  return result.totalDocs
}

/**
 * Gives back a claimed use. Call this when an order that claimed a coupon was
 * not completed, so that the use is not lost.
 */
export const releaseRedemption = async (args: {
  config: ResolvedConfig
  id: number | string
  payload: Payload
}): Promise<boolean> => {
  try {
    await args.payload.delete({
      id: args.id,
      collection: args.config.redemptionsSlug,
      depth: 0,
      overrideAccess: true,
    })

    return true
  } catch {
    return false
  }
}

export const attachOrderToRedemption = async (args: {
  config: ResolvedConfig
  id: number | string
  order: number | string
  payload: Payload
}): Promise<void> => {
  try {
    await args.payload.update({
      id: args.id,
      collection: args.config.redemptionsSlug,
      data: { order: args.order },
      depth: 0,
      overrideAccess: true,
    })
  } catch {
    return
  }
}
