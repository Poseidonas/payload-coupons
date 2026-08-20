import type { CartLine, NormalizedCoupon } from '../src/types.js'

export const coupon = (overrides: Partial<NormalizedCoupon> = {}): NormalizedCoupon => ({
  amounts: {},
  appliesTo: 'cart',
  basisPoints: 1000,
  categories: [],
  code: 'SAVE10',
  enabled: true,
  excludedCategories: [],
  excludedProducts: [],
  freeShipping: false,
  id: '1',
  maximumAmounts: {},
  maxUses: null,
  maxUsesPerCustomer: null,
  minimumAmounts: {},
  products: [],
  type: 'percentage',
  validFrom: null,
  validUntil: null,
  ...overrides,
})

export const line = (overrides: Partial<CartLine> = {}): CartLine => ({
  amount: 1000,
  categories: [],
  index: 0,
  product: 'p1',
  quantity: 1,
  variant: '',
  ...overrides,
})

export const lines = (amounts: number[]): CartLine[] =>
  amounts.map((amount, index) => line({ amount, index, product: `p${index + 1}` }))
