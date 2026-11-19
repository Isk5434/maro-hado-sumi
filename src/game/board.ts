import { E, N, S, W, type Card, type Cell, type PlacedCard, type Village } from './types'

export const COLS = 8
export const ROWS = 4
export const GOAL = { x: 0, y: 0 }
export const START = { x: 7, y: 3 }
export const FORT = { x: 3, y: 3 }
export const RIVER: ReadonlyArray<readonly [number, number]> = [
  [2, 0],
  [2, 1],
  [2, 2],
  [3, 2],
  [4, 2],
  [5, 2],
  [5, 3],
]

export const DIR_DELTA: Record<number, [number, number]> = {
  [N]: [0, -1],
  [E]: [1, 0],
  [S]: [0, 1],
  [W]: [-1, 0],
}

export function opposite(d: number): number {
  return d === N ? S : d === S ? N : d === E ? W : E
}

const BASE_OPENINGS: Record<string, number> = {
  straight: N | S,
  L: N | E,
  T: E | S | W,
  cross: N | E | S | W,
  inn: N | E | S | W,
}

/** 時計回りに rot 回、90°回転した開き方 */
export function rotate(mask: number, rot: number): number {
  let m = mask
  for (let i = 0; i < ((rot % 4) + 4) % 4; i++) m = ((m << 1) | (m >> 3)) & 0b1111
  return m
}

export function isRoadKind(kind: Card['kind']): boolean {
  return kind === 'straight' || kind === 'L' || kind === 'T' || kind === 'cross'
}

export function isPlaceCard(card: Card): boolean {
  return card.kind !== 'battle' && card.kind !== 'flood'
}

export function cardOpenings(placed: PlacedCard): number {
  const base = BASE_OPENINGS[placed.card.kind]
  return base === undefined ? 0 : rotate(base, placed.rot)
}

/** マスの道の開き方。館は四方、砦は東西 */
export function cellOpenings(cell: Cell): number {
  if (cell.terrain === 'start') return N | E | S | W
  if (cell.terrain === 'fort') return E | W
  return cell.placed ? cardOpenings(cell.placed) : 0
}

export function createVillage(): Village {
  const cells: Cell[][] = []
  for (let y = 0; y < ROWS; y++) {
    const row: Cell[] = []
    for (let x = 0; x < COLS; x++) row.push({ terrain: 'land', flooded: false, placed: null })
    cells.push(row)
  }
  cells[GOAL.y][GOAL.x].terrain = 'goal'
  cells[START.y][START.x].terrain = 'start'
  cells[FORT.y][FORT.x].terrain = 'fort'
  for (const [x, y] of RIVER) cells[y][x].terrain = 'river'
  return { cells }
}

export function inBounds(x: number, y: number): boolean {
  return x >= 0 && x < COLS && y >= 0 && y < ROWS
}

export function neighbors4(x: number, y: number): [number, number][] {
  return [
    [x, y - 1],
    [x + 1, y],
    [x, y + 1],
    [x - 1, y],
  ].filter(([a, b]) => inBounds(a, b)) as [number, number][]
}

/** 村のふち（四辺）のマス */
export function isEdge(x: number, y: number): boolean {
  return x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1
}

export function isWater(cell: Cell): boolean {
  return cell.terrain === 'river' || cell.flooded
}

function hasPlacedNeighbor(v: Village, x: number, y: number): boolean {
  return neighbors4(x, y).some(([a, b]) => v.cells[b][a].placed !== null)
}

/** 置き場所の起点になれるマス: 館・置いたカード・カードと隣接した砦 */
function isAnchor(v: Village, x: number, y: number): boolean {
  const c = v.cells[y][x]
  if (c.terrain === 'start') return true
  if (c.placed) return true
  if (c.terrain === 'fort') return hasPlacedNeighbor(v, x, y)
  return false
}

/** 道のあるカード（直線・L・T・十字・宿場） */
export function hasRoad(card: Card): boolean {
  return BASE_OPENINGS[card.kind] !== undefined
}

/** 道カードを rot の向きで (x,y) に置いたとき、隣の道（館・置いたカード・起点になる砦）と1か所以上つながるか */
function linksToRoad(v: Village, card: Card, x: number, y: number, rot: number): boolean {
  const open = rotate(BASE_OPENINGS[card.kind], rot)
  return [N, E, S, W].some((d) => {
    if (!(open & d)) return false
    const [dx, dy] = DIR_DELTA[d]
    const nx = x + dx
    const ny = y + dy
    return inBounds(nx, ny) && isAnchor(v, nx, ny) && (cellOpenings(v.cells[ny][nx]) & opposite(d)) !== 0
  })
}

/**
 * カードを (x,y) に置けるか。rot を省くと「どれかの向きで置けるか」を返す。
 * 道カードは隣の道と1か所以上つながる向きでしか置けない（2026-11-18 ユーザー決定）。農地は隣ならどこでも。
 */
export function canPlaceCard(v: Village, card: Card, x: number, y: number, rot?: number): boolean {
  if (!inBounds(x, y) || !isPlaceCard(card)) return false
  const cell = v.cells[y][x]
  if (cell.placed) return false
  if (cell.terrain === 'goal' || cell.terrain === 'start' || cell.terrain === 'fort') return false
  if (isWater(cell) && card.kind !== 'straight') return false
  // 寺カード（通常版）は村のふち（四辺）にしか置けない
  if (card.kind === 'temple' && !isEdge(x, y)) return false
  if (!neighbors4(x, y).some(([a, b]) => isAnchor(v, a, b))) return false
  if (!hasRoad(card)) return true
  if (rot !== undefined) return linksToRoad(v, card, x, y, rot)
  return [0, 1, 2, 3].some((r) => linksToRoad(v, card, x, y, r))
}

/** そのマスで置ける向き（時計回りの回転数）。道の無いカードは全部 */
export function validRotations(v: Village, card: Card, x: number, y: number): number[] {
  return [0, 1, 2, 3].filter((r) => canPlaceCard(v, card, x, y, r))
}

export function placeableCells(v: Village, card: Card, rot?: number): [number, number][] {
  const out: [number, number][] = []
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (canPlaceCard(v, card, x, y, rot)) out.push([x, y])
  return out
}

/** コマを置けるマス（コマが無い場所カード） */
export function pieceCells(v: Village): [number, number][] {
  const out: [number, number][] = []
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++) {
      const p = v.cells[y][x].placed
      if (p && !p.piece) out.push([x, y])
    }
  return out
}

/** 氾濫カードを置ける川沿いの空きマス */
export function floodCells(v: Village): [number, number][] {
  const out: [number, number][] = []
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++) {
      const c = v.cells[y][x]
      if (c.terrain !== 'land' || c.flooded || c.placed) continue
      if (neighbors4(x, y).some(([a, b]) => isWater(v.cells[b][a]))) out.push([x, y])
    }
  return out
}

/** 道でつながっているか（a から d 方向の隣へ） */
function linked(v: Village, x: number, y: number, d: number): [number, number] | null {
  const [dx, dy] = DIR_DELTA[d]
  const nx = x + dx
  const ny = y + dy
  if (!inBounds(nx, ny)) return null
  if (!(cellOpenings(v.cells[y][x]) & d)) return null
  if (!(cellOpenings(v.cells[ny][nx]) & opposite(d))) return null
  return [nx, ny]
}

/** start から道でたどれるマス。blocked は通らないマス */
export function reachable(v: Village, sx: number, sy: number, blocked?: [number, number]): Set<string> {
  const seen = new Set<string>([`${sx},${sy}`])
  const stack: [number, number][] = [[sx, sy]]
  while (stack.length) {
    const [x, y] = stack.pop()!
    for (const d of [N, E, S, W]) {
      const n = linked(v, x, y, d)
      if (!n) continue
      if (blocked && n[0] === blocked[0] && n[1] === blocked[1]) continue
      const k = `${n[0]},${n[1]}`
      if (!seen.has(k)) {
        seen.add(k)
        stack.push(n)
      }
    }
  }
  return seen
}

/** GOAL に向かって開いている、GOAL の隣のマス */
function touchesGoal(v: Village, set: Set<string>): boolean {
  const east = v.cells[0][1]
  const south = v.cells[1][0]
  return (set.has('1,0') && (cellOpenings(east) & W) !== 0) || (set.has('0,1') && (cellOpenings(south) & N) !== 0)
}

/** 館から城まで道がつながっているか */
export function isConnected(v: Village): boolean {
  return touchesGoal(v, reachable(v, START.x, START.y))
}

/** 館から城への道が砦を通っているか */
export function passesFort(v: Village): boolean {
  if (!isConnected(v)) return false
  const east: [number, number] = [FORT.x + 1, FORT.y]
  const west: [number, number] = [FORT.x - 1, FORT.y]
  const opens = (p: [number, number], d: number) =>
    inBounds(p[0], p[1]) && (cellOpenings(v.cells[p[1]][p[0]]) & d) !== 0
  if (!opens(east, W) || !opens(west, E)) return false
  const fromStart = reachable(v, START.x, START.y, [FORT.x, FORT.y])
  const goalSide = (p: [number, number]) => touchesGoal(v, reachable(v, p[0], p[1], [FORT.x, FORT.y]))
  const has = (p: [number, number]) => fromStart.has(`${p[0]},${p[1]}`)
  return (has(east) && goalSide(west)) || (has(west) && goalSide(east))
}
