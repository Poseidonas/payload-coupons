import type { CollectionBeforeValidateHook, CollectionConfig, Field } from 'payload'

import { APIError } from 'payload'

import { amountsField } from './fields.js'
import { toInteger } from './money.js'
import { normalizeCode, toDate } from './normalize.js'
import type { AvailableCollections, ResolvedConfig } from './types.js'

type AmountEntry = { amount?: unknown; currency?: unknown }

const entriesOf = (value: unknown): AmountEntry[] =>
  Array.isArray(value) ? value.filter((entry): entry is AmountEntry => Boolean(entry)) : []

const normalizeAmounts = (value: unknown, label: string): AmountEntry[] => {
  const entries = entriesOf(value)
  const seen = new Set<string>()

  return entries.map((entry) => {
    const currency = typeof entry.currency === 'string' ? entry.currency.trim().toUpperCase() : ''

    if (currency === '') {
      throw new APIError(`Every ${label} entry needs a currency`, 400)
    }

    if (seen.has(currency)) {
      throw new APIError(`${label} has more than one entry for ${currency}`, 400)
    }

    seen.add(currency)

    const amount = toInteger(entry.amount)

    if (amount === null || amount < 0) {
      throw new APIError(`Every ${label} entry needs a whole amount of 0 or more`, 400)
    }

    return { ...entry, amount, currency }
  })
}

const amountFor = (entries: AmountEntry[], currency: string): null | number => {
  for (const entry of entries) {
    if (entry.currency === currency) {
      return toInteger(entry.amount)
    }
  }

  return null
}

export const validateCoupon = (): CollectionBeforeValidateHook => ({ data, originalDoc }) => {
  if (!data) {
    return data
  }

  const merged = { ...(originalDoc as Record<string, unknown> | undefined), ...data } as Record<
    string,
    unknown
  >
  const code = normalizeCode(merged.code)

  if (code === '') {
    throw new APIError('A coupon needs a code', 400)
  }

  const type = merged.type === 'fixed' ? 'fixed' : 'percentage'
  const amounts = normalizeAmounts(merged.amounts, 'Fixed amount')
  const minimums = normalizeAmounts(merged.minimumAmounts, 'Minimum amount')
  const maximums = normalizeAmounts(merged.maximumAmounts, 'Maximum amount')

  if (type === 'percentage') {
    const percentage = merged.percentage

    if (typeof percentage !== 'number' || !Number.isFinite(percentage) || percentage <= 0) {
      throw new APIError('A percentage coupon needs a percentage above 0', 400)
    }

    if (percentage > 100) {
      throw new APIError('A percentage coupon cannot exceed 100', 400)
    }
  }

  if (type === 'fixed' && amounts.length === 0) {
    throw new APIError('A fixed coupon needs an amount for at least one currency', 400)
  }

  for (const entry of minimums) {
    const currency = String(entry.currency)
    const maximum = amountFor(maximums, currency)
    const minimum = toInteger(entry.amount) ?? 0

    if (maximum !== null && maximum < minimum) {
      throw new APIError(`The maximum for ${currency} is below the minimum`, 400)
    }
  }

  const from = toDate(merged.validFrom)
  const until = toDate(merged.validUntil)

  if (from && until && until.getTime() < from.getTime()) {
    throw new APIError('The end of the validity window is before its start', 400)
  }

  if (merged.appliesTo === 'products' && !Array.isArray(merged.products)) {
    throw new APIError('A coupon scoped to products needs at least one product', 400)
  }

  if (merged.appliesTo === 'categories' && !Array.isArray(merged.categories)) {
    throw new APIError('A coupon scoped to categories needs at least one category', 400)
  }

  return {
    ...data,
    ...('amounts' in data ? { amounts } : {}),
    ...('maximumAmounts' in data ? { maximumAmounts: maximums } : {}),
    ...('minimumAmounts' in data ? { minimumAmounts: minimums } : {}),
    code,
  }
}

export const couponsCollection = (
  config: ResolvedConfig,
  available: AvailableCollections,
): CollectionConfig => {
  const relationship = (name: string, relationTo: string, label: string): Field => ({
    name,
    type: 'relationship',
    hasMany: true,
    label,
    relationTo,
  })

  const fields: Field[] = [
    {
      name: 'code',
      type: 'text',
      index: true,
      label: 'Code',
      required: true,
      unique: true,
    },
    {
      name: 'enabled',
      type: 'checkbox',
      defaultValue: true,
      label: 'Enabled',
    },
    {
      name: 'type',
      type: 'select',
      defaultValue: 'percentage',
      label: 'Discount type',
      options: [
        { label: 'Percentage', value: 'percentage' },
        { label: 'Fixed amount', value: 'fixed' },
      ],
      required: true,
    },
    {
      name: 'percentage',
      type: 'number',
      label: 'Percentage off',
      max: 100,
      min: 0,
    },
    amountsField(config, 'amounts', 'Fixed amount per currency'),
    {
      name: 'freeShipping',
      type: 'checkbox',
      label: 'Free shipping',
    },
    {
      name: 'appliesTo',
      type: 'select',
      defaultValue: 'cart',
      label: 'Applies to',
      options: [
        { label: 'Whole cart', value: 'cart' },
        { label: 'Selected products', value: 'products' },
        { label: 'Selected categories', value: 'categories' },
      ],
      required: true,
    },
    ...(available.products ? [relationship('products', config.productsSlug, 'Products')] : []),
    ...(available.categories
      ? [relationship('categories', config.categoriesSlug, 'Categories')]
      : []),
    ...(available.products
      ? [relationship('excludedProducts', config.productsSlug, 'Excluded products')]
      : []),
    ...(available.categories
      ? [relationship('excludedCategories', config.categoriesSlug, 'Excluded categories')]
      : []),
    amountsField(config, 'minimumAmounts', 'Minimum cart amount per currency'),
    amountsField(config, 'maximumAmounts', 'Maximum cart amount per currency'),
    {
      name: 'maxUses',
      type: 'number',
      label: 'Total uses allowed',
      min: 0,
    },
    {
      name: 'maxUsesPerCustomer',
      type: 'number',
      label: 'Uses allowed per customer',
      min: 0,
    },
    {
      name: 'validFrom',
      type: 'date',
      label: 'Valid from',
    },
    {
      name: 'validUntil',
      type: 'date',
      label: 'Valid until',
    },
  ]

  return {
    slug: config.couponsSlug,
    admin: {
      defaultColumns: ['code', 'type', 'enabled', 'validUntil'],
      useAsTitle: 'code',
    },
    fields,
    hooks: {
      beforeValidate: [validateCoupon()],
    },
    labels: {
      plural: 'Coupons',
      singular: 'Coupon',
    },
    timestamps: true,
  }
}
