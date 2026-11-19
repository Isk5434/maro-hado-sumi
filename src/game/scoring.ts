import { COLS, FORT, ROWS, isConnected, neighbors4, passesFort } from './board'
import type { Village } from './types'

export interface ScoreBreakdown {
  road: number
  fortBonus: number
  farmers: number
  farmGroups: number
  crossMerchants: number
  innMerchants: number
  samurai: number
  total: number
}

export const SCORE_LABELS: Record<Exclude<keyof ScoreBreakdown, 'total'>, string> = {
  road: '館から城に道がつながっている',
  fortBonus: 'その道が砦を通っている',
  farmers: '農地の上に農民',
  farmGroups: '農地のつながり(4枚ごと)',
  crossMerchants: '十字の道の上に商人',
  innMerchants: '宿場の上に商人',
  samurai: '砦のまわりの武士',
}

/** 上下左右につながった農地のかたまりの大きさ */
export function farmGroupSizes(v: Village): number[] {
  const seen = new Set<string>()
  const sizes: number[] = []
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++) {
      if (seen.has(`${x},${y}`) || v.cells[y][x].placed?.card.kind !== 'farm') continue
      let size = 0
      const stack: [number, number][] = [[x, y]]
      seen.add(`${x},${y}`)
      while (stack.length) {
        const [cx, cy] = stack.pop()!
        size++
        for (const [nx, ny] of neighbors4(cx, cy)) {
          const k = `${nx},${ny}`
          if (!seen.has(k) && v.cells[ny][nx].placed?.card.kind === 'farm') {
            seen.add(k)
            stack.push([nx, ny])
          }
        }
      }
      sizes.push(size)
    }
  return sizes
}

export function scoreVillage(v: Village): ScoreBreakdown {
  const connected = isConnected(v)
  const s: ScoreBreakdown = {
    road: connected ? 5 : 0,
    fortBonus: connected && passesFort(v) ? 3 : 0,
    farmers: 0,
    farmGroups: farmGroupSizes(v).reduce((sum, n) => sum + Math.floor(n / 4) * 3, 0),
    crossMerchants: 0,
    innMerchants: 0,
    samurai: 0,
    total: 0,
  }
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++) {
      const p = v.cells[y][x].placed
      if (!p?.piece) continue
      const kind = p.card.kind
      if (p.piece.kind === 'farmer' && kind === 'farm') s.farmers += 1
      if (p.piece.kind === 'merchant' && kind === 'cross') s.crossMerchants += 1
      if (p.piece.kind === 'merchant' && kind === 'inn') s.innMerchants += 2
      if (p.piece.kind === 'samurai' && Math.abs(x - FORT.x) <= 1 && Math.abs(y - FORT.y) <= 1) s.samurai += 1
    }
  s.total = s.road + s.fortBonus + s.farmers + s.farmGroups + s.crossMerchants + s.innMerchants + s.samurai
  return s
}
