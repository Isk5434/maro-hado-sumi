import { useEffect, useState, type ReactNode } from 'react'
import { canPlaceCard, createVillage, isEdge, isWater, placeableCells, validRotations } from '../game/board'
import { CARD_NAMES, PIECE_NAMES } from '../game/engine'
import type { Card, CardKind, Piece, PieceKind, Village } from '../game/types'
import { CardImage, PieceImage } from '../components/Tiles'
import { VillageBoard } from '../components/VillageBoard'

// ---------------------------------------------------------------- 文章（**強調** を目立たせる）

export type Seg = { t: string; em: boolean }

export function parse(s: string): Seg[] {
  return s.split(/(\*\*.+?\*\*)/).filter(Boolean).map((t) => (t.startsWith('**') ? { t: t.slice(2, -2), em: true } : { t, em: false }))
}

export function plainLength(s: string) {
  return parse(s).reduce((n, g) => n + g.t.length, 0)
}

/** **で囲んだ語をマーカーで強調する。limit を渡すとその文字数まで表示（タイプライター用） */
export function Rich({ text, limit }: { text: string; limit?: number }) {
  let left = limit ?? Infinity
  return (
    <>
      {parse(text).map((g, i) => {
        if (left <= 0) return null
        const t = g.t.slice(0, left)
        left -= g.t.length
        return g.em ? (
          <mark key={i} className="rounded-none bg-[linear-gradient(transparent_55%,#c8b47c_55%)] px-0.5 font-black text-inherit">
            {t}
          </mark>
        ) : (
          <span key={i}>{t}</span>
        )
      })}
    </>
  )
}

// ---------------------------------------------------------------- 素材

let nid = 1
export const C = (kind: CardKind): Card => ({ id: nid++, kind })
export const P = (kind: PieceKind): Piece => ({ id: nid++, kind })
export const k = (x: number, y: number) => `${x},${y}`

type Spec = [x: number, y: number, kind: CardKind, rot?: number, piece?: PieceKind]

/** 村を作る。cards は [x, y, 種類, 向き, コマ] の並び */
export function makeVillage(cards: Spec[] = [], flooded: [number, number][] = []): Village {
  const v = createVillage()
  for (const [x, y, kind, rot = 0, piece] of cards) v.cells[y][x].placed = { card: C(kind), rot, piece: piece ? P(piece) : null }
  for (const [x, y] of flooded) v.cells[y][x].flooded = true
  return v
}

/** 館から城まで、砦を通ってつながる道 */
export const FULL_ROAD: Spec[] = [
  [6, 3, 'straight', 1],
  [5, 3, 'straight', 1],
  [4, 3, 'straight', 1],
  [2, 3, 'straight', 1],
  [1, 3, 'straight', 1],
  [0, 3, 'L', 0],
  [0, 2, 'straight', 0],
  [0, 1, 'straight', 0],
]
export const ROAD_PATH = ['7,3', '6,3', '5,3', '4,3', '3,3', '2,3', '1,3', '0,3', '0,2', '0,1', '0,0']

// ---------------------------------------------------------------- 舞台の部品

export function Note({ tone = 'info', children }: { tone?: 'info' | 'bad' | 'good'; children: ReactNode }) {
  const c = { info: 'border-white/30 bg-white/10 text-white', bad: 'border-rose-300 bg-rose-600/90 text-white', good: 'border-emerald-300 bg-emerald-600/90 text-white' }[tone]
  return <p className={`animate-fade rounded-none border-l-4 px-3 py-2 text-[13px] leading-snug font-bold ${c}`}>{children}</p>
}

export function Die({ n, rolling }: { n: number; rolling?: boolean }) {
  const pips: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] }
  return (
    <span className={`grid h-9 w-9 grid-cols-3 grid-rows-3 gap-0.5 rounded-none bg-white p-1.5 shadow-md ${rolling ? 'animate-shake' : 'animate-pop'}`}>
      {Array.from({ length: 9 }).map((_, i) => (
        <span key={i} className={`rounded-full ${pips[n].includes(i) ? (n === 1 ? 'bg-rose-600' : 'bg-stone-800') : ''}`} />
      ))}
    </span>
  )
}

/** 城の上の4組 */
export function MiniCastle({
  slots,
  onPick,
  picked,
  active = false,
  dealKey = 0,
  caption,
}: {
  slots: { card: Card | null; piece: Piece | null }[]
  onPick?: (i: number) => void
  picked?: number | null
  active?: boolean
  dealKey?: number
  caption?: string
}) {
  return (
    <div
      className="rounded-none p-2.5 text-white shadow-md"
      style={{
        background:
          'repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 18px), repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 34px), linear-gradient(#45433d, #33322d)',
      }}
    >
      <p className="mb-1.5 flex items-center gap-1.5 text-sm font-black">
        🏯 城の上 {caption && <span className="text-[11px] font-bold opacity-75">{caption}</span>}
        <span className="h-px flex-1 bg-white/25" />
      </p>
      <div className="grid grid-cols-4 gap-1.5">
        {slots.map((s, i) => (
          <button
            key={i}
            type="button"
            disabled={!onPick || !s.card}
            onClick={() => onPick?.(i)}
            className={`flex flex-col items-center rounded-none border-2 border-dashed p-1 transition duration-200 ${
              picked === i ? 'border-amber-300 bg-amber-300/30 ring-2 ring-amber-300' : active && s.card ? 'animate-glow border-amber-300 bg-amber-300/10 hover:-translate-y-0.5' : 'border-red-400/70 bg-black/15'
            }`}
            aria-label={s.card ? `${CARD_NAMES[s.card.kind]}${s.piece ? `と${PIECE_NAMES[s.piece.kind]}` : ''}の組` : '空き'}
          >
            {s.card ? (
              <span key={`${dealKey}-${s.card.id}`} className="block w-full animate-deal" style={{ animationDelay: `${i * 90}ms` }}>
                <CardImage card={s.card} className="w-full rounded-none" />
              </span>
            ) : (
              <span className="flex aspect-square w-full items-center justify-center rounded-none border border-dashed border-white/30 text-[10px] text-white/60">空き</span>
            )}
            <span key={`${dealKey}-${s.piece?.id ?? 'x'}`} className="-mt-3 w-1/2 animate-pop" style={{ animationDelay: `${150 + i * 90}ms` }}>
              {s.piece ? <PieceImage piece={s.piece} className="w-full" /> : <span className="block aspect-square w-full" />}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

/** 手元のカード・コマ */
export function HandRow({ children, label = '手元' }: { children: ReactNode; label?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-none border-t-4 border-[#3d3b35] bg-[#d3cebd] px-2.5 py-2 text-[#2b2a26]">
      <span className="text-xs font-black [writing-mode:vertical-rl]">✋{label}</span>
      {children}
    </div>
  )
}

export function HandCard({
  card,
  rot = 0,
  active,
  onClick,
  onDragStart,
}: {
  card: Card
  rot?: number
  active?: boolean
  onClick?: () => void
  /** PCでドラッグして置けるようにする */
  onDragStart?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      draggable={!!onDragStart}
      onDragStart={
        onDragStart
          ? (e) => {
              e.dataTransfer.effectAllowed = 'move'
              e.dataTransfer.setData('text/plain', String(card.id))
              onDragStart()
            }
          : undefined
      }
      className={`flex w-16 flex-col items-center gap-0.5 rounded-none p-1 transition-all duration-200 lg:w-20 ${onDragStart ? 'cursor-grab active:cursor-grabbing' : ''} ${active ? '-translate-y-1 bg-white shadow-lg ring-3 ring-amber-500' : 'bg-white/50'} hover:-translate-y-1.5 hover:rotate-[-2deg]`}
    >
      <CardImage card={card} rot={rot} className="w-full rounded-none" />
      <span className="text-[10px] leading-none font-bold">{CARD_NAMES[card.kind]}</span>
    </button>
  )
}

export function RotateButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="ml-auto rounded-none bg-teal-board px-3 py-2.5 text-sm font-black text-white shadow active:scale-95">
      ⟳ 回す
    </button>
  )
}

// ---------------------------------------------------------------- カードを置いてみる

export function PlaceDemo({
  initial,
  hand,
  only,
  labels,
  onPlaced,
  footer,
}: {
  initial: Village
  hand: { card: Card; rot?: number }[]
  /** 押せるマスをしぼる */
  only?: string[]
  labels?: Record<string, string>
  /** 置いたら呼ぶ。メッセージを返すと表示する */
  onPlaced: (v: Village, card: Card, key: string) => { msg: string; tone?: 'good' | 'info' } | void
  footer?: ReactNode
}) {
  const [v, setV] = useState(initial)
  const [cards, setCards] = useState(hand)
  const [sel, setSel] = useState(0)
  const [rot, setRot] = useState(hand[0]?.rot ?? 0)
  const [msg, setMsg] = useState<{ text: string; tone: 'bad' | 'good' | 'info' } | null>(null)
  const [shake, setShake] = useState<string | null>(null)
  const [fresh, setFresh] = useState<string | null>(null)
  const rot4 = ((rot % 4) + 4) % 4
  const card = cards[sel]?.card

  const allTargets = new Set(cards.flatMap((h) => placeableCells(v, h.card).map(([x, y]) => k(x, y))))
  // 置けないカードを選んでいても、川などを押して「置けない理由」を見られるように、手元のどれかが置けるマスは押せる
  const targets = new Set([...allTargets].filter((key) => !only || only.includes(key)))
  if (only && card) for (const key of only) if (!v.cells[+key.split(',')[1]][+key.split(',')[0]].placed) targets.add(key)
  const fits = card ? new Set(placeableCells(v, card, rot4).map(([x, y]) => k(x, y))) : null

  // PC: R キーで回す
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.key === 'r' || e.key === 'R') && card && card.kind !== 'farm' && card.kind !== 'temple') setRot((r) => r + 1)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [card])

  const onCell = (x: number, y: number, dropped = false) => {
    if (!card) return
    const key = k(x, y)
    if (!canPlaceCard(v, card, x, y)) {
      setShake(null)
      requestAnimationFrame(() => setShake(key))
      const cell = v.cells[y][x]
      setMsg({
        tone: 'bad',
        text:
          isWater(cell) && card.kind !== 'straight'
            ? `川には直線カードしか置けません（${CARD_NAMES[card.kind]}は置けない）`
            : card.kind === 'temple' && !isEdge(x, y)
              ? '寺カードは村のふち（四辺）にしか置けません'
              : 'ここでは道がつながらないので置けません',
      })
      return
    }
    const ok = validRotations(v, card, x, y)
    let useRot = rot4
    if (!ok.includes(rot4)) {
      const target = ok.find((r) => r > rot4) ?? ok[0]
      setRot(rot + ((target - rot4 + 4) % 4))
      // ドラッグで落としたときは、つながる向きに回してそのまま置く
      if (!dropped) {
        setMsg({ tone: 'info', text: '道がつながる向きに回しました。もう一度押すと置けます' })
        return
      }
      useRot = target
    }
    const next = structuredClone(v)
    next.cells[y][x].placed = { card, rot: useRot, piece: null }
    setV(next)
    setFresh(key)
    const rest = cards.filter((_, i) => i !== sel)
    setCards(rest)
    setSel(0)
    setRot(rest[0]?.rot ?? 0)
    const r = onPlaced(next, card, key)
    setMsg(r ? { text: r.msg, tone: r.tone ?? 'good' } : null)
  }

  return (
    <div className="flex flex-col gap-2">
      <VillageBoard
        village={v}
        targets={targets}
        fits={fits}
        ghost={card ? { card, rot } : null}
        freshCards={fresh ? new Set([fresh]) : undefined}
        labels={labels}
        shake={shake}
        onCell={(x, y) => onCell(x, y)}
        onDropCell={(x, y) => onCell(x, y, true)}
      />
      {cards.length > 0 && (
        <HandRow>
          {cards.map((h, i) => (
            <HandCard
              key={h.card.id}
              card={h.card}
              rot={i === sel ? rot : (h.rot ?? 0)}
              active={i === sel}
              onClick={() => (i === sel ? setRot((r) => r + 1) : (setSel(i), setRot(h.rot ?? 0)))}
              onDragStart={() => {
                if (i !== sel) {
                  setSel(i)
                  setRot(h.rot ?? 0)
                }
              }}
            />
          ))}
          <span className="hidden text-[11px] leading-tight font-bold opacity-70 [@media(hover:hover)]:block">
            ドラッグして盤に置ける
            <br />
            <kbd className="rounded-none border border-current px-1">R</kbd> で回す
          </span>
          {card && card.kind !== 'farm' && card.kind !== 'temple' && <RotateButton onClick={() => setRot((r) => r + 1)} />}
        </HandRow>
      )}
      {msg && (
        <Note key={msg.text + rot} tone={msg.tone}>
          {msg.text}
        </Note>
      )}
      {footer}
    </div>
  )
}

/** 一定間隔で 0,1,2… と数える（演出用） */
export function useTicker(ms: number, max: number, loop = true) {
  const [i, setI] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1 > max ? (loop ? 0 : max) : n + 1)), ms)
    return () => clearInterval(t)
  }, [ms, max, loop])
  return i
}
