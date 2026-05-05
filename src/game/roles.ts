import { Role, ROLE_NAMES, STANDARD_12, STANDARD_9, STANDARD_6 } from './types'
import type { GameConfig, Player } from './types'

export function getRoleName(role: Role): string {
  return ROLE_NAMES[role]
}

export function getStandardRoles(count: number): Role[] {
  switch (count) {
    case 12: return [...STANDARD_12]
    case 9: return [...STANDARD_9]
    case 6: return [...STANDARD_6]
    default: return [...STANDARD_12]
  }
}

export function getRoleColor(role: Role): string {
  const colors: Record<Role, string> = {
    [Role.Werewolf]: '#8b0000',
    [Role.Villager]: '#4a6741',
    [Role.Seer]: '#6b3fa0',
    [Role.Witch]: '#2d6b4f',
    [Role.Hunter]: '#8b6914',
    [Role.Guard]: '#3a6b8c',
  }
  return colors[role]
}

export function getRoleDescription(role: Role): string {
  const descs: Record<Role, string> = {
    [Role.Werewolf]: '每晚可以杀死一名玩家',
    [Role.Villager]: '没有特殊能力，通过推理找出狼人',
    [Role.Seer]: '每晚可以查验一名玩家的身份',
    [Role.Witch]: '拥有一瓶解药和一瓶毒药',
    [Role.Hunter]: '死亡时可以开枪带走一名玩家',
    [Role.Guard]: '每晚可以守护一名玩家免于死亡',
  }
  return descs[role]
}

export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

const AI_NAMES = ['墨渊', '青丘', '白芷', '玄夜', '素衣', '寒江', '孤月', '霜华', '影刃', '夜莺', '冷锋', '暗香']

export function createPlayers(config: GameConfig): Player[] {
  const roles = shuffleArray(config.roles)
  const count = config.playerCount
  const players: Player[] = []

  for (let i = 0; i < count; i++) {
    const isHuman = config.mode === 'play' && i === 0
    players.push({
      id: i + 1,
      name: isHuman ? '你' : AI_NAMES[i % AI_NAMES.length],
      role: roles[i],
      isAlive: true,
      isAI: !isHuman,
      number: i + 1,
    })
  }
  return players
}
