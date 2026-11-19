import { COLS, FORT, ROWS, isConnected, passesFort } from '../game/board'
import { farmGroupSizes } from '../game/scoring'
import type { Village } from '../game/types'

/** 通常版の得点（紙の「得点計算表」2026年11月時点の項目） */
export interface FullScore {
  road: number
  fortBonus: number
  farmers: number
  crossMerchants: number
  innMerchants: number
  monkTemple: number
  farmGroups: number
  innTemple: number
  samurai: number
  rice: number
  festTown: number
  festVillage: number
  total: number
}

export const FULL_SCORE_LABELS: Record<Exclude<keyof FullScore, 'total'>, string> = {
  road: '道をつなげる（館から城まで）',
  fortBonus: '道が砦を通る',
  farmers: '農地＋農民',
  crossMerchants: '十字路＋商人',
  innMerchants: '宿場＋商人（×2）',
  monkTemple: '僧＋寺院（×3）',
  farmGroups: '農地4つ（×3）',
  innTemple: '宿場＋寺（近く・斜めOK）',
  samurai: '砦＋武士（まわり8マス）',
  rice: 'お米ポイント',
  festTown: '町の祭！（商人の数）',
  festVillage: '村の祭！（農民の数）',
}

export function scoreFull(v: Village, opt: { rice: number; festTown: boolean; festVillage: boolean }): FullScore {
  const connected = isConnected(v)
  const s: FullScore = {
    road: connected ? 5 : 0,
    fortBonus: connected && passesFort(v) ? 3 : 0,
    farmers: 0,
    crossMerchants: 0,
    innMerchants: 0,
    monkTemple: 0,
    farmGroups: farmGroupSizes(v).reduce((sum, n) => sum + Math.floor(n / 4) * 3, 0),
    innTemple: 0,
    samurai: 0,
    rice: opt.rice,
    festTown: 0,
    festVillage: 0,
    total: 0,
  }
  let merchants = 0
  let farmers = 0
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++) {
      const p = v.cells[y][x].placed
      if (!p) continue
      if (p.card.kind === 'inn')
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && v.cells[y + dy]?.[x + dx]?.placed?.card.kind === 'temple') s.innTemple += 1
      const piece = p.piece?.kind
      if (!piece) continue
      if (piece === 'merchant') merchants++
      if (piece === 'farmer') farmers++
      if (piece === 'farmer' && p.card.kind === 'farm') s.farmers += 1
      if (piece === 'merchant' && p.card.kind === 'cross') s.crossMerchants += 1
      if (piece === 'merchant' && p.card.kind === 'inn') s.innMerchants += 2
      if (piece === 'monk' && p.card.kind === 'temple') s.monkTemple += 3
      if (piece === 'samurai' && Math.abs(x - FORT.x) <= 1 && Math.abs(y - FORT.y) <= 1) s.samurai += 1
    }
  if (opt.festTown) s.festTown = merchants
  if (opt.festVillage) s.festVillage = farmers
  s.total = (Object.keys(FULL_SCORE_LABELS) as (keyof typeof FULL_SCORE_LABELS)[]).reduce((n, k) => n + s[k], 0)
  return s
}
