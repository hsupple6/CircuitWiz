import type { WireConnection } from '../../modules/types'

export function posKey(x: number, y: number): string {
  return `${x},${y}`
}

/** Drop stale simulation PWM from a wire or segment object. */
export function omitPwm<T extends { pwm?: number }>(value: T): Omit<T, 'pwm'> {
  const { pwm: _pwm, ...rest } = value
  return rest
}

export function stripPwmFromWires(wires: WireConnection[]): WireConnection[] {
  return wires.map((wire) => {
    const wireBase = omitPwm(wire)
    return {
      ...wireBase,
      segments: wire.segments.map((segment) => omitPwm(segment)),
    }
  })
}

export function parseKey(key: string): { x: number; y: number } {
  const [x, y] = key.split(',').map(Number)
  return { x, y }
}

export function parseNumericProperty(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (value && typeof value === 'object' && 'default' in (value as object)) {
    const d = (value as { default: unknown }).default
    if (typeof d === 'number' && Number.isFinite(d)) return d
  }
  return fallback
}

export class UnionFind {
  parent: number[]

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, i) => i)
  }

  find(x: number): number {
    if (this.parent[x] !== x) {
      this.parent[x] = this.find(this.parent[x])
    }
    return this.parent[x]
  }

  union(a: number, b: number): void {
    const rootA = this.find(a)
    const rootB = this.find(b)
    if (rootA !== rootB) {
      this.parent[rootB] = rootA
    }
  }
}
