import type { GameState } from './types'

export function resolveNightActions(state: GameState): GameState {
  const { nightActions, players } = state

  // 1. Guard protection
  const guardAction = nightActions.find(a => a.actionType === 'guard')
  const protectedId = guardAction?.targetId ?? null

  // 2. Werewolf kill - count wolf votes, most targeted dies
  const wolfKills = nightActions.filter(a => a.actionType === 'kill')
  const killCounts: Record<number, number> = {}
  wolfKills.forEach(a => {
    killCounts[a.targetId] = (killCounts[a.targetId] || 0) + 1
  })
  let wolfTarget: number | null = null
  let maxCount = 0
  let tiedKill = false
  for (const [id, count] of Object.entries(killCounts)) {
    if (count > maxCount) {
      maxCount = count
      wolfTarget = Number(id)
      tiedKill = false
    } else if (count === maxCount) {
      tiedKill = true
    }
  }
  if (tiedKill) wolfTarget = null

  const deaths: number[] = []

  // Guard blocks wolf kill if target is protected
  if (wolfTarget !== null && wolfTarget !== protectedId) {
    deaths.push(wolfTarget)
  }

  // 3. Witch save - negates one death if witch has antidote
  const saveAction = nightActions.find(a => a.actionType === 'save')
  if (saveAction) {
    const savedIdx = deaths.indexOf(saveAction.targetId)
    if (savedIdx !== -1) {
      deaths.splice(savedIdx, 1)
    }
  }

  // 4. Witch poison
  const poisonAction = nightActions.find(a => a.actionType === 'poison')
  if (poisonAction) {
    const target = players.find(p => p.id === poisonAction.targetId)
    if (target && target.isAlive && !deaths.includes(poisonAction.targetId)) {
      deaths.push(poisonAction.targetId)
    }
  }

  // Apply deaths
  const updatedPlayers = players.map(p => ({
    ...p,
    isAlive: !deaths.includes(p.id),
  }))

  return {
    ...state,
    players: updatedPlayers,
    nightDeaths: deaths,
  }
}
