import type { Endpoint, PayloadRequest } from 'payload'

import { addDataAndFileToRequest } from 'payload'

import { evaluateCode } from './evaluate.js'
import { normalizeCode } from './normalize.js'
import { refusalMessage } from './reasons.js'
import type { RefusalReason } from './reasons.js'
import type { EvaluationOutcome, ResolvedConfig } from './types.js'

type Body = {
  cartID?: unknown
  code?: unknown
  currency?: unknown
  customer?: unknown
  items?: unknown
  secret?: unknown
}

const refusalResponse = (reason: RefusalReason, status: number): Response =>
  Response.json({ message: refusalMessage(reason), reason, valid: false }, { status })

const successBody = (outcome: Extract<EvaluationOutcome, { valid: true }>) => ({
  discount: outcome.discount,
  valid: true as const,
})

const withCartSecret = (req: PayloadRequest, secret: unknown): PayloadRequest =>
  typeof secret === 'string' && secret !== ''
    ? ({ ...req, context: { ...req.context, cartSecret: secret } } as PayloadRequest)
    : req

const loadCart = async (args: {
  config: ResolvedConfig
  id: string
  req: PayloadRequest
}): Promise<null | Record<string, unknown>> => {
  try {
    const cart = await args.req.payload.findByID({
      id: args.id,
      collection: args.config.cartsSlug,
      depth: 0,
      overrideAccess: false,
      req: args.req,
    })

    return cart as Record<string, unknown>
  } catch {
    return null
  }
}

export const validateCouponEndpoint = (config: ResolvedConfig): Endpoint => ({
  handler: async (req) => {
    await addDataAndFileToRequest(req)

    const body = (req.data ?? {}) as Body
    const code = normalizeCode(body.code)

    if (code === '') {
      return refusalResponse('MISSING_CODE', 400)
    }

    let currency = body.currency
    let customer = body.customer
    let items = body.items

    if (typeof body.cartID === 'string' || typeof body.cartID === 'number') {
      const scoped = withCartSecret(req, body.secret)
      const cart = await loadCart({ config, id: String(body.cartID), req: scoped })

      if (!cart) {
        return refusalResponse('CART_NOT_FOUND', 404)
      }

      currency = cart.currency
      customer = cart.customer
      items = cart.items
    }

    const outcome = await evaluateCode({
      claim: false,
      code,
      config,
      currency,
      customer,
      items,
      req,
    })

    if (!outcome.valid) {
      return Response.json({ message: outcome.message, reason: outcome.reason, valid: false })
    }

    return Response.json(successBody(outcome))
  },
  method: 'post',
  path: '/validate',
})

export const applyCouponEndpoint = (config: ResolvedConfig): Endpoint => ({
  handler: async (req) => {
    await addDataAndFileToRequest(req)

    const body = (req.data ?? {}) as Body
    const cartID = req.routeParams?.id
    const code = normalizeCode(body.code)

    if (code === '') {
      return refusalResponse('MISSING_CODE', 400)
    }

    if (typeof cartID !== 'string' && typeof cartID !== 'number') {
      return refusalResponse('CART_NOT_FOUND', 404)
    }

    const scoped = withCartSecret(req, body.secret)
    const cart = await loadCart({ config, id: String(cartID), req: scoped })

    if (!cart) {
      return refusalResponse('CART_NOT_FOUND', 404)
    }

    const outcome = await evaluateCode({
      claim: false,
      code,
      config,
      currency: cart.currency,
      customer: cart.customer,
      items: cart.items,
      req: scoped,
    })

    if (!outcome.valid) {
      return Response.json(
        { message: outcome.message, reason: outcome.reason, valid: false },
        { status: 422 },
      )
    }

    const updated = await req.payload.update({
      id: String(cartID),
      collection: config.cartsSlug,
      data: { [config.fieldName]: { code } },
      depth: 0,
      overrideAccess: false,
      req: scoped,
    })

    return Response.json({ ...successBody(outcome), cart: updated })
  },
  method: 'post',
  path: '/:id/apply-coupon',
})

export const removeCouponEndpoint = (config: ResolvedConfig): Endpoint => ({
  handler: async (req) => {
    await addDataAndFileToRequest(req)

    const body = (req.data ?? {}) as Body
    const cartID = req.routeParams?.id

    if (typeof cartID !== 'string' && typeof cartID !== 'number') {
      return refusalResponse('CART_NOT_FOUND', 404)
    }

    const scoped = withCartSecret(req, body.secret)
    const cart = await loadCart({ config, id: String(cartID), req: scoped })

    if (!cart) {
      return refusalResponse('CART_NOT_FOUND', 404)
    }

    const updated = await req.payload.update({
      id: String(cartID),
      collection: config.cartsSlug,
      data: { [config.fieldName]: { code: '' } },
      depth: 0,
      overrideAccess: false,
      req: scoped,
    })

    return Response.json({ cart: updated, valid: true })
  },
  method: 'post',
  path: '/:id/remove-coupon',
})
