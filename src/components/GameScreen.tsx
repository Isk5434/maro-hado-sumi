import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { floodCells, pieceCells, placeableCells, validRotations } from '../game/board'
import {
  BATTLE_SIZE,
  CARD_NAMES,
  KEEP_LIMIT,
  PIECE_NAMES,
  STRENGTH,
  canChangeSet,
  canTakeCard,
  canUseKeep,
  changeSet,
  chooseReward,
  discardCard,
  discardableCells,
  keepHoldingCard,
  keepHoldingPiece,
  phaseOf,
  piecesOf,
  placeFlood,
  placeHoldingCard,
  placeHoldingPiece,
  playKeepCard,
  playKeepPiece,
  selectBattlePieces,
  skipTurn,
  takeSet,
  takeableSlots,
  type PieceRef,
} from '../game/engine'
import type { Card, GameState, Piece, Player } from '../game/types'
import maroinu from '../assets/game/maroinu.jpg'
import { useStore } from '../store'
import { ScoreBoard } from './ScoreBoard'
import { CardImage, PieceImage } from './Tiles'
import { VillageBoard } from './VillageBoard'
import { InkButton, LineButton } from './ui'

import { PLAYER_COLORS } from './colors'

type Sel = { k: 'hcard' } | { k: 'hpiece' } | { k: 'kcard'; i: number } | { k: 'kpiece'; i: number } | null
type Phase = ReturnType<typeof phaseOf>

const keyOf = (x: number, y: number) => `${x},${y}`

export function GameScreen() {
  const game = useStore((s) => s.game)!
  const act = useStore((s) => s.act)
  const undo = useStore((s) => s.undo)
  const quit = useStore((s) => s.quit)
  const canUndo = useStore((s) => s.history.length > 0)
  const prevGame = useStore((s) => s.history.at(-1) ?? null)
  const error = useStore((s) => s.error)
  const clearError = useStore((s) => s.clearError)

  const phase = phaseOf(game)
  const actor = phase.kind === 'over' ? null : phase.player
  const [sel, setSel] = useState<Sel>(null)
  // rot は回した回数（アニメーションが逆回りしないよう 4 で割らずに持つ）。ルール上の向きは rot4
  const [rot, setRot] = useState(0)
  const rot4 = ((rot % 4) + 4) % 4
  const [view, setView] = useState<number | null>(null)
  const [battlePick, setBattlePick] = useState<string[]>([])
  const [reward, setReward] = useState<{ card: number | null; piece: number | null }>({ card: null, piece: null })

  useEffect(() => {
    if (!error) return
    const t = setTimeout(clearError, 4000)
    return () => clearTimeout(t)
  }, [error, clearError])

  // 盤面に表示する村: 氾濫なら対象の村、それ以外は手番の人
  const defaultView = phase.kind === 'flood' ? phase.target : (actor ?? game.current)
  const shown = view ?? defaultView
  const player = game.players[shown]
  const actorPlayer = actor === null ? null : game.players[actor]

  // 置く対象の自動選択: 持っているカード → コマ の順
  const holding = phase.kind === 'place' ? phase.holding : null
  const keepUsable = actor !== null && canUseKeep(game, actor)
  const effSel: Sel = useMemo(() => {
    if (keepUsable && sel?.k === 'kcard' && actorPlayer?.keepCards[sel.i]) return sel
    if (keepUsable && sel?.k === 'kpiece' && actorPlayer?.keepPieces[sel.i]) return sel
    if (sel?.k === 'hcard' && holding?.card) return sel
    if (sel?.k === 'hpiece' && holding?.piece) return sel
    if (holding?.card) return { k: 'hcard' }
    if (holding?.piece) return { k: 'hpiece' }
    return null
  }, [sel, holding, actorPlayer, keepUsable])

  const selCard: Card | null =
    effSel?.k === 'hcard' ? (holding?.card ?? null) : effSel?.k === 'kcard' ? (actorPlayer?.keepCards[effSel.i] ?? null) : null
  const selPiece: Piece | null =
    effSel?.k === 'hpiece' ? (holding?.piece ?? null) : effSel?.k === 'kpiece' ? (actorPlayer?.keepPieces[effSel.i] ?? null) : null

  const run = (fn: (g: GameState) => GameState) => {
    if (act(fn)) {
      setSel(null)
      setView(null)
      setRot(0)
    }
  }

  // ---- 押せるマスを決める ----
  const onOwnVillage = actor !== null && shown === actor
  let targets = new Set<string>()
  let tone: 'place' | 'danger' | 'pick' = 'place'
  let onCell: ((x: number, y: number) => void) | undefined
  let fits: Set<string> | null = null
  const selected = new Set<string>()

  if (phase.kind === 'flood' && shown === phase.target) {
    targets = new Set(floodCells(player.village).map(([x, y]) => keyOf(x, y)))
    tone = 'danger'
    onCell = (x, y) => run((g) => placeFlood(g, x, y))
  } else if (phase.kind === 'discard' && onOwnVillage) {
    targets = new Set(discardableCells(player.village).map(([x, y]) => keyOf(x, y)))
    tone = 'danger'
    onCell = (x, y) => run((g) => discardCard(g, x, y))
  } else if (phase.kind === 'battleSelect' && onOwnVillage) {
    player.village.cells.forEach((row, y) => row.forEach((c, x) => c.placed?.piece && targets.add(keyOf(x, y))))
    battlePick.filter((k) => !k.startsWith('k')).forEach((k) => selected.add(k))
    tone = 'pick'
    onCell = (x, y) => togglePick(keyOf(x, y))
  } else if (onOwnVillage && selCard) {
    targets = new Set(placeableCells(player.village, selCard).map(([x, y]) => keyOf(x, y)))
    fits = new Set(placeableCells(player.village, selCard, rot4).map(([x, y]) => keyOf(x, y)))
    const card = selCard
    onCell = (x, y) => {
      // いまの向きで道がつながらなければ、つながる向きに回して見せる（もう一度押すと置く）
      const ok = validRotations(player.village, card, x, y)
      if (!ok.includes(rot4)) {
        const target = ok.find((r) => r > rot4) ?? ok[0]
        setRot(rot + ((target - rot4 + 4) % 4))
        return
      }
      run((g) => (effSel?.k === 'kcard' ? playKeepCard(g, effSel.i, x, y, rot4) : placeHoldingCard(g, x, y, rot4)))
    }
  } else if (onOwnVillage && selPiece) {
    targets = new Set(pieceCells(player.village).map(([x, y]) => keyOf(x, y)))
    onCell = (x, y) =>
      run((g) => (effSel?.k === 'kpiece' ? playKeepPiece(g, effSel.i, x, y) : placeHoldingPiece(g, x, y)))
  }

  function togglePick(k: string) {
    setBattlePick((p) => (p.includes(k) ? p.filter((q) => q !== k) : [...p, k]))
  }

  const battleNeed = phase.kind === 'battleSelect' && actorPlayer ? Math.min(BATTLE_SIZE, piecesOf(actorPlayer)) : 0
  const submitBattle = () => {
    const refs: PieceRef[] = battlePick.map((k) =>
      k.startsWith('k') ? { from: 'keep', index: Number(k.slice(1)) } : { from: 'village', x: +k.split(',')[0], y: +k.split(',')[1] },
    )
    if (act((g) => selectBattlePieces(g, refs))) setBattlePick([])
  }

  // 直前の操作で置かれたカード・コマ（登場の動きをつける）
  const freshCards = new Set<string>()
  const freshPieces = new Set<string>()
  const prevCells = prevGame?.players[shown]?.village.cells
  if (prevCells) {
    player.village.cells.forEach((row, y) =>
      row.forEach((c, x) => {
        const before = prevCells[y][x].placed
        if (c.placed && c.placed.card.id !== before?.card.id) freshCards.add(keyOf(x, y))
        if (c.placed?.piece && c.placed.piece.id !== before?.piece?.id) freshPieces.add(keyOf(x, y))
      }),
    )
  }

  const trayVisible =
    (phase.kind === 'place' && onOwnVillage) ||
    (phase.kind === 'choose' && (!!effSel || takeableSlots(game).length === 0)) ||
    phase.kind === 'battleSelect' ||
    phase.kind === 'reward'

  return (
    <div className="min-h-dvh">
      <Header game={game} actor={actor} canUndo={canUndo} onUndo={undo} onQuit={() => confirm('ゲームを終了してタイトルに戻りますか？') && quit()} />

      <main className={`mx-auto flex max-w-[1400px] flex-col gap-4 px-3 pt-4 lg:px-8 ${trayVisible ? 'pb-48' : 'pb-10'}`}>
        <StepBanner phase={phase} game={game} battleNeed={battleNeed} changeable={canChangeSet(game)} />

        {phase.kind === 'over' && (
          <>
            <ScoreBoard game={game} />
            <InkButton onClick={quit}>タイトルに戻る</InkButton>
          </>
        )}

        <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px]">
          {/* 城の上 */}
          <div className="md:col-start-1 md:row-start-1 lg:col-start-2 lg:row-start-1">
            <CastlePanel
              game={game}
              phase={phase}
              actorPlayer={actorPlayer}
              reward={reward}
              onTake={(i) => run((g) => takeSet(g, i))}
              onChange={(i) => run((g) => changeSet(g, i))}
              onReward={(part, i) => setReward((r) => ({ ...r, [part]: r[part] === i ? null : i }))}
            />
          </div>

          {/* 村 */}
          <section className="md:col-span-2 md:row-start-2 lg:col-span-1 lg:col-start-1 lg:row-span-4 lg:row-start-1">
            <nav className="mb-2 flex overflow-x-auto border-b border-ink-1/70" aria-label="村の切り替え">
              {game.players.map((p) => {
                const active = shown === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setView(p.id === defaultView ? null : p.id)}
                    className={`flex shrink-0 items-center gap-2 px-4 py-2 text-sm transition-colors duration-150 ${
                      active ? 'bg-ink-1 text-paper-0' : 'text-ink-2 hover:bg-paper-2'
                    }`}
                  >
                    <span className="h-2 w-2 rotate-45" style={{ background: PLAYER_COLORS[p.id] }} />
                    <span className="font-bold">{p.name}</span>
                    <span className="text-xs opacity-70">の村</span>
                    {p.id === actor && (
                      <span aria-label="手番" className="lbl text-[9px] text-brass">
                        Turn
                      </span>
                    )}
                  </button>
                )
              })}
            </nav>
            <VillageBoard
              village={player.village}
              targets={targets}
              fits={fits}
              freshCards={freshCards}
              freshPieces={freshPieces}
              selected={selected}
              targetTone={tone}
              ghost={selCard && onOwnVillage ? { card: selCard, rot } : null}
              accent={PLAYER_COLORS[shown]}
              onCell={onCell}
            />
            {actor !== null && shown !== actor && phase.kind !== 'flood' && (
              <LineButton onClick={() => setView(null)} className="mt-2 w-full">
                ← {game.players[actor].name}の村にもどる
              </LineButton>
            )}
            <p className="mt-1.5 flex items-center gap-2 text-[11px] leading-snug text-ink-3"><span className="dia text-[7px]" />左上のGOALが城。右下の館から城まで道をつなごう。</p>
          </section>

          {/* キープ */}
          {actorPlayer && (
            <div className="md:col-start-2 md:row-start-1 md:self-stretch lg:col-start-2 lg:row-start-auto lg:self-auto">
              <KeepPanel
                player={actorPlayer}
                usable={keepUsable}
                battle={phase.kind === 'battleSelect'}
                battlePick={battlePick}
                sel={effSel}
                rot={rot}
                onSelect={(s) => setSel(s)}
                onTogglePick={togglePick}
              />
            </div>
          )}

          {game.battle && (
            <div className="md:col-span-2 lg:col-span-1 lg:col-start-2">
              <BattleResult game={game} />
            </div>
          )}

          <details className="frame bg-paper-0/70 p-3 text-sm md:col-span-2 lg:col-span-1 lg:col-start-2">
            <summary className="ttl cursor-pointer text-ink-1">
              これまでの記録 <span className="lbl ml-1 text-[9px] text-ink-3">Log</span>
            </summary>
            <ol className="mt-2 max-h-60 space-y-1 overflow-y-auto border-t border-ink-0/15 pt-2 text-[11px] text-ink-2">
              {game.log
                .slice()
                .reverse()
                .map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
            </ol>
          </details>
        </div>
      </main>

      {trayVisible && actorPlayer && (
        <ActionTray>
          {phase.kind === 'battleSelect' ? (
            <div className="flex items-center gap-3">
              <p className="flex-1 text-sm font-bold text-[#2b2a26]">
                出陣するコマ
                <span className="ml-1 text-2xl tabular-nums">
                  {battlePick.length}/{battleNeed}
                </span>
                <span className="block text-[11px] font-normal text-stone-600">村かキープのコマを押して選ぶ</span>
              </p>
              <BigButton tone="rose" disabled={battlePick.length !== battleNeed} onClick={submitBattle}>
                ⚔ 出陣
              </BigButton>
            </div>
          ) : phase.kind === 'reward' ? (
            <div className="flex items-center gap-3">
              <p className="flex-1 text-sm font-bold text-[#2b2a26]">
                功労者の報酬
                <span className="block text-[11px] font-normal text-stone-600">
                  城の上でカード{reward.card === null ? '未選択' : '1枚'}・コマ{reward.piece === null ? '未選択' : '1つ'}（取らなくてもOK）
                </span>
              </p>
              <BigButton
                tone="amber"
                onClick={() => {
                  if (act((g) => chooseReward(g, reward.card, reward.piece))) setReward({ card: null, piece: null })
                }}
              >
                受け取る
              </BigButton>
            </div>
          ) : phase.kind === 'choose' && !effSel ? (
            <BigButton tone="stone" onClick={() => run(skipTurn)}>
              取れる組が無いので手番をスキップ
            </BigButton>
          ) : (
            <HandTray
              holding={holding}
              player={actorPlayer}
              sel={effSel}
              rot={rot}
              onSelect={(s) => (effSel && JSON.stringify(effSel) === JSON.stringify(s) && (s.k === 'hcard' || s.k === 'kcard') ? setRot((r) => r + 1) : setSel(s))}
              onRotate={() => setRot((r) => r + 1)}
              onKeepCard={() => run(keepHoldingCard)}
              onKeepPiece={() => run(keepHoldingPiece)}
              onCancel={() => setSel(null)}
            />
          )}
        </ActionTray>
      )}

      <TurnNotice game={game} actor={actor} />

      {error && (
        <div key={error} role="alert" className="animate-shake fixed inset-x-3 top-16 z-50 mx-auto flex max-w-md items-center gap-3 border-l-4 border-shu bg-ink-1 px-4 py-3 text-sm text-paper-0 shadow-xl" onClick={clearError}>
          {error}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- 上部

/** 操作する人が替わったときに大きく知らせる（1台を回して遊ぶため） */
function TurnNotice({ game, actor }: { game: GameState; actor: number | null }) {
  const [shownFor, setShownFor] = useState<number | null>(actor)
  const [visible, setVisible] = useState(false)
  if (actor !== shownFor) {
    setShownFor(actor)
    setVisible(actor !== null)
  }
  useEffect(() => {
    if (!visible) return
    const t = setTimeout(() => setVisible(false), 1400)
    return () => clearTimeout(t)
  }, [visible, shownFor])
  if (!visible || actor === null) return null
  return (
    <button type="button" onClick={() => setVisible(false)} className="animate-fade fixed inset-0 z-50 flex items-center justify-center bg-ink-0/40 backdrop-blur-[2px]">
      <span className="frame animate-pop bg-paper-0 px-14 py-7 text-center shadow-2xl">
        <span className="lbl block text-[10px] text-ink-3">Next Turn</span>
        <span className="dots my-3 block" />
        <span className="flex items-center justify-center gap-3">
          <span className="h-3 w-3 rotate-45" style={{ background: PLAYER_COLORS[actor] }} />
          <span className="ttl text-3xl">{game.players[actor].name}</span>
        </span>
        <span className="mt-1 block text-sm text-ink-2">の番です</span>
      </span>
    </button>
  )
}

function Header({ game, actor, canUndo, onUndo, onQuit }: { game: GameState; actor: number | null; canUndo: boolean; onUndo: () => void; onQuit: () => void }) {
  return (
    <header className="sticky top-0 z-30 border-b border-ink-0/25 bg-paper-0/85 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-3 py-2 lg:px-8">
        <img src={maroinu} alt="" className="h-9 w-9 shrink-0 border border-ink-1/40 object-cover object-[50%_30%]" />
        <div className="min-w-0 flex-1">
          <p className="lbl text-[9px] leading-none text-ink-3">まろいぬの覇道 · Turn</p>
          {actor !== null ? (
            <p className="ttl mt-0.5 flex items-center gap-2 truncate text-lg leading-tight">
              <span className="h-2.5 w-2.5 shrink-0 rotate-45" style={{ background: PLAYER_COLORS[actor] }} />
              {game.players[actor].name}の番
            </p>
          ) : (
            <p className="ttl mt-0.5 text-lg">ゲーム終了</p>
          )}
        </div>
        <dl className="hidden items-center gap-5 sm:flex">
          {(
            [
              ['Deck', '山札', game.deck.length],
              ['Bag', 'コマ袋', game.bag.length],
            ] as const
          ).map(([en, ja, n]) => (
            <div key={en} className="text-right">
              <dt className="lbl text-[9px] leading-none text-ink-3">
                {en} <span className="tracking-normal normal-case">{ja}</span>
              </dt>
              <dd className="num text-base leading-tight">{n}</dd>
            </div>
          ))}
        </dl>
        <span className="hidden h-8 w-px bg-ink-0/20 sm:block" />
        <LineButton onClick={onUndo} disabled={!canUndo}>
          ↩ 戻す
        </LineButton>
        <LineButton onClick={onQuit}>終了</LineButton>
      </div>
    </header>
  )
}

function StepBanner({ phase, game, battleNeed, changeable }: { phase: Phase; game: GameState; battleNeed: number; changeable: boolean }) {
  const name = (i: number) => game.players[i].name
  if (phase.kind === 'choose' || phase.kind === 'place') {
    const step = phase.kind === 'choose' ? 1 : 2
    return (
      <div key={phase.kind + String(changeable)} className="frame flex animate-fade flex-col gap-2 bg-paper-0/80 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-4">
        <ol className="flex shrink-0">
          {['組を取る', '村に置く'].map((label, i) => (
            <li
              key={label}
              className={`flex items-center gap-1.5 border border-ink-1/40 px-2.5 py-1 text-xs transition-colors duration-300 first:border-r-0 ${step === i + 1 ? 'bg-ink-1 text-paper-0' : 'text-ink-3'}`}
            >
              <span className="num text-[10px]">{String(i + 1).padStart(2, '0')}</span>
              {label}
            </li>
          ))}
        </ol>
        <p className="text-sm leading-snug text-ink-1">
          {phase.kind === 'choose'
            ? '城の上の組（カード＋コマ）を1つ押して取ろう。キープを先に村に出してもOK。'
            : changeable
              ? '光っているマスを押して置こう（⟳のマスは押すと道がつながる向きに回ります）。別の組がよければ城の上の組を押すと選び直せます。'
              : '光っているマスを押して置こう（⟳のマスは押すと道がつながる向きに回ります）。置けないものはキープへ。'}
        </p>
      </div>
    )
  }
  const text: Record<string, [string, string]> = {
    flood: ['Flood', `氾濫！${name((phase as { player: number }).player)}が、${phase.kind === 'flood' ? name(phase.target) : ''}の村の川沿いの空きマスを選んで氾濫させてください。`],
    battleSelect: ['Battle', `合戦！${phase.kind === 'battleSelect' ? name(phase.player) : ''}は出陣するコマを${battleNeed}人選んでください（出したコマは戻りません）。`],
    reward: ['Reward', `${phase.kind === 'reward' ? name(phase.player) : ''}が功労者！城の上から好きなカードとコマを1つずつ選べます。`],
    discard: ['Defeat', `${phase.kind === 'discard' ? name(phase.player) : ''}は合戦に敗れました。村の、コマがのっていないカードを1枚捨ててください。`],
    over: ['Game Over', '城まで道がつながりました。得点を計算しました。'],
  }
  const danger = phase.kind === 'flood' || phase.kind === 'battleSelect' || phase.kind === 'discard'
  const [en, body] = text[phase.kind]
  return (
    <div key={phase.kind} className={`frame flex animate-fade items-center gap-3 px-3 py-2.5 ${danger ? 'bg-ink-1 text-paper-0' : 'bg-paper-0/80 text-ink-1'}`}>
      <span className={`lbl shrink-0 border px-2 py-1 text-[10px] ${danger ? 'border-shu bg-shu text-paper-0' : 'border-ink-1/50'}`}>{en}</span>
      <p className="text-sm leading-snug">{body}</p>
    </div>
  )
}

// ---------------------------------------------------------------- 城の上

function PanelTitle({ icon, title, sub, className = '' }: { icon: string; title: string; sub?: string; className?: string }) {
  return (
    <h2 className={`mb-2.5 flex flex-wrap items-center gap-x-2 ${className}`} data-icon={icon}>
      <span aria-hidden className="dia text-[8px] opacity-80" />
      <span className="ttl shrink-0 text-[15px]">{title}</span>
      {sub && <span className="text-[11px] opacity-70">{sub}</span>}
      <span aria-hidden className="dots ml-1 min-w-6 flex-1" />
    </h2>
  )
}

function CastlePanel({
  game,
  phase,
  actorPlayer,
  reward,
  onTake,
  onChange,
  onReward,
}: {
  game: GameState
  phase: Phase
  actorPlayer: Player | null
  reward: { card: number | null; piece: number | null }
  onTake: (i: number) => void
  onChange: (i: number) => void
  onReward: (part: 'card' | 'piece', i: number) => void
}) {
  const takeable = phase.kind === 'choose' ? takeableSlots(game) : []
  const changeable = canChangeSet(game)
  const from = phase.kind === 'place' ? phase.holding.fromSlot : undefined

  return (
    <section
      className="frame p-3 text-paper-0 shadow-[0_10px_24px_-14px_rgb(43_42_38/0.6)]"
      style={{
        background:
          'repeating-linear-gradient(0deg, rgba(255,255,255,0.035) 0 1px, transparent 1px 18px), repeating-linear-gradient(90deg, rgba(255,255,255,0.035) 0 1px, transparent 1px 34px), linear-gradient(#45433d, #33322d)',
      }}
    >
      <PanelTitle icon="🏯" title="城の上" sub={changeable ? '押すと選び直せる' : phase.kind === 'choose' ? '押して取る' : phase.kind === 'reward' ? 'カードとコマを1つずつ選べる' : ''} />
      <div className="grid grid-cols-4 gap-2">
        {game.slots.map((s, i) => {
          if (phase.kind === 'reward') {
            const cardOk = !!s.card && !!actorPlayer && canTakeCard(actorPlayer, s.card)
            return (
              <div key={i} className="flex flex-col items-center rounded-none border-2 border-dashed border-red-400/80 bg-black/15 p-1">
                <button
                  type="button"
                  disabled={!cardOk}
                  onClick={() => onReward('card', i)}
                  className={`w-full overflow-hidden rounded-none disabled:opacity-40 ${reward.card === i ? 'ring-4 ring-amber-400' : ''}`}
                  aria-label={s.card ? `${CARD_NAMES[s.card.kind]}カードを選ぶ` : '空き'}
                >
                  {s.card ? <CardImage card={s.card} className="w-full" /> : <EmptyCard />}
                </button>
                <button
                  type="button"
                  disabled={!s.piece}
                  onClick={() => onReward('piece', i)}
                  className={`-mt-3 w-1/2 rounded-full ${reward.piece === i ? 'ring-4 ring-amber-400' : ''}`}
                  aria-label={s.piece ? `${PIECE_NAMES[s.piece.kind]}コマを選ぶ` : '空き'}
                >
                  {s.piece ? <PieceImage piece={s.piece} className="w-full" /> : <EmptyPiece />}
                </button>
              </div>
            )
          }

          const isFrom = from === i
          const canTake = takeable.includes(i)
          const canSwap = changeable && !!s.card && !!actorPlayer && canTakeCard(actorPlayer, s.card)
          const enabled = canTake || canSwap || (changeable && isFrom)
          const action = canTake ? () => onTake(i) : changeable ? () => onChange(i) : undefined
          return (
            <button
              key={i}
              type="button"
              disabled={!enabled}
              onClick={action}
              className={`relative flex flex-col items-center rounded-none border-2 border-dashed p-1 transition duration-200 active:scale-95 ${
                enabled ? 'animate-glow border-amber-300 bg-amber-300/15 hover:-translate-y-0.5' : 'border-red-400/70 bg-black/15'
              } ${phase.kind === 'choose' && !canTake ? 'opacity-45' : ''}`}
              aria-label={
                isFrom
                  ? '取った組を城の上に戻す'
                  : s.card
                    ? `${CARD_NAMES[s.card.kind]}${s.piece ? `と${PIECE_NAMES[s.piece.kind]}` : ''}の組${canSwap ? 'に取り直す' : ''}`
                    : '空き'
              }
            >
              {isFrom ? (
                <>
                  <span className="flex aspect-square w-full flex-col items-center justify-center rounded-none border border-white/40 text-[11px] leading-tight font-bold">
                    取った組
                    <span className="mt-0.5 rounded-none bg-white/20 px-1 py-0.5 text-[10px]">押すと戻す</span>
                  </span>
                  <span className="h-[calc(50%-0.75rem)]" />
                </>
              ) : (
                <>
                  {s.card ? (
                    <span key={s.card.id} className="block w-full animate-deal" style={{ animationDelay: `${i * 60}ms` }}>
                      <CardImage card={s.card} className="w-full rounded-none" />
                    </span>
                  ) : (
                    <EmptyCard />
                  )}
                  <span key={s.piece?.id ?? 'none'} className="-mt-3 w-1/2 animate-pop" style={{ animationDelay: `${120 + i * 60}ms` }}>
                    {s.piece ? <PieceImage piece={s.piece} className="w-full" /> : <EmptyPiece />}
                  </span>
                </>
              )}
              {s.card && !isFrom && <span className="mt-0.5 text-[10px] leading-none font-bold opacity-90">{CARD_NAMES[s.card.kind]}</span>}
            </button>
          )
        })}
      </div>
      {phase.kind === 'place' && !changeable && (
        <p className="mt-2 text-[11px] text-white/70">何か置いたあとは選び直せません（「↩ 戻す」で取り消せます）。</p>
      )}
    </section>
  )
}

function EmptyCard() {
  return <span className="block aspect-square w-full rounded-none border border-dashed border-white/30 bg-black/10" />
}
function EmptyPiece() {
  return <span className="block aspect-square w-full rounded-full border border-dashed border-white/30 bg-black/20" />
}

// ---------------------------------------------------------------- キープ

function KeepPanel({
  player,
  usable,
  battle,
  battlePick,
  sel,
  rot,
  onSelect,
  onTogglePick,
}: {
  player: Player
  usable: boolean
  battle: boolean
  battlePick: string[]
  sel: Sel
  rot: number
  onSelect: (s: Sel) => void
  onTogglePick: (k: string) => void
}) {
  return (
    <section className="frame bg-paper-0/80 p-3 text-ink-0 md:h-full lg:h-auto">
      <PanelTitle icon="📦" title={`${player.name}のキープ`} sub={`カード${KEEP_LIMIT}枚・コマ${KEEP_LIMIT}個まで${usable ? '／押すと村に出せる' : ''}`} />
      <div className="flex items-end gap-2">
        {Array.from({ length: KEEP_LIMIT }).map((_, i) => {
          const c = player.keepCards[i]
          const active = sel?.k === 'kcard' && sel.i === i
          return (
            <button
              key={`c${i}`}
              type="button"
              disabled={!c || !usable}
              onClick={() => onSelect({ k: 'kcard', i })}
              className={`flex w-[22%] max-w-20 flex-col items-center gap-0.5 rounded-none border-2 border-dashed p-1 ${
                active ? 'border-amber-500 bg-amber-100 ring-2 ring-amber-500' : 'border-[#9b9584]'
              }`}
              aria-label={c ? `キープの${CARD_NAMES[c.kind]}カード` : 'カードの空き'}
            >
              {c ? (
                <CardImage card={c} rot={active ? rot : 0} className="w-full rounded-none" />
              ) : (
                <span className="flex aspect-square w-full items-center justify-center text-[10px] text-[#9b9584]">カード</span>
              )}
            </button>
          )
        })}
        <span className="mx-1 self-stretch border-l border-dashed border-[#9b9584]" />
        {Array.from({ length: KEEP_LIMIT }).map((_, i) => {
          const pc = player.keepPieces[i]
          const active = sel?.k === 'kpiece' && sel.i === i
          const picked = battlePick.includes(`k${i}`)
          return (
            <button
              key={`p${i}`}
              type="button"
              disabled={!pc || !(usable || battle)}
              onClick={() => (battle ? onTogglePick(`k${i}`) : onSelect({ k: 'kpiece', i }))}
              className={`flex aspect-square w-[16%] max-w-14 items-center justify-center rounded-full border-2 border-dashed p-0.5 ${
                active || picked ? 'border-amber-500 ring-4 ring-amber-400' : 'border-[#9b9584]'
              }`}
              aria-label={pc ? `キープの${PIECE_NAMES[pc.kind]}コマ` : 'コマの空き'}
            >
              {pc ? <PieceImage piece={pc} className="w-full" /> : <span className="text-[10px] text-[#9b9584]">コマ</span>}
            </button>
          )
        })}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------- 手元（下に固定）

function ActionTray({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 animate-rise sm:px-2 sm:pb-2">
      <div className="frame mx-auto max-w-[1400px] bg-paper-0/95 p-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] shadow-[0_-10px_28px_-8px_rgb(43_42_38/0.35)] backdrop-blur">
        {children}
      </div>
    </div>
  )
}

function HandTray({
  holding,
  player,
  sel,
  rot,
  onSelect,
  onRotate,
  onKeepCard,
  onKeepPiece,
  onCancel,
}: {
  holding: { card: Card | null; piece: Piece | null } | null
  player: Player
  sel: Sel
  rot: number
  onSelect: (s: Exclude<Sel, null>) => void
  onRotate: () => void
  onKeepCard: () => void
  onKeepPiece: () => void
  onCancel: () => void
}) {
  const fromKeep = sel?.k === 'kcard' || sel?.k === 'kpiece'
  const keepCard = sel?.k === 'kcard' ? player.keepCards[sel.i] : null
  const keepPiece = sel?.k === 'kpiece' ? player.keepPieces[sel.i] : null
  const cardSelected = sel?.k === 'hcard' || sel?.k === 'kcard'

  return (
    <div>
      <p className="mb-2 flex items-center gap-2 text-xs text-ink-0">
        <span className="dia text-[8px]" />
        <span className="ttl text-sm">手元</span>
        <span className="lbl text-[9px] text-ink-3">Hand</span>
        <span className="text-ink-2">
          {fromKeep ? '（キープから出す）' : '（いま置くもの）'}— 選んで、光るマスを押す
        </span>
      </p>
      <div className="flex items-stretch gap-2">
        {holding?.card && (
          <HandItem active={sel?.k === 'hcard'} onClick={() => onSelect({ k: 'hcard' })} label={`${CARD_NAMES[holding.card.kind]}カード`}>
            <CardImage card={holding.card} rot={sel?.k === 'hcard' ? rot : 0} className="h-full w-full rounded-none" />
          </HandItem>
        )}
        {holding?.piece && (
          <HandItem active={sel?.k === 'hpiece'} onClick={() => onSelect({ k: 'hpiece' })} label={`${PIECE_NAMES[holding.piece.kind]}・強さ${STRENGTH[holding.piece.kind]}`}>
            <PieceImage piece={holding.piece} className="h-[85%]" />
          </HandItem>
        )}
        {keepCard && (
          <HandItem active onClick={onRotate} label={`${CARD_NAMES[keepCard.kind]}カード`}>
            <CardImage card={keepCard} rot={rot} className="h-full w-full rounded-none" />
          </HandItem>
        )}
        {keepPiece && (
          <HandItem active onClick={() => {}} label={`${PIECE_NAMES[keepPiece.kind]}・強さ${STRENGTH[keepPiece.kind]}`}>
            <PieceImage piece={keepPiece} className="h-[85%]" />
          </HandItem>
        )}
        <div className="ml-auto flex flex-col justify-center gap-1.5">
          {cardSelected && (
            <button type="button" onClick={onRotate} className="bg-ink-1 px-4 py-2.5 text-sm text-paper-0 transition hover:bg-ink-0 active:translate-y-px">
              ⟳ 回す
            </button>
          )}
          {sel?.k === 'hcard' && (
            <button
              type="button"
              disabled={player.keepCards.length >= KEEP_LIMIT}
              onClick={onKeepCard}
              className="border border-ink-1/60 bg-paper-0 px-4 py-2 text-sm text-ink-0 transition hover:bg-ink-1 hover:text-paper-0 disabled:opacity-35"
            >
              キープへ
            </button>
          )}
          {sel?.k === 'hpiece' && (
            <button
              type="button"
              disabled={player.keepPieces.length >= KEEP_LIMIT}
              onClick={onKeepPiece}
              className="border border-ink-1/60 bg-paper-0 px-4 py-2 text-sm text-ink-0 transition hover:bg-ink-1 hover:text-paper-0 disabled:opacity-35"
            >
              キープへ
            </button>
          )}
          {fromKeep && (
            <button type="button" onClick={onCancel} className="border border-ink-1/30 px-4 py-2 text-sm text-ink-2 hover:bg-paper-2">
              やめる
            </button>
          )}
        </div>
      </div>
      {cardSelected && (sel?.k === 'hcard' ? holding?.card : keepCard)?.kind === 'straight' && (
        <p className="mt-1 text-[11px] text-stone-600">直線カードは川の上にも置けます。</p>
      )}
    </div>
  )
}

function HandItem({ active, onClick, label, children }: { active: boolean; onClick: () => void; label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex w-[5.5rem] flex-col items-center gap-1 border p-1.5 transition-all duration-200 active:scale-95 ${
        active ? '-translate-y-1 border-ink-1 bg-paper-0 shadow-[0_8px_16px_-8px_rgb(43_42_38/0.5)]' : 'border-ink-1/20 bg-paper-2/50 opacity-70 hover:opacity-100'
      }`}
    >
      {active && <span className="dia absolute -top-1.5 left-1/2 -translate-x-1/2 text-[8px] text-ink-1" />}
      <span className="flex h-[4.5rem] w-[4.5rem] items-center justify-center">{children}</span>
      <span className="text-[11px] leading-none text-ink-0">{label}</span>
    </button>
  )
}

function BigButton({ tone, disabled, onClick, children }: { tone: 'rose' | 'amber' | 'stone'; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  const color = { rose: 'bg-rose-700', amber: 'bg-amber-600', stone: 'bg-stone-600' }[tone]
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`${color} ttl min-h-12 px-6 py-3 tracking-widest text-paper-0 active:translate-y-px disabled:opacity-35 ${tone === 'stone' ? 'w-full' : ''}`}>
      {children}
    </button>
  )
}

// ---------------------------------------------------------------- 合戦

function BattleResult({ game }: { game: GameState }) {
  const b = game.battle!
  return (
    <section className="frame bg-paper-0/80 p-3 text-sm text-ink-0">
      <PanelTitle icon="⚔" title="直近の合戦" />
      <ul className="space-y-1.5">
        {b.entries.map((e) => (
          <li key={e.player} className="flex flex-wrap items-center gap-1">
            <span className="mr-1 inline-block h-2 w-2 rotate-45" style={{ background: PLAYER_COLORS[e.player] }} />
            <span className="font-bold">{game.players[e.player].name}</span>
            {e.pieces.map((pc) => (
              <PieceImage key={pc.id} piece={pc} className="w-6" showStrength={false} />
            ))}
            <span>強さ{e.strength}</span>
            {e.dice.map((d, i) => (
              <span key={i} className="text-rose-800">
                {i === 0 ? '+' : '／振り直し'} <span className="num">{d[0]}+{d[1]}</span>
              </span>
            ))}
            {e.dice.length > 0 && <span className="font-black">= {e.strength + e.dice[0][0] + e.dice[0][1]}</span>}
          </li>
        ))}
      </ul>
      {b.winner !== null && <p className="ttl mt-2 border-t border-ink-0/15 pt-2">功労者　{game.players[b.winner].name}</p>}
    </section>
  )
}
