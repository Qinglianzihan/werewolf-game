import { describe, expect, it } from 'vitest'
import { addChat, castVote, createInitialState, resolveNight, submitNightAction, transferSheriffIfDead } from '../domain/reducer'
import { Role } from '../domain/types'
import { buildPlayerThoughts, buildSpectatorEventLog } from './eventLog'

describe('spectator event log', () => {
  it('formats omniscient micro events for chat background and god view', () => {
    let state = createInitialState({ playerCount: 6, roles: [
      Role.Werewolf, Role.Werewolf, Role.Seer, Role.Witch, Role.Guard, Role.Villager,
    ] })

    state = addChat(state, { channel: 'wolf', playerId: 1, content: '先压低存在感', tags: ['狼聊'] })
    state = submitNightAction(state, { actorId: 1, targetId: 3, actionType: 'kill' })
    state = submitNightAction(state, { actorId: 2, targetId: 3, actionType: 'kill' })
    state = submitNightAction(state, { actorId: 3, targetId: 1, actionType: 'check' })
    state = submitNightAction(state, { actorId: 4, targetId: 6, actionType: 'poison' })
    state = submitNightAction(state, { actorId: 5, targetId: 3, actionType: 'guard' })
    state = resolveNight(state)
    state = castVote(state, { voterId: 1, targetId: 5, reason: '抗推位' })

    const log = buildSpectatorEventLog(state)

    expect(log).toContain('开局身份：1号狼人 / 2号狼人 / 3号预言家 / 4号女巫 / 5号守卫 / 6号村民')
    expect(log).toContain('狼聊：1号 先压低存在感')
    expect(log).toContain('狼队最终击杀：1号代表狼队 → 3号')
    expect(log).toContain('预言家查验：3号验1号 = 狼人')
    expect(log).toContain('女巫毒药：4号毒6号')
    expect(log).toContain('守卫守护：5号守3号')
    expect(log).toContain('天亮死亡：6号')
    expect(log).toContain('投票：1号 → 5号。理由：抗推位')
  })


  it('formats sheriff badge transfer in god log', () => {
    let state = createInitialState({ playerCount: 12, roles: [
      Role.Werewolf, Role.Werewolf, Role.Werewolf, Role.Werewolf,
      Role.Villager, Role.Villager, Role.Villager, Role.Villager,
      Role.Seer, Role.Witch, Role.Hunter, Role.Guard,
    ] })
    state = { ...state, sheriffId: 1 }
    state = submitNightAction(state, { actorId: 2, targetId: 1, actionType: 'kill' })
    state = resolveNight(state)
    state = transferSheriffIfDead(state)

    const log = buildSpectatorEventLog(state)
    expect(log.some(line => line.includes('警徽传递') && line.includes('1号'))).toBe(true)
  })

  it('collects player thoughts for night choices via buildPlayerThoughts', () => {
    let state = createInitialState({ playerCount: 6, roles: [
      Role.Werewolf, Role.Werewolf, Role.Seer, Role.Witch, Role.Guard, Role.Villager,
    ] })

    state = submitNightAction(state, { actorId: 3, targetId: 1, actionType: 'check' })
    state = submitNightAction(state, { actorId: 4, targetId: 6, actionType: 'poison' })
    state = submitNightAction(state, { actorId: 5, targetId: 3, actionType: 'guard' })

    const thoughts = buildPlayerThoughts(state)

    expect(thoughts[3]).toEqual(['预言家思考：3号选择查验1号，确认对方底牌。'])
    expect(thoughts[4]).toEqual(['女巫思考：4号决定毒6号，主动改变夜晚死亡链。'])
    expect(thoughts[5]).toEqual(['守卫思考：5号守护3号，赌这一晚刀口会落在这里。'])
  })

  it('shows vote reason in player thoughts', () => {
    let state = createInitialState({ playerCount: 6, roles: [
      Role.Werewolf, Role.Werewolf, Role.Seer, Role.Witch, Role.Guard, Role.Villager,
    ] })
    state = castVote(state, { voterId: 1, targetId: 3, reason: '发言矛盾' })

    const thoughts = buildPlayerThoughts(state)

    expect(thoughts[1]).toContain('1号投票理由：发言矛盾')
  })
})
