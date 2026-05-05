import { Role } from './types'
import type { FullGameState, Player, Winner } from './types'

export function alivePlayers(state: FullGameState): Player[] {
  return state.players.filter(p => p.isAlive)
}

export function wolves(state: FullGameState): Player[] {
  return state.players.filter(p => p.role === Role.Werewolf)
}

export function aliveWolves(state: FullGameState): Player[] {
  return alivePlayers(state).filter(p => p.role === Role.Werewolf)
}

export function checkWinCondition(state: FullGameState): Winner {
  const alive = alivePlayers(state)
  const wolfCount = alive.filter(p => p.role === Role.Werewolf).length
  const goodCount = alive.length - wolfCount
  if (wolfCount === 0) return 'villager'
  if (wolfCount >= goodCount) return 'werewolf'
  return null
}

export function playerById(state: FullGameState, id: number): Player {
  const player = state.players.find(p => p.id === id)
  if (!player) throw new Error(`未知玩家：${id}`)
  return player
}
