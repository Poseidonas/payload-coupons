export const refusalReasons = {
  CART_NOT_FOUND: 'The cart could not be found or is not accessible',
  CURRENCY_NOT_SUPPORTED: 'This code has no amount set for that currency',
  CUSTOMER_LIMIT_REACHED: 'This code has already been used the maximum number of times by this customer',
  CUSTOMER_REQUIRED: 'This code can only be used by a signed in customer',
  DISABLED: 'This code is not active',
  EMPTY_CART: 'The cart has no items',
  EXPIRED: 'This code has expired',
  MAXIMUM_EXCEEDED: 'The cart total is above the maximum for this code',
  MINIMUM_NOT_MET: 'The cart total is below the minimum for this code',
  MISSING_CODE: 'No code was given',
  MISSING_PRICE: 'An item in the cart has no price in that currency',
  NOT_FOUND: 'No code matches what was entered',
  NOT_STARTED: 'This code is not valid yet',
  NO_ELIGIBLE_ITEMS: 'No item in the cart qualifies for this code',
  REDEMPTION_CONFLICT: 'This code could not be claimed, please try again',
  USAGE_LIMIT_REACHED: 'This code has already been used the maximum number of times',
} as const

/**
 * Stable machine readable reason a code was refused. The string values of this
 * union never change between minor versions and are safe to switch on.
 */
export type RefusalReason = keyof typeof refusalReasons

/**
 * Human readable English sentence for a refusal reason. Translate it in your own
 * front end by switching on the reason code rather than on this text.
 */
export const refusalMessage = (reason: RefusalReason): string => refusalReasons[reason]
