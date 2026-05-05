import { Role } from './types'
import type { BoardType, GameConfig } from './types'

export const STANDARD_ROLES: Record<6 | 9 | 12, Role[]> = {
  6: [Role.Werewolf, Role.Werewolf, Role.Villager, Role.Villager, Role.Seer, Role.Witch],
  9: [
    Role.Werewolf, Role.Werewolf, Role.Werewolf,
    Role.Villager, Role.Villager, Role.Villager,
    Role.Seer, Role.Witch, Role.Hunter,
  ],
  12: [
    Role.Werewolf, Role.Werewolf, Role.Werewolf, Role.Werewolf,
    Role.Villager, Role.Villager, Role.Villager, Role.Villager,
    Role.Seer, Role.Witch, Role.Hunter, Role.Guard,
  ],
}

export const TWELVE_PLAYER_BOARDS: Record<BoardType, Role[]> = {
  standard: STANDARD_ROLES[12],
  idiot: [
    Role.Werewolf, Role.Werewolf, Role.Werewolf, Role.Werewolf,
    Role.Villager, Role.Villager, Role.Villager, Role.Villager,
    Role.Seer, Role.Witch, Role.Hunter, Role.Idiot,
  ],
  knight: [
    Role.Werewolf, Role.Werewolf, Role.Werewolf, Role.Werewolf,
    Role.Villager, Role.Villager, Role.Villager, Role.Villager,
    Role.Seer, Role.Witch, Role.Knight, Role.Guard,
  ],
  cupid: [
    Role.Werewolf, Role.Werewolf, Role.Werewolf, Role.Werewolf,
    Role.Villager, Role.Villager, Role.Villager,
    Role.Seer, Role.Witch, Role.Hunter, Role.Guard, Role.Cupid,
  ],
}

export function getRoles(config: GameConfig): Role[] {
  return [...(config.roles ?? getStandardRoles(config.playerCount, config.board))]
}

export function getStandardRoles(count: 6 | 9 | 12, board: BoardType = 'standard'): Role[] {
  return [...(count === 12 ? TWELVE_PLAYER_BOARDS[board] : STANDARD_ROLES[count])]
}
