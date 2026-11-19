import { SCORE_LABELS, scoreVillage, type ScoreBreakdown } from '../game/scoring'
import type { GameState } from '../game/types'

export function ScoreBoard({ game }: { game: GameState }) {
  const scores = game.players.map((p) => ({ p, s: scoreVillage(p.village) }))
  const best = Math.max(...scores.map((x) => x.s.total))
  const winners = scores.filter((x) => x.s.total === best).map((x) => x.p.name)
  const rows = Object.keys(SCORE_LABELS) as (keyof typeof SCORE_LABELS)[]

  return (
    <section className="frame bg-paper-0/85 p-3">
      <h2 className="text-lg font-bold">{winners.length > 1 ? `${winners.join('・')}の引き分け` : `${winners[0]}の勝ち！`}</h2>
      {game.finisher !== null && <p className="text-sm text-stone-600">{game.players[game.finisher].name}が城まで道をつなぎました。</p>}
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-1 pr-2">得点</th>
              {scores.map(({ p }) => (
                <th key={p.id} className="px-2 text-right">
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((k) => (
              <tr key={k} className="border-b border-stone-100">
                <td className="py-1 pr-2 text-stone-600">{SCORE_LABELS[k]}</td>
                {scores.map(({ p, s }) => (
                  <td key={p.id} className="px-2 text-right tabular-nums">
                    {(s as ScoreBreakdown)[k]}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="font-bold">
              <td className="py-1 pr-2">合計</td>
              {scores.map(({ p, s }) => (
                <td key={p.id} className="px-2 text-right tabular-nums">
                  {s.total}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  )
}
