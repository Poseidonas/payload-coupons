import type { Field } from 'payload'

import type { ResolvedConfig } from './types.js'

export const currencyField = (config: ResolvedConfig): Field =>
  config.currencies.length > 0
    ? {
        name: 'currency',
        type: 'select',
        index: true,
        label: 'Currency',
        options: config.currencies.map((code) => ({ label: code, value: code })),
        required: true,
      }
    : {
        name: 'currency',
        type: 'text',
        index: true,
        label: 'Currency',
        required: true,
      }

export const amountsField = (
  config: ResolvedConfig,
  name: string,
  label: string,
): Field => ({
  name,
  type: 'array',
  fields: [
    currencyField(config),
    {
      name: 'amount',
      type: 'number',
      label: 'Amount in minor units',
      min: 0,
      required: true,
    },
  ],
  label,
})

export const discountField = (config: ResolvedConfig): Field => ({
  name: config.fieldName,
  type: 'group',
  fields: [
    {
      name: 'code',
      type: 'text',
      index: true,
      label: 'Coupon code',
    },
    {
      name: 'coupon',
      type: 'relationship',
      admin: {
        readOnly: true,
      },
      label: 'Coupon',
      relationTo: config.couponsSlug,
    },
    {
      name: 'type',
      type: 'select',
      admin: {
        readOnly: true,
      },
      label: 'Discount type',
      options: [
        { label: 'Percentage', value: 'percentage' },
        { label: 'Fixed amount', value: 'fixed' },
      ],
    },
    {
      name: 'value',
      type: 'number',
      admin: {
        readOnly: true,
      },
      label: 'Basis points or fixed amount',
    },
    {
      name: 'amount',
      type: 'number',
      admin: {
        readOnly: true,
      },
      label: 'Amount deducted in minor units',
    },
    {
      name: 'currency',
      type: 'text',
      admin: {
        readOnly: true,
      },
      label: 'Currency',
    },
    {
      name: 'freeShipping',
      type: 'checkbox',
      admin: {
        readOnly: true,
      },
      label: 'Free shipping',
    },
    {
      name: 'lines',
      type: 'array',
      admin: {
        readOnly: true,
      },
      fields: [
        { name: 'index', type: 'number', label: 'Item position' },
        { name: 'amount', type: 'number', label: 'Amount deducted in minor units' },
      ],
      label: 'Per item allocation',
    },
  ],
  label: 'Discount',
})

export const totalField = (config: ResolvedConfig): Field => ({
  name: config.totalFieldName,
  type: 'number',
  admin: {
    position: 'sidebar',
    readOnly: true,
  },
  label: 'Total after discount',
})
