import { useState, type ReactNode } from 'react'
import { floodCells, isConnected, pieceCells, placeableCells } from '../game/board'
import { CARD_COUNTS, CARD_NAMES, PIECE_COUNTS, PIECE_NAMES, STRENGTH } from '../game/engine'
import { SCORE_LABELS, scoreVillage, type ScoreBreakdown } from '../game/scoring'
import type { CardKind, Piece, PieceKind } from '../game/types'
import { CardImage, PieceImage } from '../components/Tiles'
import { VillageBoard } from '../components/VillageBoard'
import { C, Die, FULL_ROAD, HandRow, MiniCastle, Note, P, PlaceDemo, ROAD_PATH, k, makeVillage, useTicker } from './kit'

export const CHAPTERS = ['目的', '村と道具', '準備', '手番', '置き方', 'イベント', '終わりと得点'] as const

export interface StageProps {
  done: boolean
  onDone: () => void
}

export interface Step {
  chapter: number
  title: string
  /** ルールガイド版の本文。**語** で強調 */
  body: string[]
  /** まろいぬ版のセリフ（1要素＝1ふきだし） */
  maro: string[]
  /** やってみること。あると、終わるまで「次へ」が控えめになる */
  task?: string
  /** やり終えたときのまろいぬのひとこと */
  praise?: string
  Stage: (p: StageProps) => ReactNode
}

// ---------------------------------------------------------------- 各ステップの舞台

export function GoalStage() {
  const i = useTicker(160, ROAD_PATH.length + 6)
  const v = makeVillage(FULL_ROAD)
  return (
    <VillageBoard
      village={v}
      glow={new Set(ROAD_PATH.slice(0, i))}
      labels={{ '0,0': '城', '7,3': '館' }}
      spotlight={new Set(ROAD_PATH)}
    />
  )
}

const PLACES = [
  { id: 'goal', name: '城（GOAL）', cells: ['0,0'], text: 'お殿様の城。ここまで道をつなげるのが目標。カードは置けない' },
  { id: 'start', name: '館（スタート）', cells: ['7,3'], text: '自分の館。上下左右どの向きの道ともつながる' },
  { id: 'fort', name: '砦', cells: ['3,3'], text: '左右（東西）にだけ道が通る。道が砦を通ると得点が増える' },
  { id: 'river', name: '川', cells: ['2,0', '2,1', '2,2', '3,2', '4,2', '5,2', '5,3'], text: '直線カードだけを置ける（橋になる）' },
]

export function MapStage({ onDone }: StageProps) {
  const [found, setFound] = useState<string[]>([])
  const [last, setLast] = useState<(typeof PLACES)[number] | null>(null)
  const v = makeVillage()
  const targets = new Set(PLACES.flatMap((p) => p.cells))
  const labels: Record<string, string> = {}
  for (const p of PLACES) if (found.includes(p.id)) labels[p.cells[0]] = p.name.replace(/（.*/, '')
  return (
    <div className="flex flex-col gap-2">
      <VillageBoard
        village={v}
        targets={targets}
        targetTone="pick"
        labels={labels}
        selected={last ? new Set(last.cells) : undefined}
        onCell={(x, y) => {
          const p = PLACES.find((q) => q.cells.includes(k(x, y)))!
          setLast(p)
          const next = found.includes(p.id) ? found : [...found, p.id]
          setFound(next)
          if (next.length === PLACES.length) onDone()
        }}
      />
      <div className="flex flex-wrap gap-1.5">
        {PLACES.map((p) => (
          <span
            key={p.id}
            className={`rounded-none px-2 py-1 text-xs font-black transition-colors ${found.includes(p.id) ? 'bg-emerald-500 text-white' : 'bg-white/15 text-white/70'}`}
          >
            {found.includes(p.id) ? '✓ ' : ''}
            {p.name}
          </span>
        ))}
      </div>
      {last && (
        <Note key={last.id}>
          <b className="text-amber-200">{last.name}</b>：{last.text}
        </Note>
      )}
    </div>
  )
}

const CARD_INFO: Record<CardKind, string> = {
  straight: '2方向の道。川の上にも置ける、ただひとつのカード',
  L: '曲がり角の道',
  T: '3方向に分かれる道',
  cross: '4方向の道。商人をのせると1点',
  farm: '道のない畑。農民をのせると1点、4枚つながると3点',
  inn: '十字の道としてつながる宿場町。商人をのせると2点',
  temple: '寺院。村のふちにしか置けない。僧をのせると3点',
  battle: '補充で出たら合戦が起きる',
  flood: '補充で出たら、前の人の村の川沿いが氾濫する',
}
const CARD_GROUPS: { name: string; kinds: CardKind[]; tone: string }[] = [
  { name: '道カード', kinds: ['straight', 'L', 'T', 'cross'], tone: 'text-amber-200' },
  { name: '場所カード', kinds: ['farm', 'inn'], tone: 'text-emerald-200' },
  { name: 'イベントカード', kinds: ['battle', 'flood'], tone: 'text-rose-200' },
]

function CardsStage() {
  const [sel, setSel] = useState<CardKind>('straight')
  return (
    <div className="flex flex-col gap-2">
      {CARD_GROUPS.map((g) => (
        <div key={g.name}>
          <p className={`mb-1 text-xs font-black ${g.tone}`}>{g.name}</p>
          <div className="grid grid-cols-4 gap-1.5">
            {g.kinds.map((kind, i) => (
              <button
                key={kind}
                type="button"
                onClick={() => setSel(kind)}
                className={`animate-deal rounded-none p-1 text-white transition-all duration-200 ${sel === kind ? '-translate-y-1 bg-amber-300/30 ring-2 ring-amber-300' : 'bg-black/20 hover:bg-black/30'}`}
                style={{ animationDelay: `${i * 70}ms` }}
              >
                <CardImage card={{ id: 0, kind }} className="w-full rounded-none" />
                <span className="mt-0.5 block text-[11px] leading-none font-bold">
                  {CARD_NAMES[kind]}
                  <span className="ml-0.5 opacity-60">×{CARD_COUNTS[kind]}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
      <Note key={sel}>
        <b className="text-amber-200">{CARD_NAMES[sel]}</b>：{CARD_INFO[sel]}
      </Note>
    </div>
  )
}

const PIECE_INFO: Record<PieceKind, string> = {
  farmer: '農地の上にいると1点',
  merchant: '十字の道で1点、宿場で2点',
  samurai: '砦のまわり8マスにいると1点',
  monk: '寺の上にいると3点',
}

export const makePiecesStage = (kinds: PieceKind[], counts: Partial<Record<PieceKind, number>> = PIECE_COUNTS) =>
  function PiecesStage() {
  const [sel, setSel] = useState<PieceKind>('samurai')
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${kinds.length}, minmax(0, 1fr))` }}>
        {kinds.map((kind, i) => (
          <button
            key={kind}
            type="button"
            onClick={() => setSel(kind)}
            className={`flex animate-pop flex-col items-center gap-1 rounded-none p-2 text-white transition-all duration-200 ${sel === kind ? '-translate-y-1 bg-amber-300/25 ring-2 ring-amber-300' : 'bg-black/20'}`}
            style={{ animationDelay: `${i * 120}ms` }}
          >
            <PieceImage piece={{ id: 0, kind }} className="w-full max-w-16" />
            <span className="text-sm font-black">{PIECE_NAMES[kind]}</span>
            <span className="text-[11px] opacity-75">×{counts[kind]}</span>
          </button>
        ))}
      </div>
      <div className="rounded-none bg-black/20 p-2.5 text-white">
        <p className="mb-1.5 text-xs font-black text-amber-200">合戦での強さ</p>
        {kinds.map((kind) => (
          <div key={kind} className="mb-1 flex items-center gap-2 text-xs font-bold">
            <span className="w-8">{PIECE_NAMES[kind]}</span>
            <span className="h-3 rounded-none bg-amber-300 transition-all duration-500" style={{ width: `${STRENGTH[kind] * 18}%`, opacity: sel === kind ? 1 : 0.45 }} />
            <span>{STRENGTH[kind]}</span>
          </div>
        ))}
      </div>
      <Note key={sel}>
        <b className="text-amber-200">{PIECE_NAMES[sel]}</b>（強さ{STRENGTH[sel]}）：{PIECE_INFO[sel]}
      </Note>
    </div>
  )
}
const PiecesStage = makePiecesStage(['farmer', 'merchant', 'samurai'])

export const SETUP_SLOTS = () => [
  { card: C('straight'), piece: P('farmer') },
  { card: C('farm'), piece: P('samurai') },
  { card: C('T'), piece: P('merchant') },
  { card: C('cross'), piece: P('farmer') },
]

export function SetupStage() {
  const [deal, setDeal] = useState(0)
  const [slots] = useState(SETUP_SLOTS)
  return (
    <div className="flex flex-col gap-2">
      <MiniCastle slots={slots} dealKey={deal} caption="カード＋コマの4組" />
      <div className="grid grid-cols-2 gap-2 text-[12px] font-bold text-white">
        <div className="rounded-none bg-black/20 p-2">
          <p className="mb-1 text-amber-200">① 山札から4枚</p>
          城の上に並べる
        </div>
        <div className="rounded-none bg-black/20 p-2">
          <p className="mb-1 text-amber-200">② コマ袋から4つ</p>
          1枚に1つずつのせて「組」にする
        </div>
      </div>
      <Note tone="info">イベントカードが混じっていたり、道カードが1枚も無いときは、4枚とも配りなおし</Note>
      <button type="button" onClick={() => setDeal((d) => d + 1)} className="self-start rounded-none bg-white/15 px-3 py-1.5 text-xs font-bold text-white">
        ↻ もう一度配る
      </button>
    </div>
  )
}

export function TakeStage({ onDone }: StageProps) {
  const [slots] = useState(SETUP_SLOTS)
  const [picked, setPicked] = useState<number | null>(null)
  const shown = slots.map((s, i) => (i === picked ? { card: null, piece: null } : s))
  return (
    <div className="flex flex-col gap-2">
      <MiniCastle
        slots={shown}
        active={picked === null}
        onPick={(i) => {
          if (picked !== null) return
          setPicked(i)
          onDone()
        }}
        caption={picked === null ? '好きな組を押してみよう' : undefined}
      />
      {picked !== null && (
        <div className="animate-rise">
          <HandRow>
            <span className="w-16">
              <CardImage card={slots[picked].card!} className="w-full rounded-none" />
            </span>
            <PieceImage piece={slots[picked].piece!} className="w-11" />
            <span className="text-xs font-bold">この組を自分の村に置く</span>
          </HandRow>
        </div>
      )}
    </div>
  )
}

export function PlaceCardStage({ onDone }: StageProps) {
  return (
    <PlaceDemo
      initial={makeVillage()}
      hand={[{ card: C('straight'), rot: 1 }]}
      labels={{ '7,3': '館' }}
      onPlaced={() => {
        onDone()
        return { msg: '置けました！ 館とつながっています' }
      }}
    />
  )
}

export function PlacePieceStage({ onDone }: StageProps) {
  const [v, setV] = useState(() => makeVillage([[6, 3, 'straight', 1]]))
  const [piece, setPiece] = useState<Piece | null>(() => P('farmer'))
  const [refilled, setRefilled] = useState(false)
  const [base] = useState(() => ({
    refill: { card: C('L'), piece: P('samurai') },
    rest: [
      { card: C('farm'), piece: P('samurai') },
      { card: C('T'), piece: P('merchant') },
      { card: C('cross'), piece: P('farmer') },
    ],
  }))
  const castle = [refilled ? base.refill : { card: null, piece: null }, ...base.rest]
  return (
    <div className="flex flex-col gap-2">
      <VillageBoard
        village={v}
        targets={piece ? new Set(pieceCells(v).map(([x, y]) => k(x, y))) : undefined}
        pieceGhost={piece}
        freshPieces={piece ? undefined : new Set(['6,3'])}
        onCell={(x, y) => {
          const next = structuredClone(v)
          next.cells[y][x].placed!.piece = piece
          setV(next)
          setPiece(null)
          setTimeout(() => setRefilled(true), 500)
          onDone()
        }}
      />
      {piece && (
        <HandRow>
          <PieceImage piece={piece} className="w-12" />
          <span className="text-xs font-bold">農民コマ。光っているカードの上に置こう</span>
        </HandRow>
      )}
      <MiniCastle slots={castle} caption={refilled ? '空いた場所を補充！' : '取った場所が空いている'} />
    </div>
  )
}

export function WhereStage() {
  const [mode, setMode] = useState<'start' | 'fort'>('start')
  const v = mode === 'start' ? makeVillage([[6, 3, 'straight', 1], [7, 2, 'farm']]) : makeVillage([[6, 3, 'straight', 1], [4, 3, 'straight', 1]])
  const cells = mode === 'start' ? placeableCells(v, C('farm')).map(([x, y]) => k(x, y)) : ['2,3']
  const anchors = mode === 'start' ? ['7,3', '6,3', '7,2'] : ['3,3', '4,3']
  const labels: Record<string, string> = mode === 'start' ? { '7,3': '館', '6,3': 'カード', '7,2': 'カード' } : { '3,3': '砦', '4,3': 'カード' }
  for (const c of cells) labels[c] = labels[c] ?? 'OK'
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1">
        {(
          [
            ['start', '館とカードのまわり'],
            ['fort', '砦のまわり'],
          ] as const
        ).map(([id, name]) => (
          <button
            key={id}
            type="button"
            onClick={() => setMode(id)}
            className={`rounded-none px-3 py-1.5 text-xs font-black ${mode === id ? 'bg-amber-300 text-stone-900' : 'bg-white/15 text-white'}`}
          >
            {name}
          </button>
        ))}
      </div>
      <VillageBoard key={mode} village={v} spotlight={new Set([...cells, ...anchors])} labels={labels} glow={new Set(cells)} />
      <Note>
        {mode === 'start'
          ? '「OK」のマスが置ける場所。館と、置いたカードの上下左右の隣です'
          : '砦は、隣にカードがあるときだけ起点になり、その反対側の隣にも置けるようになります'}
      </Note>
    </div>
  )
}

export function ConnectStage({ onDone }: StageProps) {
  return (
    <PlaceDemo
      initial={makeVillage([[7, 2, 'straight', 0]])}
      hand={[{ card: C('L'), rot: 3 }]}
      labels={{ '7,3': '館' }}
      onPlaced={() => {
        onDone()
        return { msg: '道がつながる向きで置けました！' }
      }}
      footer={
        <div className="grid grid-cols-2 gap-2 text-[12px] font-bold text-white">
          <p className="rounded-none bg-emerald-600/80 p-2">◯ 隣の道と1か所でもつながればOK。ほかの辺は行き止まりでもいい</p>
          <p className="rounded-none bg-rose-700/80 p-2">✕ どこともつながらない向きでは置けない（⟳のマス）</p>
        </div>
      }
    />
  )
}

export function RiverStage({ onDone }: StageProps) {
  return (
    <PlaceDemo
      initial={makeVillage([[6, 3, 'straight', 1]])}
      hand={[{ card: C('T'), rot: 0 }, { card: C('straight'), rot: 1 }]}
      only={['5,3']}
      labels={{ '5,3': '川', '7,3': '館' }}
      onPlaced={(_v, card) => {
        if (card.kind === 'straight') onDone()
        return { msg: '直線カードは橋になって、川を渡れます！' }
      }}
    />
  )
}

export function KeepStage({ onDone }: StageProps) {
  const [kept, setKept] = useState<{ card: boolean; piece: boolean }>({ card: false, piece: false })
  const [card] = useState(() => C('cross'))
  const [piece] = useState(() => P('merchant'))
  const slot = 'flex aspect-square items-center justify-center rounded-none border-2 border-dashed border-[#9b9584] text-[10px] text-[#9b9584]'
  const keep = (part: 'card' | 'piece') => {
    const next = { ...kept, [part]: true }
    setKept(next)
    if (next.card && next.piece) onDone()
  }
  return (
    <div className="flex flex-col gap-2">
      <HandRow>
        {!kept.card ? (
          <button type="button" onClick={() => keep('card')} className="flex w-16 flex-col items-center gap-0.5 bg-paper-0 p-1 outline outline-1 outline-ink-1 transition hover:-translate-y-1">
            <CardImage card={card} className="w-full rounded-none" />
            <span className="text-[10px] font-bold">押してキープ</span>
          </button>
        ) : (
          <span className="w-16 text-center text-[10px] opacity-60">（キープ済み）</span>
        )}
        {!kept.piece ? (
          <button type="button" onClick={() => keep('piece')} className="flex w-16 flex-col items-center gap-0.5 bg-paper-0 p-1 outline outline-1 outline-ink-1 transition hover:-translate-y-1">
            <PieceImage piece={piece} className="w-11" />
            <span className="text-[10px] font-bold">押してキープ</span>
          </button>
        ) : (
          <span className="w-16 text-center text-[10px] opacity-60">（キープ済み）</span>
        )}
      </HandRow>
      <div className="rounded-none border-2 border-[#7a766a] bg-[#e2ded1] p-2.5 text-[#2b2a26]">
        <p className="mb-1.5 flex items-center gap-2 text-sm"><span className="dia text-[8px]" /><span className="ttl">キープ</span> <span className="text-[11px]">カード2枚・コマ2個まで</span></p>
        <div className="grid grid-cols-[1fr_1fr_auto_0.7fr_0.7fr] items-center gap-2">
          <span className={slot}>{kept.card ? <span className="w-full animate-drop"><CardImage card={card} className="w-full rounded-none" /></span> : 'カード'}</span>
          <span className={slot}>カード</span>
          <span className="h-full border-l border-dashed border-[#9b9584]" />
          <span className={`${slot} rounded-full`}>{kept.piece ? <span className="w-full animate-pop p-0.5"><PieceImage piece={piece} className="w-full" /></span> : 'コマ'}</span>
          <span className={`${slot} rounded-full`}>コマ</span>
        </div>
      </div>
      <Note>キープしたものは、自分の番ならいつでも村に出せます</Note>
    </div>
  )
}

export function EventStage() {
  const i = useTicker(900, 3)
  const kinds: CardKind[] = ['battle', 'battle', 'farm', 'farm']
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-center gap-3 py-2">
        <div className="relative w-28">
          <span key={i} className="block animate-deal">
            <CardImage card={{ id: i, kind: i < 2 ? 'battle' : 'flood' }} className={`w-full rounded-none shadow-xl ${i % 2 ? 'opacity-40 grayscale' : ''}`} />
          </span>
          {i % 2 === 1 && <span className="absolute inset-0 flex animate-pop items-center justify-center text-sm font-black text-white drop-shadow">処理したら捨てる</span>}
        </div>
        <span className="text-2xl text-white">→</span>
        <div className="w-28">
          <span key={`p${i}`} className="block animate-deal" style={{ animationDelay: '250ms' }}>
            <CardImage card={{ id: 9, kind: kinds[i] === 'battle' ? 'T' : 'farm' }} className="w-full rounded-none shadow-xl" />
          </span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1.5 text-center text-[11px] font-bold text-white">
        {['補充で イベントが出る', 'すぐに 処理する', '場所カードが出るまで 引き直す'].map((t, n) => (
          <span key={t} className={`rounded-none p-2 transition-colors duration-300 ${n === Math.min(i, 2) ? 'bg-amber-300 text-stone-900' : 'bg-black/20'}`}>
            {t}
          </span>
        ))}
      </div>
    </div>
  )
}

type Fighter = { name: string; color: string; pieces: PieceKind[]; dice: number[][] }

interface BattleSetup {
  mine: PieceKind[]
  /** 出す人数の下限・上限（短縮版は必ず3人、通常版は1〜3人） */
  min: number
  max: number
  rivals: Fighter[]
}

export const makeBattleStage = ({ mine, min, max, rivals }: BattleSetup) =>
  function BattleStage({ onDone, done }: StageProps) {
  const [pick, setPick] = useState<number[]>([])
  const [phase, setPhase] = useState<'pick' | 'rolling' | 'result'>('pick')
  const strength = (ks: PieceKind[]) => ks.reduce((s, x) => s + STRENGTH[x], 0)
  const myPieces = pick.map((i) => mine[i])
  const me: Fighter = { name: 'あなた', color: '#8f4a3a', pieces: myPieces, dice: [[3, 4], [6, 2]] }
  const total = (f: Fighter, round = 0) => strength(f.pieces) + f.dice[round][0] + f.dice[round][1]
  const all = [me, ...rivals]
  const best = Math.max(...all.map((f) => total(f)))
  const tied = all.filter((f) => total(f) === best)
  const winner = tied.length > 1 ? tied.reduce((a, b) => (total(a, 1) >= total(b, 1) ? a : b)) : tied[0]

  const roll = () => {
    setPhase('rolling')
    setTimeout(() => {
      setPhase('result')
      onDone()
    }, 900)
  }
  return (
    <div className="flex flex-col gap-2 text-white">
      <div className="rounded-none bg-black/20 p-2">
        <p className="mb-1.5 text-xs font-black text-amber-200">あなたの人物コマ（{min === max ? `${max}人選ぶ` : `${min}〜${max}人選ぶ`}）</p>
        <div className="flex items-center gap-2">
          {mine.map((kind, i) => (
            <button
              key={i}
              type="button"
              disabled={phase !== 'pick'}
              onClick={() => setPick((p) => (p.includes(i) ? p.filter((q) => q !== i) : p.length < max ? [...p, i] : p))}
              className={`rounded-full p-0.5 transition-all duration-200 ${pick.includes(i) ? '-translate-y-1 ring-3 ring-amber-300' : 'opacity-70'}`}
            >
              <PieceImage piece={{ id: i, kind }} className="w-11" />
            </button>
          ))}
          <span className="ml-auto text-right text-xs font-bold">
            強さ
            <span className="block text-2xl leading-none font-black tabular-nums">{strength(myPieces)}</span>
          </span>
        </div>
      </div>
      {phase === 'pick' ? (
        <button
          type="button"
          disabled={pick.length < min || pick.length > max}
          onClick={roll}
          className="rounded-none bg-rose-700 py-2.5 font-black shadow transition active:scale-95 disabled:opacity-40"
        >
          {pick.length >= min ? '出陣してサイコロを振る' : `あと${min - pick.length}人選ぶ`}
        </button>
      ) : (
        <div className="flex flex-col gap-1.5">
          {all.map((f) => (
            <div
              key={f.name}
              className={`flex items-center gap-2 rounded-none p-1.5 transition-colors duration-300 ${phase === 'result' && f === winner ? 'bg-amber-300/30 ring-2 ring-amber-300' : 'bg-black/20'}`}
            >
              <span className="h-2.5 w-2.5 rotate-45" style={{ background: f.color }} />
              <span className="w-14 text-xs font-black">{f.name}</span>
              <span className="text-xs">強さ{strength(f.pieces)}＋</span>
              <Die n={phase === 'rolling' ? 1 + ((f.name.length * 3) % 6) : f.dice[0][0]} rolling={phase === 'rolling'} />
              <Die n={phase === 'rolling' ? 1 + ((f.name.length * 5) % 6) : f.dice[0][1]} rolling={phase === 'rolling'} />
              {phase === 'result' && <span className="ml-auto animate-pop text-lg font-black tabular-nums">{total(f)}</span>}
            </div>
          ))}
          {phase === 'result' && tied.length > 1 && (
            <Note tone="info">
              同点！ {tied.map((f) => f.name).join('と')}だけがサイコロを振りなおし → {tied.map((f) => `${f.name} ${total(f, 1)}`).join('・')}
            </Note>
          )}
          {phase === 'result' && <Note tone="good">功労者は{winner.name}</Note>}
          {done && (
            <button
              type="button"
              onClick={() => {
                setPick([])
                setPhase('pick')
              }}
              className="self-start rounded-none bg-white/15 px-3 py-1.5 text-xs font-bold"
            >
              ↻ ちがうコマで試す
            </button>
          )}
        </div>
      )}
    </div>
  )
}

const BattleStage = makeBattleStage({
  mine: ['samurai', 'farmer', 'farmer', 'merchant'],
  min: 3,
  max: 3,
  rivals: [
    { name: 'Bさん', color: '#4f6b80', pieces: ['samurai', 'farmer', 'merchant'], dice: [[2, 3], [1, 4]] },
    { name: 'Cさん', color: '#5f6f4c', pieces: ['farmer', 'farmer', 'merchant'], dice: [[4, 2]] },
  ],
})

export function AfterBattleStage({ onDone }: StageProps) {
  const [v, setV] = useState(() =>
    makeVillage([
      [6, 3, 'straight', 1, 'farmer'],
      [7, 2, 'farm'],
      [6, 2, 'farm', 0, 'farmer'],
      [7, 1, 'T', 3],
    ]),
  )
  const [gone, setGone] = useState<string | null>(null)
  const targets = gone ? new Set<string>() : new Set(['7,2', '7,1'])
  return (
    <div className="flex flex-col gap-2 text-white">
      <div className="grid grid-cols-2 gap-2 text-[12px] font-bold">
        <p className="rounded-none bg-amber-300/25 p-2 ring-1 ring-amber-300">功労者：城の上から好きなカード1枚とコマ1つをもらえる</p>
        <p className="rounded-none bg-rose-700/70 p-2">それ以外の人：村のカードを1枚捨てる</p>
      </div>
      <p className="text-xs font-bold text-white/80">負けた人の村 — コマがのっていないカードだけ捨てられる</p>
      <VillageBoard
        village={v}
        targets={targets}
        targetTone="danger"
        labels={{ '7,3': '館' }}
        onCell={(x, y) => {
          const next = structuredClone(v)
          next.cells[y][x].placed = null
          setV(next)
          setGone(k(x, y))
          onDone()
        }}
      />
      {gone && <Note tone="bad">{gone === '7,2' ? '農地を捨てました。' : 'T字を捨てました。'}捨てて道が切れたら、直すまで城にはつながりません</Note>}
    </div>
  )
}

export function FloodStage({ onDone }: StageProps) {
  const [v, setV] = useState(() => makeVillage([[6, 3, 'straight', 1], [7, 2, 'farm']]))
  const [done, setDone] = useState(false)
  const cells = done ? [] : floodCells(v).map(([x, y]) => k(x, y))
  return (
    <div className="flex flex-col gap-2 text-white">
      <div className="flex items-center gap-2">
        <span className="w-14 shrink-0 animate-deal">
          <CardImage card={{ id: 0, kind: 'flood' }} className="w-full rounded-none shadow-lg" />
        </span>
        <p className="text-xs font-bold">あなたが氾濫カードを引いた！ 1つ前の手番の人（Dさん）の村の、川沿いの空きマスを選ぶ</p>
      </div>
      <VillageBoard
        village={v}
        targets={new Set(cells)}
        targetTone="danger"
        accent="#a07f3f"
        labels={{ '7,3': 'Dさんの館' }}
        freshCards={undefined}
        onCell={(x, y) => {
          const next = structuredClone(v)
          next.cells[y][x].flooded = true
          setV(next)
          setDone(true)
          onDone()
        }}
      />
      {done && <Note tone="bad">そのマスは川と同じになり、直線カードしか置けなくなりました</Note>}
    </div>
  )
}

function RoadGlow() {
  const i = useTicker(110, ROAD_PATH.length, false)
  return <VillageBoard village={makeVillage(FULL_ROAD)} glow={new Set(ROAD_PATH.slice(0, i))} spotlight={new Set(ROAD_PATH)} labels={{ '0,0': '城', '7,3': '館' }} />
}

export function EndStage({ onDone }: StageProps) {
  const [complete, setComplete] = useState(false)
  return (
    <div className="relative">
      <PlaceDemo
        initial={makeVillage(FULL_ROAD.filter(([x, y]) => !(x === 0 && y === 1)))}
        hand={[{ card: C('straight'), rot: 0 }]}
        only={['0,1']}
        labels={{ '0,0': '城' }}
        onPlaced={(v) => {
          if (isConnected(v)) {
            setComplete(true)
            onDone()
          }
          return { msg: '館から城まで道がつながった！ この瞬間にゲーム終了です', tone: 'good' }
        }}
      />
      {complete && (
        <div className="pointer-events-none absolute inset-x-0 top-0 animate-fade">
          <RoadGlow />
        </div>
      )}
    </div>
  )
}

const SCORE_VILLAGE: Parameters<typeof makeVillage>[0] = [
  ...FULL_ROAD.map(([x, y, kind, rot]) => [x, y, kind, rot] as [number, number, CardKind, number]),
  [6, 1, 'farm', 0, 'farmer'],
  [7, 1, 'farm', 0, 'farmer'],
  [6, 0, 'farm'],
  [7, 0, 'farm'],
  [7, 2, 'cross', 0, 'merchant'],
  [6, 2, 'inn', 0, 'merchant'],
]

function ScoreStage() {
  const [v] = useState(() => {
    const vv = makeVillage(SCORE_VILLAGE)
    vv.cells[3][4].placed!.piece = P('samurai')
    vv.cells[3][2].placed!.piece = P('samurai')
    return vv
  })
  const s = scoreVillage(v)
  const rows = Object.keys(SCORE_LABELS) as (keyof typeof SCORE_LABELS)[]
  const [sel, setSel] = useState<keyof typeof SCORE_LABELS>('road')
  const cellsFor: Record<keyof typeof SCORE_LABELS, string[]> = {
    road: ROAD_PATH,
    fortBonus: ['3,3', '2,3', '4,3'],
    farmers: ['6,1', '7,1'],
    farmGroups: ['6,0', '7,0', '6,1', '7,1'],
    crossMerchants: ['7,2'],
    innMerchants: ['6,2'],
    samurai: ['2,3', '4,3', '3,3'],
  }
  const visible = rows.filter((r) => (s as ScoreBreakdown)[r] > 0)
  return (
    <div className="flex flex-col gap-2 text-white">
      <VillageBoard village={v} spotlight={new Set(cellsFor[sel])} glow={new Set(cellsFor[sel])} />
      <div className="grid gap-1 lg:grid-cols-2">
        {visible.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setSel(r)}
            className={`flex items-center justify-between rounded-none px-2.5 py-1.5 text-left text-[12px] font-bold transition-colors duration-200 ${sel === r ? 'bg-amber-300 text-stone-900' : 'bg-black/20 hover:bg-black/30'}`}
          >
            <span>{SCORE_LABELS[r]}</span>
            <span className="text-base font-black tabular-nums">{(s as ScoreBreakdown)[r]}点</span>
          </button>
        ))}
        <p className="flex items-center justify-between border-t border-white/30 px-2.5 pt-1.5 text-sm font-black lg:col-span-2">
          <span>合計</span>
          <span className="text-xl tabular-nums">{s.total}点</span>
        </p>
      </div>
    </div>
  )
}

export function SummaryStage() {
  const flow = [
    { n: '1', t: '組を取る', d: '城の上の4組から1組' },
    { n: '2', t: '村に置く', d: 'カードは道がつながる向きで。コマはカードの上に。置けなければキープ' },
    { n: '3', t: '補充する', d: 'イベントが出たら合戦・氾濫を処理' },
  ]
  return (
    <div className="flex flex-col gap-2 text-white">
      {flow.map((f, i) => (
        <div key={f.n} className="flex animate-rise items-start gap-3 rounded-none bg-black/20 p-2.5" style={{ animationDelay: `${i * 120}ms` }}>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-none bg-amber-300 text-lg font-black text-stone-900">{f.n}</span>
          <span>
            <b className="block text-sm">{f.t}</b>
            <span className="text-[12px] opacity-85">{f.d}</span>
          </span>
        </div>
      ))}
      <div className="animate-rise rounded-none bg-amber-300/20 p-2.5 text-[12px] font-bold ring-1 ring-amber-300" style={{ animationDelay: '400ms' }}>
        だれかが館から城まで道をつないだら終了。得点のいちばん高い人の勝ち
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- ステップ

export const STEPS: Step[] = [
  {
    chapter: 0,
    title: '館から城まで、街道をつなごう',
    body: [
      'あなたは村の主。自分の村で、**館**からお殿様の**城（GOAL）**まで、道カードで街道をつなぎます。',
      'だれかが城までつないだらゲーム終了。そのとき**得点がいちばん高い人**の勝ちです。',
    ],
    maro: ['よくぞ参った！ 我はまろいぬ。この国のお殿様まろ。', 'そなたの**館**から我の**城**まで、**街道をつなげてほしい**まろ！', 'だれかが城までつないだらおしまい。**得点がいちばん高い者**が勝ちまろ。'],
    Stage: GoalStage,
  },
  {
    chapter: 1,
    title: '村のマスを見てみよう',
    body: ['村は**8×4マス**。はじめから4種類の特別なマスがあります。', '盤の上の**城・館・砦・川**を押して、それぞれの役割を確かめましょう。'],
    maro: ['これがそなたの村、**8×4マス**の土地まろ。', '**城・館・砦・川**、4つの特別な場所があるまろ。ぜんぶ押して確かめてみるまろ！'],
    task: '城・館・砦・川をぜんぶ押してみよう',
    praise: 'ぜんぶ見つけたまろ！ さすがまろ。',
    Stage: MapStage,
  },
  {
    chapter: 1,
    title: 'カードは3種類',
    body: [
      '**道カード**（直線・L字・T字・十字）で街道をのばします。',
      '**場所カード**（農地・宿場）は得点のもと。**イベントカード**（合戦・氾濫）は補充で出たときに起きる出来事です。',
      'カードを押すと説明が出ます。',
    ],
    maro: ['カードは**道**・**場所**・**イベント**の3種類まろ。', '道カードで街道をのばし、場所カードで得点をかせぐまろ。', 'イベントカードは……出てからのお楽しみまろ。押して中身を見てみるまろ！'],
    Stage: CardsStage,
  },
  {
    chapter: 1,
    title: '人物コマは3人',
    body: ['**農民・商人・武士**の3種類。それぞれ**得点になる場所**と、合戦での**強さ**がちがいます。', '武士がいちばん強く（4）、農民は2、商人は1です。'],
    maro: ['村に住んでくれる者たちまろ。**農民・商人・武士**がいるまろ。', 'いる場所で**得点**になるし、合戦では**強さ**が物を言うまろ。武士は強いまろ〜。'],
    Stage: PiecesStage,
  },
  {
    chapter: 2,
    title: '城の上に4組を並べる',
    body: ['山札から**4枚**を城の上に並べ、コマ袋から引いたコマを1つずつのせて**「組」**にします。', '最初にイベントカードが混じったり、道カードが1枚も無いときは配りなおします。'],
    maro: ['準備はかんたんまろ。城の上に**カードとコマの組を4つ**並べるまろ。', '最初の4枚にイベントがあったり、道カードが無かったら配りなおしまろ。'],
    Stage: SetupStage,
  },
  {
    chapter: 3,
    title: '① 組を1つ取る',
    body: ['自分の番では、城の上の4組から**1組**（カード1枚とコマ1つ）を取ります。', 'どの組を取るかが、作戦の分かれ道です。'],
    maro: ['そなたの番まろ！ 城の上から**好きな組を1つ**取るまろ。', 'どれにするか、よーく考えるまろ。'],
    task: '城の上の組を1つ押して取ろう',
    praise: 'よい目利きまろ！',
    Stage: TakeStage,
  },
  {
    chapter: 3,
    title: '② カードを自分の村に置く',
    body: ['取ったカードを自分の村に置きます。はじめは**館のとなり**から。', '光っているマスを押すと置けます。⟳ が付いたマスは、押すと道がつながる向きに回ります。'],
    maro: ['取ったカードを村に置くまろ。最初は**館のとなり**からまろ。', '光っているマスを押してみるまろ！'],
    task: '光っているマスを押してカードを置こう',
    praise: '見事な普請まろ！',
    Stage: PlaceCardStage,
  },
  {
    chapter: 3,
    title: '③ コマを置いて、補充する',
    body: ['コマは自分の村の**カードの上**に置きます（1枚に1つ）。', '最後に、取った場所へ山札とコマ袋から**補充**して、次の人の番です。'],
    maro: ['コマは**カードの上**に住まわせるまろ。', '置いたら城の上の空いた所に**補充**して、次の者の番まろ。'],
    task: 'コマを置いて、補充を見よう',
    praise: '村がにぎやかになってきたまろ！',
    Stage: PlacePieceStage,
  },
  {
    chapter: 4,
    title: '置ける場所',
    body: ['カードは**館**と**置いてあるカード**の上下左右のとなりに置けます。', '**砦**は、となりにカードがあるときだけ起点になります。上のボタンで切りかえて見てみましょう。'],
    maro: ['置ける場所にはきまりがあるまろ。**館**か**置いたカード**のとなりまろ。', '**砦**は、となりにカードが来てはじめて頼りになるまろ。切りかえて見てみるまろ。'],
    Stage: WhereStage,
  },
  {
    chapter: 4,
    title: '道はつながる向きで置く',
    body: ['カードは**回して**置けます。道カードは、となりの道と**少なくとも1か所つながる向き**でしか置けません。', 'つながらない向きのマスには ⟳ が付きます。カードを回してから置いてみましょう。'],
    maro: ['ここが大事まろ！ 道カードは、となりの道と**1か所はつながる向き**でしか置けないまろ。', '「⟳ 回す」で向きを変えて、つながるように置いてみるまろ。'],
    task: 'L字カードを、道がつながる向きで置こう',
    praise: 'ぴたりとつながったまろ！',
    Stage: ConnectStage,
  },
  {
    chapter: 4,
    title: '川には直線カードだけ',
    body: ['**川**には**直線カード**だけが置けます。橋のように川を渡れます。', 'T字を選んで川を押すとどうなるか、直線ではどうか、試してみましょう。'],
    maro: ['川には**直線カード**しか置けないまろ。橋になるまろ。', 'T字で川を押してみるまろ……そして直線でも試すまろ！'],
    task: '直線カードを川に置こう',
    praise: '立派な橋がかかったまろ！',
    Stage: RiverStage,
  },
  {
    chapter: 4,
    title: 'キープ',
    body: [
      'すぐ置かないカードやコマは**キープ**しておけます（**カード2枚・コマ2個**まで）。自分の番ならいつでも村に出せます。',
      '置ける場所が無いカードでも、キープに空きがあれば取れます。',
    ],
    maro: ['今は置かない、というときは**キープ**するまろ。**カード2枚・コマ2個**までまろ。', '自分の番なら、いつでも出せるまろ。手元のカードとコマをキープしてみるまろ！'],
    task: 'カードとコマをキープに入れよう',
    praise: '先を読むのは良いことまろ。',
    Stage: KeepStage,
  },
  {
    chapter: 5,
    title: 'イベントカードが出たら',
    body: ['補充のときに**イベントカード**が出たら、すぐに処理します。', '処理したら、**場所カードが出るまで**引き直して補充します。'],
    maro: ['補充で**イベントカード**が出たら、すぐに起こるまろ！', '終わったら、**場所カードが出るまで**引き直すまろ。'],
    Stage: EventStage,
  },
  {
    chapter: 5,
    title: '合戦',
    body: [
      'みんなが人物コマを**3人**出し（足りなければいるだけ全員）、**強さの合計＋サイコロ2個**で比べます。いちばん大きい人が**功労者**。',
      '同点なら、その人たちだけで振りなおし。出したコマは袋に戻ります。だれか1人でもコマが0人なら合戦は起きません。',
    ],
    maro: ['**合戦**まろ！ みなが人物コマを**3人**出して、**強さ＋サイコロ2個**で勝負まろ。', '同点なら、その者たちだけで振りなおしまろ。さあ、3人選んで出陣まろ！'],
    task: 'コマを3人選んでサイコロを振ろう',
    praise: '天晴れな戦いぶりまろ！',
    Stage: BattleStage,
  },
  {
    chapter: 5,
    title: '合戦のあと',
    body: [
      '**功労者**は城の上から好きなカード1枚とコマ1つをもらえます。',
      'それ以外の人は、村の**コマがのっていないカード**を1枚捨てます。道が切れたら、直すまで城にはつながりません。',
    ],
    maro: ['勝った**功労者**にはほうびをとらすまろ。城の上から好きなカードとコマを1つずつまろ。', '負けた者は、**コマがのっていないカード**を1枚捨てるまろ……。試しに1枚えらぶまろ。'],
    task: '負けた人として、カードを1枚捨てよう',
    praise: 'つらいが、また建て直せばよいまろ。',
    Stage: AfterBattleStage,
  },
  {
    chapter: 5,
    title: '氾濫',
    body: ['氾濫カードを引いた人は、**1つ前の手番の人**の村の、**川沿いの空きマス**に置きます。', 'そのマスは**川と同じ**になり、直線カードしか置けなくなります。空きマスが無ければ捨てます。'],
    maro: ['大雨まろ！ **氾濫カード**は、**1つ前の番の者**の村の**川沿い**に置くまろ。', '置かれたマスは川になるまろ。どこを水びたしにするまろ？'],
    task: '川沿いの空きマスを1つ選ぼう',
    praise: 'ふむ、なかなかの策士まろ。',
    Stage: FloodStage,
  },
  {
    chapter: 6,
    title: '城までつないだら終了',
    body: ['だれかが**館から城まで道をつないだ瞬間**にゲーム終了です。', '最後の1枚を置いて、街道を完成させましょう。'],
    maro: ['あと1枚で我が城に届くまろ！', '最後のカードを置いて、**街道を完成**させるまろ！'],
    task: '最後の1枚を置いて城までつなごう',
    praise: '見事！ 街道が通じたまろ〜！',
    Stage: EndStage,
  },
  {
    chapter: 6,
    title: '得点を数える',
    body: [
      '道がつながると**5点**、その道が**砦を通る**と**さらに3点**。',
      'ほかに、**農地の農民**・**農地のつながり**・**十字や宿場の商人**・**砦のまわりの武士**が得点になります。項目を押すと、どのマスの点かが光ります。',
    ],
    maro: ['最後は得点まろ。城までの道で**5点**、**砦を通れば3点**おまけまろ。', '農民・商人・武士も、いる場所しだいで点になるまろ。項目を押して確かめるまろ！'],
    Stage: ScoreStage,
  },
  {
    chapter: 6,
    title: 'これで準備はばっちり',
    body: ['手番は **取る → 置く → 補充** のくり返し。', 'あとは遊びながら覚えましょう。'],
    maro: ['これで説明はおしまいまろ。手番は**取る→置く→補充**のくり返しまろ。', 'さあ、そなたの街道を見せてほしいまろ！'],
    Stage: SummaryStage,
  },
]
