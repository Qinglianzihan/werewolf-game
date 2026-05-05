import { describe, expect, it } from 'vitest'
import { Role, GamePhase } from './types'
import type { GameState, Player } from './types'
import { resolveNightActions } from './actions'

const player = (id: number, role: Role): Player => ({
  id,
  number: id,
  name: `${id}号`,
  role,
  isAlive: true,
  isAI: true,
})

const state = (players: Player[], nightActions: GameState['nightActions']): GameState => ({
  config: { playerCount: players.length, mode: 'spectate', roles: players.map(p => p.role) },
  players,
  phase: GamePhase.Night,
  round: 1,
  nightActions,
  chatHistory: [],
  votes: [],
  nightDeaths: [],
  winner: null,
})

describe('resolveNightActions', () => {
  it('does not kill anyone when werewolf votes tie', () => {
    const result = resolveNightActions(state([
      player(1, Role.Werewolf),
      player(2, Role.Werewolf),
      player(3, Role.Villager),
      player(4, Role.Seer),
    ], [
      { actorId: 1, targetId: 3, actionType: 'kill' },
      { actorId: 2, targetId: 4, actionType: 'kill' },
    ]))

    expect(result.nightDeaths).toEqual([])
    expect(result.players.every(p => p.isAlive)).toBe(true)
  })
})
