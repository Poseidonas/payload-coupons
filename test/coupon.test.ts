import { describe, expect, it } from 'vitest'

import { normalizeCoupon } from '../src/coupon.js'

describe('normalizeCoupon', () => {
  it('reads a percentage coupon', () => {
    const result = normalizeCoupon({ id: 1, code: 'save10', percentage: 10, type: 'percentage' })

    expect(result).toMatchObject({ basisPoints: 1000, code: 'SAVE10', id: '1', type: 'percentage' })
  })

  it('reads fixed amounts as a lookup by currency', () => {
    const result = normalizeCoupon({
      id: 'x',
      amounts: [
        { amount: 500, currency: 'eur' },
        { amount: 700, currency: 'USD' },
      ],
      code: 'TEN',
      type: 'fixed',
    })

    expect(result?.amounts).toEqual({ EUR: 500, USD: 700 })
  })

  it('keeps the first entry when a currency appears twice', () => {
    const result = normalizeCoupon({
      id: 'x',
      amounts: [
        { amount: 500, currency: 'EUR' },
        { amount: 900, currency: 'EUR' },
      ],
      code: 'TEN',
      type: 'fixed',
    })

    expect(result?.amounts).toEqual({ EUR: 500 })
  })

  it('drops an amount that is not a usable number', () => {
    const result = normalizeCoupon({
      id: 'x',
      amounts: [
        { amount: 'free', currency: 'EUR' },
        { amount: -100, currency: 'USD' },
      ],
      code: 'TEN',
      type: 'fixed',
    })

    expect(result?.amounts).toEqual({})
  })

  it('treats a missing enabled flag as enabled', () => {
    expect(normalizeCoupon({ id: '1', code: 'A' })?.enabled).toBe(true)
    expect(normalizeCoupon({ id: '1', code: 'A', enabled: false })?.enabled).toBe(false)
  })

  it('treats zero and absent usage limits as unlimited', () => {
    const result = normalizeCoupon({ id: '1', code: 'A', maxUses: 0 })

    expect(result?.maxUses).toBeNull()
    expect(result?.maxUsesPerCustomer).toBeNull()
  })

  it('reads usage limits', () => {
    const result = normalizeCoupon({ id: '1', code: 'A', maxUses: 5, maxUsesPerCustomer: 2 })

    expect(result).toMatchObject({ maxUses: 5, maxUsesPerCustomer: 2 })
  })

  it('falls back to the whole cart for an unknown scope', () => {
    expect(normalizeCoupon({ id: '1', code: 'A', appliesTo: 'nonsense' })?.appliesTo).toBe('cart')
  })

  it('reads relationships as ids whether populated or not', () => {
    const result = normalizeCoupon({
      id: '1',
      categories: [{ id: 'c1' }],
      code: 'A',
      excludedProducts: ['p9'],
      products: ['p1', { id: 'p2' }],
    })

    expect(result).toMatchObject({
      categories: ['c1'],
      excludedProducts: ['p9'],
      products: ['p1', 'p2'],
    })
  })

  it('reads the validity window as dates', () => {
    const result = normalizeCoupon({
      id: '1',
      code: 'A',
      validFrom: '2026-01-01T00:00:00.000Z',
      validUntil: 'not a date',
    })

    expect(result?.validFrom).toBeInstanceOf(Date)
    expect(result?.validUntil).toBeNull()
  })

  it('refuses a document with no code or no id', () => {
    expect(normalizeCoupon({ id: '1' })).toBeNull()
    expect(normalizeCoupon({ code: 'A' })).toBeNull()
    expect(normalizeCoupon(null)).toBeNull()
    expect(normalizeCoupon(undefined)).toBeNull()
  })
})
