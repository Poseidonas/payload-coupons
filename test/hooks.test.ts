import { describe, expect, it } from 'vitest'

import { applyCartDiscount } from '../src/cart.js'
import { resolveConfig } from '../src/config.js'
import { linkOrderRedemption, redeemOrderCoupon, redemptionContextKey } from '../src/order.js'
import { fakeRequest } from './fake.js'
import type { Store } from './fake.js'

const shop = (): Store => ({
  coupons: [
    { id: '1', code: 'SAVE10', enabled: true, percentage: 10, type: 'percentage' },
    { id: '2', code: 'GONE', enabled: false, percentage: 10, type: 'percentage' },
    {
      id: '3',
      amounts: [{ amount: 100000, currency: 'EUR' }],
      code: 'HUGE',
      enabled: true,
      type: 'fixed',
    },
    { id: '4', code: 'ONCE', enabled: true, maxUses: 1, percentage: 10, type: 'percentage' },
  ],
  products: [{ id: 'p1', priceInEUR: 1000 }],
})

const items = [{ product: 'p1', quantity: 2 }]

const runCart = async (
  data: Record<string, unknown>,
  store: Store,
  options: Parameters<typeof resolveConfig>[0] = {},
  originalDoc?: Record<string, unknown>,
): Promise<Record<string, unknown>> => {
  const hook = applyCartDiscount(resolveConfig(options))
  const result = await hook({
    data,
    operation: 'update',
    originalDoc,
    req: fakeRequest(store),
  } as never)

  return result as Record<string, unknown>
}

describe('applyCartDiscount', () => {
  it('writes the discount and the total after it', async () => {
    const result = await runCart(
      { currency: 'EUR', discount: { code: 'SAVE10' }, items, subtotal: 2000 },
      shop(),
    )

    expect(result.discount).toMatchObject({ amount: 200, code: 'SAVE10', value: 1000 })
    expect(result.total).toBe(1800)
  })

  it('leaves the subtotal exactly as it found it', async () => {
    const result = await runCart(
      { currency: 'EUR', discount: { code: 'SAVE10' }, items, subtotal: 2000 },
      shop(),
    )

    expect(result.subtotal).toBe(2000)
  })

  it('records which line the discount came off', async () => {
    const result = await runCart(
      { currency: 'EUR', discount: { code: 'SAVE10' }, items, subtotal: 2000 },
      shop(),
    )

    expect((result.discount as { lines: unknown }).lines).toEqual([{ amount: 200, index: 0 }])
  })

  it('clears a code that is no longer valid', async () => {
    const result = await runCart(
      { currency: 'EUR', discount: { code: 'GONE' }, items, subtotal: 2000 },
      shop(),
    )

    expect(result.discount).toMatchObject({ amount: 0, code: '', coupon: null })
    expect(result.total).toBe(2000)
  })

  it('sets the total to the subtotal when there is no code', async () => {
    const result = await runCart({ currency: 'EUR', items, subtotal: 2000 }, shop())

    expect(result.total).toBe(2000)
    expect(result.discount).toMatchObject({ amount: 0 })
  })

  it('never lets the total go below zero', async () => {
    const result = await runCart(
      { currency: 'EUR', discount: { code: 'HUGE' }, items, subtotal: 2000 },
      shop(),
    )

    expect((result.discount as { amount: number }).amount).toBe(2000)
    expect(result.total).toBe(0)
  })

  it('reads the code from the stored cart when the update does not send one', async () => {
    const result = await runCart({ subtotal: 2000 }, shop(), {}, {
      currency: 'EUR',
      discount: { code: 'SAVE10' },
      items,
      subtotal: 2000,
    })

    expect(result.total).toBe(1800)
  })

  it('does nothing at all when the plugin is disabled', async () => {
    const data = { currency: 'EUR', discount: { code: 'SAVE10' }, items, subtotal: 2000 }
    const result = await runCart(data, shop(), { disabled: true })

    expect(result).toBe(data)
    expect(result.total).toBeUndefined()
  })

  it('claims nothing while a cart is being saved', async () => {
    const store = shop()

    await runCart({ currency: 'EUR', discount: { code: 'ONCE' }, items, subtotal: 2000 }, store)

    expect(store['coupon-redemptions'] ?? []).toHaveLength(0)
  })

  it('uses a custom field name', async () => {
    const result = await runCart(
      { currency: 'EUR', items, promo: { code: 'SAVE10' }, subtotal: 2000 },
      shop(),
      { fieldName: 'promo', totalFieldName: 'payable' },
    )

    expect((result.promo as { amount: number }).amount).toBe(200)
    expect(result.payable).toBe(1800)
  })
})

const runOrder = async (
  data: Record<string, unknown>,
  store: Store,
  options: Parameters<typeof resolveConfig>[0] = {},
  operation: 'create' | 'update' = 'create',
): Promise<{ req: ReturnType<typeof fakeRequest>; result: Record<string, unknown> }> => {
  const req = fakeRequest(store)
  const hook = redeemOrderCoupon(resolveConfig(options))
  const result = await hook({ data, operation, req } as never)

  return { req, result: result as Record<string, unknown> }
}

describe('redeemOrderCoupon', () => {
  it('writes the discount and claims a use', async () => {
    const store = shop()
    const { req, result } = await runOrder(
      { amount: 1800, currency: 'EUR', discount: { code: 'SAVE10' }, items },
      store,
    )

    expect(result.discount).toMatchObject({ amount: 200, code: 'SAVE10', type: 'percentage' })
    expect(store['coupon-redemptions']).toHaveLength(1)
    expect(req.context[redemptionContextKey]).toBeDefined()
  })

  it('never changes the amount charged', async () => {
    const { result } = await runOrder(
      { amount: 1800, currency: 'EUR', discount: { code: 'SAVE10' }, items },
      shop(),
    )

    expect(result.amount).toBe(1800)
  })

  it('does nothing on an update', async () => {
    const data = { amount: 1800, currency: 'EUR', discount: { code: 'SAVE10' }, items }
    const { result } = await runOrder(data, shop(), {}, 'update')

    expect(result).toBe(data)
  })

  it('does nothing when the order carries no code', async () => {
    const data = { amount: 2000, currency: 'EUR', items }
    const { result } = await runOrder(data, shop())

    expect(result).toBe(data)
  })

  it('saves the order without a discount when the code cannot be redeemed', async () => {
    const store = shop()
    const { result } = await runOrder(
      { amount: 2000, currency: 'EUR', discount: { code: 'GONE' }, items },
      store,
    )

    expect(result.discount).toMatchObject({ amount: 0, code: '' })
    expect(store['coupon-redemptions'] ?? []).toHaveLength(0)
  })

  it('refuses the order instead when asked to', async () => {
    await expect(
      runOrder({ amount: 2000, currency: 'EUR', discount: { code: 'GONE' }, items }, shop(), {
        refuseOrderOnInvalidCoupon: true,
      }),
    ).rejects.toThrow('This code is not active')
  })

  it('refuses a second order for a coupon with one use left', async () => {
    const store = shop()

    await runOrder({ amount: 1800, currency: 'EUR', discount: { code: 'ONCE' }, items }, store)
    const { result } = await runOrder(
      { amount: 1800, currency: 'EUR', discount: { code: 'ONCE' }, items },
      store,
    )

    expect(result.discount).toMatchObject({ amount: 0, code: '' })
    expect(store['coupon-redemptions']).toHaveLength(1)
  })
})

describe('linkOrderRedemption', () => {
  it('points the redemption at the order that claimed it', async () => {
    const store = shop()
    const config = resolveConfig()
    const req = fakeRequest(store)
    const before = redeemOrderCoupon(config)

    await before({
      data: { amount: 1800, currency: 'EUR', discount: { code: 'SAVE10' }, items },
      operation: 'create',
      req,
    } as never)

    await linkOrderRedemption(config)({ doc: { id: 'o1' }, operation: 'create', req } as never)

    expect(store['coupon-redemptions']?.[0]?.order).toBe('o1')
    expect(req.context[redemptionContextKey]).toBeUndefined()
  })

  it('does nothing when no use was claimed', async () => {
    const store = shop()
    const req = fakeRequest(store)
    const doc = { id: 'o1' }
    const result = await linkOrderRedemption(resolveConfig())({
      doc,
      operation: 'create',
      req,
    } as never)

    expect(result).toBe(doc)
  })
})
