import type { CollectionBeforeChangeHook } from 'payload'

import { evaluateCode } from './evaluate.js'
import { toInteger } from './money.js'
import { normalizeCode } from './normalize.js'
import { emptyDiscount, toStoredDiscount } from './stored.js'
import type { ResolvedConfig } from './types.js'

export const applyCartDiscount =
  (config: ResolvedConfig): CollectionBeforeChangeHook =>
  async ({ data, originalDoc, req }) => {
    if (config.disabled) {
      return data
    }

    const previous = (originalDoc ?? {}) as Record<string, unknown>
    const subtotal = toInteger(data.subtotal ?? previous.subtotal) ?? 0
    const group = (data[config.fieldName] ?? previous[config.fieldName]) as
      | Record<string, unknown>
      | undefined
    const code = normalizeCode(group?.code)

    if (code === '') {
      return {
        ...data,
        [config.fieldName]: emptyDiscount(),
        [config.totalFieldName]: subtotal > 0 ? subtotal : 0,
      }
    }

    const outcome = await evaluateCode({
      claim: false,
      code,
      config,
      currency: data.currency ?? previous.currency,
      customer: data.customer ?? previous.customer,
      items: data.items ?? previous.items,
      req,
    })

    if (!outcome.valid) {
      return {
        ...data,
        [config.fieldName]: emptyDiscount(),
        [config.totalFieldName]: subtotal > 0 ? subtotal : 0,
      }
    }

    const total = subtotal - outcome.discount.amount

    return {
      ...data,
      [config.fieldName]: toStoredDiscount(outcome.discount),
      [config.totalFieldName]: total > 0 ? total : 0,
    }
  }
