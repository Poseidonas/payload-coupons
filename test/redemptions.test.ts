import { describe, expect, it } from 'vitest'

import { resolveConfig } from '../src/config.js'
import { claimRedemption, countUses, releaseRedemption } from '../src/redemptions.js'
import { fakePayload } from './fake.js'
import type { Store } from './fake.js'
import { coupon } from './factories.js'

const config = resolveConfig()

const claim = (store: Store, overrides: Parameters<typeof coupon>[0] = {}, customer = '') =>
  claimRedemption({
    amount: 100,
    config,
    coupon: coupon(overrides),
    currency: 'EUR',
    customer,
    payload: fakePayload(store),
  })

describe('claimRedemption', () => {
  it('records a redemption for a coupon with no limits', async () => {
    const store: Store = {}
    const result = await claim(store)

    expect(result.valid).toBe(true)
    expect(store['coupon-redemptions']).toHaveLength(1)
  })

  it('leaves the slot empty when there is no limit to enforce', async () => {
    const store: Store = {}

    await claim(store)

    expect(store['coupon-redemptions']?.[0]?.slot).toBeUndefined()
  })

  it('numbers the slots in sequence when a total limit is set', async () => {
    const store: Store = {}

    await claim(store, { maxUses: 3 })
    await claim(store, { maxUses: 3 })

    expect(store['coupon-redemptions']?.map((row) => row.slot)).toEqual(['1#1', '1#2'])
  })

  it('refuses once the total limit is reached', async () => {
    const store: Store = {}

    await claim(store, { maxUses: 2 })
    await claim(store, { maxUses: 2 })
    const third = await claim(store, { maxUses: 2 })

    expect(third).toEqual({ reason: 'USAGE_LIMIT_REACHED', valid: false })
  })

  it('lets only one of two simultaneous claims take the last use', async () => {
    const store: Store = {}
    const payload = fakePayload(store)
    const both = await Promise.all([
      claimRedemption({
        amount: 100,
        config,
        coupon: coupon({ maxUses: 1 }),
        currency: 'EUR',
        customer: '',
        payload,
      }),
      claimRedemption({
        amount: 100,
        config,
        coupon: coupon({ maxUses: 1 }),
        currency: 'EUR',
        customer: '',
        payload,
      }),
    ])

    expect(both.filter((entry) => entry.valid)).toHaveLength(1)
    expect(both.filter((entry) => !entry.valid)).toHaveLength(1)
    expect(store['coupon-redemptions']).toHaveLength(1)
  })

  it('never lets twenty simultaneous claims exceed the limit', async () => {
    const store: Store = {}
    const payload = fakePayload(store)
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        claimRedemption({
          amount: 100,
          config,
          coupon: coupon({ maxUses: 5 }),
          currency: 'EUR',
          customer: '',
          payload,
        }),
      ),
    )

    expect(results.filter((entry) => entry.valid)).toHaveLength(5)
    expect(store['coupon-redemptions']).toHaveLength(5)
    expect(new Set(store['coupon-redemptions']?.map((row) => row.slot)).size).toBe(5)
  })

  it('counts uses per customer separately', async () => {
    const store: Store = {}

    await claim(store, { maxUsesPerCustomer: 1 }, 'c1')
    const second = await claim(store, { maxUsesPerCustomer: 1 }, 'c1')
    const other = await claim(store, { maxUsesPerCustomer: 1 }, 'c2')

    expect(second).toEqual({ reason: 'CUSTOMER_LIMIT_REACHED', valid: false })
    expect(other.valid).toBe(true)
  })

  it('refuses a guest when a per customer limit is set', async () => {
    const store: Store = {}

    expect(await claim(store, { maxUsesPerCustomer: 1 })).toEqual({
      reason: 'CUSTOMER_REQUIRED',
      valid: false,
    })
  })

  it('enforces both limits at once', async () => {
    const store: Store = {}

    await claim(store, { maxUses: 2, maxUsesPerCustomer: 1 }, 'c1')
    const sameCustomer = await claim(store, { maxUses: 2, maxUsesPerCustomer: 1 }, 'c1')
    const otherCustomer = await claim(store, { maxUses: 2, maxUsesPerCustomer: 1 }, 'c2')
    const third = await claim(store, { maxUses: 2, maxUsesPerCustomer: 1 }, 'c3')

    expect(sameCustomer).toEqual({ reason: 'CUSTOMER_LIMIT_REACHED', valid: false })
    expect(otherCustomer.valid).toBe(true)
    expect(third).toEqual({ reason: 'USAGE_LIMIT_REACHED', valid: false })
  })

  it('stores what was taken off and in which currency', async () => {
    const store: Store = {}

    await claim(store, { maxUses: 1 })

    expect(store['coupon-redemptions']?.[0]).toMatchObject({
      amount: 100,
      code: 'SAVE10',
      currency: 'EUR',
    })
  })
})

describe('countUses', () => {
  it('counts every redemption of a coupon', async () => {
    const store: Store = {}

    await claim(store, { maxUses: 5 }, 'c1')
    await claim(store, { maxUses: 5 }, 'c2')

    expect(await countUses({ config, coupon: '1', payload: fakePayload(store) })).toBe(2)
  })

  it('counts the redemptions of one customer', async () => {
    const store: Store = {}

    await claim(store, { maxUses: 5 }, 'c1')
    await claim(store, { maxUses: 5 }, 'c2')

    expect(
      await countUses({ config, coupon: '1', customer: 'c1', payload: fakePayload(store) }),
    ).toBe(1)
  })
})

describe('releaseRedemption', () => {
  it('returns a claimed use to the pool', async () => {
    const store: Store = {}
    const payload = fakePayload(store)
    const claimed = await claimRedemption({
      amount: 100,
      config,
      coupon: coupon({ maxUses: 1 }),
      currency: 'EUR',
      customer: '',
      payload,
    })

    expect(claimed.valid).toBe(true)

    const released = await releaseRedemption({
      config,
      id: claimed.valid ? claimed.id : '',
      payload,
    })

    expect(released).toBe(true)
    expect(store['coupon-redemptions']).toHaveLength(0)
  })

  it('reports failure rather than throwing when there is nothing to release', async () => {
    expect(await releaseRedemption({ config, id: 'missing', payload: fakePayload({}) })).toBe(false)
  })
})
