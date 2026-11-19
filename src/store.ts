import { create } from 'zustand'
import { createGame } from './game/engine'
import type { GameState } from './game/types'

interface Store {
  game: GameState | null
  history: GameState[]
  error: string | null
  start: (names: string[]) => void
  /** エンジンの操作を実行する。ルール違反は例外になるので、エラーとして表示する */
  act: (fn: (g: GameState) => GameState) => boolean
  undo: () => void
  quit: () => void
  clearError: () => void
}

export const useStore = create<Store>((set, get) => ({
  game: null,
  history: [],
  error: null,
  start: (names) => set({ game: createGame(names), history: [], error: null }),
  act: (fn) => {
    const { game, history } = get()
    if (!game) return false
    try {
      const next = fn(game)
      set({ game: next, history: [...history, game].slice(-50), error: null })
      return true
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) })
      return false
    }
  },
  undo: () => {
    const { history } = get()
    if (!history.length) return
    set({ game: history.at(-1)!, history: history.slice(0, -1), error: null })
  },
  quit: () => set({ game: null, history: [], error: null }),
  clearError: () => set({ error: null }),
}))
