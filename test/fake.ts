import type { Payload, PayloadRequest } from 'payload'

export type Row = Record<string, unknown>

export type Store = Record<string, Row[]>

const uniqueFields: Record<string, string[]> = {
  'coupon-redemptions': ['slot', 'customerSlot'],
}

const matches = (row: Row, where: unknown): boolean => {
  if (!where || typeof where !== 'object') {
    return true
  }

  const query = where as Record<string, unknown>

  if (Array.isArray(query.and)) {
    return query.and.every((entry) => matches(row, entry))
  }

  return Object.entries(query).every(([field, condition]) => {
    const test = condition as Record<string, unknown>
    const value = row[field]

    if ('equals' in test) {
      return String(value ?? '') === String(test.equals ?? '')
    }

    if ('greater_than' in test) {
      return typeof value === 'number' && value > Number(test.greater_than)
    }

    return true
  })
}

const sortRows = (rows: Row[], sort: unknown): Row[] => {
  if (typeof sort !== 'string' || sort === '') {
    return rows
  }

  const descending = sort.startsWith('-')
  const field = descending ? sort.slice(1) : sort

  return [...rows].sort((left, right) => {
    const a = typeof left[field] === 'number' ? (left[field] as number) : Number.NEGATIVE_INFINITY
    const b = typeof right[field] === 'number' ? (right[field] as number) : Number.NEGATIVE_INFINITY

    return descending ? b - a : a - b
  })
}

export const fakePayload = (store: Store): Payload => {
  let nextID = 1

  const rowsOf = (collection: string): Row[] => {
    store[collection] = store[collection] ?? []

    return store[collection]
  }

  const payload = {
    count: async ({ collection, where }: { collection: string; where?: unknown }) => ({
      totalDocs: rowsOf(collection).filter((row) => matches(row, where)).length,
    }),
    create: async ({ collection, data }: { collection: string; data: Row }) => {
      const rows = rowsOf(collection)

      for (const field of uniqueFields[collection] ?? []) {
        const value = data[field]

        if (
          value !== undefined &&
          value !== null &&
          rows.some((row) => row[field] === value)
        ) {
          throw new Error(`duplicate ${field}`)
        }
      }

      const doc = { id: String(nextID), ...data }

      nextID += 1
      rows.push(doc)

      return doc
    },
    delete: async ({ collection, id }: { collection: string; id: string }) => {
      const rows = rowsOf(collection)
      const index = rows.findIndex((row) => String(row.id) === String(id))

      if (index === -1) {
        throw new Error('not found')
      }

      const [removed] = rows.splice(index, 1)

      return removed
    },
    find: async ({
      collection,
      limit,
      sort,
      where,
    }: {
      collection: string
      limit?: number
      sort?: unknown
      where?: unknown
    }) => {
      const found = sortRows(
        rowsOf(collection).filter((row) => matches(row, where)),
        sort,
      )
      const docs = typeof limit === 'number' && limit > 0 ? found.slice(0, limit) : found

      return { docs, totalDocs: found.length }
    },
    findByID: async ({ collection, id }: { collection: string; id: string }) => {
      const doc = rowsOf(collection).find((row) => String(row.id) === String(id))

      if (!doc) {
        throw new Error('not found')
      }

      return doc
    },
    logger: { error: () => undefined, info: () => undefined },
    update: async ({ collection, data, id }: { collection: string; data: Row; id: string }) => {
      const doc = rowsOf(collection).find((row) => String(row.id) === String(id))

      if (!doc) {
        throw new Error('not found')
      }

      Object.assign(doc, data)

      return doc
    },
  }

  return payload as unknown as Payload
}

export const fakeRequest = (store: Store): PayloadRequest =>
  ({ context: {}, payload: fakePayload(store) }) as unknown as PayloadRequest
