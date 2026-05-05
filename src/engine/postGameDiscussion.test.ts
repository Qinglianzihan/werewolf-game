import { describe, expect, it } from 'vitest'
import { addChat, createInitialState } from '../domain/reducer'
import { Phase, Role } from '../domain/types'
import { runSessionStep } from './session'
import type { AIConfig } from '../ai/types'

const noModel: AIConfig = { providers: [], activeProviderId: '', activeModel: '' }

describe('post-game free discussion', () => {
  it('continues after game end and caps post-game chat at 25 messages', async () => {
    let state = createInitialState({ playerCount: 6, roles: [
      Role.Werewolf, Role.Villager, Role.Villager, Role.Villager, Role.Seer, Role.Witch,
    ] })
    state = { ...state, phase: Phase.PostGameDiscussion, winner: 'villager', aiStatus: '赛后自由讨论' }

    for (let i = 0; i < 30; i++) state = await runSessionStep(state, noModel)

    const postGameMessages = state.publicChat.filter(m => m.phase === Phase.PostGameDiscussion)
    expect(postGameMessages).toHaveLength(25)
    expect(state.aiStatus).toBe('赛后讨论结束')
  })

  it('chooses free speakers by conversation pressure instead of fixed seat order', async () => {
    let state = createInitialState({ playerCount: 6, roles: [
      Role.Werewolf, Role.Villager, Role.Villager, Role.Villager, Role.Seer, Role.Witch,
    ] })
    state = { ...state, phase: Phase.PostGameDiscussion, winner: 'werewolf' }
    state = addChat(state, { channel: 'public', playerId: 1, content: '@2 你这局太离谱了，最后还站错边？', tags: ['赛后'] })

    state = await runSessionStep(state, noModel)

    expect(state.publicChat.at(-1)?.playerId).toBe(2)
  })
})

it('respects mentions but avoids two-player post-game loops', async () => {
  let state = createInitialState({ playerCount: 12, roles: [
    Role.Werewolf, Role.Villager, Role.Hunter, Role.Werewolf, Role.Witch, Role.Werewolf,
    Role.Villager, Role.Villager, Role.Seer, Role.Werewolf, Role.Guard, Role.Villager,
  ] })
  state = { ...state, phase: Phase.PostGameDiscussion, winner: 'werewolf' }
  state = addChat(state, { channel: 'public', playerId: 9, content: '@12 你别装，狼队全靠复读', tags: ['赛后'] })
  state = addChat(state, { channel: 'public', playerId: 12, content: '@9 急了？赢了就行', tags: ['赛后'] })
  state = addChat(state, { channel: 'public', playerId: 9, content: '@12 继续复读啊', tags: ['赛后'] })

  state = await runSessionStep(state, noModel)

  expect([9, 12]).not.toContain(state.publicChat.at(-1)?.playerId)
})

