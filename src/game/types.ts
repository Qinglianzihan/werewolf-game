export const Role = {
  Werewolf: 'werewolf',
  Villager: 'villager',
  Seer: 'seer',
  Witch: 'witch',
  Hunter: 'hunter',
  Guard: 'guard',
} as const
export type Role = (typeof Role)[keyof typeof Role]

export const GamePhase = {
  Lobby: 'lobby',
  Night: 'night',
  Day: 'day',
  Vote: 'vote',
  GameOver: 'gameover',
} as const
export type GamePhase = (typeof GamePhase)[keyof typeof GamePhase]

export interface Player {
  id: number
  name: string
  role: Role
  isAlive: boolean
  isAI: boolean
  number: number
}

export interface GameConfig {
  playerCount: number
  mode: 'spectate' | 'play'
  roles: Role[]
}

export interface NightAction {
  actorId: number
  targetId: number
  actionType: 'kill' | 'check' | 'save' | 'poison' | 'guard'
}

export interface ChatMessage {
  playerId: number
  content: string
  round: number
}

export interface Vote {
  voterId: number
  targetId: number
}

export interface GameState {
  config: GameConfig
  players: Player[]
  phase: GamePhase
  round: number
  nightActions: NightAction[]
  chatHistory: ChatMessage[]
  votes: Vote[]
  nightDeaths: number[]
  winner: 'werewolf' | 'villager' | null
}

export const ROLE_NAMES: Record<Role, string> = {
  [Role.Werewolf]: '狼人',
  [Role.Villager]: '村民',
  [Role.Seer]: '预言家',
  [Role.Witch]: '女巫',
  [Role.Hunter]: '猎人',
  [Role.Guard]: '守卫',
}

export const STANDARD_12: Role[] = [
  Role.Werewolf, Role.Werewolf, Role.Werewolf, Role.Werewolf,
  Role.Villager, Role.Villager, Role.Villager, Role.Villager,
  Role.Seer, Role.Witch, Role.Hunter, Role.Guard,
]

export const STANDARD_9: Role[] = [
  Role.Werewolf, Role.Werewolf, Role.Werewolf,
  Role.Villager, Role.Villager, Role.Villager,
  Role.Seer, Role.Witch, Role.Hunter,
]

export const STANDARD_6: Role[] = [
  Role.Werewolf, Role.Werewolf,
  Role.Villager, Role.Villager,
  Role.Seer, Role.Witch,
]
