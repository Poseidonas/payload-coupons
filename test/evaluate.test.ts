import { describe, expect, it } from 'vitest'

import { resolveConfig } from '../src/config.js'
import { evaluateCode } from '../src/evaluate.js'
import { fakeRequest } from './fake.js'
import type { Store } from './fake.js'

const shop = (): Store => ({
  coupons: [
    { id: '1', code: 'SAVE10', enabled: true, percentage: 10, type: 'percentage' },
    {
      id: '2',
      amounts: [{ amount: 500, currency: 'EUR' }],
      code: 'FIVEOFF',
      enabled: true,
      type: 'fixed',
    },
    {
      id: '3',
      appliesTo: 'categories',
      categories: ['c2'],
      code: 'HATS',
      enabled: true,
      percentage: 50,
      type: 'percentage',
    },
    { id: '4', code: 'ONCE', enabled: true, maxUses: 1, percentage: 10, type: 'percentage' },
  ],
  products: [
    { id: 'p1', categories: ['c1'], priceInEUR: 1000 },
    { id: 'p2', categories: ['c2'], priceInEUR: 2000 },
    { id: 'p3', categories: [] },
  ],
})

const items = [{ product: 'p1', quantity: 2 }]

const evaluate = (store: Store, overrides: Record<string, unknown> = {}) =>
  evaluateCode({
    claim: false,
    code: 'SAVE10',
    config: resolveConfig(),
    currency: 'EUR',
    customer: '',
    items,
    req: fakeRequest(store),
    ...overrides,
  })

describe('evaluateCode', () => {
  it('returns the discount for a valid code', async () => {
    const result = await evaluate(shop())

    expect(result.valid).toBe(true)
    expect(result.valid && result.discount.amount).toBe(200)
  })

  it('multiplies the unit price by the quantity', async () => {
    const result = await evaluate(shop(), { items: [{ product: 'p1', quantity: 3 }] })

    expect(result.valid && result.discount.amount).toBe(300)
  })

  it('refuses an empty code', async () => {
    const result = await evaluate(shop(), { code: '   ' })

    expect(result).toMatchObject({ reason: 'MISSING_CODE', valid: false })
  })

  it('refuses a code that does not exist', async () => {
    const result = await evaluate(shop(), { code: 'NOPE' })

    expect(result).toMatchObject({ reason: 'NOT_FOUND', valid: false })
  })

  it('matches a code regardless of how it was typed', async () => {
    const result = await evaluate(shop(), { code: ' save10 ' })

    expect(result.valid).toBe(true)
  })

  it('refuses a product with no price in the cart currency', async () => {
    const result = await evaluate(shop(), { items: [{ product: 'p3', quantity: 1 }] })

    expect(result).toMatchObject({ reason: 'MISSING_PRICE', valid: false })
  })

  it('refuses a fixed coupon in a currency it has no amount for', async () => {
    const result = await evaluate(shop(), { code: 'FIVEOFF', currency: 'USD' })

    expect(result).toMatchObject({ reason: 'CURRENCY_NOT_SUPPORTED', valid: false })
  })

  it('applies a fixed coupon in a currency it does have', async () => {
    const result = await evaluate(shop(), { code: 'FIVEOFF' })

    expect(result.valid && result.discount.amount).toBe(500)
  })

  it('reads categories from the product for a category scoped coupon', async () => {
    const result = await evaluate(shop(), {
      code: 'HATS',
      items: [
        { product: 'p1', quantity: 1 },
        { product: 'p2', quantity: 1 },
      ],
    })

    expect(result.valid && result.discount.amount).toBe(1000)
    expect(result.valid && result.discount.lines).toEqual([{ amount: 1000, index: 1 }])
  })

  it('refuses when the category scope matches nothing', async () => {
    const result = await evaluate(shop(), { code: 'HATS', items: [{ product: 'p1', quantity: 1 }] })

    expect(result).toMatchObject({ reason: 'NO_ELIGIBLE_ITEMS', valid: false })
  })

  it('uses a custom line amount resolver when one is given', async () => {
    const result = await evaluateCode({
      claim: false,
      code: 'SAVE10',
      config: resolveConfig({ resolveLineAmount: () => 5000 }),
      currency: 'EUR',
      customer: '',
      items,
      req: fakeRequest(shop()),
    })

    expect(result.valid && result.discount.amount).toBe(500)
  })

  it('claims a use when asked to', async () => {
    const store = shop()
    const result = await evaluate(store, { claim: true, code: 'ONCE' })

    expect(result.valid).toBe(true)
    expect(store['coupon-redemptions']).toHaveLength(1)
  })

  it('does not claim a use when only validating', async () => {
    const store = shop()

    await evaluate(store, { code: 'ONCE' })

    expect(store['coupon-redemptions'] ?? []).toHaveLength(0)
  })

  it('refuses once every use has been claimed', async () => {
    const store = shop()

    await evaluate(store, { claim: true, code: 'ONCE' })
    const second = await evaluate(store, { claim: true, code: 'ONCE' })

    expect(second).toMatchObject({ reason: 'USAGE_LIMIT_REACHED', valid: false })
    expect(store['coupon-redemptions']).toHaveLength(1)
  })

  it('refuses a code on an empty cart', async () => {
    const result = await evaluate(shop(), { items: [] })

    expect(result).toMatchObject({ reason: 'EMPTY_CART', valid: false })
  })

  it('reports no redemption when only validating', async () => {
    const result = await evaluate(shop())

    expect(result.valid && result.redemptionID).toBeNull()
  })
})
