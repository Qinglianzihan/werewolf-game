import { GamePhase } from './types'
import type { GameState, GameConfig, ChatMessage, Vote, NightAction } from './types'
import { createPlayers } from './roles'

export function initGame(config: GameConfig): GameState {
  return {
    config,
    players: createPlayers(config),
    phase: GamePhase.Night,
    round: 1,
    nightActions: [],
    chatHistory: [],
    votes: [],
    nightDeaths: [],
    winner: null,
  }
}

export function nextPhase(state: GameState): GameState {
  switch (state.phase) {
    case GamePhase.Lobby:
      return { ...state, phase: GamePhase.Night, round: 1 }
    case GamePhase.Night:
      return { ...state, phase: GamePhase.Day, nightActions: [] }
    case GamePhase.Day:
      return { ...state, phase: GamePhase.Vote }
    case GamePhase.Vote:
      return { ...state, phase: GamePhase.Night, round: state.round + 1, votes: [], nightDeaths: [] }
    case GamePhase.GameOver:
      return state
  }
}

export function addChatMessage(state: GameState, msg: ChatMessage): GameState {
  return { ...state, chatHistory: [...state.chatHistory, msg] }
}

export function addVote(state: GameState, vote: Vote): GameState {
  return { ...state, votes: [...state.votes, vote] }
}

export function addNightAction(state: GameState, action: NightAction): GameState {
  return { ...state, nightActions: [...state.nightActions, action] }
}
