export const Role = {
  Werewolf: 'werewolf',
  Villager: 'villager',
  Seer: 'seer',
  Witch: 'witch',
  Hunter: 'hunter',
  Guard: 'guard',
  Cupid: 'cupid',
  Idiot: 'idiot',
  Knight: 'knight',
} as const
export type Role = (typeof Role)[keyof typeof Role]

export const Phase = {
  Lobby: 'lobby',
  Night: 'night',
  WolfDiscussion: 'wolfDiscussion',
  NightActions: 'nightActions',
  DayDiscussion: 'dayDiscussion',
  Vote: 'vote',
  HunterShot: 'hunterShot',
  KnightDuel: 'knightDuel',
  SheriffElection: 'sheriffElection',
  FreeDiscussion: 'freeDiscussion',
  PostGameDiscussion: 'postGameDiscussion',
  GameOver: 'gameOver',
} as const
export type Phase = (typeof Phase)[keyof typeof Phase]

export type Winner = 'werewolf' | 'villager' | null
export type ChatChannel = 'public' | 'wolf' | 'system'
export type NightActionType = 'kill' | 'check' | 'save' | 'poison' | 'guard'
export type BoardType = 'standard' | 'idiot' | 'knight' | 'cupid'
export type Alignment = 'werewolf' | 'good'

export interface GameConfig {
  playerCount: 6 | 9 | 12
  roles?: Role[]
  board?: BoardType
}

export interface Player {
  id: number
  number: number
  name: string
  role: Role
  isAlive: boolean
  isAI: boolean
  personality: string
}

export interface ChatMessage {
  id: string
  channel: ChatChannel
  playerId?: number
  content: string
  round: number
  phase: Phase
  tags?: string[]
}

export interface NightAction {
  actorId: number
  targetId: number
  actionType: NightActionType
  reason?: string
}

export interface Vote {
  voterId: number
  targetId: number
  reason: string
}

export interface DeathRecord {
  round: number
  playerIds: number[]
  cause: 'night' | 'vote' | 'hunter'
}

export interface SeerCheck {
  targetId: number
  alignment: Alignment
  round: number
}

export interface AbilityState {
  witchAntidoteUsed: boolean
  witchPoisonUsed: boolean
  guardLastTargetId: number | null
  hunterShotUsed: boolean
  cupidLinked: boolean
  idiotRevealed: boolean
  knightDuelUsed: boolean
  canVote: boolean
}

export interface AgentMemory {
  personality: string
  memory: string[]
  suspicionMap: Record<number, number>
  alliances: number[]
  strategyNotes: string[]
}

export interface FullGameState {
  config: Required<GameConfig>
  players: Player[]
  phase: Phase
  round: number
  events: GameEvent[]
  publicChat: ChatMessage[]
  wolfChat: ChatMessage[]
  nightActions: NightAction[]
  votes: Vote[]
  deaths: DeathRecord[]
  seerChecks: Record<number, SeerCheck[]>
  abilities: Record<number, AbilityState>
  memories: Record<number, AgentMemory>
  lovers: number[]
  sheriffId: number | null
  lastWords: Record<number, string>
  winner: Winner
  isPaused: boolean
  aiStatus: string
}

export type GameEvent =
  | { type: 'GameStarted'; round: number; players: Player[] }
  | { type: 'NightStarted'; round: number }
  | { type: 'WolfDiscussionStarted'; round: number }
  | { type: 'SpeechSubmitted'; channel: ChatChannel; message: ChatMessage }
  | { type: 'NightActionSubmitted'; round: number; action: NightAction }
  | { type: 'NightActionSkipped'; round: number; actorId: number; reason: string }
  | { type: 'NightResolved'; round: number; deaths: number[] }
  | { type: 'DayStarted'; round: number; deaths: number[] }
  | { type: 'DayDiscussionStarted'; round: number }
  | { type: 'VoteStarted'; round: number }
  | { type: 'VoteCast'; round: number; vote: Vote }
  | { type: 'VoteSkipped'; round: number; voterId: number; reason: string }
  | { type: 'PlayerExiled'; round: number; playerId: number | null }
  | { type: 'SheriffElected'; round: number; playerId: number }
  | { type: 'SheriffTransferred'; round: number; fromId: number; toId: number | null }
  | { type: 'HunterShot'; round: number; hunterId: number; targetId: number }
  | { type: 'CupidLinked'; round: number; cupidId: number; loverIds: number[] }
  | { type: 'LoverDied'; round: number; playerId: number; loverId: number }
  | { type: 'IdiotRevealed'; round: number; playerId: number }
  | { type: 'KnightDuel'; round: number; knightId: number; targetId: number; deadId: number }
  | { type: 'LastWordsSubmitted'; round: number; playerId: number; content: string }
  | { type: 'GameEnded'; round: number; winner: Exclude<Winner, null> }

export const ROLE_NAMES: Record<Role, string> = {
  [Role.Werewolf]: '狼人',
  [Role.Villager]: '村民',
  [Role.Seer]: '预言家',
  [Role.Witch]: '女巫',
  [Role.Hunter]: '猎人',
  [Role.Guard]: '守卫',
  [Role.Cupid]: '丘比特',
  [Role.Idiot]: '白痴',
  [Role.Knight]: '骑士',
}

export const ROLE_COLORS: Record<Role, string> = {
  [Role.Werewolf]: '#ef4444',
  [Role.Villager]: '#94a3b8',
  [Role.Seer]: '#a855f7',
  [Role.Witch]: '#22c55e',
  [Role.Hunter]: '#f59e0b',
  [Role.Guard]: '#38bdf8',
  [Role.Cupid]: '#ec4899',
  [Role.Idiot]: '#eab308',
  [Role.Knight]: '#6366f1',
}
