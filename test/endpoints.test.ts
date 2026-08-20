import type { Endpoint, PayloadRequest } from 'payload'

import { describe, expect, it } from 'vitest'

import { resolveConfig } from '../src/config.js'
import {
  applyCouponEndpoint,
  removeCouponEndpoint,
  validateCouponEndpoint,
} from '../src/endpoints.js'
import { fakePayload } from './fake.js'
import type { Store } from './fake.js'

const items = [{ product: 'p1', quantity: 2 }]

const shop = (): Store => ({
  carts: [{ id: 'cart1', currency: 'EUR', items, subtotal: 2000 }],
  coupons: [
    { id: '1', code: 'SAVE10', enabled: true, percentage: 10, type: 'percentage' },
    { id: '2', code: 'GONE', enabled: false, percentage: 10, type: 'percentage' },
    { id: '3', code: 'ONCE', enabled: true, maxUses: 1, percentage: 10, type: 'percentage' },
  ],
  products: [{ id: 'p1', priceInEUR: 1000 }],
})

const request = (store: Store, data: Record<string, unknown>, id?: string): PayloadRequest =>
  ({
    context: {},
    data,
    payload: fakePayload(store),
    routeParams: id === undefined ? {} : { id },
  }) as unknown as PayloadRequest

const call = async (
  endpoint: Endpoint,
  req: PayloadRequest,
): Promise<{ body: Record<string, unknown>; status: number }> => {
  const response = await endpoint.handler(req)

  return { body: (await response.json()) as Record<string, unknown>, status: response.status }
}

const config = resolveConfig()

describe('validateCouponEndpoint', () => {
  const endpoint = validateCouponEndpoint(config)

  it('is mounted on the coupons collection as a post', () => {
    expect(endpoint).toMatchObject({ method: 'post', path: '/validate' })
  })

  it('answers with the discount for a valid code', async () => {
    const { body, status } = await call(
      endpoint,
      request(shop(), { code: 'SAVE10', currency: 'EUR', items }),
    )

    expect(status).toBe(200)
    expect(body).toMatchObject({ valid: true })
    expect((body.discount as { amount: number }).amount).toBe(200)
  })

  it('answers with a reason code and a message when it refuses', async () => {
    const { body, status } = await call(
      endpoint,
      request(shop(), { code: 'GONE', currency: 'EUR', items }),
    )

    expect(status).toBe(200)
    expect(body).toEqual({
      message: 'This code is not active',
      reason: 'DISABLED',
      valid: false,
    })
  })

  it('refuses an empty code with a bad request', async () => {
    const { body, status } = await call(endpoint, request(shop(), { currency: 'EUR', items }))

    expect(status).toBe(400)
    expect(body.reason).toBe('MISSING_CODE')
  })

  it('reads the cart when it is given one', async () => {
    const { body } = await call(endpoint, request(shop(), { cartID: 'cart1', code: 'SAVE10' }))

    expect((body.discount as { amount: number }).amount).toBe(200)
  })

  it('reports a cart it cannot read', async () => {
    const { body, status } = await call(
      endpoint,
      request(shop(), { cartID: 'nope', code: 'SAVE10' }),
    )

    expect(status).toBe(404)
    expect(body.reason).toBe('CART_NOT_FOUND')
  })

  it('claims nothing, so validating twice stays valid', async () => {
    const store = shop()

    await call(endpoint, request(store, { code: 'ONCE', currency: 'EUR', items }))
    const { body } = await call(endpoint, request(store, { code: 'ONCE', currency: 'EUR', items }))

    expect(body.valid).toBe(true)
    expect(store['coupon-redemptions'] ?? []).toHaveLength(0)
  })
})

describe('applyCouponEndpoint', () => {
  const endpoint = applyCouponEndpoint(config)

  it('is mounted on the cart as a post', () => {
    expect(endpoint).toMatchObject({ method: 'post', path: '/:id/apply-coupon' })
  })

  it('writes the code onto the cart', async () => {
    const store = shop()
    const { body, status } = await call(
      endpoint,
      request(store, { code: 'save10' }, 'cart1'),
    )

    expect(status).toBe(200)
    expect(body.valid).toBe(true)
    expect(store.carts?.[0]?.discount).toEqual({ code: 'SAVE10' })
  })

  it('refuses a code the cart cannot use and leaves the cart alone', async () => {
    const store = shop()
    const { body, status } = await call(endpoint, request(store, { code: 'GONE' }, 'cart1'))

    expect(status).toBe(422)
    expect(body).toMatchObject({ reason: 'DISABLED', valid: false })
    expect(store.carts?.[0]?.discount).toBeUndefined()
  })

  it('reports a cart it cannot read', async () => {
    const { status } = await call(endpoint, request(shop(), { code: 'SAVE10' }, 'nope'))

    expect(status).toBe(404)
  })

  it('needs a cart id', async () => {
    const { body, status } = await call(endpoint, request(shop(), { code: 'SAVE10' }))

    expect(status).toBe(404)
    expect(body.reason).toBe('CART_NOT_FOUND')
  })

  it('needs a code', async () => {
    const { status } = await call(endpoint, request(shop(), {}, 'cart1'))

    expect(status).toBe(400)
  })
})

describe('removeCouponEndpoint', () => {
  const endpoint = removeCouponEndpoint(config)

  it('is mounted on the cart as a post', () => {
    expect(endpoint).toMatchObject({ method: 'post', path: '/:id/remove-coupon' })
  })

  it('clears the code on the cart', async () => {
    const store = shop()

    store.carts = [{ id: 'cart1', currency: 'EUR', discount: { code: 'SAVE10' }, items }]

    const { status } = await call(endpoint, request(store, {}, 'cart1'))

    expect(status).toBe(200)
    expect(store.carts[0]?.discount).toEqual({ code: '' })
  })

  it('reports a cart it cannot read', async () => {
    const { status } = await call(endpoint, request(shop(), {}, 'nope'))

    expect(status).toBe(404)
  })
})
