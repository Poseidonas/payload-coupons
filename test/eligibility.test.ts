import { describe, expect, it } from 'vitest'

import { checkCoupon, checkCouponBasics, selectEligibleLines } from '../src/eligibility.js'
import type { EvaluationContext } from '../src/eligibility.js'
import type { CartLine } from '../src/types.js'
import { coupon, line, lines } from './factories.js'

const context = (overrides: Partial<EvaluationContext> = {}): EvaluationContext => {
  const given = overrides.lines ?? lines([1000])

  return {
    basis: given.reduce((total, entry) => total + entry.amount, 0),
    currency: 'EUR',
    customer: '',
    customerUses: 0,
    now: new Date('2026-06-01T12:00:00.000Z'),
    uses: 0,
    ...overrides,
    lines: given,
  }
}

describe('selectEligibleLines', () => {
  it('takes every line for a whole cart coupon', () => {
    expect(selectEligibleLines(coupon(), lines([100, 200]))).toHaveLength(2)
  })

  it('takes only the listed products', () => {
    const result = selectEligibleLines(
      coupon({ appliesTo: 'products', products: ['p2'] }),
      lines([100, 200, 300]),
    )

    expect(result.map((entry) => entry.product)).toEqual(['p2'])
  })

  it('takes lines in any of the listed categories', () => {
    const cart: CartLine[] = [
      line({ categories: ['shoes'], index: 0, product: 'p1' }),
      line({ categories: ['hats'], index: 1, product: 'p2' }),
    ]
    const result = selectEligibleLines(
      coupon({ appliesTo: 'categories', categories: ['hats', 'coats'] }),
      cart,
    )

    expect(result.map((entry) => entry.product)).toEqual(['p2'])
  })

  it('drops excluded products even when the scope is the whole cart', () => {
    const result = selectEligibleLines(coupon({ excludedProducts: ['p1'] }), lines([100, 200]))

    expect(result.map((entry) => entry.product)).toEqual(['p2'])
  })

  it('drops excluded categories', () => {
    const cart: CartLine[] = [
      line({ categories: ['sale'], index: 0, product: 'p1' }),
      line({ categories: ['new'], index: 1, product: 'p2' }),
    ]
    const result = selectEligibleLines(coupon({ excludedCategories: ['sale'] }), cart)

    expect(result.map((entry) => entry.product)).toEqual(['p2'])
  })

  it('lets an exclusion override the scope', () => {
    const result = selectEligibleLines(
      coupon({ appliesTo: 'products', excludedProducts: ['p1'], products: ['p1'] }),
      lines([100]),
    )

    expect(result).toEqual([])
  })

  it('ignores lines worth nothing', () => {
    expect(selectEligibleLines(coupon(), lines([0, 100]))).toHaveLength(1)
  })
})

describe('checkCoupon', () => {
  it('accepts a plain coupon', () => {
    expect(checkCoupon(coupon(), context())).toBeNull()
  })

  it('refuses a disabled coupon', () => {
    expect(checkCoupon(coupon({ enabled: false }), context())).toBe('DISABLED')
  })

  it('refuses a coupon whose window has not opened', () => {
    const result = checkCoupon(
      coupon({ validFrom: new Date('2026-07-01T00:00:00.000Z') }),
      context(),
    )

    expect(result).toBe('NOT_STARTED')
  })

  it('refuses a coupon whose window has closed', () => {
    const result = checkCoupon(
      coupon({ validUntil: new Date('2026-05-01T00:00:00.000Z') }),
      context(),
    )

    expect(result).toBe('EXPIRED')
  })

  it('accepts a coupon inside its window', () => {
    const result = checkCoupon(
      coupon({
        validFrom: new Date('2026-01-01T00:00:00.000Z'),
        validUntil: new Date('2026-12-31T00:00:00.000Z'),
      }),
      context(),
    )

    expect(result).toBeNull()
  })

  it('refuses a fixed coupon with no amount in the cart currency', () => {
    const result = checkCoupon(
      coupon({ amounts: { USD: 500 }, type: 'fixed' }),
      context({ currency: 'EUR' }),
    )

    expect(result).toBe('CURRENCY_NOT_SUPPORTED')
  })

  it('accepts a percentage coupon in any currency', () => {
    expect(checkCoupon(coupon(), context({ currency: 'SEK' }))).toBeNull()
  })

  it('refuses an empty cart', () => {
    expect(checkCoupon(coupon(), context({ lines: [] }))).toBe('EMPTY_CART')
  })

  it('refuses a cart where nothing qualifies', () => {
    const result = checkCoupon(
      coupon({ appliesTo: 'products', products: ['other'] }),
      context(),
    )

    expect(result).toBe('NO_ELIGIBLE_ITEMS')
  })

  it('refuses a cart below the minimum for its currency', () => {
    const result = checkCoupon(
      coupon({ minimumAmounts: { EUR: 5000 } }),
      context({ lines: lines([1000]) }),
    )

    expect(result).toBe('MINIMUM_NOT_MET')
  })

  it('accepts a cart exactly on the minimum', () => {
    const result = checkCoupon(
      coupon({ minimumAmounts: { EUR: 1000 } }),
      context({ lines: lines([1000]) }),
    )

    expect(result).toBeNull()
  })

  it('ignores a minimum set for another currency', () => {
    const result = checkCoupon(
      coupon({ minimumAmounts: { USD: 5000 } }),
      context({ currency: 'EUR' }),
    )

    expect(result).toBeNull()
  })

  it('refuses a cart above the maximum', () => {
    const result = checkCoupon(
      coupon({ maximumAmounts: { EUR: 500 } }),
      context({ lines: lines([1000]) }),
    )

    expect(result).toBe('MAXIMUM_EXCEEDED')
  })

  it('accepts a cart exactly on the maximum', () => {
    const result = checkCoupon(
      coupon({ maximumAmounts: { EUR: 1000 } }),
      context({ lines: lines([1000]) }),
    )

    expect(result).toBeNull()
  })

  it('refuses a guest when the coupon is limited per customer', () => {
    const result = checkCoupon(coupon({ maxUsesPerCustomer: 1 }), context({ customer: '' }))

    expect(result).toBe('CUSTOMER_REQUIRED')
  })

  it('refuses a customer who has used the coupon already', () => {
    const result = checkCoupon(
      coupon({ maxUsesPerCustomer: 1 }),
      context({ customer: 'c1', customerUses: 1 }),
    )

    expect(result).toBe('CUSTOMER_LIMIT_REACHED')
  })

  it('accepts a customer below the per customer limit', () => {
    const result = checkCoupon(
      coupon({ maxUsesPerCustomer: 2 }),
      context({ customer: 'c1', customerUses: 1 }),
    )

    expect(result).toBeNull()
  })

  it('refuses a coupon that has run out', () => {
    expect(checkCoupon(coupon({ maxUses: 10 }), context({ uses: 10 }))).toBe('USAGE_LIMIT_REACHED')
  })

  it('accepts the last remaining use', () => {
    expect(checkCoupon(coupon({ maxUses: 10 }), context({ uses: 9 }))).toBeNull()
  })

  it('reports the first failure in a fixed order', () => {
    const result = checkCoupon(
      coupon({
        enabled: false,
        maxUses: 1,
        minimumAmounts: { EUR: 100000 },
        validUntil: new Date('2020-01-01T00:00:00.000Z'),
      }),
      context({ uses: 5 }),
    )

    expect(result).toBe('DISABLED')
  })
})

describe('checkCouponBasics', () => {
  const now = new Date('2026-06-01T12:00:00.000Z')

  it('accepts a live coupon without looking at the cart', () => {
    expect(checkCouponBasics(coupon(), { currency: 'EUR', now })).toBeNull()
  })

  it('refuses a disabled coupon', () => {
    expect(checkCouponBasics(coupon({ enabled: false }), { currency: 'EUR', now })).toBe('DISABLED')
  })

  it('refuses a fixed coupon with no amount in that currency', () => {
    const result = checkCouponBasics(coupon({ amounts: { USD: 100 }, type: 'fixed' }), {
      currency: 'EUR',
      now,
    })

    expect(result).toBe('CURRENCY_NOT_SUPPORTED')
  })

  it('refuses an expired coupon', () => {
    const result = checkCouponBasics(coupon({ validUntil: new Date('2026-01-01T00:00:00.000Z') }), {
      currency: 'EUR',
      now,
    })

    expect(result).toBe('EXPIRED')
  })
})
