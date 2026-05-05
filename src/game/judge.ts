import { Role } from './types'
import type { GameState } from './types'

export function countVotes(state: GameState): number | null {
  const { votes, players } = state
  const aliveIds = new Set(players.filter(p => p.isAlive).map(p => p.id))
  const counts: Record<number, number> = {}
  votes.forEach(v => {
    if (!aliveIds.has(v.voterId) || !aliveIds.has(v.targetId)) return
    counts[v.targetId] = (counts[v.targetId] || 0) + 1
  })

  let maxCount = 0
  let topId: number | null = null
  let tie = false

  for (const [id, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count
      topId = Number(id)
      tie = false
    } else if (count === maxCount) {
      tie = true
    }
  }

  return tie ? null : topId
}

export function executeVote(state: GameState): GameState {
  const eliminatedId = countVotes(state)
  if (eliminatedId === null) return state

  const updatedPlayers = state.players.map(p => ({
    ...p,
    isAlive: p.id === eliminatedId ? false : p.isAlive,
  }))

  return { ...state, players: updatedPlayers }
}

export function checkWinCondition(state: GameState): 'werewolf' | 'villager' | null {
  const alivePlayers = state.players.filter(p => p.isAlive)
  const wolfCount = alivePlayers.filter(p => p.role === Role.Werewolf).length
  const nonWolfCount = alivePlayers.filter(p => p.role !== Role.Werewolf).length

  if (wolfCount === 0) return 'villager'
  if (wolfCount >= nonWolfCount) return 'werewolf'
  return null
}
