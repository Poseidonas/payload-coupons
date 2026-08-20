import { describe, expect, it } from 'vitest'

import { emptyDiscount, toStoredDiscount } from '../src/stored.js'

describe('emptyDiscount', () => {
  it('holds no money and no coupon', () => {
    expect(emptyDiscount()).toEqual({
      amount: 0,
      code: '',
      coupon: null,
      currency: '',
      freeShipping: false,
      lines: [],
      type: null,
      value: 0,
    })
  })
})

describe('toStoredDiscount', () => {
  it('keeps the code, type, value and amount deducted', () => {
    const stored = toStoredDiscount({
      amount: 250,
      code: 'SAVE10',
      coupon: '7',
      currency: 'EUR',
      freeShipping: true,
      lines: [{ amount: 250, index: 0 }],
      type: 'percentage',
      value: 1000,
    })

    expect(stored).toEqual({
      amount: 250,
      code: 'SAVE10',
      coupon: '7',
      currency: 'EUR',
      freeShipping: true,
      lines: [{ amount: 250, index: 0 }],
      type: 'percentage',
      value: 1000,
    })
  })
})
