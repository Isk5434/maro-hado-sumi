import { useState, type ReactNode } from 'react'
import { isEdge, pieceCells } from '../game/board'
import type { CardKind, Piece } from '../game/types'
import festTownImg from '../assets/game/fest-town.jpg'
import festVillageImg from '../assets/game/fest-village.jpg'
import riceImg from '../assets/game/rice.png'
import { CardImage, PieceImage } from '../components/Tiles'
import { VillageBoard } from '../components/VillageBoard'
import { C, FULL_ROAD, HandRow, Note, P, PlaceDemo, ROAD_PATH, k, makeVillage } from './kit'
import { FULL_SCORE_LABELS, scoreFull } from './fullScoring'
import {
  AfterBattleStage,
  ConnectStage,
  EndStage,
  EventStage,
  FloodStage,
  GoalStage,
  KeepStage,
  MapStage,
  PlaceCardStage,
  PlacePieceStage,
  RiverStage,
  SetupStage,
  TakeStage,
  WhereStage,
  makeBattleStage,
  makePiecesStage,
  type StageProps,
  type Step,
} from './steps'

export const FULL_CHAPTERS = ['目的', '村と道具', '準備', '手番', '置き方', '特殊効果', 'イベント', '終わりと得点'] as const

// ---------------------------------------------------------------- 舞台

function Rice({ className = 'w-7' }: { className?: string }) {
  return <img src={riceImg} alt="お米ポイント" className={`aspect-square rounded-full shadow ${className}`} />
}

type GalleryItem = { id: string; name: string; count: string; info: string; image: ReactNode }

const card = (kind: CardKind) => <CardImage card={{ id: 0, kind }} className="w-full rounded-none" />
const pic = (src: string, alt: string) => <img src={src} alt={alt} className="block aspect-square w-full rounded-none object-cover" />
const SPECIAL_ICON = (label: string) => (
  <span className="flex aspect-square w-full items-center justify-center rounded-none border-2 border-[#7a766a] bg-[#d3cebd] p-1 text-center text-[9px] leading-tight font-black text-[#2b2a26]">
    {label}
  </span>
)

const FULL_CARD_GROUPS: { name: string; tone: string; items: GalleryItem[] }[] = [
  {
    name: '道カード',
    tone: 'text-amber-200',
    items: [
      { id: 'straight', name: '直線', count: '20', info: '2方向の道。川の上にも置ける、ただひとつのカード', image: card('straight') },
      { id: 'L', name: 'L字', count: '15', info: '曲がり角の道', image: card('L') },
      { id: 'T', name: 'T字', count: '15', info: '3方向に分かれる道', image: card('T') },
      { id: 'cross', name: '十字', count: '10', info: '4方向の道。商人をのせると1点', image: card('cross') },
    ],
  },
  {
    name: '場所カード',
    tone: 'text-emerald-200',
    items: [
      { id: 'farm', name: '農地', count: '20', info: '道のない畑。上に農民 → 1点（お米ポイントも1つ）／ 4枚つなげる → 3点', image: card('farm') },
      { id: 'temple', name: '寺', count: '8', info: '村のふち（四辺）にしか置けない。僧をのせると3点、近くの宿場1つにつき1点', image: card('temple') },
      { id: 'inn', name: '宿場', count: '8', info: '十字の道としてつながる宿場町。商人をのせると2点', image: card('inn') },
    ],
  },
  {
    name: 'イベントカード',
    tone: 'text-rose-200',
    items: [
      { id: 'battle', name: '合戦', count: '要確認', info: '補充で出たら合戦が起きる（枚数はルールブックで調整中）', image: card('battle') },
      { id: 'flood', name: '氾濫', count: '7', info: '補充で出たら、前の人の村の川沿いが氾濫する', image: card('flood') },
      { id: 'fv', name: '村の祭', count: '2', info: '出たら祭置き場へ。ゲームの終わりに、全員が農民の数×1点', image: pic(festVillageImg, '村の祭') },
      { id: 'ft', name: '町の祭', count: '2', info: '出たら祭置き場へ。ゲームの終わりに、全員が商人の数×1点', image: pic(festTownImg, '町の祭') },
    ],
  },
  {
    name: '特殊効果カード（表向きで並べておく）',
    tone: 'text-sky-200',
    items: [
      { id: 's1', name: '一回休み', count: '4', info: '左隣の人の次の番をとばす', image: SPECIAL_ICON('左隣の人は一回休み') },
      { id: 's2', name: '2枚外す', count: '4', info: '左隣の人の村から、コマののっていないカードを2枚捨てる', image: SPECIAL_ICON('左隣のカードを2枚外す') },
      { id: 's3', name: '交換', count: '4', info: 'キープの場所カードと、自分の村のコマののっていないカードを1枚交換する', image: SPECIAL_ICON('キープと村のカードを交換') },
      { id: 's4', name: '並べなおし', count: '4', info: '城の上のカード4枚を捨てて、山札から並べなおす', image: SPECIAL_ICON('城の上の4枚を並べなおす') },
    ],
  },
]

function FullCardsStage() {
  const all = FULL_CARD_GROUPS.flatMap((g) => g.items)
  const [sel, setSel] = useState('straight')
  const item = all.find((i) => i.id === sel)!
  return (
    <div className="flex flex-col gap-2">
      {FULL_CARD_GROUPS.map((g) => (
        <div key={g.name}>
          <p className={`mb-1 text-xs font-black ${g.tone}`}>{g.name}</p>
          <div className="grid grid-cols-4 gap-1.5">
            {g.items.map((it, i) => (
              <button
                key={it.id}
                type="button"
                onClick={() => setSel(it.id)}
                className={`animate-deal rounded-none p-1 text-white transition-all duration-200 ${sel === it.id ? '-translate-y-1 bg-amber-300/30 ring-2 ring-amber-300' : 'bg-black/20 hover:bg-black/30'}`}
                style={{ animationDelay: `${i * 60}ms` }}
              >
                {it.image}
                <span className="mt-0.5 block truncate text-[10px] leading-none font-bold">
                  {it.name}
                  <span className="ml-0.5 opacity-60">×{it.count}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
      <Note key={sel}>
        <b className="text-amber-200">{item.name}</b>：{item.info}
      </Note>
    </div>
  )
}

const FullPiecesStage = makePiecesStage(['farmer', 'merchant', 'samurai', 'monk'], { farmer: 56, merchant: 28, samurai: 28, monk: 18 })

/** ② コマはカードの上に置く（どのコマも共通のきまり） */
function PieceOnCardStage({ onDone }: StageProps) {
  const [v, setV] = useState(() =>
    makeVillage([
      [6, 3, 'straight', 1],
      [7, 2, 'farm'],
      [6, 2, 'cross'],
    ]),
  )
  const [piece, setPiece] = useState<Piece | null>(() => P('merchant'))
  const [placedAt, setPlacedAt] = useState<string | null>(null)
  const kindAt = (key: string) => {
    const [x, y] = key.split(',').map(Number)
    return v.cells[y][x].placed?.card.kind
  }
  return (
    <div className="flex flex-col gap-2 text-white">
      <VillageBoard
        village={v}
        targets={piece ? new Set(pieceCells(v).map(([x, y]) => k(x, y))) : undefined}
        freshPieces={placedAt ? new Set([placedAt]) : undefined}
        labels={{ '6,3': '直線', '7,2': '農地', '6,2': '十字', '7,3': '館' }}
        onCell={(x, y) => {
          const next = structuredClone(v)
          next.cells[y][x].placed!.piece = piece
          setV(next)
          setPiece(null)
          setPlacedAt(k(x, y))
          onDone()
        }}
      />
      {piece && (
        <HandRow>
          <PieceImage piece={piece} className="w-12" />
          <span className="text-xs font-bold">取った商人コマを、光っているカードのどれかに置こう</span>
        </HandRow>
      )}
      {placedAt && (
        <Note tone="good">
          {kindAt(placedAt) === 'cross'
            ? '十字の道に商人。これはあとで1点になる組み合わせです'
            : `${kindAt(placedAt) === 'farm' ? '農地' : '直線'}に商人を置きました。商人は十字や宿場にいると点になります`}
        </Note>
      )}
      <div className="grid grid-cols-2 gap-2 text-[12px] font-bold">
        <p className="rounded-none bg-emerald-600/80 p-2">◯ 自分の村の、カードの上に置く</p>
        <p className="rounded-none bg-rose-700/80 p-2">✕ 1枚のカードにコマは1つまで。空き地には置けない</p>
      </div>
    </div>
  )
}

/** 農地＋農民＝お米ポイント（通常版だけのきまり）。ちがう組み合わせと比べて試せる */
function RiceStage({ onDone }: StageProps) {
  const init = () =>
    makeVillage([
      [6, 3, 'farm'],
      [7, 2, 'farm'],
      [6, 2, 'straight', 0],
    ])
  const [v, setV] = useState(init)
  const [kind, setKind] = useState<'farmer' | 'merchant'>('farmer')
  const [rice, setRice] = useState(0)
  const [last, setLast] = useState<{ key: string; ok: boolean; text: string } | null>(null)
  const place = (x: number, y: number) => {
    const card = v.cells[y][x].placed!.card.kind
    const next = structuredClone(v)
    next.cells[y][x].placed!.piece = P(kind)
    setV(next)
    const ok = kind === 'farmer' && card === 'farm'
    if (ok) {
      setRice((r) => r + 1)
      onDone()
    }
    setLast({
      key: k(x, y),
      ok,
      text: ok
        ? '農地＋農民！ お米ポイントを1つゲット'
        : kind === 'merchant'
          ? '農地に商人……農民ではないので、お米はもらえません'
          : '直線に農民……農地ではないので、お米はもらえません',
    })
  }
  const box = 'flex h-14 w-14 items-center justify-center rounded-none bg-black/25 sm:h-16 sm:w-16'
  return (
    <div className="flex flex-col gap-2 text-white">
      {/* 式で見せる */}
      <div className="flex items-center justify-center gap-2 rounded-none bg-black/20 py-2 text-2xl font-black">
        <span className="flex flex-col items-center gap-0.5">
          <span className={box}>
            <CardImage card={{ id: 0, kind: 'farm' }} className="w-full rounded-none" />
          </span>
          <span className="text-[11px]">農地カード</span>
        </span>
        <span>＋</span>
        <span className="flex flex-col items-center gap-0.5">
          <span className={box}>
            <PieceImage piece={{ id: 0, kind: 'farmer' }} className="w-[85%]" showStrength={false} />
          </span>
          <span className="text-[11px]">農民コマ</span>
        </span>
        <span>＝</span>
        <span className="flex flex-col items-center gap-0.5">
          <span className={box}>
            <Rice className="w-[80%]" />
          </span>
          <span className="text-[11px]">お米 1つ</span>
        </span>
      </div>
      <VillageBoard
        village={v}
        targets={new Set(pieceCells(v).map(([x, y]) => k(x, y)))}
        freshPieces={last ? new Set([last.key]) : undefined}
        labels={{ '6,3': '農地', '7,2': '農地', '6,2': '直線', '7,3': '館' }}
        onCell={place}
      />
      <HandRow label="置くコマ">
        {(['farmer', 'merchant'] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setKind(p)}
            className={`flex w-16 flex-col items-center gap-0.5 rounded-none p-1 transition-all duration-200 ${kind === p ? '-translate-y-1 bg-paper-0 shadow-[0_8px_16px_-8px_rgb(43_42_38/0.5)] outline outline-1 outline-ink-1' : 'bg-paper-0/45'}`}
          >
            <PieceImage piece={{ id: 0, kind: p }} className="w-11" />
            <span className="text-[10px] font-bold">{p === 'farmer' ? '農民' : '商人'}</span>
          </button>
        ))}
        <span className="ml-auto flex items-center gap-1.5">
          <Rice className="w-8" />
          <span className="text-2xl font-black tabular-nums">{rice}</span>
        </span>
      </HandRow>
      {last && (
        <Note key={last.key + last.text} tone={last.ok ? 'good' : 'bad'}>
          {last.text}
        </Note>
      )}
      <button
        type="button"
        onClick={() => {
          setV(init())
          setRice(0)
          setLast(null)
        }}
        className="self-start rounded-none bg-white/15 px-3 py-1.5 text-xs font-bold"
      >
        ↻ 置きなおす
      </button>
    </div>
  )
}

function TempleStage({ onDone }: StageProps) {
  return (
    <PlaceDemo
      initial={makeVillage([[6, 3, 'straight', 1]])}
      hand={[{ card: C('temple'), rot: 0 }]}
      only={['7,2', '6,2']}
      labels={{ '7,2': 'ふち', '6,2': '内側', '7,3': '館' }}
      onPlaced={(_v, c, key) => {
        const [x, y] = key.split(',').map(Number)
        if (c.kind === 'temple' && isEdge(x, y)) onDone()
        return { msg: '寺はふちに建ちました。僧をのせれば3点！' }
      }}
      footer={<Note>「内側」を押すとどうなるかも試してみよう</Note>}
    />
  )
}

const SPECIALS = [
  { id: 'rest', name: '左隣の人は一回休み', info: '左の人の次の番をとばします' },
  { id: 'remove', name: '左隣の人のカードを2枚外す', info: 'コマののっていないカードを2枚選んで捨てます' },
  { id: 'swap', name: 'キープと村のカードを交換', info: 'キープの場所カードと、村のコマののっていないカードを1枚交換' },
  { id: 'redeal', name: '城の上を並べなおす', info: '城の上の4枚を捨てて、山札から並べなおします' },
]

function SpecialStage({ onDone }: StageProps) {
  const [rice, setRice] = useState(2)
  const [used, setUsed] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  return (
    <div className="flex flex-col gap-2 text-white">
      <div className="flex items-center gap-2 rounded-none bg-black/20 p-2">
        <span className="text-xs font-black text-amber-200">あなたのお米ポイント</span>
        <span className="flex gap-1">
          {Array.from({ length: rice }).map((_, i) => (
            <Rice key={i} />
          ))}
        </span>
        <span className="ml-auto text-xs font-bold opacity-80">自分の番の最初に使える</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {SPECIALS.map((s) => {
          const isUsed = used === s.id
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                if (used) {
                  setMsg(isUsed ? '使ったカードは裏向き。このゲームではもう使えません' : '使えるのは1ターンに1枚まで！')
                  return
                }
                setUsed(s.id)
                setRice((r) => r - 1)
                setMsg(`お米ポイント1つで「${s.name}」を使いました`)
                onDone()
              }}
              className="relative h-28 [perspective:600px]"
            >
              <span
                className="absolute inset-0 transition-transform duration-500 [transform-style:preserve-3d]"
                style={{ transform: isUsed ? 'rotateY(180deg)' : 'none' }}
              >
                <span className="absolute inset-0 flex flex-col justify-between rounded-none border-2 border-[#7a766a] bg-[#e2ded1] p-2 text-left text-[#2b2a26] [backface-visibility:hidden]">
                  <b className="text-[13px] leading-tight">{s.name}</b>
                  <span className="text-[10px] leading-snug">{s.info}</span>
                  <span className="flex items-center gap-1 self-end text-[10px] font-black">
                    <Rice className="w-4" />×1
                  </span>
                </span>
                <span className="absolute inset-0 flex items-center justify-center rounded-none bg-[repeating-linear-gradient(45deg,#2b2a26_0_6px,#6d4826_6px_12px)] text-xs font-black text-white [backface-visibility:hidden] [transform:rotateY(180deg)]">
                  使用済み
                </span>
              </span>
            </button>
          )
        })}
      </div>
      {msg && (
        <Note key={msg} tone={msg.startsWith('お米') ? 'good' : 'bad'}>
          {msg}
        </Note>
      )}
    </div>
  )
}

const FullBattleStage = makeBattleStage({
  mine: ['samurai', 'monk', 'farmer', 'merchant'],
  min: 1,
  max: 3,
  rivals: [
    { name: 'Bさん', color: '#4f6b80', pieces: ['samurai', 'monk', 'merchant'], dice: [[2, 3], [1, 4]] },
    { name: 'Cさん', color: '#5f6f4c', pieces: ['farmer', 'farmer'], dice: [[4, 2]] },
  ],
})

const FEST_VILLAGE: Parameters<typeof makeVillage>[0] = [
  [6, 3, 'straight', 1, 'merchant'],
  [7, 2, 'farm', 0, 'farmer'],
  [6, 2, 'farm', 0, 'farmer'],
  [7, 1, 'inn', 0, 'merchant'],
  [5, 3, 'straight', 1, 'farmer'],
]

function FestStage({ onDone }: StageProps) {
  const [v] = useState(() => makeVillage(FEST_VILLAGE))
  const [placed, setPlaced] = useState<{ village: boolean; town: boolean }>({ village: false, town: false })
  const [msg, setMsg] = useState<{ text: string; tone: 'good' | 'bad' } | null>(null)
  const [focus, setFocus] = useState<'village' | 'town' | null>(null)
  const farmers = ['7,2', '6,2', '5,3']
  const merchants = ['6,3', '7,1']
  const draw = (which: 'village' | 'town') => {
    setFocus(which)
    if (placed[which]) {
      setMsg({ text: 'すでに発生している祭が出たら、なにも起きません（捨て箱へ）', tone: 'bad' })
      return
    }
    setPlaced((p) => ({ ...p, [which]: true }))
    setMsg({
      text: which === 'village' ? `村の祭！ ゲームの終わりに、全員が農民の数×1点（この村なら${farmers.length}点）` : `町の祭！ ゲームの終わりに、全員が商人の数×1点（この村なら${merchants.length}点）`,
      tone: 'good',
    })
    onDone()
  }
  const card = (which: 'village' | 'town', size = 'w-16') => (
    <img src={which === 'village' ? festVillageImg : festTownImg} alt={which === 'village' ? '村の祭' : '町の祭'} className={`${size} aspect-square rounded-none object-cover shadow-lg`} />
  )
  return (
    <div className="flex flex-col gap-2 text-white">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold">山札から…</span>
        {(['village', 'town'] as const).map((w) => (
          <button key={w} type="button" onClick={() => draw(w)} className="rounded-none bg-black/20 p-1 transition hover:-translate-y-0.5">
            {card(w, 'w-14')}
            <span className="block text-[10px] font-bold">{w === 'village' ? '村の祭を引く' : '町の祭を引く'}</span>
          </button>
        ))}
      </div>
      <div className="flex min-h-20 items-center gap-2 rounded-none border-2 border-dashed border-amber-300/60 bg-black/20 p-2">
        <span className="text-xs font-black text-amber-200 [writing-mode:vertical-rl]">祭置き場</span>
        {placed.village && <span className="animate-drop">{card('village')}</span>}
        {placed.town && <span className="animate-drop">{card('town')}</span>}
        {!placed.village && !placed.town && <span className="text-[11px] opacity-60">ゲームの終わりまで置いたまま</span>}
      </div>
      <VillageBoard village={v} spotlight={focus ? new Set(focus === 'village' ? farmers : merchants) : null} glow={focus ? new Set(focus === 'village' ? farmers : merchants) : undefined} />
      {msg && (
        <Note key={msg.text} tone={msg.tone}>
          {msg.text}
        </Note>
      )}
    </div>
  )
}

const FULL_SCORE_VILLAGE: Parameters<typeof makeVillage>[0] = [
  ...FULL_ROAD.map(([x, y, kind, rot]) => [x, y, kind, rot] as [number, number, CardKind, number]),
  [6, 0, 'farm'],
  [7, 0, 'farm'],
  [6, 1, 'farm', 0, 'farmer'],
  [7, 1, 'farm', 0, 'farmer'],
  [6, 2, 'inn', 0, 'merchant'],
  [7, 2, 'temple', 0, 'monk'],
  [5, 1, 'cross', 0, 'merchant'],
]

function FullScoreStage() {
  const [v] = useState(() => {
    const vv = makeVillage(FULL_SCORE_VILLAGE)
    vv.cells[3][4].placed!.piece = P('samurai')
    vv.cells[3][2].placed!.piece = P('samurai')
    return vv
  })
  const [fest, setFest] = useState({ village: true, town: false })
  const rice = 2
  const s = scoreFull(v, { rice, festTown: fest.town, festVillage: fest.village })
  type Row = keyof typeof FULL_SCORE_LABELS
  const [sel, setSel] = useState<Row>('road')
  const cellsFor: Record<Row, string[]> = {
    road: ROAD_PATH,
    fortBonus: ['3,3', '2,3', '4,3'],
    farmers: ['6,1', '7,1'],
    crossMerchants: ['5,1'],
    innMerchants: ['6,2'],
    monkTemple: ['7,2'],
    farmGroups: ['6,0', '7,0', '6,1', '7,1'],
    innTemple: ['6,2', '7,2'],
    samurai: ['2,3', '4,3', '3,3'],
    rice: [],
    festTown: ['6,2', '5,1'],
    festVillage: ['6,1', '7,1'],
  }
  const rows = (Object.keys(FULL_SCORE_LABELS) as Row[]).filter((r) => s[r] > 0 || r === 'festTown' || r === 'festVillage')
  return (
    <div className="flex flex-col gap-2 text-white">
      <VillageBoard village={v} spotlight={cellsFor[sel].length ? new Set(cellsFor[sel]) : null} glow={new Set(cellsFor[sel])} />
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
        <span className="opacity-80">祭置き場：</span>
        {(['village', 'town'] as const).map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => setFest((f) => ({ ...f, [w]: !f[w] }))}
            className={`rounded-none px-2 py-1 ${fest[w] ? 'bg-amber-300 text-stone-900' : 'bg-white/15'}`}
          >
            {w === 'village' ? '村の祭' : '町の祭'} {fest[w] ? 'あり' : 'なし'}
          </button>
        ))}
        <span className="ml-auto flex items-center gap-1">
          <Rice className="w-5" />
          <Rice className="w-5" /> 残り{rice}つ
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {rows.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setSel(r)}
            className={`flex items-center justify-between rounded-none px-2.5 py-1 text-left text-[12px] font-bold transition-colors duration-200 ${sel === r ? 'bg-amber-300 text-stone-900' : 'bg-black/20 hover:bg-black/30'} ${s[r] === 0 ? 'opacity-50' : ''}`}
          >
            <span>{FULL_SCORE_LABELS[r]}</span>
            <span className="text-base font-black tabular-nums">{s[r]}点</span>
          </button>
        ))}
        <p className="flex items-center justify-between border-t border-white/30 px-2.5 pt-1.5 text-sm font-black">
          <span>合計</span>
          <span key={s.total} className="animate-pop text-xl tabular-nums">
            {s.total}点
          </span>
        </p>
      </div>
    </div>
  )
}

function FullSummaryStage() {
  const flow = [
    { n: '0', t: '特殊効果（使うなら）', d: '番のはじめに、お米ポイント1つで1枚まで' },
    { n: '1', t: '組を取る', d: '城の上の4組から1組' },
    { n: '2', t: '村に置く', d: '道はつながる向きで。寺はふちだけ。農地＋農民でお米ゲット' },
    { n: '3', t: '補充する', d: '合戦・氾濫・祭が出たら処理して、引き直す' },
  ]
  return (
    <div className="flex flex-col gap-2 text-white">
      {flow.map((f, i) => (
        <div key={f.n} className="flex animate-rise items-start gap-3 rounded-none bg-black/20 p-2.5" style={{ animationDelay: `${i * 110}ms` }}>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-none bg-amber-300 text-lg font-black text-stone-900">{f.n}</span>
          <span>
            <b className="block text-sm">{f.t}</b>
            <span className="text-[12px] opacity-85">{f.d}</span>
          </span>
        </div>
      ))}
      <div className="animate-rise rounded-none bg-amber-300/20 p-2.5 text-[12px] font-bold ring-1 ring-amber-300" style={{ animationDelay: '450ms' }}>
        だれかが館から城まで道をつないだら終了。得点表で数えて、いちばん高い人の勝ち
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- ステップ（紙の「通常版改訂」ルールブック 2026年11月時点）

export const FULL_STEPS: Step[] = [
  {
    chapter: 0,
    title: '館から城まで、街道をつなごう',
    body: [
      'あなたは、まろ城のお殿様に仕える家臣。自分の**館**とお殿様の**城**を、道カードでつなげて忠誠を示そう！',
      '農地・宿場・**寺**を整えるとボーナス点。だれかが街道を完成させたら終了、**合計点がいちばん大きい人**の勝ちです。',
    ],
    maro: ['よくぞ参った！ 我はまろいぬ。こちらは**通常版**のルールまろ。', 'そなたの**館**から我の**城**まで、**街道をつなげてほしい**まろ！', '農地・宿場・**寺**を整えれば、ほうびの点も増えるまろ。'],
    Stage: GoalStage,
  },
  {
    chapter: 1,
    title: '村のマスを見てみよう',
    body: ['ボードには**4つの村**があり、どこで遊ぶかを決めます。1つの村は**8×4マス**。', '**城・館・砦・川**を押して、それぞれの役割を確かめましょう。'],
    maro: ['ボードには村が**4つ**。好きな村を選ぶまろ。', '**城・館・砦・川**、ぜんぶ押して確かめてみるまろ！'],
    task: '城・館・砦・川をぜんぶ押してみよう',
    praise: 'ぜんぶ見つけたまろ！',
    Stage: MapStage,
  },
  {
    chapter: 1,
    title: 'カードは4種類',
    body: [
      '**道カード**・**場所カード**（農地・寺・宿場）・**イベントカード**（合戦・氾濫・村の祭・町の祭）が山札に入っています。',
      '**特殊効果カード**は山札とは別に、表向きで並べておきます。押すと説明が出ます。',
    ],
    maro: ['通常版のカードは、**道・場所・イベント**に、**特殊効果カード**が加わるまろ。', '**寺**や**祭**は通常版だけのお楽しみまろ。押して見てみるまろ！'],
    Stage: FullCardsStage,
  },
  {
    chapter: 1,
    title: '人物コマは4人',
    body: ['**農民・商人・武士**に、通常版では**僧**が加わります。', '合戦での強さは **武士4・僧3・農民2・商人1**。僧は**寺の上で3点**になります。'],
    maro: ['通常版では**僧**も村に来てくれるまろ。', '強さは**武士4・僧3・農民2・商人1**まろ。僧は寺にいると3点まろ！'],
    Stage: FullPiecesStage,
  },
  {
    chapter: 2,
    title: '準備',
    body: [
      '城や砦を並べ、山札を城のまわり4か所に置き、**特殊効果カード**を表向きに並べます。',
      '山札から**4枚**を城の上へ、コマ袋から**4つ**をのせて「組」に。イベントが混じったり道カードが無ければ配りなおし。**じゃんけん**で勝った人から時計回りです。',
    ],
    maro: ['城の上に**カードとコマの組を4つ**並べるまろ。', '特殊効果カードも表向きに並べておくまろ。順番は**じゃんけん**で決めて、時計回りまろ！'],
    Stage: SetupStage,
  },
  {
    chapter: 3,
    title: '① 組を1つ取る',
    body: ['城の上の4組から**1組**（カード1枚とコマ1つ）を取ります。**別々の組のカードとコマ**は取れません。', '取っても置ける場所が無いときは、その番の①〜③はスキップです。'],
    maro: ['城の上から**好きな組を1つ**取るまろ。', 'ちがう組のカードとコマを組み合わせるのはダメまろ。'],
    task: '城の上の組を1つ押して取ろう',
    praise: 'よい目利きまろ！',
    Stage: TakeStage,
  },
  {
    chapter: 3,
    title: '② カードを自分の村に置く',
    body: ['取ったカードを自分の村に置きます。はじめは**館のとなり**から。', '光っているマスを押すと置けます。⟳ のマスは、押すと道がつながる向きに回ります。'],
    maro: ['取ったカードを村に置くまろ。最初は**館のとなり**からまろ。', '光っているマスを押してみるまろ！'],
    task: '光っているマスを押してカードを置こう',
    praise: '見事な普請まろ！',
    Stage: PlaceCardStage,
  },
  {
    chapter: 3,
    title: '② コマをカードの上に置く',
    body: [
      '取ったコマは、自分の村の**カードの上**に置きます。**1枚のカードにコマは1つ**まで。',
      'どのコマをどのカードにのせるかで、得点が変わります（くわしくは「得点」で）。',
    ],
    maro: ['コマは村の**カードの上**に住まわせるまろ。**1枚に1人**までまろ。', '商人は**十字の道**が好きまろ。どこに置くか、やってみるまろ！'],
    task: 'コマをカードの上に置こう',
    praise: '住まいが決まったまろ！',
    Stage: PieceOnCardStage,
  },
  {
    chapter: 3,
    title: '農地＋農民で、お米ポイント',
    body: [
      '**農地カード**の上に**農民コマ**を置いたときだけ、**お米ポイント**を1つもらえます。',
      '農地に**商人**、**直線**などに農民では、もらえません。お米は**特殊効果カード**に使えて、最後まで残せば**1つ1点**です。',
    ],
    maro: [
      'ここは通常版だけのきまりまろ。**農地**に**農民**を置くと、**お米ポイント**がもらえるまろ！',
      '農地に商人、道に農民ではダメまろ。いろいろ置いて比べてみるまろ！',
    ],
    task: '農地に農民を置いて、お米をもらおう',
    praise: '豊作まろ〜！',
    Stage: RiceStage,
  },
  {
    chapter: 3,
    title: '③ 補充する',
    body: ['取った場所に、山札とコマ袋から1つずつ**補充**します。コマは見ずに引きます。', '補充が終わったら次の人の番です。'],
    maro: ['置き終わったら、城の上の空いた所に**補充**するまろ。', 'コマを置いて、補充のようすを見てみるまろ。'],
    task: 'コマを置いて、補充を見よう',
    praise: 'これで1手番おしまいまろ！',
    Stage: PlacePieceStage,
  },
  {
    chapter: 4,
    title: '置ける場所',
    body: ['カードは**館**・**置いてある場所カード**・**場所カードとつながっている砦**のとなりに置けます。', '上のボタンで切りかえて見てみましょう。'],
    maro: ['置ける場所は、**館**か**置いたカード**のとなりまろ。', '**砦**は、となりにカードが来てはじめて頼りになるまろ。'],
    Stage: WhereStage,
  },
  {
    chapter: 4,
    title: '道はつながる向きで置く',
    body: ['カードは**回して**置けます。道カードは、となりの道と**少なくとも1か所つながる向き**で置きます。', 'つながらない向きのマスには ⟳ が付きます。'],
    maro: ['道カードは、となりの道と**1か所はつながる向き**で置くまろ。', '「⟳ 回す」で向きを変えて置いてみるまろ。'],
    task: 'L字カードを、道がつながる向きで置こう',
    praise: 'ぴたりとつながったまろ！',
    Stage: ConnectStage,
  },
  {
    chapter: 4,
    title: '川には直線カードだけ',
    body: ['**川**と**氾濫カード**の上には、**直線カード**しか置けません。', 'T字で川を押すとどうなるか、直線ではどうか試しましょう。'],
    maro: ['川には**直線カード**しか置けないまろ。橋になるまろ。', 'T字と直線、両方で試してみるまろ！'],
    task: '直線カードを川に置こう',
    praise: '立派な橋がかかったまろ！',
    Stage: RiverStage,
  },
  {
    chapter: 4,
    title: '寺は村のふちだけ',
    body: ['**寺カード**は、村の**ふち（四辺）**にしか置けません。', '寺に**僧**をのせると3点、寺の**近く（斜めもOK）に宿場**があると1組1点です。'],
    maro: ['**寺**は静かな**村のふち**にしか建てられないまろ。', '「内側」と「ふち」、両方押してみるまろ。'],
    task: '寺カードを村のふちに置こう',
    praise: 'ありがたい寺が建ったまろ。',
    Stage: TempleStage,
  },
  {
    chapter: 4,
    title: 'キープ',
    body: ['カードとコマは、それぞれ**2つずつ**まで**キープ**できます。', 'キープしたものは、自分の番ならいつでも村に出せます。'],
    maro: ['今は置かない、というときは**キープ**するまろ。**カード2枚・コマ2個**までまろ。', '手元のカードとコマをキープしてみるまろ！'],
    task: 'カードとコマをキープに入れよう',
    praise: '先を読むのは良いことまろ。',
    Stage: KeepStage,
  },
  {
    chapter: 5,
    title: '特殊効果カード',
    body: [
      '自分の番の**最初**に、**お米ポイント1つ**で特殊効果カードを使えます。**1ターンに1枚**まで。',
      '使ったカードは裏向きにして、**1ゲームに1回**だけ。使ったお米は箱に戻します。',
    ],
    maro: ['お米ポイントがあれば、番のはじめに**特殊効果カード**を使えるまろ。', '**1ターンに1枚**、それぞれ**1ゲームに1回**まで。どれか使ってみるまろ！'],
    task: '特殊効果カードを1枚使ってみよう',
    praise: 'ふふふ、策士まろ〜。',
    Stage: SpecialStage,
  },
  {
    chapter: 6,
    title: 'イベントカードが出たら',
    body: ['補充で**合戦・氾濫・祭**のカードが出たら、すぐに処理します。', '処理したら、**場所カードが出るまで**引き直します。'],
    maro: ['補充で**イベントカード**が出たら、すぐに起こるまろ！', '終わったら、**場所カードが出るまで**引き直すまろ。'],
    Stage: EventStage,
  },
  {
    chapter: 6,
    title: '合戦',
    body: [
      '各プレイヤーは村かキープの人物コマから**最大3人**（**最低1人**）を出し、**強さの合計＋サイコロ2個**で比べます。いちばん大きい人が**功労者**。',
      '同点ならその人たちだけ振りなおし。出したコマは袋へ戻ります。出せるコマが0人の人がいれば合戦は起きません。',
    ],
    maro: ['**合戦**まろ！ 人物コマを**1〜3人**出して、**強さ＋サイコロ2個**で勝負まろ。', '僧は強さ3。だれを出すか選んで、出陣まろ！'],
    task: 'コマを選んでサイコロを振ろう',
    praise: '天晴れな戦いぶりまろ！',
    Stage: FullBattleStage,
  },
  {
    chapter: 6,
    title: '合戦のあと',
    body: ['**功労者**は城の上から好きなカードとコマを1つずつもらえます。', 'それ以外の人は、村の**コマがのっていないカード**を1枚捨てます（キープは含めない）。道が切れたら、直すまでゴールできません。'],
    maro: ['勝った**功労者**にはほうびをとらすまろ。', '負けた者は、**コマがのっていないカード**を1枚捨てるまろ……。'],
    task: '負けた人として、カードを1枚捨てよう',
    praise: 'また建て直せばよいまろ。',
    Stage: AfterBattleStage,
  },
  {
    chapter: 6,
    title: '氾濫',
    body: ['氾濫カードを引いた人は、**1つ前の番の人（右隣）**の村の、**川沿いの空きマス**に置きます。', 'そのマスは**川と同じ**になり、直線カードしか置けません。空きが無ければ捨てます。'],
    maro: ['大雨まろ！ **氾濫カード**は、**右隣の者**の村の**川沿い**に置くまろ。', 'どこを水びたしにするまろ？'],
    task: '川沿いの空きマスを1つ選ぼう',
    praise: 'なかなかの策士まろ。',
    Stage: FloodStage,
  },
  {
    chapter: 6,
    title: '祭',
    body: [
      '**村の祭・町の祭**のカードが出たら、**祭置き場**に置きます（ゲームの終わりまでそのまま）。',
      '村の祭があれば全員が**農民の数×1点**、町の祭があれば**商人の数×1点**。すでに出ている祭がまた出たら、何も起きません。',
    ],
    maro: ['**祭**だまろ〜！ 出た祭は**祭置き場**に飾っておくまろ。', '村の祭は**農民**、町の祭は**商人**の数だけ、みんなに点が入るまろ。2回引いてみるまろ？'],
    task: '祭のカードを引いてみよう',
    praise: 'にぎやかでよいまろ〜！',
    Stage: FestStage,
  },
  {
    chapter: 7,
    title: '城までつないだら終了',
    body: ['だれかが**館から城まで道をつないだ瞬間**にゲーム終了です。', '最後の1枚を置いて、街道を完成させましょう。'],
    maro: ['あと1枚で我が城に届くまろ！', '最後のカードを置いて、**街道を完成**させるまろ！'],
    task: '最後の1枚を置いて城までつなごう',
    praise: '見事！ 街道が通じたまろ〜！',
    Stage: EndStage,
  },
  {
    chapter: 7,
    title: '得点を数える',
    body: [
      '道がつながると**5点**、砦を通ると**さらに3点**。**僧＋寺院は3点**、**宿場＋寺**は1組1点、**お米ポイント**は1つ1点。',
      '祭置き場のボタンで、**祭のあり・なし**による点の変化も見られます。項目を押すと、どのマスの点かが光ります。',
    ],
    maro: ['得点表で数えるまろ。道で**5点**、砦を通れば**3点**おまけまろ。', '**僧と寺**は3点、**お米**も1つ1点、**祭**があればさらに点が入るまろ！'],
    Stage: FullScoreStage,
  },
  {
    chapter: 7,
    title: 'これで準備はばっちり',
    body: ['手番は **（特殊効果）→ 取る → 置く → 補充** のくり返し。', 'あとは遊びながら覚えましょう。'],
    maro: ['これで通常版の説明はおしまいまろ。', 'さあ、そなたの街道と村づくりを見せてほしいまろ！'],
    Stage: FullSummaryStage,
  },
]

