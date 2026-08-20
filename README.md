# payload-coupons

[![npm](https://img.shields.io/npm/v/payload-coupons?style=flat-square&color=0F766E)](https://www.npmjs.com/package/payload-coupons) ![node](https://img.shields.io/badge/node-%3E%3D20-339933?style=flat-square) ![license](https://img.shields.io/badge/license-MIT-6C757D?style=flat-square)

Gives a Payload shop coupon codes with percentage and fixed discounts, scope and exclusions, usage limits and a validity window, calculated in whole minor units so that the line amounts always add up to the total.

- Works with `@payloadcms/plugin-ecommerce` and with any collection that holds carts and orders
- Every amount is an integer number of minor units, never a float
- A code that cannot be used is refused with a stable reason code, never converted or silently adjusted
- No runtime dependencies
- No admin components, so it survives minor releases

## Install

```bash
pnpm add payload-coupons
```

```ts
import { couponsPlugin } from 'payload-coupons'

export default buildConfig({
  plugins: [
    couponsPlugin({
      currencies: ['EUR', 'USD'],
    }),
  ],
})
```

Create a coupon in the admin, then ask whether it may be used:

```bash
curl -X POST /api/coupons/validate \
  -H 'Content-Type: application/json' \
  -d '{"code":"SAVE10","cartID":"6a85cce9ce631c0034f52d84"}'
```

```json
{
  "valid": true,
  "discount": {
    "amount": 300,
    "code": "SAVE10",
    "coupon": "1",
    "currency": "EUR",
    "freeShipping": false,
    "lines": [{ "amount": 100, "index": 0 }, { "amount": 200, "index": 1 }],
    "type": "percentage",
    "value": 1000
  }
}
```

Apply it to the cart, and the cart keeps a `total` next to its untouched `subtotal`:

```bash
curl -X POST /api/carts/6a85cce9ce631c0034f52d84/apply-coupon \
  -H 'Content-Type: application/json' \
  -d '{"code":"SAVE10"}'
```

## What was measured

`@payloadcms/plugin-ecommerce` 3.88.0 has no discount of any kind. Its published `dist` contains zero occurrences of `coupon`, `discount` or `promo`. One third-party package exists, `@wtree/payload-ecommerce-coupon`, last published in March 2026; no code from it is used here.

Read from the plugin source, and the reason this package works the way it does:

| What | Where it was read | Consequence |
| --- | --- | --- |
| Amounts are minor units, `Math.round(value * 10 ** currency.decimals)` | `ui/utilities.ts` | every calculation here is integer only |
| EUR, USD and GBP all have `decimals: 2` | `currencies/index.ts` | one cent is the smallest unit that can be moved |
| A cart stores `items` and one `subtotal`, no price per line | `collections/carts/beforeChange.ts` | line amounts are recalculated from product and variant prices |
| An order is created with `amount`, `currency` and `items`, with no link back to the cart | `payments/adapters/stripe/confirmOrder.ts` | the discount is recorded on the order, the charged amount is never rewritten |

### How a percentage is split across lines

The total is worked out once, on the sum of the eligible lines, and then divided. Both steps are exact integer arithmetic.

1. The rate is held in basis points, so 12.5 percent is 1250 and nothing is ever a float.
2. The total is `eligible x rate / 10000`, rounded half up, once.
3. Each line takes the floor of its exact share of that total.
4. The units left over are handed out one at a time, largest fractional remainder first. A tie goes to the larger line, and a tie between equal lines goes to the earlier position.
5. No line is ever given more than the line is worth, and the parts always add up to the total.

A cart of 3.33, 3.33 and 3.34 with 10 percent off gives a total of 100 cents split as 33, 33 and 34. A cart of three items of one cent each with 50 percent off gives 2 cents split as 1, 1 and 0: the third item is not rounded up to keep the split even, because that would take more than the total.

The multiplication is done in `BigInt`, so the split stays exact for carts far beyond the range where `total x line` overflows the safe integer range of a float.

The calculation is exported as `computeDiscount`, `allocate`, `percentageOf` and `toBasisPoints`, so a front end can show the same split before the cart is saved. `normalizeCode` uppercases and trims a code the way the plugin does.

The test suite checks this exhaustively: every total from 0 to 1000 against a three line cart, every combination of three lines drawn from a fixed set of amounts against several totals, 500 pseudo random carts of up to eight lines, and every rate from 1 to 10000 basis points against five cart shapes. In each case the parts add up to the total and no part exceeds its own line.

### How the usage limit holds under concurrency

The same problem as sequential order numbers, and the same answer. These facts were measured on a live Payload 3.88 install while building `payload-order-numbers`:

| Approach | Result |
| --- | --- |
| Read a counter and increment it in a hook | 5 of 25 concurrent operations succeeded |
| `$inc` on the PostgreSQL adapter | atomic, but 40 concurrent calls all returned the same number, so it cannot back a counter you have to read |
| Insert into a unique index from a separate transaction | 25 of 25 succeeded, no duplicates |

So a use is not counted, it is claimed. Each redemption inserts a document whose `slot` is `couponID#useIndex` and, when a per customer limit applies, whose `customerSlot` is `couponID#customerID#useIndex`. Both are unique indexes. The insert commits on its own, outside the order's transaction, so a second order arriving at the same instant sees the claim and takes the next index. When the next index would pass the limit the code is refused. Two customers cannot both take the last use, because the database refuses the second insert.

A coupon with no limits inserts a redemption with no slot at all, so unlimited codes never contend.

## Options

| Option | Default | Meaning |
| --- | --- | --- |
| `attempts` | `25` | How many times to look for a free redemption slot before refusing. Each attempt is one insert |
| `cartsSlug` | `'carts'` | Slug of the carts collection |
| `categoriesSlug` | `'categories'` | Slug of the categories collection |
| `categoryField` | `'categories'` | Field on a product holding its categories |
| `couponsSlug` | `'coupons'` | Slug of the coupons collection this plugin creates |
| `currencies` | `[]` | Currency codes offered as a select in the admin. Empty means a free text field, uppercased on save |
| `customersSlug` | `'users'` | Slug of the customers collection |
| `disabled` | `false` | Stops evaluating and claiming, keeps every field and collection so the database keeps its shape |
| `fieldName` | `'discount'` | Group field holding the applied discount on carts and orders |
| `ordersSlug` | `'orders'` | Slug of the orders collection |
| `priceField` | `` (currency) => `priceIn${currency}` `` | Name of the price field to read for a currency |
| `productsSlug` | `'products'` | Slug of the products collection |
| `redemptionsSlug` | `'coupon-redemptions'` | Collection holding one document per claimed use |
| `refuseOrderOnInvalidCoupon` | `false` | Throws instead of saving the order without the discount |
| `resolveLineAmount` | none | Replaces the built in line amount lookup. Return the amount of the whole line in minor units, or null to fall back |
| `totalFieldName` | `'total'` | Number field on the cart holding the total after the discount |
| `variantsSlug` | `'variants'` | Slug of the variants collection |

A value that cannot be used is replaced by its default rather than being applied. An `attempts` of `0` or `-5` becomes `25`, and `9.9` becomes `9`.

Relationship fields are only added for collections that exist in your config. A shop with no `categories` collection gets a coupons collection with no category scope, rather than a config that refuses to boot.

## What it adds to your database

| Collection | Field | Type | Notes |
| --- | --- | --- | --- |
| `coupons` | `code` | text | unique, indexed, uppercased on save |
| `coupons` | `enabled` | checkbox | defaults to true |
| `coupons` | `type` | select | `percentage` or `fixed` |
| `coupons` | `percentage` | number | 0 to 100, kept to two decimal places |
| `coupons` | `amounts` | array | `currency` and `amount` in minor units, one entry per currency |
| `coupons` | `freeShipping` | checkbox | recorded on the cart and the order, nothing more |
| `coupons` | `appliesTo` | select | `cart`, `products` or `categories` |
| `coupons` | `products`, `categories` | relationship | the scope, when the scope is not the whole cart |
| `coupons` | `excludedProducts`, `excludedCategories` | relationship | removed from the scope, whatever the scope is |
| `coupons` | `minimumAmounts`, `maximumAmounts` | array | cart conditions per currency, in minor units |
| `coupons` | `maxUses`, `maxUsesPerCustomer` | number | empty or 0 means unlimited |
| `coupons` | `validFrom`, `validUntil` | date | the validity window |
| your carts collection | `discount` | group | `code`, `coupon`, `type`, `value`, `amount`, `currency`, `freeShipping`, `lines` |
| your carts collection | `total` | number | `subtotal` less the discount, never below zero |
| your orders collection | `discount` | group | the same group, written once when the order is created |
| `coupon-redemptions` | `slot` | text | unique, indexed. `couponID#useIndex` |
| `coupon-redemptions` | `customerSlot` | text | unique, indexed. `couponID#customerID#useIndex` |
| `coupon-redemptions` | `useIndex`, `customerUseIndex` | number | indexed. The position inside each limit |
| `coupon-redemptions` | `coupon`, `code`, `customer`, `order`, `amount`, `currency` | mixed | what was claimed, and by whom |

`value` is the basis points of a percentage coupon or the fixed amount of a fixed coupon. `amount` is what was actually deducted. `lines` records how that amount was split: `index`, the position of the item in `items`, and `amount`.

The redemptions collection is closed to create, read, update and delete through the API and hidden in the admin. It is written only by the plugin. The coupons collection is left on Payload's own access control, which requires a logged in user for every operation, so codes cannot be listed by the public.

## Endpoints

| Method and path | Body | Answer |
| --- | --- | --- |
| `POST /api/coupons/validate` | `code`, and either `cartID` or `currency` with `items` | `200` with `valid: true` and the discount, or `200` with `valid: false` and a reason. `400` when the code is missing, `404` when the cart cannot be read |
| `POST /api/carts/:id/apply-coupon` | `code`, optional `secret` for a guest cart | `200` and the updated cart, `422` with a reason when the code is refused, `404` when the cart cannot be read |
| `POST /api/carts/:id/remove-coupon` | optional `secret` | `200` and the updated cart |

Validating claims nothing. A use is claimed only when an order is created.

Every refusal carries a stable machine readable `reason` next to its English `message`. Switch on the reason, not on the text.

| Reason | When |
| --- | --- |
| `CART_NOT_FOUND` | the cart does not exist or the request may not read it |
| `CURRENCY_NOT_SUPPORTED` | a fixed coupon has no amount in the cart's currency |
| `CUSTOMER_LIMIT_REACHED` | this customer has used the code as often as allowed |
| `CUSTOMER_REQUIRED` | the code is limited per customer and the request is a guest |
| `DISABLED` | the coupon is switched off |
| `EMPTY_CART` | the cart has no items |
| `EXPIRED` | now is past `validUntil` |
| `MAXIMUM_EXCEEDED` | the cart is above `maximumAmounts` for its currency |
| `MINIMUM_NOT_MET` | the cart is below `minimumAmounts` for its currency |
| `MISSING_CODE` | no code was sent |
| `MISSING_PRICE` | an item has no price in the cart's currency |
| `NOT_FOUND` | no coupon has that code |
| `NOT_STARTED` | now is before `validFrom` |
| `NO_ELIGIBLE_ITEMS` | nothing in the cart is in scope after exclusions |
| `REDEMPTION_CONFLICT` | the slot could not be claimed within `attempts` |
| `USAGE_LIMIT_REACHED` | the coupon has been used as often as allowed |

The full set of codes and their English messages is exported as `refusalReasons`, and `refusalMessage` returns the message for one code.

The checks run in a fixed order and the first failure is the one reported: enabled, then the validity window, then the currency, then the cart contents, then the scope, then the minimum and maximum, then the per customer limit, then the total limit.

## Honest limits

**PostgreSQL needs a large enough connection pool.** Claiming a use opens a second connection while the order's own transaction holds the first. With the `pg` default of 10, ten simultaneous orders exhaust the pool and the eleventh waits forever. This was measured while building `payload-order-numbers`, which claims its numbers the same way:

| Simultaneous orders | Result with the default pool of 10 |
| --- | --- |
| 2, 4, 6, 8, 10 | all succeed |
| 15 | 3 succeed, the rest time out |

```ts
postgresAdapter({
  pool: { connectionString: process.env.DATABASE_URI, max: 60 },
})
```

MongoDB is not affected and needs no change.

**The plugin never changes an amount you already have.** The cart keeps its `subtotal` untouched and gains a `total`. The order keeps the `amount` it was created with, because that is what the payment provider charged; only the `discount` group is written. Charge the cart's `total` at checkout, and the order will record what the code took off. Nothing is silently rewritten, and no total ever goes below zero.

**A coupon carries no uses counter.** A number kept on the coupon and incremented in a hook is wrong under load, which is what the 5 of 25 above measures, so there is no such field. Uses are counted from the redemptions collection instead, with `countCouponUses`.

**A claimed use can be lost.** The claim commits before the order does. If the order then fails to save, the use is gone. Call `releaseCouponRedemption` to give it back:

```ts
import { releaseCouponRedemption } from 'payload-coupons'

await releaseCouponRedemption({ id: redemptionID, payload })
```

**One coupon per cart.** There is no stacking, no automatic best code, and no priority between codes. Applying a second code replaces the first.

**The cart is re-checked on every save.** A code that has become invalid, because the cart changed or the coupon expired, is removed from the cart and the discount goes to zero. The cart does not keep a note of why. Ask the validate endpoint for the reason.

**Free shipping is data, not a shipping calculation.** `discount.freeShipping` is exposed on the cart and the order. Nothing else is done with it, and no shipping package is touched.

**Fixed amounts are never converted.** A coupon with an amount in EUR is refused on a USD cart. Add an amount for each currency you sell in.

**Line prices are read from the products.** A cart line has no stored price, so the plugin reads `priceIn{CURRENCY}` from the variant, or from the product when there is no variant. A category scope reads the product as well. That is one or two reads per line; use `resolveLineAmount` if your prices live elsewhere.

**All coupon fields are always visible in the admin.** The plugin adds no admin components and no client side conditions, so the fixed amounts are shown even on a percentage coupon.

## License

MIT. Copyright George Vasiliades, https://github.com/Poseidonas
