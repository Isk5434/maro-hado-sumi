/** 方角のビットフラグ。カードの道の開き方を表す */
export const N = 1
export const E = 2
export const S = 4
export const W = 8
export const ALL_DIRS = [N, E, S, W] as const
export type Dir = (typeof ALL_DIRS)[number]

export type RoadShape = 'straight' | 'L' | 'T' | 'cross'
/** temple(寺)は通常版だけで使う */
export type PlaceKind = RoadShape | 'farm' | 'inn' | 'temple'
export type EventKind = 'battle' | 'flood'
export type CardKind = PlaceKind | EventKind

export interface Card {
  id: number
  kind: CardKind
}

/** monk(僧)は通常版だけで使う */
export type PieceKind = 'farmer' | 'merchant' | 'samurai' | 'monk'

export interface Piece {
  id: number
  kind: PieceKind
}

/** 盤面に置かれた場所カード。rot は時計回り90°単位の回転数 */
export interface PlacedCard {
  card: Card
  rot: number
  piece: Piece | null
}

export type Terrain = 'land' | 'river' | 'goal' | 'start' | 'fort'

export interface Cell {
  terrain: Terrain
  flooded: boolean
  placed: PlacedCard | null
}

export interface Village {
  cells: Cell[][] // [y][x]
}

export interface Player {
  id: number
  name: string
  village: Village
  keepCards: Card[]
  keepPieces: Piece[]
}

export interface Slot {
  card: Card | null
  piece: Piece | null
}

/** 置き待ちのカードとコマ（取った組・功労者の報酬など） */
export interface Holding {
  player: number
  card: Card | null
  piece: Piece | null
  /** 城の上から取った組で、まだ何も置いていなければ取った場所。置くと選び直せなくなる */
  fromSlot?: number
}

export type Task =
  | { t: 'refillCard'; slot: number }
  | { t: 'refillPiece'; slot: number }
  | { t: 'flood'; by: number; target: number }
  | { t: 'battleStart' }
  | { t: 'battleSelect'; player: number }
  | { t: 'battleResolve' }
  | { t: 'reward'; player: number }
  | { t: 'place'; holding: Holding }
  | { t: 'discard'; player: number }
  | { t: 'endTurn' }

export interface BattleEntry {
  player: number
  pieces: Piece[]
  strength: number
  dice: number[][] // 振り直しも含めた全ての出目
}

export interface Battle {
  entries: BattleEntry[]
  winner: number | null
}

export interface GameState {
  seed: number
  players: Player[]
  current: number
  slots: Slot[]
  deck: Card[]
  discard: Card[]
  bag: Piece[]
  queue: Task[]
  battle: Battle | null
  log: string[]
  over: boolean
  /** 城まで道をつないでゲームを終わらせた人 */
  finisher: number | null
}
