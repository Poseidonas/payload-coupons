import { describe, expect, it } from 'vitest'

import { allocate, percentageOf, sumOf, toBasisPoints, toInteger } from '../src/money.js'

describe('toInteger', () => {
  it('keeps a whole number', () => {
    expect(toInteger(1500)).toBe(1500)
  })

  it('truncates rather than rounding, so no money is invented', () => {
    expect(toInteger(1500.9)).toBe(1500)
  })

  it('refuses anything that is not a finite number', () => {
    expect(toInteger('1500')).toBeNull()
    expect(toInteger(Number.NaN)).toBeNull()
    expect(toInteger(Infinity)).toBeNull()
    expect(toInteger(null)).toBeNull()
  })
})

describe('toBasisPoints', () => {
  it('turns a percentage into basis points', () => {
    expect(toBasisPoints(10)).toBe(1000)
    expect(toBasisPoints(12.5)).toBe(1250)
    expect(toBasisPoints(100)).toBe(10000)
  })

  it('keeps two decimal places and rounds the third', () => {
    expect(toBasisPoints(12.345)).toBe(1235)
    expect(toBasisPoints(0.01)).toBe(1)
  })

  it('clamps above 100 percent', () => {
    expect(toBasisPoints(150)).toBe(10000)
  })

  it('returns zero for anything that is not a positive number', () => {
    expect(toBasisPoints(0)).toBe(0)
    expect(toBasisPoints(-10)).toBe(0)
    expect(toBasisPoints('10')).toBe(0)
    expect(toBasisPoints(Number.NaN)).toBe(0)
  })
})

describe('percentageOf', () => {
  it('applies a plain rate', () => {
    expect(percentageOf(1000, 1000)).toBe(100)
    expect(percentageOf(2500, 2000)).toBe(500)
  })

  it('rounds half up on the exact half', () => {
    expect(percentageOf(1, 5000)).toBe(1)
    expect(percentageOf(3, 5000)).toBe(2)
    expect(percentageOf(995, 1000)).toBe(100)
  })

  it('rounds down below the half', () => {
    expect(percentageOf(984, 1000)).toBe(98)
    expect(percentageOf(1, 4999)).toBe(0)
  })

  it('returns the whole amount at one hundred percent', () => {
    expect(percentageOf(1234, 10000)).toBe(1234)
  })

  it('never returns more than the amount', () => {
    expect(percentageOf(500, 20000)).toBe(500)
  })

  it('returns zero for a zero or negative amount or rate', () => {
    expect(percentageOf(0, 1000)).toBe(0)
    expect(percentageOf(-100, 1000)).toBe(0)
    expect(percentageOf(1000, 0)).toBe(0)
  })

  it('stays exact on amounts far beyond float precision for a plain multiply', () => {
    expect(percentageOf(9007199254740, 3333)).toBe(3002099511605)
  })
})

describe('allocate', () => {
  it('gives a single line the whole amount', () => {
    expect(allocate(100, [1000])).toEqual([100])
  })

  it('splits evenly when it divides exactly', () => {
    expect(allocate(300, [1000, 1000, 1000])).toEqual([100, 100, 100])
  })

  it('hands the remainder to the largest fractional part', () => {
    expect(allocate(7, [10, 20, 30])).toEqual([1, 2, 4])
  })

  it('breaks a tie by position when the fractions are equal', () => {
    expect(allocate(1, [1, 1, 1])).toEqual([1, 0, 0])
    expect(allocate(10, [1000, 1000, 1000])).toEqual([4, 3, 3])
  })

  it('breaks a tie by the larger line before position', () => {
    expect(allocate(2, [1, 3])).toEqual([0, 2])
  })

  it('never gives a line more than the line is worth', () => {
    expect(allocate(100, [1, 1])).toEqual([1, 1])
  })

  it('gives nothing to a line worth nothing', () => {
    expect(allocate(10, [0, 100])).toEqual([0, 10])
  })

  it('returns zeros when there is nothing to split', () => {
    expect(allocate(0, [100, 100])).toEqual([0, 0])
    expect(allocate(-50, [100, 100])).toEqual([0, 0])
    expect(allocate(100, [])).toEqual([])
    expect(allocate(100, [0, 0])).toEqual([0, 0])
  })

  it('is deterministic for the same input', () => {
    expect(allocate(97, [333, 333, 334])).toEqual(allocate(97, [333, 333, 334]))
  })

  it('adds up to the total for every total across a fixed set of lines', () => {
    const weights = [333, 333, 334]

    for (let total = 0; total <= 1000; total += 1) {
      const parts = allocate(total, weights)

      expect(sumOf(parts)).toBe(total)
    }
  })

  it('holds every invariant across an exhaustive sweep of three line carts', () => {
    const values = [0, 1, 2, 3, 7, 99, 100, 4999]

    for (const a of values) {
      for (const b of values) {
        for (const c of values) {
          const weights = [a, b, c]
          const basis = sumOf(weights)

          for (const total of [0, 1, 2, 3, 17, 999, basis, basis + 5]) {
            const parts = allocate(total, weights)
            const expected = total <= 0 || basis <= 0 ? 0 : Math.min(total, basis)

            expect(sumOf(parts)).toBe(expected)
            parts.forEach((part, index) => {
              expect(part).toBeGreaterThanOrEqual(0)
              expect(part).toBeLessThanOrEqual(weights[index] as number)
            })
          }
        }
      }
    }
  })

  it('holds every invariant across pseudo random carts', () => {
    let seed = 20260819

    const next = (max: number): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648

      return seed % max
    }

    for (let run = 0; run < 500; run += 1) {
      const count = 1 + next(8)
      const weights = Array.from({ length: count }, () => next(50000))
      const basis = sumOf(weights)
      const total = next(basis + 10)
      const parts = allocate(total, weights)

      expect(sumOf(parts)).toBe(basis === 0 ? 0 : Math.min(total, basis))
      parts.forEach((part, index) => {
        expect(part).toBeLessThanOrEqual(weights[index] as number)
      })
    }
  })
})

describe('sumOf', () => {
  it('adds integers', () => {
    expect(sumOf([1, 2, 3])).toBe(6)
    expect(sumOf([])).toBe(0)
  })
})
