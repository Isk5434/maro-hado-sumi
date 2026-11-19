import type { ReactNode } from 'react'

/**
 * 墨と和紙の画面部品。
 * 角は立て、線は細く。選んでいる行は墨色に反転させ、左に菱形の印を出す。
 */

/** 画面上部の帯（左に題、右に情報） */
export function SysBar({ left, right, sub }: { left: ReactNode; right?: ReactNode; sub?: ReactNode }) {
  return (
    <div className="border-b border-ink-0/25 bg-paper-0/70 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-2 lg:px-8">
        <div className="flex min-w-0 items-baseline gap-3">{left}</div>
        {sub && <span className="lbl hidden truncate text-[10px] text-ink-3 sm:inline">{sub}</span>}
        <span className="dots hidden flex-1 sm:block" />
        <div className="ml-auto flex shrink-0 items-center gap-2">{right}</div>
      </div>
    </div>
  )
}

/** 見出し帯のあるパネル */
export function Panel({
  title,
  en,
  children,
  className = '',
  tone = 'paper',
  aside,
}: {
  title: ReactNode
  en?: string
  children: ReactNode
  className?: string
  tone?: 'paper' | 'ink'
  aside?: ReactNode
}) {
  return (
    <section className={`frame ${tone === 'ink' ? 'bg-ink-1 text-paper-0' : 'bg-paper-0/80'} ${className}`}>
      <header className={`flex items-center gap-2 px-3 py-1.5 ${tone === 'ink' ? 'border-b border-paper-0/15' : 'bar'}`}>
        <span className="dia text-[9px] opacity-70" />
        <h2 className="ttl text-[15px] leading-tight">{title}</h2>
        {en && <span className="lbl text-[9px] opacity-55">{en}</span>}
        {aside && <span className="ml-auto text-[11px]">{aside}</span>}
      </header>
      <div className="p-3">{children}</div>
    </section>
  )
}

/** 選ぶと墨色に反転するメニューの行 */
export function MenuRow({
  active,
  onClick,
  icon,
  title,
  sub,
  right,
}: {
  active?: boolean
  onClick: () => void
  icon?: ReactNode
  title: ReactNode
  sub?: ReactNode
  right?: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex w-full items-center gap-3 border-b border-ink-0/12 px-3 py-2.5 text-left transition-colors duration-150 ${
        active ? 'bg-ink-1 text-paper-0' : 'hover:bg-ink-1 hover:text-paper-0'
      }`}
    >
      <span aria-hidden className={`dia menu-ptr absolute -left-3 text-[10px] ${active ? 'is-on' : ''}`} />
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold">{title}</span>
        {sub && <span className="block text-xs opacity-65">{sub}</span>}
      </span>
      {right ?? <span className="lbl text-[10px] opacity-60">▸</span>}
    </button>
  )
}

/** 墨のボタン（主） */
export function InkButton({ children, onClick, disabled, className = '' }: { children: ReactNode; onClick: () => void; disabled?: boolean; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`ink-btn group flex items-center justify-center gap-4 bg-ink-1 px-5 py-3 text-paper-0 transition hover:bg-ink-0 active:translate-y-px disabled:opacity-35 ${className}`}
    >
      <span aria-hidden className="gem gem-l" />
      <span className="ttl text-lg tracking-[0.2em]">{children}</span>
      <span aria-hidden className="gem gem-r" />
    </button>
  )
}

/** 枠だけのボタン（従） */
export function LineButton({ children, onClick, disabled, className = '' }: { children: ReactNode; onClick: () => void; disabled?: boolean; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`border border-ink-1/60 bg-paper-0/60 px-3 py-1.5 text-sm transition hover:bg-ink-1 hover:text-paper-0 disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-inherit ${className}`}
    >
      {children}
    </button>
  )
}

/** 画面下の操作ヒント */
export function HintBar({ left, hints }: { left?: ReactNode; hints: [string, string][] }) {
  return (
    <div className="border-t border-ink-0/25 bg-paper-0/70">
      <div className="mx-auto flex max-w-[1400px] items-center gap-4 px-4 py-2 text-xs text-ink-2 lg:px-8">
        <span className="min-w-0 flex-1 truncate">{left}</span>
        {hints.map(([k, v]) => (
          <span key={v} className="flex shrink-0 items-center gap-1.5">
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full border border-ink-2 px-1 text-[10px] leading-none">{k}</span>
            {v}
          </span>
        ))}
      </div>
    </div>
  )
}
