import { describe, expect, it } from 'vitest'
import { Role, GamePhase } from './types'
import type { GameState, Player } from './types'
import { countVotes, executeVote } from './judge'

const player = (id: number, role: Role, isAlive = true): Player => ({
  id,
  number: id,
  name: `${id}号`,
  role,
  isAlive,
  isAI: true,
})

const state = (players: Player[], votes: GameState['votes']): GameState => ({
  config: { playerCount: players.length, mode: 'spectate', roles: players.map(p => p.role) },
  players,
  phase: GamePhase.Vote,
  round: 1,
  nightActions: [],
  chatHistory: [],
  votes,
  nightDeaths: [],
  winner: null,
})

describe('vote resolution', () => {
  it('ignores votes from dead players and votes targeting dead players', () => {
    const game = state([
      player(1, Role.Werewolf),
      player(2, Role.Villager),
      player(3, Role.Seer, false),
      player(4, Role.Villager),
    ], [
      { voterId: 1, targetId: 2 },
      { voterId: 3, targetId: 4 },
      { voterId: 2, targetId: 3 },
      { voterId: 4, targetId: 3 },
    ])

    expect(countVotes(game)).toBe(2)
    expect(executeVote(game).players.find(p => p.id === 2)?.isAlive).toBe(false)
  })
})
