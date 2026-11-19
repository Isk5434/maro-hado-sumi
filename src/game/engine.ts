import {
  canPlaceCard,
  createVillage,
  floodCells,
  isConnected,
  isPlaceCard,
  isRoadKind,
  pieceCells,
  placeableCells,
} from './board'
import type { Card, CardKind, GameState, Holding, Piece, PieceKind, Player, Task, Village } from './types'

export const KEEP_LIMIT = 2
export const BATTLE_SIZE = 3

export const CARD_COUNTS: Record<CardKind, number> = {
  straight: 20,
  L: 15,
  T: 15,
  cross: 10,
  farm: 20,
  inn: 8,
  temple: 0, // 通常版のみ（8枚）
  battle: 3,
  flood: 7,
}

/** 短縮版の数。僧は通常版のみ（18個） */
export const PIECE_COUNTS: Record<PieceKind, number> = { farmer: 56, merchant: 28, samurai: 28, monk: 0 }
export const STRENGTH: Record<PieceKind, number> = { samurai: 4, monk: 3, farmer: 2, merchant: 1 }

export const CARD_NAMES: Record<CardKind, string> = {
  straight: '直線',
  L: 'L字',
  T: 'T字',
  cross: '十字',
  farm: '農地',
  inn: '宿場',
  temple: '寺',
  battle: '合戦',
  flood: '氾濫',
}
export const PIECE_NAMES: Record<PieceKind, string> = { farmer: '農民', merchant: '商人', samurai: '武士', monk: '僧' }

// ---------- 乱数（シード固定でテストできるようにする） ----------

function nextRandom(state: GameState): number {
  let t = (state.seed = (state.seed + 0x6d2b79f5) | 0)
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

function shuffle<T>(state: GameState, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom(state) * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export function rollDie(state: GameState): number {
  return Math.floor(nextRandom(state) * 6) + 1
}

// ---------- 準備 ----------

export function createGame(names: string[], seed = Date.now()): GameState {
  if (names.length < 2 || names.length > 4) throw new Error('プレイヤーは2〜4人です')
  const state: GameState = {
    seed: seed | 0,
    players: names.map((name, id) => ({ id, name, village: createVillage(), keepCards: [], keepPieces: [] })),
    current: 0,
    slots: [0, 1, 2, 3].map(() => ({ card: null, piece: null })),
    deck: [],
    discard: [],
    bag: [],
    queue: [],
    battle: null,
    log: [],
    over: false,
    finisher: null,
  }
  let id = 0
  for (const [kind, n] of Object.entries(CARD_COUNTS) as [CardKind, number][])
    for (let i = 0; i < n; i++) state.deck.push({ id: id++, kind })
  for (const [kind, n] of Object.entries(PIECE_COUNTS) as [PieceKind, number][])
    for (let i = 0; i < n; i++) state.bag.push({ id: id++, kind })
  shuffle(state, state.deck)
  shuffle(state, state.bag)

  // イベントが1枚でもあるか、道カードが1枚も無ければ4枚とも捨てて引き直す
  for (;;) {
    const drawn = state.deck.splice(-4, 4)
    const ok = drawn.every(isPlaceCard) && drawn.some((c) => isRoadKind(c.kind))
    if (ok) {
      drawn.forEach((c, i) => (state.slots[i].card = c))
      break
    }
    state.discard.push(...drawn)
    if (state.deck.length < 4) throw new Error('山札が足りません')
  }
  state.slots.forEach((s) => (s.piece = state.bag.pop() ?? null))
  log(state, `ゲーム開始。${state.players[0].name}の番です`)
  return state
}

function log(state: GameState, msg: string) {
  state.log.push(msg)
}

function clone(state: GameState): GameState {
  return structuredClone(state)
}

// ---------- 状態の読み取り ----------

export type Phase =
  | { kind: 'choose'; player: number }
  | { kind: 'place'; player: number; holding: Holding }
  | { kind: 'flood'; player: number; target: number }
  | { kind: 'battleSelect'; player: number }
  | { kind: 'reward'; player: number }
  | { kind: 'discard'; player: number }
  | { kind: 'over' }

export function phaseOf(state: GameState): Phase {
  if (state.over) return { kind: 'over' }
  const task = state.queue[0]
  if (!task) return { kind: 'choose', player: state.current }
  switch (task.t) {
    case 'place':
      return { kind: 'place', player: task.holding.player, holding: task.holding }
    case 'flood':
      return { kind: 'flood', player: task.by, target: task.target }
    case 'battleSelect':
      return { kind: 'battleSelect', player: task.player }
    case 'reward':
      return { kind: 'reward', player: task.player }
    case 'discard':
      return { kind: 'discard', player: task.player }
    default:
      throw new Error(`入力待ちではないタスク: ${task.t}`)
  }
}

/** カードを村に置けるか、キープに入れられるか */
export function canTakeCard(player: Player, card: Card): boolean {
  return placeableCells(player.village, card).length > 0 || player.keepCards.length < KEEP_LIMIT
}

export function takeableSlots(state: GameState): number[] {
  const p = state.players[state.current]
  return state.slots.flatMap((s, i) => (s.card && canTakeCard(p, s.card) ? [i] : []))
}

export function piecesOf(player: Player): number {
  let n = player.keepPieces.length
  for (const row of player.village.cells) for (const c of row) if (c.placed?.piece) n++
  return n
}

export function discardableCells(v: Village): [number, number][] {
  const out: [number, number][] = []
  v.cells.forEach((row, y) => row.forEach((c, x) => c.placed && !c.placed.piece && out.push([x, y])))
  return out
}

/** 自分の番で、キープから場に出せるか */
export function canUseKeep(state: GameState, player: number): boolean {
  if (state.over || player !== state.current) return false
  const task = state.queue[0]
  return !task || (task.t === 'place' && task.holding.player === player)
}

// ---------- キュー処理 ----------

function drawCard(state: GameState): Card | null {
  return state.deck.pop() ?? null
}

function previousPlayer(state: GameState, p: number): number {
  return (p - 1 + state.players.length) % state.players.length
}

function finishIfConnected(state: GameState, player: number) {
  if (state.over) return
  if (isConnected(state.players[player].village)) {
    state.over = true
    state.finisher = player
    state.queue = []
    log(state, `${state.players[player].name}が館から城まで道をつなぎました！ゲーム終了`)
  }
}

/** 自動で進められるタスクを、入力待ちになるまで処理する */
function run(state: GameState) {
  while (!state.over && state.queue.length) {
    const task = state.queue[0]
    switch (task.t) {
      case 'refillCard': {
        state.queue.shift()
        const card = drawCard(state)
        if (!card) {
          log(state, '山札がなくなりました')
          break
        }
        if (card.kind === 'battle') {
          state.discard.push(card)
          log(state, '合戦カードが出た！合戦が発生')
          state.queue.unshift({ t: 'battleStart' }, { t: 'refillCard', slot: task.slot })
        } else if (card.kind === 'flood') {
          state.discard.push(card)
          const target = previousPlayer(state, state.current)
          log(state, `氾濫カードが出た！${state.players[target].name}の村の川があふれる`)
          state.queue.unshift({ t: 'flood', by: state.current, target }, { t: 'refillCard', slot: task.slot })
        } else {
          state.slots[task.slot].card = card
        }
        break
      }
      case 'refillPiece':
        state.queue.shift()
        state.slots[task.slot].piece = state.bag.pop() ?? null
        break
      case 'flood':
        if (floodCells(state.players[task.target].village).length === 0) {
          state.queue.shift()
          log(state, '川沿いに空きマスが無いので、氾濫カードは捨てられた')
          break
        }
        return
      case 'battleStart': {
        state.queue.shift()
        const empty = state.players.filter((p) => piecesOf(p) === 0)
        if (empty.length) {
          log(state, `${empty.map((p) => p.name).join('・')}に出せる人物コマが無いので、合戦は起こらない`)
          break
        }
        state.battle = { entries: [], winner: null }
        const order = state.players.map((_, i) => (state.current + i) % state.players.length)
        state.queue.unshift(...order.map((player): Task => ({ t: 'battleSelect', player })), { t: 'battleResolve' })
        break
      }
      case 'battleSelect': {
        const p = state.players[task.player]
        // 3人以下なら全員を出すしかないので自動で出す
        if (piecesOf(p) <= BATTLE_SIZE) {
          const refs: PieceRef[] = p.keepPieces.map((_, index) => ({ from: 'keep', index }))
          p.village.cells.forEach((row, y) =>
            row.forEach((c, x) => c.placed?.piece && refs.push({ from: 'village', x, y })),
          )
          commitBattleSelect(state, task.player, refs)
          state.queue.shift()
          break
        }
        return
      }
      case 'battleResolve':
        state.queue.shift()
        resolveBattle(state)
        break
      case 'reward':
        if (!state.slots.some((s) => s.card || s.piece)) {
          state.queue.shift()
          break
        }
        return
      case 'place': {
        const h = task.holding
        const p = state.players[h.player]
        if (h.card && !canTakeCard(p, h.card)) {
          state.discard.push(h.card)
          log(state, `${CARD_NAMES[h.card.kind]}カードは置けないので捨てた`)
          h.card = null
        }
        if (!h.card && h.piece && pieceCells(p.village).length === 0 && p.keepPieces.length >= KEEP_LIMIT) {
          state.bag.push(h.piece)
          shuffle(state, state.bag)
          log(state, `${PIECE_NAMES[h.piece.kind]}コマは置けないのでコマ袋に戻した`)
          h.piece = null
        }
        if (!h.card && !h.piece) {
          state.queue.shift()
          break
        }
        return
      }
      case 'discard':
        if (discardableCells(state.players[task.player].village).length === 0) {
          state.queue.shift()
          break
        }
        return
      case 'endTurn':
        state.queue.shift()
        state.current = (state.current + 1) % state.players.length
        log(state, `${state.players[state.current].name}の番です`)
        break
    }
  }
  if (!state.over && !state.queue.length && state.slots.every((s) => !s.card) && state.deck.length === 0) {
    state.over = true
    log(state, '城の上のカードがなくなったので、ゲーム終了')
  }
}

// ---------- 合戦 ----------

export type PieceRef = { from: 'village'; x: number; y: number } | { from: 'keep'; index: number }

function commitBattleSelect(state: GameState, player: number, refs: PieceRef[]) {
  const p = state.players[player]
  const pieces: Piece[] = []
  for (const r of refs) if (r.from === 'village') pieces.push(p.village.cells[r.y][r.x].placed!.piece!)
  for (const r of refs) if (r.from === 'village') p.village.cells[r.y][r.x].placed!.piece = null
  const keepIdx = refs.flatMap((r) => (r.from === 'keep' ? [r.index] : [])).sort((a, b) => b - a)
  for (const i of keepIdx) pieces.push(...p.keepPieces.splice(i, 1))
  const strength = pieces.reduce((s, pc) => s + STRENGTH[pc.kind], 0)
  state.battle!.entries.push({ player, pieces, strength, dice: [] })
  log(state, `${p.name}は${pieces.map((pc) => PIECE_NAMES[pc.kind]).join('・')}を出した（強さ${strength}）`)
}

function resolveBattle(state: GameState) {
  const battle = state.battle!
  const roll = () => [rollDie(state), rollDie(state)]
  for (const e of battle.entries) e.dice.push(roll())
  const sum = (d: number[]) => d[0] + d[1]
  let best = Math.max(...battle.entries.map((e) => e.strength + sum(e.dice[0])))
  let tied = battle.entries.filter((e) => e.strength + sum(e.dice[0]) === best)
  // 同点ならその人たちだけでサイコロ2個を振り直し、出目の大きい人が功労者
  while (tied.length > 1) {
    log(state, `${tied.map((e) => state.players[e.player].name).join('・')}が同点。サイコロを振り直す`)
    for (const e of tied) e.dice.push(roll())
    best = Math.max(...tied.map((e) => sum(e.dice.at(-1)!)))
    tied = tied.filter((e) => sum(e.dice.at(-1)!) === best)
  }
  const winner = tied[0].player
  battle.winner = winner
  for (const e of battle.entries) {
    state.bag.push(...e.pieces)
    const d = e.dice[0]
    log(state, `${state.players[e.player].name}: 強さ${e.strength}+サイコロ${d[0]}+${d[1]}=${e.strength + d[0] + d[1]}`)
  }
  shuffle(state, state.bag)
  log(state, `合戦の功労者は${state.players[winner].name}！`)
  const losers = state.players.map((p) => p.id).filter((id) => id !== winner)
  state.queue.unshift({ t: 'reward', player: winner }, ...losers.map((player): Task => ({ t: 'discard', player })))
}

// ---------- プレイヤーの操作 ----------

type Action = (state: GameState) => void

function apply(state: GameState, action: Action): GameState {
  const next = clone(state)
  action(next)
  run(next)
  return next
}

function frontTask<T extends Task['t']>(state: GameState, t: T): Extract<Task, { t: T }> {
  const task = state.queue[0]
  if (!task || task.t !== t) throw new Error('今はその操作はできません')
  return task as Extract<Task, { t: T }>
}

function doTakeSet(s: GameState, slot: number) {
  if (s.over || s.queue.length) throw new Error('今はその操作はできません')
  if (!takeableSlots(s).includes(slot)) throw new Error('その組は取れません')
  const { card, piece } = s.slots[slot]
  s.slots[slot] = { card: null, piece: null }
  log(s, `${s.players[s.current].name}は${CARD_NAMES[card!.kind]}${piece ? `と${PIECE_NAMES[piece.kind]}` : ''}を取った`)
  s.queue.push(
    { t: 'place', holding: { player: s.current, card, piece, fromSlot: slot } },
    { t: 'refillCard', slot },
    { t: 'refillPiece', slot },
    { t: 'endTurn' },
  )
}

export function takeSet(state: GameState, slot: number): GameState {
  return apply(state, (s) => doTakeSet(s, slot))
}

/** 取った組をまだ何も置いていなければ、城の上に戻せるか */
export function canChangeSet(state: GameState): boolean {
  const task = state.queue[0]
  return !state.over && task?.t === 'place' && task.holding.fromSlot !== undefined
}

/**
 * 取った組を城の上に戻し、別の組を取り直す。同じ場所を選ぶと、戻すだけ。
 * カードもコマもまだ置いていないときだけできる。
 */
export function changeSet(state: GameState, slot: number): GameState {
  return apply(state, (s) => {
    if (!canChangeSet(s)) throw new Error('もう置き始めたので選び直せません（「戻す」で取り消せます）')
    const h = (s.queue[0] as Extract<Task, { t: 'place' }>).holding
    const from = h.fromSlot!
    s.slots[from] = { card: h.card, piece: h.piece }
    s.queue = []
    log(s, `${s.players[s.current].name}は取った組を城の上に戻した`)
    if (slot !== from) doTakeSet(s, slot)
  })
}

export function skipTurn(state: GameState): GameState {
  return apply(state, (s) => {
    if (s.over || s.queue.length) throw new Error('今はその操作はできません')
    if (takeableSlots(s).length) throw new Error('取れる組があります')
    log(s, `${s.players[s.current].name}は取れる組が無いので、手番をスキップ`)
    s.queue.push({ t: 'endTurn' })
  })
}

export function placeHoldingCard(state: GameState, x: number, y: number, rot: number): GameState {
  return apply(state, (s) => {
    const h = frontTask(s, 'place').holding
    const p = s.players[h.player]
    if (!h.card || !canPlaceCard(p.village, h.card, x, y)) throw new Error('そこには置けません')
    if (!canPlaceCard(p.village, h.card, x, y, rot)) throw new Error('その向きでは道がつながりません。カードを回してください')
    p.village.cells[y][x].placed = { card: h.card, rot, piece: null }
    h.card = null
    h.fromSlot = undefined
    finishIfConnected(s, h.player)
  })
}

export function keepHoldingCard(state: GameState): GameState {
  return apply(state, (s) => {
    const h = frontTask(s, 'place').holding
    const p = s.players[h.player]
    if (!h.card || p.keepCards.length >= KEEP_LIMIT) throw new Error('キープがいっぱいです')
    p.keepCards.push(h.card)
    h.card = null
    h.fromSlot = undefined
  })
}

export function placeHoldingPiece(state: GameState, x: number, y: number): GameState {
  return apply(state, (s) => {
    const h = frontTask(s, 'place').holding
    const cell = s.players[h.player].village.cells[y]?.[x]
    if (!h.piece || !cell?.placed || cell.placed.piece) throw new Error('そこには置けません')
    cell.placed.piece = h.piece
    h.piece = null
    h.fromSlot = undefined
  })
}

export function keepHoldingPiece(state: GameState): GameState {
  return apply(state, (s) => {
    const h = frontTask(s, 'place').holding
    const p = s.players[h.player]
    if (!h.piece || p.keepPieces.length >= KEEP_LIMIT) throw new Error('キープがいっぱいです')
    p.keepPieces.push(h.piece)
    h.piece = null
    h.fromSlot = undefined
  })
}

export function playKeepCard(state: GameState, index: number, x: number, y: number, rot: number): GameState {
  return apply(state, (s) => {
    if (!canUseKeep(s, s.current)) throw new Error('今はキープを使えません')
    const p = s.players[s.current]
    const card = p.keepCards[index]
    if (!card || !canPlaceCard(p.village, card, x, y)) throw new Error('そこには置けません')
    if (!canPlaceCard(p.village, card, x, y, rot)) throw new Error('その向きでは道がつながりません。カードを回してください')
    p.keepCards.splice(index, 1)
    p.village.cells[y][x].placed = { card, rot, piece: null }
    log(s, `${p.name}はキープの${CARD_NAMES[card.kind]}を置いた`)
    finishIfConnected(s, s.current)
  })
}

export function playKeepPiece(state: GameState, index: number, x: number, y: number): GameState {
  return apply(state, (s) => {
    if (!canUseKeep(s, s.current)) throw new Error('今はキープを使えません')
    const p = s.players[s.current]
    const piece = p.keepPieces[index]
    const cell = p.village.cells[y]?.[x]
    if (!piece || !cell?.placed || cell.placed.piece) throw new Error('そこには置けません')
    p.keepPieces.splice(index, 1)
    cell.placed.piece = piece
    log(s, `${p.name}はキープの${PIECE_NAMES[piece.kind]}を置いた`)
  })
}

export function placeFlood(state: GameState, x: number, y: number): GameState {
  return apply(state, (s) => {
    const task = frontTask(s, 'flood')
    const v = s.players[task.target].village
    if (!floodCells(v).some(([a, b]) => a === x && b === y)) throw new Error('そこには置けません')
    v.cells[y][x].flooded = true
    s.queue.shift()
    log(s, `${s.players[task.target].name}の村の(${x + 1},${y + 1})が氾濫した`)
  })
}

export function selectBattlePieces(state: GameState, refs: PieceRef[]): GameState {
  return apply(state, (s) => {
    const task = frontTask(s, 'battleSelect')
    const p = s.players[task.player]
    const need = Math.min(BATTLE_SIZE, piecesOf(p))
    const keys = new Set(refs.map((r) => (r.from === 'keep' ? `k${r.index}` : `v${r.x},${r.y}`)))
    if (keys.size !== need) throw new Error(`人物コマを${need}人選んでください`)
    for (const r of refs) {
      const ok = r.from === 'keep' ? !!p.keepPieces[r.index] : !!p.village.cells[r.y]?.[r.x]?.placed?.piece
      if (!ok) throw new Error('選べないコマがあります')
    }
    commitBattleSelect(s, task.player, refs)
    s.queue.shift()
  })
}

export function chooseReward(state: GameState, cardSlot: number | null, pieceSlot: number | null): GameState {
  return apply(state, (s) => {
    const task = frontTask(s, 'reward')
    const p = s.players[task.player]
    const card = cardSlot === null ? null : s.slots[cardSlot]?.card ?? null
    const piece = pieceSlot === null ? null : s.slots[pieceSlot]?.piece ?? null
    if (cardSlot !== null && (!card || !canTakeCard(p, card))) throw new Error('そのカードは取れません')
    if (pieceSlot !== null && !piece) throw new Error('そのコマは取れません')
    if (cardSlot !== null) s.slots[cardSlot].card = null
    if (pieceSlot !== null) s.slots[pieceSlot].piece = null
    s.queue.shift()
    const refills: Task[] = []
    if (cardSlot !== null) refills.push({ t: 'refillCard', slot: cardSlot })
    if (pieceSlot !== null) refills.push({ t: 'refillPiece', slot: pieceSlot })
    s.queue.unshift({ t: 'place', holding: { player: task.player, card, piece } }, ...refills)
    log(s, `${p.name}は報酬として${card ? CARD_NAMES[card.kind] : 'カードなし'}・${piece ? PIECE_NAMES[piece.kind] : 'コマなし'}を取った`)
  })
}

export function discardCard(state: GameState, x: number, y: number): GameState {
  return apply(state, (s) => {
    const task = frontTask(s, 'discard')
    const p = s.players[task.player]
    const cell = p.village.cells[y]?.[x]
    if (!cell?.placed || cell.placed.piece) throw new Error('コマがのっていない場所カードを選んでください')
    s.discard.push(cell.placed.card)
    log(s, `${p.name}は${CARD_NAMES[cell.placed.card.kind]}カードを捨てた`)
    cell.placed = null
    s.queue.shift()
  })
}

/** テストやデバッグ用に、run を通した状態を返す */
export function settle(state: GameState): GameState {
  return apply(state, () => {})
}
