import type { CollectionConfig, Config, Field } from 'payload'

import { describe, expect, it } from 'vitest'

import { couponsPlugin } from '../src/index.js'

const cartsCollection: CollectionConfig = {
  slug: 'carts',
  fields: [{ name: 'subtotal', type: 'number' }],
}

const ordersCollection: CollectionConfig = {
  slug: 'orders',
  fields: [{ name: 'amount', type: 'number' }],
}

const productsCollection: CollectionConfig = {
  slug: 'products',
  fields: [{ name: 'title', type: 'text' }],
}

const categoriesCollection: CollectionConfig = {
  slug: 'categories',
  fields: [{ name: 'title', type: 'text' }],
}

const usersCollection: CollectionConfig = { slug: 'users', fields: [] }

const baseConfig = (collections: CollectionConfig[]): Config => ({ collections }) as Config

const fullConfig = (): Config =>
  baseConfig([
    cartsCollection,
    ordersCollection,
    productsCollection,
    categoriesCollection,
    usersCollection,
  ])

const collectionOf = (config: Config, slug: string): CollectionConfig | undefined =>
  config.collections?.find((entry) => entry.slug === slug)

const fieldNames = (config: Config, slug: string): string[] =>
  (collectionOf(config, slug)?.fields ?? []).map((field) =>
    'name' in field && typeof field.name === 'string' ? field.name : '',
  )

const fieldNamed = (fields: Field[], name: string): Field | undefined =>
  fields.find((field) => 'name' in field && field.name === name)

describe('couponsPlugin', () => {
  it('adds the coupons collection', () => {
    const result = couponsPlugin()(fullConfig())

    expect(collectionOf(result, 'coupons')).toBeDefined()
  })

  it('adds the redemptions collection', () => {
    const result = couponsPlugin()(fullConfig())

    expect(collectionOf(result, 'coupon-redemptions')).toBeDefined()
  })

  it('adds the discount and total fields to the cart', () => {
    const result = couponsPlugin()(fullConfig())

    expect(fieldNames(result, 'carts')).toEqual(['subtotal', 'discount', 'total'])
  })

  it('adds the discount field to the order but leaves its amount alone', () => {
    const result = couponsPlugin()(fullConfig())

    expect(fieldNames(result, 'orders')).toEqual(['amount', 'discount'])
  })

  it('honours a custom field name', () => {
    const result = couponsPlugin({ fieldName: 'promotion', totalFieldName: 'payable' })(
      fullConfig(),
    )

    expect(fieldNames(result, 'carts')).toEqual(['subtotal', 'promotion', 'payable'])
  })

  it('honours custom slugs', () => {
    const result = couponsPlugin({
      couponsSlug: 'vouchers',
      redemptionsSlug: 'voucher-uses',
    })(fullConfig())

    expect(collectionOf(result, 'vouchers')).toBeDefined()
    expect(collectionOf(result, 'voucher-uses')).toBeDefined()
  })

  it('adds a cart hook and an order hook', () => {
    const result = couponsPlugin()(fullConfig())

    expect(collectionOf(result, 'carts')?.hooks?.beforeChange).toHaveLength(1)
    expect(collectionOf(result, 'orders')?.hooks?.beforeChange).toHaveLength(1)
    expect(collectionOf(result, 'orders')?.hooks?.afterChange).toHaveLength(1)
  })

  it('keeps hooks that were already on the cart', () => {
    const existing = (): null => null
    const result = couponsPlugin()(
      baseConfig([{ ...cartsCollection, hooks: { beforeChange: [existing as never] } }]),
    )
    const hooks = collectionOf(result, 'carts')?.hooks?.beforeChange

    expect(hooks).toHaveLength(2)
    expect(hooks?.[0]).toBe(existing)
  })

  it('adds the apply and remove endpoints to the cart', () => {
    const result = couponsPlugin()(fullConfig())
    const endpoints = collectionOf(result, 'carts')?.endpoints

    expect(endpoints === false ? [] : (endpoints ?? []).map((entry) => entry.path)).toEqual([
      '/:id/apply-coupon',
      '/:id/remove-coupon',
    ])
  })

  it('adds the validate endpoint to the coupons collection', () => {
    const result = couponsPlugin()(fullConfig())
    const endpoints = collectionOf(result, 'coupons')?.endpoints

    expect(endpoints === false ? [] : (endpoints ?? []).map((entry) => entry.path)).toEqual([
      '/validate',
    ])
  })

  it('leaves endpoints switched off when the cart has switched them off', () => {
    const result = couponsPlugin()(baseConfig([{ ...cartsCollection, endpoints: false }]))

    expect(collectionOf(result, 'carts')?.endpoints).toBe(false)
  })

  it('keeps endpoints the cart already had', () => {
    const existing = { handler: () => Response.json({}), method: 'get' as const, path: '/ping' }
    const result = couponsPlugin()(baseConfig([{ ...cartsCollection, endpoints: [existing] }]))
    const endpoints = collectionOf(result, 'carts')?.endpoints

    expect(endpoints === false ? [] : (endpoints ?? [])[0]).toBe(existing)
  })

  it('leaves other collections untouched', () => {
    const result = couponsPlugin()(fullConfig())

    expect(fieldNames(result, 'products')).toEqual(['title'])
  })

  it('works without a carts collection', () => {
    const result = couponsPlugin()(baseConfig([ordersCollection]))

    expect(collectionOf(result, 'coupons')).toBeDefined()
    expect(fieldNames(result, 'orders')).toEqual(['amount', 'discount'])
  })

  it('leaves out product and category scope when those collections are absent', () => {
    const result = couponsPlugin()(baseConfig([cartsCollection]))
    const names = fieldNames(result, 'coupons')

    expect(names).not.toContain('products')
    expect(names).not.toContain('categories')
    expect(names).not.toContain('excludedProducts')
    expect(names).not.toContain('excludedCategories')
  })

  it('adds product and category scope when those collections are present', () => {
    const names = fieldNames(couponsPlugin()(fullConfig()), 'coupons')

    expect(names).toContain('products')
    expect(names).toContain('categories')
    expect(names).toContain('excludedProducts')
    expect(names).toContain('excludedCategories')
  })

  it('leaves out the customer and order links when those collections are absent', () => {
    const names = fieldNames(couponsPlugin()(baseConfig([cartsCollection])), 'coupon-redemptions')

    expect(names).not.toContain('customer')
    expect(names).not.toContain('order')
  })

  it('still adds every field when disabled, so the database keeps its shape', () => {
    const result = couponsPlugin({ disabled: true })(fullConfig())

    expect(fieldNames(result, 'carts')).toContain('discount')
    expect(collectionOf(result, 'coupons')).toBeDefined()
  })

  it('marks the coupon code unique so the database enforces it', () => {
    const result = couponsPlugin()(fullConfig())
    const code = fieldNamed(collectionOf(result, 'coupons')?.fields ?? [], 'code')

    expect(code).toMatchObject({ index: true, required: true, unique: true })
  })

  it('marks both redemption slots unique, which is the real usage guarantee', () => {
    const result = couponsPlugin()(fullConfig())
    const fields = collectionOf(result, 'coupon-redemptions')?.fields ?? []

    expect(fieldNamed(fields, 'slot')).toMatchObject({ index: true, unique: true })
    expect(fieldNamed(fields, 'customerSlot')).toMatchObject({ index: true, unique: true })
  })

  it('closes the redemptions collection to the api and hides it', () => {
    const collection = collectionOf(couponsPlugin()(fullConfig()), 'coupon-redemptions')

    expect(collection?.admin?.hidden).toBe(true)
    expect(collection?.access?.create?.({} as never)).toBe(false)
    expect(collection?.access?.read?.({} as never)).toBe(false)
    expect(collection?.access?.update?.({} as never)).toBe(false)
    expect(collection?.access?.delete?.({} as never)).toBe(false)
  })

  it('leaves access on the coupons collection to Payload, which requires a login', () => {
    expect(collectionOf(couponsPlugin()(fullConfig()), 'coupons')?.access).toBeUndefined()
  })

  it('offers the currency as a select when currencies are configured', () => {
    const result = couponsPlugin({ currencies: ['EUR', 'USD'] })(fullConfig())
    const amounts = fieldNamed(collectionOf(result, 'coupons')?.fields ?? [], 'amounts')
    const currency =
      amounts && 'fields' in amounts ? fieldNamed(amounts.fields, 'currency') : undefined

    expect(currency?.type).toBe('select')
  })

  it('offers the currency as text when no currencies are configured', () => {
    const result = couponsPlugin()(fullConfig())
    const amounts = fieldNamed(collectionOf(result, 'coupons')?.fields ?? [], 'amounts')
    const currency =
      amounts && 'fields' in amounts ? fieldNamed(amounts.fields, 'currency') : undefined

    expect(currency?.type).toBe('text')
  })

  it('does not touch the rest of the incoming config', () => {
    const input = { ...fullConfig(), serverURL: 'https://shop.example' } as Config
    const result = couponsPlugin()(input)

    expect(result.serverURL).toBe('https://shop.example')
  })
})
