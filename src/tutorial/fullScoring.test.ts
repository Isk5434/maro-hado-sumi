import { describe, expect, it } from 'vitest'
import { canPlaceCard, createVillage } from '../game/board'
import type { CardKind, PieceKind, Village } from '../game/types'
import { scoreFull } from './fullScoring'

let id = 1
function put(v: Village, x: number, y: number, kind: CardKind, rot = 0, piece?: PieceKind) {
  v.cells[y][x].placed = { card: { id: id++, kind }, rot, piece: piece ? { id: id++, kind: piece } : null }
}

describe('通常版の得点（得点計算表）', () => {
  it('全項目を数える', () => {
    const v = createVillage()
    // 館から城まで砦を通る道
    for (const x of [6, 5, 4, 2, 1]) put(v, x, 3, 'straight', 1)
    put(v, 0, 3, 'L', 0)
    put(v, 0, 2, 'straight', 0)
    put(v, 0, 1, 'straight', 0)
    v.cells[3][4].placed!.piece = { id: id++, kind: 'samurai' }
    put(v, 6, 0, 'farm')
    put(v, 7, 0, 'farm')
    put(v, 6, 1, 'farm', 0, 'farmer')
    put(v, 7, 1, 'farm', 0, 'farmer')
    put(v, 6, 2, 'inn', 0, 'merchant')
    put(v, 7, 2, 'temple', 0, 'monk')
    put(v, 5, 1, 'cross', 0, 'merchant')
    const s = scoreFull(v, { rice: 2, festTown: true, festVillage: true })
    expect(s).toMatchObject({
      road: 5,
      fortBonus: 3,
      farmers: 2,
      crossMerchants: 1,
      innMerchants: 2,
      monkTemple: 3,
      farmGroups: 3,
      innTemple: 1,
      samurai: 1,
      rice: 2,
      festTown: 2,
      festVillage: 2,
    })
    expect(s.total).toBe(5 + 3 + 2 + 1 + 2 + 3 + 3 + 1 + 1 + 2 + 2 + 2)
  })

  it('宿場と寺は斜めでも1組', () => {
    const v = createVillage()
    put(v, 6, 2, 'inn')
    put(v, 7, 1, 'temple')
    expect(scoreFull(v, { rice: 0, festTown: false, festVillage: false }).innTemple).toBe(1)
  })

  it('寺カードは村のふちにしか置けない', () => {
    const v = createVillage()
    put(v, 6, 3, 'straight', 1)
    expect(canPlaceCard(v, { id: 0, kind: 'temple' }, 7, 2)).toBe(true)
    expect(canPlaceCard(v, { id: 0, kind: 'temple' }, 6, 2)).toBe(false)
  })
})
