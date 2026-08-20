import type { PayloadRequest } from 'payload'

import { normalizeCoupon } from './coupon.js'
import { computeDiscount } from './discount.js'
import { checkCoupon, checkCouponBasics } from './eligibility.js'
import { resolveCartLines } from './lines.js'
import { sumOf } from './money.js'
import { normalizeCode, toRelationID } from './normalize.js'
import { refusalMessage } from './reasons.js'
import type { RefusalReason } from './reasons.js'
import { claimRedemption, countUses } from './redemptions.js'
import type { EvaluationOutcome, ResolvedConfig } from './types.js'

const refuse = (reason: RefusalReason): EvaluationOutcome => ({
  message: refusalMessage(reason),
  reason,
  valid: false,
})

export const normalizeCurrency = (value: unknown): string =>
  typeof value === 'string' ? value.trim().toUpperCase() : ''

/**
 * Resolves a code against a set of cart items and reports either the discount it
 * produces or the first reason it was refused. With `claim` set, a use of the
 * coupon is also claimed and cannot be taken by anyone else.
 */
export const evaluateCode = async (args: {
  claim: boolean
  code: unknown
  config: ResolvedConfig
  currency: unknown
  customer: unknown
  items: unknown
  now?: Date
  req: PayloadRequest
}): Promise<EvaluationOutcome> => {
  const { claim, config, req } = args
  const code = normalizeCode(args.code)

  if (code === '') {
    return refuse('MISSING_CODE')
  }

  const currency = normalizeCurrency(args.currency)
  const customer = toRelationID(args.customer)

  const found = await req.payload.find({
    collection: config.couponsSlug,
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    req,
    where: { code: { equals: code } },
  })

  const coupon = normalizeCoupon(found.docs[0])

  if (!coupon) {
    return refuse('NOT_FOUND')
  }

  const now = args.now ?? new Date()
  const basics = checkCouponBasics(coupon, { currency, now })

  if (basics) {
    return refuse(basics)
  }

  const resolution = await resolveCartLines({
    config,
    currency,
    items: args.items,
    req,
    withCategories: coupon.appliesTo === 'categories' || coupon.excludedCategories.length > 0,
  })

  if (!resolution.valid) {
    return refuse(resolution.reason)
  }

  const uses =
    coupon.maxUses === null ? 0 : await countUses({ config, coupon: coupon.id, payload: req.payload })

  const customerUses =
    coupon.maxUsesPerCustomer === null || customer === ''
      ? 0
      : await countUses({ config, coupon: coupon.id, customer, payload: req.payload })

  const reason = checkCoupon(coupon, {
    basis: sumOf(resolution.lines.map((line) => line.amount)),
    currency,
    customer,
    customerUses,
    lines: resolution.lines,
    now,
    uses,
  })

  if (reason) {
    return refuse(reason)
  }

  const discount = computeDiscount(coupon, { currency, lines: resolution.lines })

  if (!claim) {
    return { discount, redemptionID: null, valid: true }
  }

  const claimed = await claimRedemption({
    amount: discount.amount,
    config,
    coupon,
    currency,
    customer,
    payload: req.payload,
  })

  if (!claimed.valid) {
    return refuse(claimed.reason)
  }

  return { discount, redemptionID: claimed.id, valid: true }
}
