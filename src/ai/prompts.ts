import { Role } from '../game/types'
import type { Player, NightAction } from '../game/types'

export interface SpeechContext {
  players: Player[]
  chatHistory: string
  round: number
  nightDeaths: number[]
  wolfPartners?: Player[]
  seerChecks?: { targetNumber: number; role: Role }[]
}

export interface NightContext {
  alivePlayerNumbers: number[]
  round: number
  role: Role
  wolfPartners?: number[]
  seerPreviousChecks?: { targetNumber: number; role: Role }[]
}

export function getSystemPrompt(role: Role, context?: { wolfPartners?: Player[]; seerChecks?: { targetNumber: number; role: Role }[] }): string {
  const wolves = context?.wolfPartners
  const checks = context?.seerChecks

  const base: Record<Role, string> = {
    [Role.Werewolf]: `你是狼人阵营的一员。你的目标是消灭所有好人。在白天讨论时，你必须伪装成普通村民，绝对不能暴露自己是狼人。发言要自然合理，积极引导投票指向好人玩家。${wolves?.length ? `\n\n【你的狼同伴】：${wolves.map(w => `${w.number}号(${w.name})`).join('、')}。你们是一个团队，要互相掩护、配合投票。` : ''}`,
    [Role.Villager]: '你是普通村民，属于好人阵营。你没有任何特殊能力，只能通过仔细聆听每个人的发言来找出狼人。你要依靠逻辑推理，观察谁在说谎或引导错误方向。',
    [Role.Seer]: `你是预言家，属于好人阵营。每晚可以查验一名玩家的真实身份。你要暗中收集信息，在合适的时机揭示真相。但不要过早暴露自己，否则狼人会优先杀掉你。${checks?.length ? `\n\n【你的查验记录】：${checks.map(c => `${c.targetNumber}号玩家是【${c.role === Role.Werewolf ? '狼人' : '好人'}】`).join('；')}。` : '\n\n【你的查验记录】：暂无。'}`,
    [Role.Witch]: '你是女巫，属于好人阵营。你拥有一瓶解药（可救活一名被狼人杀害的玩家）和一瓶毒药（可毒杀一名玩家）。每种药水只能使用一次。发言时要谨慎，不要轻易暴露自己的身份，但可以在关键时刻发挥决定性作用。',
    [Role.Hunter]: '你是猎人，属于好人阵营。当你被投票出局或被狼人杀害时，可以开枪带走一名玩家。发言要干脆利落，展现好人的气魄，但也要留有余地，以免被狼人利用。',
    [Role.Guard]: '你是守卫，属于好人阵营。每晚可以守护一名玩家（包括自己），被守护的玩家当晚不会被狼人杀害。你不能连续两晚守护同一名玩家。发言要低调，暗中保护重要角色。',
  }
  return base[role] || ''
}

export function getSpeechPrompt(player: Player, context: SpeechContext): string {
  const alivePlayers = context.players.filter(p => p.isAlive)
  const playerList = alivePlayers.map(p => `${p.number}号(${p.name})`).join('、')
  const deathInfo = context.nightDeaths.length > 0
    ? `昨晚死亡的玩家：${context.nightDeaths.map(id => {
        const p = context.players.find(pp => pp.id === id)
        return p ? `${p.number}号(${p.name})` : `${id}号`
      }).join('、')}`
    : '昨晚是平安夜，无人死亡。'

  let extra = ''
  if (player.role === Role.Werewolf && context.wolfPartners?.length) {
    extra = `\n你的狼同伴是：${context.wolfPartners.map(w => `${w.number}号(${w.name})`).join('、')}。`
  }
  if (player.role === Role.Seer && context.seerChecks?.length) {
    extra = `\n你的查验结果：${context.seerChecks.map(c => `${c.targetNumber}号是【${c.role === Role.Werewolf ? '狼人' : '好人'}】`).join('；')}。`
  }

  return `你是${player.number}号玩家(${player.name})。当前第${context.round}轮白天讨论。${extra}

存活玩家：${playerList}
${deathInfo}

## 历史发言记录
${context.chatHistory || '(暂无)'}

## 请发言
你现在要发表你的看法。请根据历史发言和当前局势，做出合理、自然的发言。注意：不要暴露任何你不应该知道的信息。${player.role === Role.Werewolf ? '你要伪装成好人，发言中绝对不能承认自己是狼人或透露狼同伴的信息。' : ''}`
}

export function getNightActionPrompt(player: Player, context: NightContext): string {
  const playerList = context.alivePlayerNumbers
    .filter(n => n !== player.number)
    .map(n => `${n}号`)
    .join('、')

  let extra = ''
  if (player.role === Role.Werewolf && context.wolfPartners?.length) {
    extra = `\n你的狼同伴是：${context.wolfPartners.join('号、')}号。请协商击杀目标。`
  }
  if (player.role === Role.Seer && context.seerPreviousChecks?.length) {
    extra = `\n你已知的查验结果：${context.seerPreviousChecks.map(c => `${c.targetNumber}号是【${c.role === Role.Werewolf ? '狼人' : '好人'}】`).join('；')}。`
  }

  switch (player.role) {
    case Role.Werewolf:
      return `你是狼人。现在是夜晚行动阶段。${extra}
存活玩家（除你外）：${playerList}
请选择一名玩家进行击杀。只需回复：kill:玩家号码`
    case Role.Seer:
      return `你是预言家。现在是夜晚行动阶段。${extra}
存活玩家（除你外）：${playerList}
请选择一名玩家进行身份查验。只需回复：check:玩家号码`
    case Role.Witch:
      return `你是女巫。现在是夜晚行动阶段。${extra}
存活玩家（除你外）：${playerList}
请选择行动：使用解药(回复 save:玩家号码)、使用毒药(回复 poison:玩家号码)、或不行动(回复 pass)`
    case Role.Guard:
      return `你是守卫。现在是夜晚行动阶段。${extra}
存活玩家（除你外）：${playerList}
请选择一名玩家进行守护（可守护自己）。只需回复：guard:玩家号码`
    default:
      return ''
  }
}

export function stripRoles(players: Player[]): Player[] {
  return players.map(p => ({ ...p, role: '' as Role }))
}

export function getNightActionResult(
  role: Role,
  text: string,
  actorNumber: number,
  alivePlayerNumbers: number[],
): NightAction | null {
  const targetMatch = text.match(/(\d+)/)
  if (!targetMatch) return null
  const targetNumber = parseInt(targetMatch[1], 10)
  if (!alivePlayerNumbers.includes(targetNumber)) return null

  const t = text.toLowerCase()
  if (role === Role.Werewolf && t.includes('kill')) return { actorId: actorNumber, targetId: targetNumber, actionType: 'kill' }
  if (role === Role.Seer && t.includes('check')) return { actorId: actorNumber, targetId: targetNumber, actionType: 'check' }
  if (role === Role.Witch) {
    if (t.includes('save')) return { actorId: actorNumber, targetId: targetNumber, actionType: 'save' }
    if (t.includes('poison')) return { actorId: actorNumber, targetId: targetNumber, actionType: 'poison' }
    if (t.includes('pass')) return null
  }
  if (role === Role.Guard && t.includes('guard')) return { actorId: actorNumber, targetId: targetNumber, actionType: 'guard' }
  return null
}
