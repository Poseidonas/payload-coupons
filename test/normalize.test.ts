import { describe, expect, it } from 'vitest'

import { normalizeCode, toDate, toRelationID, toRelationIDs } from '../src/normalize.js'

describe('normalizeCode', () => {
  it('trims and uppercases', () => {
    expect(normalizeCode('  save10 ')).toBe('SAVE10')
  })

  it('returns an empty string for anything that is not a string', () => {
    expect(normalizeCode(undefined)).toBe('')
    expect(normalizeCode(null)).toBe('')
    expect(normalizeCode(10)).toBe('')
  })

  it('returns an empty string for whitespace only', () => {
    expect(normalizeCode('   ')).toBe('')
  })
})

describe('toRelationID', () => {
  it('reads a string id', () => {
    expect(toRelationID('abc')).toBe('abc')
  })

  it('reads a numeric id as text', () => {
    expect(toRelationID(7)).toBe('7')
  })

  it('reads the id out of a populated relationship', () => {
    expect(toRelationID({ id: 7, title: 'Shoes' })).toBe('7')
  })

  it('returns an empty string when there is no id', () => {
    expect(toRelationID(null)).toBe('')
    expect(toRelationID({})).toBe('')
  })
})

describe('toRelationIDs', () => {
  it('reads a list of mixed ids', () => {
    expect(toRelationIDs(['a', 2, { id: 'c' }])).toEqual(['a', '2', 'c'])
  })

  it('wraps a single value', () => {
    expect(toRelationIDs('a')).toEqual(['a'])
  })

  it('returns an empty list for nothing', () => {
    expect(toRelationIDs(null)).toEqual([])
    expect(toRelationIDs([null, {}])).toEqual([])
  })
})

describe('toDate', () => {
  it('reads an ISO string', () => {
    expect(toDate('2026-08-19T00:00:00.000Z')?.getTime()).toBe(
      Date.parse('2026-08-19T00:00:00.000Z'),
    )
  })

  it('keeps a date', () => {
    const date = new Date('2026-08-19T00:00:00.000Z')

    expect(toDate(date)).toBe(date)
  })

  it('refuses an unusable value', () => {
    expect(toDate('not a date')).toBeNull()
    expect(toDate(undefined)).toBeNull()
    expect(toDate(new Date('nope'))).toBeNull()
  })
})
