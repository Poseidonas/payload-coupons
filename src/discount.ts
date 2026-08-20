import { selectEligibleLines } from './eligibility.js'
import { allocate, percentageOf, sumOf } from './money.js'
import type { CartLine, DiscountResult, NormalizedCoupon } from './types.js'

/**
 * Works out what a coupon takes off a set of cart lines and how that amount is
 * split across them. Every value is an integer number of minor units and the
 * line amounts always add up to the total.
 */
export const computeDiscount = (
  coupon: NormalizedCoupon,
  args: { currency: string; lines: CartLine[] },
): DiscountResult => {
  const eligible = selectEligibleLines(coupon, args.lines)
  const weights = eligible.map((line) => line.amount)
  const base = sumOf(weights)
  const fixed = coupon.amounts[args.currency] ?? 0
  const value = coupon.type === 'percentage' ? coupon.basisPoints : fixed
  const requested = coupon.type === 'percentage' ? percentageOf(base, coupon.basisPoints) : fixed
  const amount = requested > base ? base : requested
  const parts = allocate(amount, weights)

  return {
    amount,
    code: coupon.code,
    coupon: coupon.id,
    currency: args.currency,
    freeShipping: coupon.freeShipping,
    lines: eligible.map((line, position) => ({
      amount: parts[position] ?? 0,
      index: line.index,
    })),
    type: coupon.type,
    value,
  }
}
