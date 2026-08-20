export const sumOf = (values: number[]): number =>
  values.reduce((total, value) => total + value, 0)

export const toInteger = (value: unknown): null | number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null
  }

  return Math.trunc(value)
}

/**
 * Converts a percentage entered by a shop owner into basis points, so that every
 * later calculation is integer only. 12.5 becomes 1250. Values are clamped to
 * the range 0 to 10000 and rounded to two decimal places.
 */
export const toBasisPoints = (percentage: unknown): number => {
  if (typeof percentage !== 'number' || !Number.isFinite(percentage) || percentage <= 0) {
    return 0
  }

  const points = Math.round(percentage * 100)

  return points > 10000 ? 10000 : points
}

/**
 * Applies a basis point rate to an integer amount of minor units. The
 * multiplication is exact and the single rounding step is half up.
 */
export const percentageOf = (amount: number, basisPoints: number): number => {
  if (amount <= 0 || basisPoints <= 0) {
    return 0
  }

  if (basisPoints >= 10000) {
    return amount
  }

  const product = BigInt(amount) * BigInt(basisPoints)
  const whole = product / 10000n
  const remainder = product % 10000n

  return Number(remainder * 2n >= 10000n ? whole + 1n : whole)
}

const allocationOrder = (weights: number[], remainders: bigint[]): number[] =>
  weights
    .map((weight, index) => ({ index, remainder: remainders[index] ?? 0n, weight }))
    .sort((left, right) => {
      if (left.remainder !== right.remainder) {
        return left.remainder > right.remainder ? -1 : 1
      }

      if (left.weight !== right.weight) {
        return right.weight - left.weight
      }

      return left.index - right.index
    })
    .map((entry) => entry.index)

/**
 * Splits an integer total across weights so that the parts always add up to the
 * total exactly and no part is larger than its own weight.
 *
 * Each part starts at the floor of its exact share. The units left over are
 * handed out one at a time, largest fractional remainder first, ties broken by
 * the larger weight and then by the earlier position.
 */
export const allocate = (total: number, weights: number[]): number[] => {
  const basis = sumOf(weights)

  if (total <= 0 || basis <= 0) {
    return weights.map(() => 0)
  }

  const capped = total > basis ? basis : total
  const cappedBig = BigInt(capped)
  const basisBig = BigInt(basis)
  const parts: number[] = []
  const remainders: bigint[] = []

  for (const weight of weights) {
    if (weight <= 0) {
      parts.push(0)
      remainders.push(0n)
      continue
    }

    const product = cappedBig * BigInt(weight)
    parts.push(Number(product / basisBig))
    remainders.push(product % basisBig)
  }

  let left = capped - sumOf(parts)
  const order = allocationOrder(weights, remainders)

  while (left > 0) {
    let progressed = false

    for (const index of order) {
      if (left === 0) {
        break
      }

      const part = parts[index] ?? 0
      const weight = weights[index] ?? 0

      if (part < weight) {
        parts[index] = part + 1
        left -= 1
        progressed = true
      }
    }

    if (!progressed) {
      break
    }
  }

  return parts
}
