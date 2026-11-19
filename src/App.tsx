import { useState } from 'react'
import face from './assets/game/maroinu-face.jpg'
import maroinu from './assets/game/maroinu.jpg'
import { PLAYER_COLORS } from './components/colors'
import { GameScreen } from './components/GameScreen'
import { RotateHint } from './components/RotateHint'
import { HintBar, InkButton, MenuRow, Panel, SysBar } from './components/ui'
import { useStore } from './store'
import type { RulesId } from './tutorial/rulesets'
import { Tutorial, type TutorialMode } from './tutorial/Tutorial'

const DEFAULT_NAMES = ['プレイヤー1', 'プレイヤー2', 'プレイヤー3', 'プレイヤー4']

function Setup({ onLearn }: { onLearn: (m: TutorialMode, r: RulesId) => void }) {
  const [rules, setRules] = useState<RulesId>('short')
  const start = useStore((s) => s.start)
  const [count, setCount] = useState(4)
  const [names, setNames] = useState(DEFAULT_NAMES)

  return (
    <div className="flex min-h-dvh flex-col">
      <SysBar
        left={
          <>
            <span className="ttl text-sm">まろいぬの覇道</span>
            <span className="lbl text-[10px] text-ink-3">Main Menu</span>
          </>
        }
        sub="Board Game · Maro"
        right={<span className="lbl text-[10px] text-ink-3">2–4 Players</span>}
      />

      <main className="mx-auto grid w-full max-w-[1200px] flex-1 gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-10 lg:px-8 lg:py-10">
        {/* 左: 題と絵 */}
        <section className="flex flex-col gap-5">
          <div>
            <p className="lbl text-[11px] text-ink-3">Sengoku Road Building Game</p>
            <h1 className="ttl mt-1 text-[clamp(2.4rem,6vw,4.2rem)] leading-[1.05] text-ink-0">まろいぬの覇道</h1>
            <div className="mt-3 flex items-center gap-3">
              <span className="h-px w-10 bg-ink-1" />
              <p className="text-sm text-ink-2">そなたの城から我の城まで、街道をつなげてくれまろ</p>
            </div>
          </div>
          <figure className="frame bg-paper-0/60 p-2">
            <img src={maroinu} alt="まろいぬ" className="aspect-[16/10] w-full object-cover object-[50%_22%]" />
            <figcaption className="flex items-center justify-between px-1 pt-2 text-[11px] text-ink-3">
              <span>お殿様　まろいぬ</span>
              <span className="lbl text-[9px]">Fig. 01</span>
            </figcaption>
          </figure>
          <p className="max-w-prose text-sm leading-relaxed text-ink-2">
            道カードで、自分の館からお殿様の城まで街道をつなごう。だれかがつないだらゲーム終了。得点のいちばん高い人の勝ちです。
          </p>
        </section>

        {/* 右: 対局とルール */}
        <section className="flex flex-col gap-5 lg:pt-6">
          <Panel title="対局" en="New Game">
            <p className="lbl mb-1.5 text-[10px] text-ink-3">Players</p>
            <div className="grid grid-cols-3 border border-ink-1/50">
              {[2, 3, 4].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCount(n)}
                  className={`border-r border-ink-1/30 py-2.5 last:border-r-0 transition-colors ${count === n ? 'bg-ink-1 text-paper-0' : 'hover:bg-paper-2'}`}
                >
                  <span className="num text-lg">{n}</span>
                  <span className="ml-1 text-xs">人</span>
                </button>
              ))}
            </div>
            <p className="lbl mt-4 mb-1 text-[10px] text-ink-3">Order of Play</p>
            <ol className="flex flex-col">
              {names.slice(0, count).map((n, i) => (
                <li key={i} className="flex items-center gap-3 border-b border-ink-0/15 py-1.5">
                  <span className="num w-5 text-xs text-ink-3">{String(i + 1).padStart(2, '0')}</span>
                  <span className="h-2.5 w-2.5 shrink-0 rotate-45" style={{ background: PLAYER_COLORS[i] }} />
                  <input
                    value={n}
                    onChange={(e) => setNames((ns) => ns.map((v, j) => (j === i ? e.target.value : v)))}
                    className="min-w-0 flex-1 bg-transparent px-1 py-1 text-base outline-none focus:bg-paper-2/70"
                    aria-label={`${i + 1}人目の名前`}
                  />
                </li>
              ))}
            </ol>
            <InkButton onClick={() => start(names.slice(0, count).map((n, i) => n.trim() || DEFAULT_NAMES[i]))} className="mt-4 w-full">
              対局をはじめる
            </InkButton>
          </Panel>

          <Panel title="ルールを知る" en="Learn">
            <div className="relative mt-8 mb-3 grid grid-cols-2 border border-ink-1/50" role="tablist" aria-label="ルールの版">
              {(
                [
                  ['short', '短縮版', 'すぐ遊べる短いルール'],
                  ['full', '通常版', '寺・僧・祭・特殊効果'],
                ] as const
              ).map(([id, name, sub]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={rules === id}
                  onClick={() => setRules(id)}
                  className={`border-r border-ink-1/30 px-2 py-2 text-center last:border-r-0 transition-colors ${rules === id ? 'bg-ink-1 text-paper-0' : 'hover:bg-paper-2'}`}
                >
                  <b className="ttl block text-sm">{name}</b>
                  <span className="block text-[10px] opacity-70">{sub}</span>
                </button>
              ))}
              {rules === 'short' && (
                <button
                  type="button"
                  onClick={() => setRules('full')}
                  className="absolute -top-9 right-0 flex animate-pop items-center gap-1.5 border border-ink-1 bg-paper-0 py-0.5 pr-2.5 pl-0.5 text-xs text-ink-0 shadow-[2px_2px_0_rgb(43_42_38/0.2)] transition hover:-translate-y-0.5"
                >
                  <img src={face} alt="" className="h-6 w-6 animate-[talk_0.9s_ease-in-out_infinite_alternate] object-cover" />
                  通常版は<b className="text-shu">ここを押す</b>まろ
                  <span aria-hidden className="absolute -bottom-[5px] right-[24%] h-2 w-2 rotate-45 border-r border-b border-ink-1 bg-paper-0" />
                </button>
              )}
            </div>
            <div className="border-t border-ink-0/12">
              <MenuRow
                onClick={() => onLearn('maro', rules)}
                icon={<img src={face} alt="" className="h-10 w-10 shrink-0 border border-ink-1/40 object-cover" />}
                title="まろいぬに教わる"
                sub="まろいぬがしゃべって、遊びながら案内する"
              />
              <MenuRow
                onClick={() => onLearn('guide', rules)}
                icon={
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-current/40">
                    <span className="dia text-[12px]" />
                  </span>
                }
                title="ルールガイド"
                sub={`図を動かしながら、ルールブックの順に${rules === 'short' ? '7' : '8'}章で`}
              />
            </div>
          </Panel>
        </section>
      </main>

      <HintBar left="1台の端末を回して遊ぶ「交代プレイ」です" hints={[['◯', '選ぶ'], ['▸', '進む']]} />
    </div>
  )
}

export default function App() {
  return (
    <>
      <Screen />
      <RotateHint />
    </>
  )
}

function Screen() {
  const game = useStore((s) => s.game)
  const [learn, setLearn] = useState<{ mode: TutorialMode; rules: RulesId } | null>(null)
  if (game) return <GameScreen />
  if (learn)
    return (
      <Tutorial
        key={`${learn.mode}-${learn.rules}`}
        mode={learn.mode}
        rules={learn.rules}
        onSwitchRules={(rules) => setLearn({ ...learn, rules })}
        onClose={() => setLearn(null)}
        onPlay={() => {
          setLearn(null)
          setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 50)
        }}
      />
    )
  return <Setup onLearn={(mode, rules) => setLearn({ mode, rules })} />
}
