import type { DiscountResult } from './types.js'

export type StoredDiscount = {
  amount: number
  code: string
  coupon: null | string
  currency: string
  freeShipping: boolean
  lines: { amount: number; index: number }[]
  type: null | string
  value: number
}

export const emptyDiscount = (): StoredDiscount => ({
  amount: 0,
  code: '',
  coupon: null,
  currency: '',
  freeShipping: false,
  lines: [],
  type: null,
  value: 0,
})

export const toStoredDiscount = (discount: DiscountResult): StoredDiscount => ({
  amount: discount.amount,
  code: discount.code,
  coupon: discount.coupon,
  currency: discount.currency,
  freeShipping: discount.freeShipping,
  lines: discount.lines.map((line) => ({ amount: line.amount, index: line.index })),
  type: discount.type,
  value: discount.value,
})
