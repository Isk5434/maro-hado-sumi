import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import face from '../assets/game/maroinu-face.jpg'
import maroinu from '../assets/game/maroinu.jpg'
import { Rich, plainLength } from './kit'
import { RULESETS, RulesContext, useRules, type RulesId } from './rulesets'

export type TutorialMode = 'guide' | 'maro'

const storeKey = (mode: TutorialMode, rules: RulesId) => `maro-hado:tutorial:${rules === 'short' ? '' : 'full:'}${mode}`
function loadStep(mode: TutorialMode, rules: RulesId) {
  try {
    const n = Number(localStorage.getItem(storeKey(mode, rules)))
    return Number.isInteger(n) && n >= 0 && n < RULESETS[rules].steps.length ? n : 0
  } catch {
    return 0
  }
}

export function Tutorial({
  mode,
  rules,
  onClose,
  onPlay,
  onSwitchRules,
}: {
  mode: TutorialMode
  rules: RulesId
  onClose: () => void
  onPlay: () => void
  onSwitchRules: (r: RulesId) => void
}) {
  const ruleset = RULESETS[rules]
  const STEPS = ruleset.steps
  const [index, setIndex] = useState(() => loadStep(mode, rules))
  const [doneSet, setDoneSet] = useState<Set<number>>(new Set())
  const step = STEPS[index]
  const done = !step.task || doneSet.has(index)
  const last = index === STEPS.length - 1

  useEffect(() => {
    try {
      localStorage.setItem(storeKey(mode, rules), String(index))
    } catch {
      /* 保存できなくても続ける */
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [index, mode, rules])

  const go = useCallback((n: number) => setIndex(Math.max(0, Math.min(STEPS.length - 1, n))), [STEPS.length])
  // やり終えた瞬間に紙吹雪を出す
  const [burst, setBurst] = useState(0)
  const markDone = useCallback(() => {
    if (doneSet.has(index)) return
    setDoneSet((s) => new Set(s).add(index))
    setBurst((b) => b + 1)
  }, [index, doneSet])

  const Stage = step.Stage
  const stage = (
    <TiltStage>
      <section className="relative overflow-hidden rounded-none bg-teal-board p-3 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.5)] sm:p-4 lg:p-5">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)', backgroundSize: '14px 14px' }}
        />
        {/* PC: 舞台の上に章番号を大きく */}
        <div key={`h${index}`} className="relative mb-3 hidden animate-fade items-end gap-3 text-white lg:flex">
          <span className="text-5xl leading-none font-black text-transparent [-webkit-text-stroke:1.5px_rgba(255,255,255,0.55)]">
            {String(step.chapter + 1).padStart(2, '0')}
          </span>
          <span className="pb-0.5">
            <span className="lbl block text-[10px] text-paper-0/55">
              Chapter {String(step.chapter + 1).padStart(2, '0')} · <span className="tracking-[0.1em] normal-case">{ruleset.chapters[step.chapter]}</span>
            </span>
            <span className="ttl block text-xl leading-tight">{step.title}</span>
          </span>
          <span className="dots mb-2 flex-1 opacity-40 invert" />
          <span className="num pb-0.5 text-xs text-paper-0/60">
            {String(index + 1).padStart(2, '0')} / {String(STEPS.length).padStart(2, '0')}
          </span>
        </div>
        <div className="relative">
          <Stage key={index} done={done} onDone={markDone} />
        </div>
        {burst > 0 && <Burst key={burst} />}
      </section>
    </TiltStage>
  )

  const t = ruleset.theme
  const layout: LayoutProps = {
    index,
    done,
    last,
    stage,
    doneSet,
    onJump: go,
    onPrev: () => go(index - 1),
    onNext: () => go(index + 1),
    onPlay: rules === 'full' ? onClose : onPlay,
    onRestart: () => go(0),
  }
  return (
    <RulesContext.Provider value={ruleset}>
      <div
        className="relative min-h-dvh overflow-x-clip"
        style={{ ['--color-teal-board' as string]: t.board }}
      >
        {/* PC: うしろでゆっくり動く色のにじみ */}
        <div aria-hidden className="pointer-events-none fixed inset-0 hidden lg:block">
          <span className="absolute -top-24 -left-24 h-[28rem] w-[28rem] animate-[float_14s_ease-in-out_infinite] rounded-full bg-teal-board opacity-[0.06] blur-3xl" />
          <span
            className="absolute -right-32 bottom-0 h-[32rem] w-[32rem] animate-[float_18s_ease-in-out_infinite] rounded-full opacity-[0.05] blur-3xl"
            style={{ background: t.accent, ['--fx' as string]: '-40px', ['--fy' as string]: '30px' }}
          />
                  </div>
        <div className="relative">
          <ProgressHeader mode={mode} index={index} onJump={go} onClose={onClose} onSwitchRules={onSwitchRules} />
          {mode === 'guide' ? <GuideLayout {...layout} /> : <MaroLayout {...layout} />}
        </div>
      </div>
    </RulesContext.Provider>
  )
}

// ---------------------------------------------------------------- PC の演出

/** マウスに合わせて、舞台がほんの少し手前に傾く（PCのみ） */
function TiltStage({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [enabled] = useState(() => {
    try {
      return window.matchMedia('(hover: hover) and (min-width: 1024px) and (prefers-reduced-motion: no-preference)').matches
    } catch {
      return false
    }
  })
  const [tilt, setTilt] = useState({ x: 0, y: 0, gx: 50, gy: 50, on: false })
  if (!enabled) return <>{children}</>
  return (
    <div
      ref={ref}
      className="[perspective:1400px]"
      onPointerMove={(e) => {
        if (e.pointerType !== 'mouse' || e.buttons) return
        const r = ref.current!.getBoundingClientRect()
        const px = (e.clientX - r.left) / r.width
        const py = (e.clientY - r.top) / r.height
        setTilt({ x: (0.5 - py) * 3, y: (px - 0.5) * 4, gx: px * 100, gy: py * 100, on: true })
      }}
      onPointerLeave={() => setTilt((t) => ({ ...t, x: 0, y: 0, on: false }))}
    >
      <div className="relative transition-transform duration-300 ease-out" style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }}>
        {children}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-none transition-opacity duration-300"
          style={{
            opacity: tilt.on ? 1 : 0,
            background: `radial-gradient(circle at ${tilt.gx}% ${tilt.gy}%, rgba(255,255,255,0.14), transparent 45%)`,
          }}
        />
      </div>
    </div>
  )
}

const BURST_COLORS = ['#c8b47c', '#a8532f', '#8d966e', '#7f8c96', '#bfb3a3', '#f1eee6']

/** やり終えたときの紙吹雪と「見事！」 */
function Burst() {
  const [bits] = useState(() =>
    Array.from({ length: 26 }, (_, i) => {
      const a = (i / 26) * Math.PI * 2 + Math.random() * 0.4
      const d = 90 + Math.random() * 140
      return { dx: Math.cos(a) * d, dy: Math.sin(a) * d - 40, r: Math.random() * 540 - 270, c: BURST_COLORS[i % BURST_COLORS.length], w: 6 + Math.random() * 6, delay: Math.random() * 120 }
    }),
  )
  const [show, setShow] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setShow(false), 1300)
    return () => clearTimeout(t)
  }, [])
  if (!show) return null
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-40 overflow-hidden">
      {bits.map((b, i) => (
        <span
          key={i}
          className="absolute top-1/2 left-1/2 rounded-none"
          style={{
            width: b.w,
            height: b.w * 0.45,
            background: b.c,
            ['--dx' as string]: `${b.dx}px`,
            ['--dy' as string]: `${b.dy}px`,
            ['--r' as string]: `${b.r}deg`,
            animation: `burst 1s cubic-bezier(0.15, 0.7, 0.3, 1) ${b.delay}ms both`,
          }}
        />
      ))}
      <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <span className="block rotate-[-8deg]">
          <span className="block animate-pop border-[3px] border-shu bg-paper-0/90 px-5 py-1.5 text-shu shadow-[0_8px_24px_rgb(43_42_38/0.35)]">
            <span className="ttl block text-3xl leading-none tracking-[0.3em]">見事</span>
            <span className="lbl mt-1 block text-center text-[8px]">Clear</span>
          </span>
        </span>
      </span>
    </div>
  )
}

/** PC: 章と手順の目次 */
function Toc({ index, doneSet, onJump }: { index: number; doneSet: Set<number>; onJump: (n: number) => void }) {
  const { steps, chapters } = useRules()
  return (
    <nav aria-label="目次" className="sticky top-32 hidden max-h-[calc(100dvh-9rem)] overflow-y-auto pr-1 xl:block">
      <p className="mb-3 flex items-center gap-2">
        <span className="ttl text-sm">目次</span>
        <span className="lbl text-[9px] text-ink-3">Contents</span>
        <span className="dots flex-1" />
      </p>
      <ol className="flex flex-col gap-3">
        {chapters.map((name, c) => (
          <li key={name}>
            <p className="mb-1 flex items-center gap-2 text-ink-1">
              <span className="num flex h-5 w-7 items-center justify-center bg-teal-board text-[10px] text-paper-0">{String(c + 1).padStart(2, '0')}</span>
              <span className="ttl text-[13px]">{name}</span>
            </p>
            <ol className="flex flex-col gap-0.5 border-l-2 border-stone-300/70 pl-2">
              {steps.map((s, i) =>
                s.chapter !== c ? null : (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => onJump(i)}
                      className={`flex w-full items-center gap-1.5 rounded-none px-2 py-1 text-left text-[12px] leading-snug font-bold transition-all duration-200 ${
                        i === index ? 'translate-x-1 bg-teal-board text-white shadow' : 'text-stone-600 hover:translate-x-1 hover:bg-white/70'
                      }`}
                    >
                      <span className="w-3 shrink-0 text-center text-[10px]">{doneSet.has(i) ? '✓' : s.task ? '◇' : '·'}</span>
                      <span className="truncate">{s.title}</span>
                    </button>
                  </li>
                ),
              )}
            </ol>
          </li>
        ))}
      </ol>
      <p className="mt-4 border-t border-ink-0/15 pt-2 text-[11px] text-ink-3">◇ やってみるステップ　✓ できた</p>
    </nav>
  )
}

// ---------------------------------------------------------------- 上部の進み具合

function ProgressHeader({
  mode,
  index,
  onJump,
  onClose,
  onSwitchRules,
}: {
  mode: TutorialMode
  index: number
  onJump: (n: number) => void
  onClose: () => void
  onSwitchRules: (r: RulesId) => void
}) {
  const { steps: STEPS, chapters: CHAPTERS, id, name: rulesName, theme } = useRules()
  const step = STEPS[index]
  const [popOpen, setPopOpen] = useState(true)
  const other: RulesId = id === 'short' ? 'full' : 'short'
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    <header className="sticky top-0 z-30 border-b border-ink-0/25 bg-paper-0/85 backdrop-blur-sm">
      <div className="mx-auto max-w-[1400px] px-3 pt-2 pb-2 lg:px-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center border border-ink-1/40 text-ink-2 transition-colors hover:bg-ink-1 hover:text-paper-0"
            aria-label="閉じる"
          >
            ✕
          </button>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="lbl text-[9px] text-ink-3">{mode === 'guide' ? 'Rule Guide' : 'Tutorial · Lord Maroinu'}</p>
            <p className="flex items-center gap-2 truncate">
              <span className="ttl text-base">{mode === 'guide' ? 'ルールガイド' : 'まろいぬに教わる'}</span>
              <span className="shrink-0 bg-teal-board px-1.5 py-0.5 text-[10px] leading-none text-paper-0">{rulesName}</span>
            </p>
          </div>
          <p className="num shrink-0 text-right leading-none">
            <span className="text-xl text-ink-0">{pad(index + 1)}</span>
            <span className="text-xs text-ink-3"> / {pad(STEPS.length)}</span>
          </p>
        </div>
        {popOpen && (
          <div className="mt-2 flex animate-pop items-center gap-2">
            <button
              type="button"
              onClick={() => onSwitchRules(other)}
              className="group flex min-w-0 flex-1 items-center gap-2 border border-ink-1/50 bg-paper-0 py-1 pr-3 pl-1 text-left shadow-[2px_2px_0_rgb(43_42_38/0.15)] transition hover:-translate-y-0.5 hover:shadow-[3px_4px_0_rgb(43_42_38/0.18)]"
            >
              <img src={face} alt="" className="h-7 w-7 shrink-0 animate-[talk_0.9s_ease-in-out_infinite_alternate] border border-ink-1/30 object-cover" />
              <span className="min-w-0 truncate text-[13px] text-ink-1">
                {other === 'full' ? '通常版' : '短縮版'}のルールは<b className="mx-0.5 text-shu">ここを押す</b>まろ
              </span>
              <span className="lbl ml-auto hidden shrink-0 text-[9px] text-ink-3 sm:inline">Switch</span>
              <span className="shrink-0 text-ink-1 transition group-hover:translate-x-1">→</span>
            </button>
            <button
              type="button"
              onClick={() => setPopOpen(false)}
              className="h-8 w-8 shrink-0 text-sm text-ink-3 transition-colors hover:bg-paper-2"
              aria-label="案内を閉じる"
              data-theme={theme.accent}
            >
              ✕
            </button>
          </div>
        )}
        <ol className="mt-2 flex gap-[3px]" aria-label="章">
          {CHAPTERS.map((name, c) => {
            const steps = STEPS.map((s, i) => [s, i] as const).filter(([s]) => s.chapter === c)
            const first = steps[0][1]
            const passed = steps.filter(([, i]) => i < index).length + (step.chapter === c ? 1 : 0)
            const current = step.chapter === c
            return (
              <li key={name} className="min-w-0" style={{ flex: steps.length }}>
                <button type="button" onClick={() => onJump(first)} className="group block w-full text-left" aria-label={`${name}の章へ`} aria-current={current ? 'step' : undefined}>
                  <span className={`relative block h-[5px] overflow-hidden ${current ? 'bg-paper-3' : 'bg-paper-3/50'}`}>
                    <span className="block h-full bg-teal-board transition-[width] duration-500 ease-out" style={{ width: `${(passed / steps.length) * 100}%` }} />
                  </span>
                  <span
                    className={`mt-1 flex items-baseline gap-1 text-[10px] leading-none transition-colors ${current ? 'overflow-visible whitespace-nowrap text-ink-0' : 'hidden truncate text-ink-3 group-hover:text-ink-1 sm:flex'}`}
                  >
                    <span className="num text-[9px] opacity-70">{pad(c + 1)}</span>
                    <span className={current ? 'font-bold' : ''}>{name}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </div>
    </header>
  )
}

function ChapterTag({ index }: { index: number }) {
  const { steps: STEPS, chapters: CHAPTERS } = useRules()
  const c = STEPS[index].chapter
  return (
    <p className="flex items-center gap-2">
      <span className="lbl text-[10px] text-ink-3">Chapter {String(c + 1).padStart(2, '0')}</span>
      <span className="ttl text-sm text-ink-1">{CHAPTERS[c]}</span>
      <span className="dots flex-1" />
    </p>
  )
}

type LayoutProps = {
  index: number
  done: boolean
  last: boolean
  stage: React.ReactNode
  doneSet: Set<number>
  onJump: (n: number) => void
  onPrev: () => void
  onNext: () => void
  onPlay: () => void
  onRestart: () => void
}

function useKeys(onPrev: () => void, onNext: () => void) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (e.key === 'ArrowRight') onNext()
      if (e.key === 'ArrowLeft') onPrev()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onPrev, onNext])
}

function EndButtons({ onPlay, onRestart }: { onPlay: () => void; onRestart: () => void }) {
  const { id } = useRules()
  // 通常版のゲームはまだ無いので、通常版の説明の最後はタイトルに戻る（onPlay には閉じる処理が入る）
  return (
    <div className="flex flex-col gap-1.5">
    {id === 'full' && <p className="text-center text-[11px] text-ink-3">通常版のゲームは準備中です</p>}
    <div className="flex gap-2">
      <button type="button" onClick={onRestart} className="border border-ink-1/50 bg-paper-0/70 px-4 py-3 text-sm text-ink-1 transition-colors hover:bg-ink-1 hover:text-paper-0">
        最初から
      </button>
      <button type="button" onClick={onPlay} className="ink-btn flex flex-1 items-center justify-center gap-3 bg-ink-1 px-4 py-3 text-paper-0 shadow-md active:scale-[0.98]">
        <span aria-hidden className="gem gem-l" />
        <span className="ttl tracking-[0.15em]">{id === 'full' ? 'タイトルにもどる' : 'ゲームをはじめる'}</span>
        <span aria-hidden className="gem gem-r" />
      </button>
    </div>
    </div>
  )
}

// ---------------------------------------------------------------- ルールガイド版

const MAIN_GRID =
  'mx-auto grid max-w-5xl gap-3 px-3 pt-3 lg:max-w-6xl lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-6 lg:px-6 lg:pt-5 lg:pb-4 xl:max-w-[1400px] xl:grid-cols-[230px_minmax(0,1fr)_400px]'

function GuideLayout({ index, done, last, stage, doneSet, onJump, onPrev, onNext, onPlay, onRestart }: LayoutProps) {
  const { steps: STEPS } = useRules()
  const step = STEPS[index]
  useKeys(onPrev, onNext)
  return (
    <>
      <main className={`${MAIN_GRID} pb-28`}>
        <Toc index={index} doneSet={doneSet} onJump={onJump} />
        <div className="lg:sticky lg:top-32">{stage}</div>
        <article key={index} className="flex animate-fade flex-col gap-3 lg:sticky lg:top-32">
          <ChapterTag index={index} />
          <h2 className="text-2xl leading-tight text-ink-0 lg:text-[2rem]">{step.title}</h2>
          <div className="flex flex-col gap-2 text-[15px] leading-relaxed text-ink-1 lg:text-base lg:leading-loose">
            {step.body.map((p, i) => (
              <p key={i}>
                <Rich text={p} />
              </p>
            ))}
          </div>
          {step.task && (
            <p className={`frame flex items-center gap-3 px-3 py-2.5 text-sm transition-colors duration-300 ${done ? 'bg-ink-1 text-paper-0' : 'bg-paper-0/80 text-ink-0'}`}>
              <span className={`lbl shrink-0 border px-2 py-1 text-[10px] ${done ? 'border-brass text-brass' : 'border-ink-1/50'}`}>{done ? 'Clear' : 'Try'}</span>
              {done ? <span key="d" className="gem-enter h-2.5 w-2.5 shrink-0 bg-brass" /> : <span key="t" className="dia turn-gem shrink-0 text-[9px] text-shu" />}
              <span>{done ? 'できました' : step.task}</span>
            </p>
          )}
          <div className="hidden lg:block">
            <NavButtons index={index} done={done} last={last} onPrev={onPrev} onNext={onNext} onPlay={onPlay} onRestart={onRestart} />
            <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-ink-3">
              <kbd className="num border border-ink-1/40 px-1.5">←</kbd>
              <kbd className="num border border-ink-1/40 px-1.5">→</kbd>
              キーでも移動できます
            </p>
          </div>
        </article>
      </main>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-0/25 bg-paper-0/90 px-3 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] backdrop-blur-sm lg:hidden">
        <div className="md:mx-auto md:max-w-3xl">
        <NavButtons index={index} done={done} last={last} onPrev={onPrev} onNext={onNext} onPlay={onPlay} onRestart={onRestart} />
        </div>
      </div>
    </>
  )
}

function NavButtons({ index, done, last, onPrev, onNext, onPlay, onRestart }: Omit<LayoutProps, 'stage' | 'doneSet' | 'onJump'>) {
  if (last) return <EndButtons onPlay={onPlay} onRestart={onRestart} />
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={onPrev}
        disabled={index === 0}
        className="border border-ink-1/50 bg-paper-0/70 px-4 py-3 text-ink-1 transition-colors hover:bg-ink-1 hover:text-paper-0 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ink-1"
        aria-label="前へ"
      >
        ←
      </button>
      <button
        type="button"
        onClick={onNext}
        className={`flex flex-1 items-center justify-center gap-3 px-4 py-3 font-black transition-all duration-300 active:scale-[0.98] ${
          done ? 'ink-btn bg-teal-board text-paper-0 shadow-md' : 'border border-ink-1/35 bg-paper-0/60 text-ink-2 hover:bg-paper-2'
        }`}
      >
        {done ? (
          <>
            <span aria-hidden className="gem gem-l" />
            <span className="ttl tracking-[0.2em]">次へ</span>
            <span aria-hidden className="gem gem-r" />
          </>
        ) : (
          <>
            <span className="lbl text-[9px] text-ink-3">Skip</span>
            <span className="text-sm">とばして次へ →</span>
          </>
        )}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------- まろいぬ版

function MaroLayout({ index, done, last, stage, doneSet, onJump, onPrev, onNext, onPlay, onRestart }: LayoutProps) {
  const { steps: STEPS, chapters: CHAPTERS } = useRules()
  const step = STEPS[index]
  const lines = done && step.task && step.praise ? [...step.maro, step.praise] : step.maro
  const [line, setLine] = useState(0)
  const [count, setCount] = useState(0)
  const text = lines[Math.min(line, lines.length - 1)]
  const full = plainLength(text)
  const typing = count < full
  const atEnd = line >= lines.length - 1
  const waiting = atEnd && !typing && !done

  // ステップが変わったら最初のセリフから
  const [shownIndex, setShownIndex] = useState(index)
  if (shownIndex !== index) {
    setShownIndex(index)
    setLine(0)
    setCount(0)
  }
  // やり終えたら、ほめ言葉へ進む
  const [praised, setPraised] = useState<number | null>(null)
  if (done && step.task && step.praise && praised !== index) {
    setPraised(index)
    setLine(step.maro.length)
    setCount(0)
  }

  useEffect(() => {
    if (!typing) return
    const t = setTimeout(() => setCount((c) => c + 1), 32)
    return () => clearTimeout(t)
  }, [typing, count])

  const advance = useCallback(() => {
    if (typing) return setCount(full)
    if (!atEnd) {
      setLine((l) => l + 1)
      setCount(0)
      return
    }
    if (done && !last) onNext()
  }, [typing, full, atEnd, done, last, onNext])
  const back = useCallback(() => {
    if (line > 0) {
      setLine((l) => l - 1)
      setCount(Infinity)
    } else onPrev()
  }, [line, onPrev])
  useKeys(back, advance)

  return (
    <div>
      <main className={`${MAIN_GRID} pb-56`}>
        <Toc index={index} doneSet={doneSet} onJump={onJump} />
        <div className="flex flex-col gap-2 lg:sticky lg:top-32">
          <div key={index} className="flex animate-fade items-baseline gap-2 lg:hidden">
            <span className="lbl shrink-0 bg-ink-1 px-2 py-1 text-[9px] text-paper-0">
              Ch.{String(step.chapter + 1).padStart(2, '0')} <span className="tracking-normal">{CHAPTERS[step.chapter]}</span>
            </span>
            <h2 className="truncate text-lg text-ink-0">{step.title}</h2>
          </div>
          {stage}
        </div>
        <div className="fixed inset-x-0 bottom-0 z-30 lg:sticky lg:top-32 lg:bottom-auto">
          <div className="md:mx-auto md:max-w-3xl lg:max-w-none">
          {/* PC: まろいぬの全身 */}
          <figure className="frame relative mb-3 hidden bg-paper-0/75 p-2 shadow-[0_12px_28px_-16px_rgb(43_42_38/0.55)] lg:block">
            <div className="overflow-hidden border border-ink-0/15">
              <img
                src={maroinu}
                alt="まろいぬ"
                className={`h-60 w-full object-cover object-[50%_20%] ${typing ? 'animate-[talk_0.3s_ease-in-out_infinite_alternate]' : 'animate-[bob_3.5s_ease-in-out_infinite]'}`}
              />
            </div>
            <figcaption className="flex items-center gap-2 px-1 pt-2">
              <span className="ttl text-sm">お殿様　まろいぬ</span>
              <span className="lbl text-[9px] text-ink-3">Lord Maroinu</span>
              <span className="dots flex-1" />
              <span className={`h-2 w-2 rotate-45 transition-colors ${typing ? 'bg-shu' : 'bg-ink-3/50'}`} title={typing ? '話している' : ''} />
            </figcaption>
            {done && step.task && (
              <span key={index} className="absolute top-5 right-5 rotate-[-8deg]">
                <span className="block animate-pop border-[3px] border-shu bg-paper-0/85 px-3 py-1 text-shu shadow-[0_6px_16px_rgb(43_42_38/0.3)]">
                  <span className="ttl text-lg tracking-[0.25em]">天晴れ</span>
                </span>
              </span>
            )}
          </figure>
          {waiting && step.task && (
            <p className="frame mx-3 mb-2 flex animate-rise items-center gap-3 bg-ink-1 px-3 py-2 text-sm text-paper-0 shadow-lg lg:mx-0">
              <span className="lbl shrink-0 border border-paper-0/40 px-2 py-0.5 text-[9px]">Try</span>
              <span className="dia turn-gem shrink-0 text-[9px] text-shu" />
              {step.task}
            </p>
          )}
          <div className="frame bg-paper-0/95 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-10px_28px_-8px_rgb(43_42_38/0.35)] backdrop-blur-sm lg:shadow-[0_12px_28px_-16px_rgb(43_42_38/0.55)]">
            <p className="mb-2 flex items-center gap-2">
              <span className="bar px-2 py-0.5 text-xs">まろいぬ</span>
              <span className="lbl text-[9px] text-ink-3">Lord Maroinu</span>
              <span className="dots flex-1" />
              <span className="num text-[10px] text-ink-3">
                {String(Math.min(line, lines.length - 1) + 1).padStart(2, '0')}/{String(lines.length).padStart(2, '0')}
              </span>
            </p>
            <div className="flex items-start gap-3">
              <div className="flex shrink-0 flex-col items-center gap-1 lg:hidden">
                <img
                  src={face}
                  alt="まろいぬ"
                  className={`h-14 w-14 border border-ink-1/40 object-cover ${typing ? 'animate-[talk_0.28s_ease-in-out_infinite_alternate]' : ''}`}
                />
              </div>
              <button type="button" onClick={advance} className="relative min-h-[5.5rem] flex-1 text-left" aria-label="続きを読む">
                <span className="block text-[15px] leading-relaxed font-medium text-ink-0 lg:text-lg lg:leading-relaxed">
                  <Rich text={text} limit={count} />
                  {typing && <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-ink-2" />}
                </span>
                {!typing && (!atEnd || (done && !last)) && <span className="dia absolute right-1 bottom-1 animate-bounce text-[8px] text-ink-1" />}
              </button>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button type="button" onClick={back} disabled={index === 0 && line === 0} className="px-2 py-1.5 text-xs text-ink-2 transition-colors hover:bg-paper-2 disabled:opacity-30">
                ← もどる
              </button>
              <span className="flex flex-1 justify-center gap-1">
                {lines.map((_, i) => (
                  <span key={i} className={`h-1.5 transition-all duration-300 ${i === line ? 'w-5 bg-ink-1' : i < line ? 'w-1.5 bg-ink-1/45' : 'w-1.5 bg-paper-3'}`} />
                ))}
              </span>
              {last && atEnd && !typing ? null : (
                <button type="button" onClick={onNext} className="px-2 py-1.5 text-xs text-ink-3 transition-colors hover:bg-paper-2" disabled={last}>
                  とばす →
                </button>
              )}
            </div>
            {last && atEnd && !typing && (
              <div className="mt-2 animate-rise">
                <EndButtons onPlay={onPlay} onRestart={onRestart} />
              </div>
            )}
          </div>
          </div>
        </div>
      </main>
    </div>
  )
}
