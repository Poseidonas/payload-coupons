import { describe, expect, it } from 'vitest'

import { validateCoupon } from '../src/coupons.js'

const run = (data: Record<string, unknown>, originalDoc?: Record<string, unknown>): unknown => {
  const hook = validateCoupon()

  return hook({ data, originalDoc, operation: 'create' } as never)
}

describe('validateCoupon', () => {
  it('uppercases and trims the code before it is stored', () => {
    expect(run({ code: ' save10 ', percentage: 10 })).toMatchObject({ code: 'SAVE10' })
  })

  it('refuses a coupon with no code', () => {
    expect(() => run({ percentage: 10 })).toThrow('A coupon needs a code')
  })

  it('refuses a percentage coupon with no percentage', () => {
    expect(() => run({ code: 'A' })).toThrow('A percentage coupon needs a percentage above 0')
  })

  it('refuses a percentage above one hundred', () => {
    expect(() => run({ code: 'A', percentage: 120 })).toThrow(
      'A percentage coupon cannot exceed 100',
    )
  })

  it('refuses a fixed coupon with no amounts', () => {
    expect(() => run({ code: 'A', type: 'fixed' })).toThrow(
      'A fixed coupon needs an amount for at least one currency',
    )
  })

  it('refuses two entries for the same currency instead of dropping one', () => {
    expect(() =>
      run({
        code: 'A',
        amounts: [
          { amount: 100, currency: 'EUR' },
          { amount: 200, currency: 'eur' },
        ],
        type: 'fixed',
      }),
    ).toThrow('Fixed amount has more than one entry for EUR')
  })

  it('refuses an amount entry with no currency', () => {
    expect(() => run({ code: 'A', amounts: [{ amount: 100 }], type: 'fixed' })).toThrow(
      'Every Fixed amount entry needs a currency',
    )
  })

  it('refuses a negative amount', () => {
    expect(() =>
      run({ code: 'A', amounts: [{ amount: -100, currency: 'EUR' }], type: 'fixed' }),
    ).toThrow('Every Fixed amount entry needs a whole amount of 0 or more')
  })

  it('refuses an amount that is not a number', () => {
    expect(() =>
      run({ code: 'A', amounts: [{ amount: '10.00', currency: 'EUR' }], type: 'fixed' }),
    ).toThrow('Every Fixed amount entry needs a whole amount of 0 or more')
  })

  it('uppercases the currency of every amount entry', () => {
    const result = run({
      code: 'A',
      amounts: [{ amount: 100, currency: 'usd' }],
      type: 'fixed',
    }) as { amounts: { currency: string }[] }

    expect(result.amounts[0]?.currency).toBe('USD')
  })

  it('refuses a maximum below the minimum for the same currency', () => {
    expect(() =>
      run({
        code: 'A',
        maximumAmounts: [{ amount: 100, currency: 'EUR' }],
        minimumAmounts: [{ amount: 500, currency: 'EUR' }],
        percentage: 10,
      }),
    ).toThrow('The maximum for EUR is below the minimum')
  })

  it('accepts a maximum above the minimum', () => {
    expect(() =>
      run({
        code: 'A',
        maximumAmounts: [{ amount: 5000, currency: 'EUR' }],
        minimumAmounts: [{ amount: 500, currency: 'EUR' }],
        percentage: 10,
      }),
    ).not.toThrow()
  })

  it('refuses a validity window that ends before it starts', () => {
    expect(() =>
      run({
        code: 'A',
        percentage: 10,
        validFrom: '2026-08-01T00:00:00.000Z',
        validUntil: '2026-07-01T00:00:00.000Z',
      }),
    ).toThrow('The end of the validity window is before its start')
  })

  it('refuses a product scope with no products', () => {
    expect(() => run({ code: 'A', appliesTo: 'products', percentage: 10 })).toThrow(
      'A coupon scoped to products needs at least one product',
    )
  })

  it('refuses a category scope with no categories', () => {
    expect(() => run({ code: 'A', appliesTo: 'categories', percentage: 10 })).toThrow(
      'A coupon scoped to categories needs at least one category',
    )
  })

  it('reads the values already stored when an update only sends one field', () => {
    expect(() => run({ percentage: 20 }, { code: 'A', type: 'percentage' })).not.toThrow()
  })

  it('leaves fields the update did not send out of the returned data', () => {
    const result = run({ percentage: 20 }, { code: 'A', type: 'percentage' }) as Record<
      string,
      unknown
    >

    expect(result).toEqual({ code: 'A', percentage: 20 })
  })
})
