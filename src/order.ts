import type { CollectionAfterChangeHook, CollectionBeforeChangeHook } from 'payload'

import { APIError } from 'payload'

import { evaluateCode } from './evaluate.js'
import { normalizeCode } from './normalize.js'
import { attachOrderToRedemption } from './redemptions.js'
import { emptyDiscount, toStoredDiscount } from './stored.js'
import type { ResolvedConfig } from './types.js'

export const redemptionContextKey = 'payloadCouponsRedemption'

export const redeemOrderCoupon =
  (config: ResolvedConfig): CollectionBeforeChangeHook =>
  async ({ data, operation, req }) => {
    if (config.disabled || operation !== 'create') {
      return data
    }

    const group = data[config.fieldName] as Record<string, unknown> | undefined
    const code = normalizeCode(group?.code)

    if (code === '') {
      return data
    }

    const outcome = await evaluateCode({
      claim: true,
      code,
      config,
      currency: data.currency,
      customer: data.customer,
      items: data.items,
      req,
    })

    if (!outcome.valid) {
      if (config.refuseOrderOnInvalidCoupon) {
        throw new APIError(outcome.message, 422)
      }

      req.payload.logger.error(
        `payload-coupons: code ${code} refused on order create with reason ${outcome.reason}`,
      )

      return { ...data, [config.fieldName]: emptyDiscount() }
    }

    req.context[redemptionContextKey] = outcome.redemptionID

    return { ...data, [config.fieldName]: toStoredDiscount(outcome.discount) }
  }

export const linkOrderRedemption =
  (config: ResolvedConfig): CollectionAfterChangeHook =>
  async ({ doc, operation, req }) => {
    if (config.disabled || operation !== 'create') {
      return doc
    }

    const id = req.context[redemptionContextKey]

    if (typeof id !== 'string' && typeof id !== 'number') {
      return doc
    }

    delete req.context[redemptionContextKey]

    await attachOrderToRedemption({
      config,
      id,
      order: doc.id as number | string,
      payload: req.payload,
    })

    return doc
  }
