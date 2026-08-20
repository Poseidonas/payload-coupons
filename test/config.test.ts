import { describe, expect, it } from 'vitest'

import { defaultPriceField, resolveConfig } from '../src/config.js'

describe('resolveConfig', () => {
  it('fills in the documented defaults', () => {
    const config = resolveConfig()

    expect(config).toMatchObject({
      attempts: 25,
      cartsSlug: 'carts',
      categoriesSlug: 'categories',
      categoryField: 'categories',
      couponsSlug: 'coupons',
      currencies: [],
      customersSlug: 'users',
      disabled: false,
      fieldName: 'discount',
      ordersSlug: 'orders',
      productsSlug: 'products',
      redemptionsSlug: 'coupon-redemptions',
      refuseOrderOnInvalidCoupon: false,
      resolveLineAmount: null,
      totalFieldName: 'total',
      variantsSlug: 'variants',
    })
    expect(config.priceField).toBe(defaultPriceField)
  })

  it('names the price field the way the official ecommerce plugin does', () => {
    expect(resolveConfig().priceField('EUR')).toBe('priceInEUR')
  })

  it('keeps a custom price field resolver', () => {
    const config = resolveConfig({ priceField: (currency) => `cost_${currency}` })

    expect(config.priceField('USD')).toBe('cost_USD')
  })

  it('rejects a zero or negative attempts rather than using it', () => {
    expect(resolveConfig({ attempts: 0 }).attempts).toBe(25)
    expect(resolveConfig({ attempts: -5 }).attempts).toBe(25)
  })

  it('truncates a fractional attempts', () => {
    expect(resolveConfig({ attempts: 9.9 }).attempts).toBe(9)
  })

  it('falls back when a slug is given as an empty string', () => {
    expect(resolveConfig({ cartsSlug: '', couponsSlug: '' })).toMatchObject({
      cartsSlug: 'carts',
      couponsSlug: 'coupons',
    })
  })

  it('uppercases and trims the currency list', () => {
    expect(resolveConfig({ currencies: [' eur ', 'usd'] }).currencies).toEqual(['EUR', 'USD'])
  })

  it('drops entries in the currency list that are not usable', () => {
    expect(resolveConfig({ currencies: ['EUR', '', '  '] }).currencies).toEqual(['EUR'])
  })

  it('only treats an exact true as disabled', () => {
    expect(resolveConfig({ disabled: true }).disabled).toBe(true)
    expect(resolveConfig({ disabled: false }).disabled).toBe(false)
  })

  it('only treats an exact true as refusing invalid orders', () => {
    expect(resolveConfig({ refuseOrderOnInvalidCoupon: true }).refuseOrderOnInvalidCoupon).toBe(
      true,
    )
  })
})
