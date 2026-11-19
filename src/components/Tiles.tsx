import { PIECE_NAMES, STRENGTH } from '../game/engine'
import type { Card, CardKind, Cell, Piece, PieceKind } from '../game/types'
import cardBattle from '../assets/game/card-battle.jpg'
import cardCross from '../assets/game/card-cross.jpg'
import cardFarm from '../assets/game/card-farm.jpg'
import cardFlood from '../assets/game/card-flood.jpg'
import cardInn from '../assets/game/card-inn.jpg'
import cardL from '../assets/game/card-L.jpg'
import cardStraight from '../assets/game/card-straight.jpg'
import cardT from '../assets/game/card-T.jpg'
import cardTemple from '../assets/game/card-temple.jpg'
import pieceFarmer from '../assets/game/piece-farmer.png'
import pieceMerchant from '../assets/game/piece-merchant.png'
import pieceMonk from '../assets/game/piece-monk.png'
import pieceSamurai from '../assets/game/piece-samurai.png'
import tileFort from '../assets/game/tile-fort.jpg'
import tileGoal from '../assets/game/tile-goal.jpg'
import tileRiver from '../assets/game/tile-river.jpg'
import tileStart from '../assets/game/tile-start.jpg'

/** 素材写真から切り出したカードの絵 */
const CARD_IMAGE: Record<CardKind, string> = {
  straight: cardStraight,
  L: cardL,
  T: cardT,
  cross: cardCross,
  farm: cardFarm,
  inn: cardInn,
  temple: cardTemple,
  battle: cardBattle,
  flood: cardFlood,
}

/**
 * 絵の向きが、ルール上の基準の向き(直線=南北, L=北東, T=東南西)から時計回りに何回まわっているか。
 * 写真の直線カードは東西、L字カードは北西に開いている。
 */
const IMAGE_ROT: Partial<Record<CardKind, number>> = { straight: 1, L: 3 }

const PIECE_IMAGE: Record<PieceKind, string> = {
  farmer: pieceFarmer,
  merchant: pieceMerchant,
  samurai: pieceSamurai,
  monk: pieceMonk,
}

export const PIECE_COLOR: Record<PieceKind, string> = {
  farmer: '#9c8148',
  merchant: '#4f6b80',
  samurai: '#8f4a3a',
  monk: '#6c6478',
}

export function CardImage({ card, rot = 0, className = '' }: { card: Card; rot?: number; className?: string }) {
  // 4で割らずに回すと、3→4(=0)のときも時計回りに動く
  const turn = rot - (IMAGE_ROT[card.kind] ?? 0)
  return (
    <img
      src={CARD_IMAGE[card.kind]}
      alt={card.kind}
      draggable={false}
      className={`block aspect-square select-none object-cover transition-transform duration-300 ease-out ${className}`}
      style={{ transform: `rotate(${turn * 90}deg)` }}
    />
  )
}

export function PieceImage({ piece, className = '', showStrength = true }: { piece: Piece; className?: string; showStrength?: boolean }) {
  return (
    <span className={`relative inline-block aspect-square ${className}`} title={`${PIECE_NAMES[piece.kind]}（強さ${STRENGTH[piece.kind]}）`}>
      <img
        src={PIECE_IMAGE[piece.kind]}
        alt={PIECE_NAMES[piece.kind]}
        draggable={false}
        className="block h-full w-full select-none rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.45)] ring-2"
        style={{ ['--tw-ring-color' as string]: PIECE_COLOR[piece.kind] }}
      />
      {showStrength && (
        <span
          className="absolute -right-1 -bottom-1 flex h-[42%] min-h-3.5 w-[42%] min-w-3.5 items-center justify-center rounded-full border border-white text-[clamp(8px,2.4vw,12px)] leading-none font-black text-white"
          style={{ background: PIECE_COLOR[piece.kind] }}
        >
          {STRENGTH[piece.kind]}
        </span>
      )}
    </span>
  )
}

/** 村のマスの地形（カードが置かれていないとき） */
export function TerrainTile({ cell }: { cell: Cell }) {
  const img = (src: string, alt: string) => (
    <img src={src} alt={alt} draggable={false} className="block h-full w-full select-none object-cover" />
  )
  if (cell.flooded) return img(cardFlood, '氾濫')
  switch (cell.terrain) {
    case 'goal':
      return img(tileGoal, 'GOAL')
    case 'start':
      return img(tileStart, '館')
    case 'fort':
      return img(tileFort, '砦')
    case 'river':
      return img(tileRiver, '川')
    default:
      return <span className="block h-full w-full bg-[#e7e3d6]" />
  }
}
