import { describe, expect, it } from 'vitest'

import { refusalMessage, refusalReasons } from '../src/reasons.js'

describe('refusalReasons', () => {
  it('keeps the published set of reason codes', () => {
    expect(Object.keys(refusalReasons).sort()).toEqual([
      'CART_NOT_FOUND',
      'CURRENCY_NOT_SUPPORTED',
      'CUSTOMER_LIMIT_REACHED',
      'CUSTOMER_REQUIRED',
      'DISABLED',
      'EMPTY_CART',
      'EXPIRED',
      'MAXIMUM_EXCEEDED',
      'MINIMUM_NOT_MET',
      'MISSING_CODE',
      'MISSING_PRICE',
      'NOT_FOUND',
      'NOT_STARTED',
      'NO_ELIGIBLE_ITEMS',
      'REDEMPTION_CONFLICT',
      'USAGE_LIMIT_REACHED',
    ])
  })

  it('gives every reason a message', () => {
    Object.keys(refusalReasons).forEach((reason) => {
      expect(refusalMessage(reason as keyof typeof refusalReasons)).not.toBe('')
    })
  })

  it('does not leak the coupon configuration in a message', () => {
    expect(refusalMessage('USAGE_LIMIT_REACHED')).not.toMatch(/\d/)
  })
})
