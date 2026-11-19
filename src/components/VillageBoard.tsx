import { useState } from 'react'
import { COLS, ROWS } from '../game/board'
import { CARD_NAMES, PIECE_NAMES, STRENGTH } from '../game/engine'
import type { Card, Cell, Village } from '../game/types'
import { CardImage, PieceImage, TerrainTile } from './Tiles'

interface Props {
  village: Village
  /** 押せるマス "x,y" */
  targets?: Set<string>
  /** 押せるマスのうち、いまの向きのままで置けるマス（無ければ全部置ける扱い） */
  fits?: Set<string> | null
  /** 選択中のマス（合戦で出すコマなど） */
  selected?: Set<string>
  targetTone?: 'place' | 'danger' | 'pick'
  /** 置こうとしているカード。押せるマスに薄く表示して、向きを確かめられるようにする */
  ghost?: { card: Card; rot: number } | null
  /** 直前の操作で置かれたカード／コマのマス（登場の動きをつける） */
  freshCards?: Set<string>
  freshPieces?: Set<string>
  /** 盤の縁の色（村の持ち主の色） */
  accent?: string
  /** 説明中のマス。指定するとほかのマスを暗くする（ルール説明用） */
  spotlight?: Set<string> | null
  /** マスに添える小さなラベル（ルール説明用） */
  labels?: Record<string, string>
  /** 金色に光らせるマス（つながった道など） */
  glow?: Set<string>
  /** 揺らすマス（置けない場所を押したとき） */
  shake?: string | null
  onCell?: (x: number, y: number) => void
  /** カードをドラッグして落としたとき（PC） */
  onDropCell?: (x: number, y: number) => void
  /** マウスを乗せたマスの説明を盤の下に出す（PCのみ表示） */
  inspect?: boolean
}

/** マスの説明（PCで盤にマウスを乗せたとき） */
export function describeCell(cell: Cell): string {
  if (cell.placed) {
    const p = cell.placed.piece
    return `${CARD_NAMES[cell.placed.card.kind]}カード${p ? `　＋　${PIECE_NAMES[p.kind]}（強さ${STRENGTH[p.kind]}）` : ''}`
  }
  if (cell.flooded) return '氾濫 — 川と同じ。直線カードだけ置ける'
  switch (cell.terrain) {
    case 'goal':
      return '城（GOAL）— ここまで道をつなげる。カードは置けない'
    case 'start':
      return '館（スタート）— 上下左右どの道ともつながる'
    case 'fort':
      return '砦 — 左右（東西）にだけ道が通る'
    case 'river':
      return '川 — 直線カードだけ置ける（橋になる）'
    default:
      return '空き地'
  }
}

const TONE = {
  place: { ring: 'ring-emerald-300', fill: 'bg-emerald-300/30' },
  danger: { ring: 'ring-rose-400', fill: 'bg-rose-500/30' },
  pick: { ring: 'ring-amber-300', fill: 'bg-amber-300/20' },
} as const

export function VillageBoard({
  village,
  targets,
  fits,
  selected,
  targetTone = 'place',
  ghost,
  freshCards,
  freshPieces,
  accent,
  spotlight,
  labels,
  glow,
  shake,
  onCell,
  onDropCell,
  inspect = true,
}: Props) {
  const tone = TONE[targetTone]
  const [hover, setHover] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  // 無効なボタンにはマウスのイベントが来ないので、盤の座標からマスを割り出す
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse') return
    const r = e.currentTarget.getBoundingClientRect()
    const x = Math.floor(((e.clientX - r.left) / r.width) * COLS)
    const y = Math.floor(((e.clientY - r.top) / r.height) * ROWS)
    setHover(x >= 0 && x < COLS && y >= 0 && y < ROWS ? `${x},${y}` : null)
  }
  const hovered = hover ? village.cells[+hover.split(',')[1]][+hover.split(',')[0]] : null
  return (
    <div>
    <div
      className="rounded-none bg-teal-board p-1 sm:p-1.5"
      style={{ boxShadow: `${accent ? `0 0 0 3px ${accent},` : ''} inset 0 2px 6px rgba(0,0,0,0.35), 0 6px 16px -8px rgba(0,0,0,0.45)` }}
    >
      <div
        className="grid gap-[2px]"
        style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
        onPointerMove={inspect ? onPointerMove : undefined}
        onPointerLeave={() => setHover(null)}
      >
        {Array.from({ length: ROWS }).flatMap((_, y) =>
          Array.from({ length: COLS }).map((_, x) => {
            const cell = village.cells[y][x]
            const key = `${x},${y}`
            const isTarget = !!targets?.has(key)
            const isSelected = !!selected?.has(key)
            const fitsNow = !fits || fits.has(key)
            const lit = !!spotlight?.has(key)
            return (
              <button
                key={key}
                type="button"
                disabled={!isTarget && !isSelected}
                onClick={() => onCell?.(x, y)}
                onDragOver={
                  onDropCell && isTarget
                    ? (e) => {
                        e.preventDefault()
                        setDragOver(key)
                      }
                    : undefined
                }
                onDragLeave={() => setDragOver((d) => (d === key ? null : d))}
                onDrop={
                  onDropCell && isTarget
                    ? (e) => {
                        e.preventDefault()
                        setDragOver(null)
                        onDropCell(x, y)
                      }
                    : undefined
                }
                className={`group relative aspect-square overflow-hidden rounded-none outline-none transition-transform duration-150 ${
                  isSelected ? 'z-10 scale-95 ring-4 ring-amber-400' : isTarget ? `z-10 ring-2 ring-inset ${tone.ring} hover:scale-[1.04] active:scale-95` : ''
                } ${isTarget || isSelected ? 'cursor-pointer' : 'cursor-default'} ${lit ? 'z-20 ring-2 ring-amber-300' : ''} ${shake === key ? 'animate-shake' : ''} ${dragOver === key ? 'z-30 scale-110 ring-4 ring-white' : ''} ${hover === key && !dragOver ? 'brightness-110' : ''}`}
                aria-label={`(${x + 1},${y + 1})${isTarget && !fitsNow ? ' 回すと置ける' : ''}`}
              >
                {cell.placed ? (
                  <span key={cell.placed.card.id} className={`absolute inset-0 ${freshCards?.has(key) ? 'animate-drop' : ''}`}>
                    <CardImage card={cell.placed.card} rot={cell.placed.rot} className="h-full w-full" />
                  </span>
                ) : (
                  <TerrainTile cell={cell} />
                )}
                {cell.placed?.piece && (
                  <span key={cell.placed.piece.id} className={`absolute inset-0 flex items-center justify-center ${freshPieces?.has(key) ? 'animate-pop' : ''}`}>
                    <PieceImage piece={cell.placed.piece} className="w-[64%]" />
                  </span>
                )}
                {isTarget && !cell.placed && (
                  <>
                    {ghost && (
                      <CardImage
                        card={ghost.card}
                        rot={ghost.rot}
                        className={`absolute inset-0 h-full w-full ${fitsNow ? 'opacity-60' : 'opacity-25 grayscale'}`}
                      />
                    )}
                    <span className={`absolute inset-0 animate-pulse ${tone.fill}`} />
                    {!fitsNow && (
                      <span className="absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-none bg-teal-board/85 text-[10px] leading-none font-black text-white">
                        ⟳
                      </span>
                    )}
                  </>
                )}
                {isTarget && cell.placed && <span className={`absolute inset-0 animate-pulse ${tone.fill}`} />}
                {glow?.has(key) && <span className="pointer-events-none absolute inset-0 animate-pulse bg-amber-300/35 shadow-[inset_0_0_10px_rgba(252,211,77,0.9)]" />}
                {spotlight && !lit && <span className="pointer-events-none absolute inset-0 bg-[#1c1b18]/60 transition-opacity duration-300" />}
                {labels?.[key] && (
                  <span className="pointer-events-none absolute inset-x-0 bottom-0 animate-fade truncate bg-black/70 px-0.5 py-px text-center text-[9px] leading-tight font-bold text-white sm:text-[11px]">
                    {labels[key]}
                  </span>
                )}
              </button>
            )
          }),
        )}
      </div>
    </div>
    {inspect && (
      <p className="mt-1 hidden h-6 items-center gap-2 overflow-hidden text-xs font-bold [@media(hover:hover)]:flex">
        {hovered ? (
          <span key={hover} className="flex animate-fade items-center gap-2 rounded-none bg-black/70 px-2 py-0.5 text-white">
            <span className="tabular-nums opacity-60">
              ({+hover!.split(',')[0] + 1},{+hover!.split(',')[1] + 1})
            </span>
            {describeCell(hovered)}
          </span>
        ) : (
          <span className="opacity-50">🔍 マスにマウスを乗せると説明が出ます</span>
        )}
      </p>
    )}
    </div>
  )
}
