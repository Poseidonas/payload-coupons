import { describe, expect, it } from 'vitest'

import { computeDiscount } from '../src/discount.js'
import { sumOf } from '../src/money.js'
import { coupon, lines } from './factories.js'

describe('computeDiscount', () => {
  it('takes a percentage off the whole cart', () => {
    const result = computeDiscount(coupon({ basisPoints: 1000 }), {
      currency: 'EUR',
      lines: lines([1000, 2000]),
    })

    expect(result.amount).toBe(300)
    expect(result.value).toBe(1000)
    expect(result.type).toBe('percentage')
  })

  it('splits the percentage across lines so the parts add up to the total', () => {
    const result = computeDiscount(coupon({ basisPoints: 1000 }), {
      currency: 'EUR',
      lines: lines([333, 333, 334]),
    })

    expect(result.amount).toBe(100)
    expect(result.lines.map((entry) => entry.amount)).toEqual([33, 33, 34])
    expect(sumOf(result.lines.map((entry) => entry.amount))).toBe(result.amount)
  })

  it('never gives a line more than the line is worth', () => {
    const result = computeDiscount(coupon({ basisPoints: 5000 }), {
      currency: 'EUR',
      lines: lines([1, 1, 1]),
    })

    expect(result.amount).toBe(2)
    expect(result.lines.map((entry) => entry.amount)).toEqual([1, 1, 0])
  })

  it('records the position of each line it discounted', () => {
    const result = computeDiscount(coupon({ appliesTo: 'products', products: ['p2'] }), {
      currency: 'EUR',
      lines: lines([1000, 2000, 3000]),
    })

    expect(result.lines).toEqual([{ amount: 200, index: 1 }])
  })

  it('takes a fixed amount in the cart currency', () => {
    const result = computeDiscount(
      coupon({ amounts: { EUR: 500, USD: 700 }, type: 'fixed' }),
      { currency: 'USD', lines: lines([1000, 1000]) },
    )

    expect(result.amount).toBe(700)
    expect(result.value).toBe(700)
    expect(result.lines.map((entry) => entry.amount)).toEqual([350, 350])
  })

  it('never takes more than the eligible lines are worth', () => {
    const result = computeDiscount(coupon({ amounts: { EUR: 5000 }, type: 'fixed' }), {
      currency: 'EUR',
      lines: lines([600, 400]),
    })

    expect(result.amount).toBe(1000)
    expect(sumOf(result.lines.map((entry) => entry.amount))).toBe(1000)
  })

  it('takes nothing when no line qualifies', () => {
    const result = computeDiscount(coupon({ appliesTo: 'products', products: ['other'] }), {
      currency: 'EUR',
      lines: lines([1000]),
    })

    expect(result.amount).toBe(0)
    expect(result.lines).toEqual([])
  })

  it('bases a percentage only on the lines in scope', () => {
    const result = computeDiscount(coupon({ appliesTo: 'products', products: ['p1'] }), {
      currency: 'EUR',
      lines: lines([1000, 9000]),
    })

    expect(result.amount).toBe(100)
  })

  it('carries the code, the coupon and the free shipping flag', () => {
    const result = computeDiscount(coupon({ code: 'SHIPFREE', freeShipping: true, id: '42' }), {
      currency: 'GBP',
      lines: lines([1000]),
    })

    expect(result).toMatchObject({
      code: 'SHIPFREE',
      coupon: '42',
      currency: 'GBP',
      freeShipping: true,
    })
  })

  it('keeps the line amounts adding up for every cart size at every rate', () => {
    for (let rate = 1; rate <= 10000; rate += 1) {
      for (const amounts of [[1], [1, 1], [999, 1, 500], [10, 20, 30, 40], [7, 7, 7, 7, 7, 7, 7]]) {
        const result = computeDiscount(coupon({ basisPoints: rate }), {
          currency: 'EUR',
          lines: lines(amounts),
        })

        expect(sumOf(result.lines.map((entry) => entry.amount))).toBe(result.amount)
        expect(result.amount).toBeLessThanOrEqual(sumOf(amounts))
        expect(result.amount).toBeGreaterThanOrEqual(0)
      }
    }
  })
})
