import type { PayloadRequest, SelectType } from 'payload'

import { toInteger } from './money.js'
import { toRelationID, toRelationIDs } from './normalize.js'
import type { CartLine, ResolvedConfig } from './types.js'

export type LineResolution =
  | { lines: CartLine[]; valid: true }
  | { reason: 'MISSING_PRICE'; valid: false }

const readDoc = async (args: {
  collection: string
  fields: string[]
  id: string
  req: PayloadRequest
}): Promise<null | Record<string, unknown>> => {
  const select: SelectType = {}

  for (const field of args.fields) {
    select[field] = true
  }

  try {
    const doc = await args.req.payload.findByID({
      id: args.id,
      collection: args.collection,
      depth: 0,
      overrideAccess: true,
      req: args.req,
      select,
    })

    return doc as Record<string, unknown>
  } catch {
    return null
  }
}

/**
 * Turns cart items into lines with an integer amount in minor units. The amount
 * of a line is its unit price multiplied by its quantity.
 */
export const resolveCartLines = async (args: {
  config: ResolvedConfig
  currency: string
  items: unknown
  req: PayloadRequest
  withCategories: boolean
}): Promise<LineResolution> => {
  const { config, currency, items, req, withCategories } = args

  if (!Array.isArray(items)) {
    return { lines: [], valid: true }
  }

  const priceField = config.priceField(currency)
  const lines: CartLine[] = []
  let index = -1

  for (const entry of items) {
    index += 1

    if (!entry || typeof entry !== 'object') {
      continue
    }

    const item = entry as Record<string, unknown>
    const quantity = toInteger(item.quantity) ?? 1
    const product = toRelationID(item.product)
    const variant = toRelationID(item.variant)

    if (product === '' && variant === '') {
      continue
    }

    let categories: string[] = []
    let amount: null | number = null

    if (config.resolveLineAmount) {
      const custom = await config.resolveLineAmount({ currency, item, req })

      amount = typeof custom === 'number' ? toInteger(custom) : null
    }

    const needsProduct = product !== '' && (withCategories || (amount === null && variant === ''))

    if (needsProduct) {
      const doc = await readDoc({
        collection: config.productsSlug,
        fields: withCategories ? [priceField, config.categoryField] : [priceField],
        id: product,
        req,
      })

      if (!doc) {
        return { reason: 'MISSING_PRICE', valid: false }
      }

      if (withCategories) {
        categories = toRelationIDs(doc[config.categoryField])
      }

      if (amount === null && variant === '') {
        const price = toInteger(doc[priceField])

        if (price === null) {
          return { reason: 'MISSING_PRICE', valid: false }
        }

        amount = price * quantity
      }
    }

    if (amount === null && variant !== '') {
      const doc = await readDoc({
        collection: config.variantsSlug,
        fields: [priceField],
        id: variant,
        req,
      })
      const price = doc ? toInteger(doc[priceField]) : null

      if (price === null) {
        return { reason: 'MISSING_PRICE', valid: false }
      }

      amount = price * quantity
    }

    if (amount === null) {
      return { reason: 'MISSING_PRICE', valid: false }
    }

    lines.push({
      amount: amount > 0 ? amount : 0,
      categories,
      index,
      product,
      quantity,
      variant,
    })
  }

  return { lines, valid: true }
}
