import { create } from 'zustand'
import { Phase } from '../domain/types'
import type { FullGameState, GameConfig } from '../domain/types'
import type { AIConfig } from '../ai/types'
import { createInitialState } from '../domain/reducer'
import { getStandardRoles } from '../domain/rulesets'
import { runSessionStep } from '../engine/session'
import { startLogSession } from '../debug/gameLogger'

interface GameStore extends FullGameState {
  isRunning: boolean
  startGame: (config: GameConfig) => void
  runStep: (config: AIConfig) => Promise<void>
  pause: () => void
  resume: () => void
  resetGame: () => void
}

const initialState: FullGameState = {
  config: { playerCount: 6, roles: getStandardRoles(6), board: 'standard' },
  players: [],
  phase: Phase.Lobby,
  round: 0,
  events: [],
  publicChat: [],
  wolfChat: [],
  nightActions: [],
  votes: [],
  deaths: [],
  seerChecks: {},
  abilities: {},
  memories: {},
  lovers: [],
  sheriffId: null,
  lastWords: {},
  winner: null,
  isPaused: false,
  aiStatus: '待开局',
}

export const useGameStore = create<GameStore>((set, get) => ({
  ...initialState,
  isRunning: false,

  startGame: (config) => {
    startLogSession()
    set({ ...createInitialState(config), isRunning: false })
  },

  runStep: async (config) => {
    const current = get()
    if (current.isRunning || current.isPaused || current.phase === Phase.Lobby || current.phase === Phase.GameOver) return
    set({ isRunning: true })
    try {
      const next = await runSessionStep(get(), config)
      set({ ...next, isRunning: false })
    } catch (e: unknown) {
      set({
        aiStatus: e instanceof Error ? `模型调用失败：${e.message}` : '模型调用失败',
        isRunning: false,
      })
    }
  },

  pause: () => set({ isPaused: true, aiStatus: '已暂停' }),
  resume: () => set({ isPaused: false, aiStatus: '继续运行' }),
  resetGame: () => set({ ...initialState, isRunning: false }),
}))
