import { Role } from '../domain/types'
import type { FullGameState, NightAction, Vote } from '../domain/types'
import type { AIConfig } from './types'
import type { PlayerContext } from './context'
import { appendApiLog, playerLabel, providerLabel, redactRequest } from '../debug/gameLogger'

const FINAL_CONTENT_RULE = '最终 content 只能是对其他玩家说出口的话；隐藏推理、计算和分析请放在 reasoning_content 里。'
const ROLEPLAY_STYLE_RULE = '加强角色扮演：请在隐藏推理中代入当前身份、性格、阵营目标和已知信息进行判断；最终 content 只能输出角色会在群聊里说出口的台词，语气符合身份和性格。不要在 content 输出心理活动、旁白、计划草稿或推理过程。'

const PERSONALITY_GUIDES: Record<string, string> = {
  '强势带队型': '策略倾向：偏好前置位起跳身份、定方向、积极归票。果断但不鲁莽——带队要有依据（查验结果、刀口信息、票型逻辑），不是0信息乱打。\n发言风格：主动带节奏归票，用"全票出X""跟票""这轮必须出X"等强硬表达。用"力度摆在这""谁敢保直接标狼"建立权威。不拖泥带水，第一个站出来定方向。',
  '阴阳怪气型': '策略倾向：偏好后置位发言，先用酸话刺探别人，再找矛盾点切入。表面不站边但暗自有判断，善于用反问挖出别人的逻辑漏洞。\n发言风格：多用"哟""～""呢"等语气词，惯用反问句挖苦人。"XX倒是挺会XX""这操作...""可真行"是标志句式。表面低调实则暗刺，带酸味嘲讽不自证的人。',
  '谨慎逻辑型': '策略倾向：偏好后置位发言，先听完所有人再综合判断。倾向于列出多种可能性而非一口咬定。投票前会反复权衡，不易被带节奏。\n发言风格：多用"大概率""可能""先观察""不急着"等保留性表达。说话像在推理，会列出几种可能性再做决定。从不第一个站边，强调"再听听""再观察"。',
  '情绪煽动型': '策略倾向：偏好中置位发言，用情绪化表达带动风向。逻辑可以简单但感染力要强，目标是让其他人跟自己的判断走。\n发言风格：多用感叹号、夸张表达。"铁狼！""必定！""别犹豫了！"是标志。喜欢把简单的事说得很严重，带动其他人情绪。不擅长逻辑推理但感染力强。',
  '沉默观察型': '策略倾向：偏好后置位发言，先简短表态再暗中观察。不争第一个说话，但一旦发言会用简洁有力的逻辑点出关键矛盾。宁可少说，说就说到位。\n发言风格：说话简短，多以"我先看看""再听听""不急着"开头。不爱长篇大论，一句到位。不轻易表态，但一旦表态通常有说服力。',
  '反问压迫型': '策略倾向：偏好中后置位发言，紧盯前后矛盾的人发起连环追问。目标是逼狼人露出破绽，不是无差别攻击所有人。\n发言风格：喜欢用反问句逼问别人。"你倒是说说""那昨天干嘛去了""这话你怎么解释"。不给对方留余地，连环追问让心虚的人露出破绽。',
}

const FALLBACK_SPEECHES: Record<Role, string> = {
  [Role.Werewolf]: '我先抛个观点，今天别急着站边，谁带节奏太硬反而更像有问题。',
  [Role.Villager]: '我没信息，但我会重点看谁在回避投票逻辑。',
  [Role.Seer]: '我建议从投票和发言一致性入手，别被情绪带偏。',
  [Role.Witch]: '先把发言听完整，强行归票的人要重点关注。',
  [Role.Hunter]: '我可以接受对跳，但理由必须说清楚，别只喊身份。',
  [Role.Guard]: '我更看重行为链，谁前后矛盾谁就进视野。',
  [Role.Cupid]: '我先听发言，谁的关系链太刻意谁就更值得怀疑。',
  [Role.Idiot]: '我这轮先不急着站死边，重点看票型有没有抱团。',
  [Role.Knight]: '我会盯紧发言硬踩但不给逻辑的人，必要时直接拍身份压迫。',
}

async function callLLM(systemPrompt: string, userPrompt: string, config: AIConfig, meta?: { task: string; context?: PlayerContext }): Promise<{ content: string; reasoning: string }> {
  const provider = config.providers.find(p => p.id === config.activeProviderId)
  if (!provider?.apiKey) throw new Error('No active provider')
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), llmTimeoutMs(config))
  const startedAt = Date.now()
  const dynamicPrefix = meta?.context ? buildDynamicUserPrefix(meta.context) : ''
  const fullUserPrompt = dynamicPrefix ? `${dynamicPrefix}\n\n${userPrompt}` : userPrompt
  const request = buildRequestBody(config, provider, systemPrompt, fullUserPrompt)
  const labels = providerLabel(config)
  appendApiLog({
    ...labels,
    status: 'start',
    task: meta?.task ?? 'unknown',
    player: playerLabel(meta?.context),
    role: meta?.context?.self.role,
    request: redactRequest(request),
  })
  try {
    const res = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`API ${res.status}${body ? `: ${body.slice(0, 300)}` : ''}`)
    }
    const data = await res.json() as { choices?: Array<{ message?: { content?: string; reasoning_content?: string } }> }
    const message = data.choices?.[0]?.message
    const content = message?.content?.trim() ?? ''
    const reasoning = message?.reasoning_content?.trim() ?? ''
    appendApiLog({
      ...labels,
      status: 'success',
      task: meta?.task ?? 'unknown',
      player: playerLabel(meta?.context),
      role: meta?.context?.self.role,
      durationMs: Date.now() - startedAt,
      response: {
        content,
        rawKeys: Object.keys(message ?? {}),
        reasoningLength: reasoning.length,
      },
    })
    return { content, reasoning }
  } catch (error) {
    appendApiLog({
      ...labels,
      status: 'error',
      task: meta?.task ?? 'unknown',
      player: playerLabel(meta?.context),
      role: meta?.context?.self.role,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

function buildRequestBody(config: AIConfig, provider: AIConfig['providers'][number], systemPrompt: string, userPrompt: string): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: selectedModel(config, provider),
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    stream: false,
  }
  if (isDeepSeek(provider)) {
    body.thinking = { type: provider.thinkingEnabled === false ? 'disabled' : 'enabled' }
    if (provider.thinkingEnabled !== false) body.reasoning_effort = provider.reasoningEffort ?? 'high'
    else body.temperature = 0.8
    return body
  }
  if (provider.thinkingEnabled !== false) body.reasoning_effort = provider.reasoningEffort ?? 'high'
  else body.temperature = 0.8
  return body
}

function isDeepSeek(provider: AIConfig['providers'][number]): boolean {
  return /deepseek/i.test(provider.name) || /api\.deepseek\.com/i.test(provider.baseUrl)
}

function selectedModel(config: AIConfig, provider: AIConfig['providers'][number]): string {
  const remembered = config.activeModelsByProvider?.[provider.id]
  if (remembered && provider.models.includes(remembered)) return remembered
  if (config.activeModel && provider.models.includes(config.activeModel)) return config.activeModel
  return provider.models[0] || config.activeModel
}

function llmTimeoutMs(config: AIConfig): number {
  const provider = config.providers.find(p => p.id === config.activeProviderId)
  if (!provider?.apiKey) return 30_000
  if (provider.thinkingEnabled !== false) return provider.reasoningEffort === 'max' ? 300_000 : 180_000
  return 60_000
}

export async function decideWolfDiscussionSpeech(context: PlayerContext, config: AIConfig): Promise<string> {
  const partners = context.wolfPartners.map(p => `${p.number}号`).join('、') || '无'
  const roundHints = context.history.wolfChat.filter(m => m.round === context.round).length >= 1
    ? '前一轮讨论尚未明确击杀目标，请继续讨论或直接投票 vote:X号 定刀。'
    : '这是本轮首次讨论，请提出刀口建议并给出理由，最后用 vote:X号 明确你的最终意向。'
  const prompt = serializeContextForPrompt(context, `狼人频道：你的狼队友是${partners}。${roundHints}不要提议击杀狼队友。优先讨论非狼存活玩家的威胁程度，最后各自投票定刀。回复格式：先分析讨论，末尾写 vote:号码。${ROLEPLAY_STYLE_RULE}`)
  return callOrFallback(context, config, prompt, '先压刀，等白天看谁发言可疑再定。vote:无明确目标', 'wolfDiscussion')
}

export async function decideDaySpeech(context: PlayerContext, config: AIConfig): Promise<string> {
  const roleRule = context.self.role === Role.Werewolf
    ? '你是狼人，必须记住狼队友，不要攻击狼队友是铁狼；可以悍跳但只能编“狼人/好人”查验。'
    : context.self.role === Role.Seer
      ? '你是预言家，真实查验只会得到“狼人/好人”，发言中禁止说验出守卫/女巫/猎人等具体神职。'
      : '不要声称自己知道未公开的具体神职。'
  const prompt = serializeContextForPrompt(context, `白天公开群聊发言：${roleRule}基于你知道的信息发言，可踩人、互保、跳身份或伪装，控制在200字以内。不要重复别人已经说过的话，要推进讨论走向。${ROLEPLAY_STYLE_RULE}`)
  return callOrFallback(context, config, prompt, FALLBACK_SPEECHES[context.self.role], 'daySpeech')
}

export async function decidePostGameSpeech(context: PlayerContext, config: AIConfig): Promise<string> {
  const alreadySaid = context.history.publicChat
    .filter(m => m.playerId === context.self.id)
    .slice(-3)
    .map(m => m.content)
  const antiRepeat = alreadySaid.length
    ? `\n你刚刚说过的内容（不要重复）：${alreadySaid.join(' | ')}`
    : ''
  const prompt = serializeContextForPrompt(context, `赛后自由群聊：系统会连续推进25轮赛后对话。身份全公开，AI可以自由发挥：复盘、邀功、甩锅、嘴队友、互怼、对喷、讨论关键操作和票型，但不要人身威胁。${antiRepeat}\n优先赛后观战爽感，像真人微信群，控制在150字以内。绝对不要重复自己刚说过的话。${ROLEPLAY_STYLE_RULE}`)
  const fallback = context.winner === 'werewolf'
    ? '这局狼队节奏可以啊，但有几波发言也太装了，差点把自己聊爆。'
    : '好人这把赢得不容易，前面站边乱成一锅粥，狼队也是真能演。'
  return callOrFallback(context, config, prompt, fallback, 'postGame')
}

export async function decideVote(context: PlayerContext, config: AIConfig): Promise<Vote> {
  const prompt = serializeContextForPrompt(context, '投票：回复格式 vote:玩家号码:一句内心理由。理由是心声，只给自己/上帝看，其他玩家不可见。狼人不能投狼队友，除非没有其他合法目标。必须投给存活且不是自己的玩家。')
  const fallbackTarget = firstVoteTarget(context)
  try {
    const result = await callLLM(systemFor(context), prompt, config, { task: 'vote', context })
    const match = result.content.match(/vote\s*[:：]\s*(\d+)\s*[:：]?\s*(.*)/i)
    const parsed = match ? Number(match[1]) : fallbackTarget
    const target = context.players.find(p => p.number === parsed && p.isAlive && p.id !== context.self.id)
    const rawReason = (match?.[2]?.trim() || '这轮行为链最不自然').replace(/^[:：]\s*/, '')
    return { voterId: context.self.id, targetId: target?.id ?? fallbackTarget, reason: rawReason.length > 20 ? rawReason.slice(0, 18) + '…' : rawReason }
  } catch (error) {
    logFallback(context, config, error, 'vote')
    return { voterId: context.self.id, targetId: fallbackTarget, reason: '行为链异常' }
  }
}

export async function decideNightAction(
  context: PlayerContext,
  config: AIConfig,
): Promise<NightAction | null>
export async function decideNightAction(
  player: { id: number; number: number; role: Role },
  context: { alivePlayerNumbers: number[] },
  config: AIConfig,
): Promise<NightAction | null>
export async function decideNightAction(
  first: PlayerContext | { id: number; number: number; role: Role },
  second: AIConfig | { alivePlayerNumbers: number[] },
  third?: AIConfig,
): Promise<NightAction | null> {
  if ('self' in first) return decideContextNightAction(first, second as AIConfig)
  const player = first
  const alive = (second as { alivePlayerNumbers: number[] }).alivePlayerNumbers.filter(n => n !== player.number)
  const target = alive[0]
  if (!target) return null
  if (player.role === Role.Werewolf) return { actorId: player.number, targetId: target, actionType: 'kill' }
  if (player.role === Role.Seer) return { actorId: player.number, targetId: target, actionType: 'check' }
  if (player.role === Role.Guard) return { actorId: player.number, targetId: player.number, actionType: 'guard' }
  void third
  return null
}

function countValidNightTargets(context: PlayerContext): number {
  const self = context.self
  if (self.role === Role.Guard) {
    const lastGuarded = context.guardHistory[0] ?? null
    return context.players.filter(p => p.isAlive && p.id !== lastGuarded).length
  }
  if (self.role === Role.Werewolf) {
    return context.players.filter(p => p.isAlive && p.role !== Role.Werewolf).length
  }
  return Infinity
}

async function decideContextNightAction(context: PlayerContext, config: AIConfig): Promise<NightAction | null> {
  // Witch with both potions used → nothing to do
  if (context.self.role === Role.Witch && context.witch.antidoteUsed && context.witch.poisonUsed) return null

  const target = firstGoodTarget(context)
  const fallback = defaultNightAction(context, target)
  if (!fallback && context.self.role !== Role.Witch && context.self.role !== Role.Hunter) return null

  // Only 1 valid target → skip LLM
  const validCount = countValidNightTargets(context)
  if (validCount === 0) return null
  if (validCount === 1 && fallback) return fallback
  const witchTarget = context.self.role === Role.Witch && context.witch.currentKillTargetNumber
    ? `今晚狼刀目标：${context.witch.currentKillTargetNumber}号。`
    : ''
  const instruction = context.self.role === Role.Witch
    ? `夜间行动：${witchTarget}请在隐藏推理中分析：当前局势、各玩家可疑程度、药水使用策略。然后回复 save:玩家号码、poison:玩家号码 或 pass。`
    : context.self.role === Role.Hunter
      ? `猎人开枪：你已死亡，可以开枪带走一名存活玩家。请在隐藏推理中分析：当前局势、谁最可疑、谁最可能是狼人。然后回复 action:玩家号码。如果不确定可以回复 pass 放弃开枪。`
      : '夜间行动：请在隐藏推理中分析：当前局势、各玩家身份可能性、你的最佳行动目标是谁、为什么。然后回复 action:玩家号码。'
  const prompt = serializeContextForPrompt(context, instruction)
  try {
    const result = await callLLM(systemFor(context), prompt, config, { task: 'nightAction', context })
    const reasoning = result.reasoning || extractReasoningFromContent(result.content)
    if (/^\s*pass\s*$/i.test(result.content)) return null
    const match = result.content.match(/(?:action|kill|check|save|poison|guard)\s*[:：]\s*(\d+)/i)
    if (!match) {
      logFallback(context, config, 'empty response', 'nightAction')
      return context.self.role === Role.Witch ? null : fallback
    }
    const parsed = Number(match[1])
    const targetPlayer = context.players.find(p => p.number === parsed && p.isAlive)
    if (context.self.role === Role.Witch) {
      const actionType = /save/i.test(match[0]) ? 'save' : /poison/i.test(match[0]) ? 'poison' : null
      if (!actionType) return null
      return { actorId: context.self.id, targetId: targetPlayer?.id ?? parsed, actionType, reason: reasoning || undefined }
    }
    if (!fallback) return null
    return { ...fallback, targetId: targetPlayer?.id ?? fallback.targetId, reason: reasoning || undefined }
  } catch (error) {
    logFallback(context, config, error, 'nightAction')
    return context.self.role === Role.Witch ? null : fallback
  }
}

function defaultNightAction(context: PlayerContext, targetId: number): NightAction | null {
  const self = context.self
  if (self.role === Role.Werewolf) return { actorId: self.id, targetId, actionType: 'kill' }
  if (self.role === Role.Seer) return { actorId: self.id, targetId, actionType: 'check' }
  if (self.role === Role.Guard) return { actorId: self.id, targetId: self.id, actionType: 'guard' }
  if (self.role === Role.Hunter) return { actorId: self.id, targetId, actionType: 'kill' }
  return null
}

export async function generateSpeech(
  player: { role: Role },
  context: unknown,
  config: AIConfig,
): Promise<string> {
  void context
  void config
  return FALLBACK_SPEECHES[player.role] ?? '我先过，听后置位发言。'
}

export async function decideSheriffSpeech(context: PlayerContext, config: AIConfig): Promise<string> {
  const prompt = serializeContextForPrompt(context, `警长竞选发言：你是候选人，请发表竞选演讲，说明为什么你适合当警长。控制在100字以内。${ROLEPLAY_STYLE_RULE}`)
  return callOrFallback(context, config, prompt, '我竞选警长，我会带领好人走向胜利。', 'sheriffSpeech')
}

export async function decideSheriffVote(context: PlayerContext, config: AIConfig): Promise<{ targetId: number; reason: string }> {
  const candidates = context.players.filter(p => p.isAlive)
  const candidatesStr = candidates.map(p => `${p.number}号`).join('、')
  const prompt = serializeContextForPrompt(context, `警长投票：请从候选人中选择警长。回复 vote:玩家号码:一句投票理由。当前候选人：${candidatesStr}。必须投给存活且不是自己的玩家。`)
  const fallbackTarget = fallbackSheriffTarget(context)
  try {
    const result = await callLLM(systemFor(context), prompt, config, { task: 'sheriffVote', context })
    const match = result.content.match(/vote\s*[:：]\s*(\d+)\s*[:：]?\s*(.*)/i)
    if (!match) return { targetId: fallbackTarget, reason: '行为链异常' }
    const target = context.players.find(p => p.number === Number(match[1]) && p.isAlive && p.id !== context.self.id)
    const rawReason = (match[2]?.trim() || '相信这位玩家的带队能力').replace(/^[:：]\s*/, '')
    return { targetId: target?.id ?? fallbackTarget, reason: rawReason.length > 30 ? rawReason.slice(0, 28) + '…' : rawReason }
  } catch (error) {
    logFallback(context, config, error, 'sheriffVote')
    return { targetId: fallbackTarget, reason: '行为链异常' }
  }
}

function fallbackSheriffTarget(context: PlayerContext): number {
  const target = context.players.find(p => p.isAlive && p.id !== context.self.id)
  return target?.id ?? context.self.id
}

export async function decideSheriffTransfer(context: PlayerContext, config: AIConfig): Promise<number> {
  const candidates = context.players.filter(p => p.isAlive && p.id !== context.self.id)
  if (!candidates.length) throw new Error('无存活玩家可传递警徽')
  const candidatesStr = candidates.map(p => `${p.number}号`).join('、')
  const prompt = serializeContextForPrompt(context, `警徽传递：你即将出局，请指定一名存活玩家继承警徽。请在隐藏推理中分析各玩家的身份可能性，选择你最信任的好人阵营玩家。回复 transfer:玩家号码。可选：${candidatesStr}。`)
  try {
    const result = await callLLM(systemFor(context), prompt, config, { task: 'sheriffTransfer', context })
    const match = result.content.match(/transfer\s*[:：]\s*(\d+)/i)
    if (!match) return candidates[Math.floor(Math.random() * candidates.length)].id
    const target = context.players.find(p => p.number === Number(match[1]) && p.isAlive && p.id !== context.self.id)
    return target?.id ?? candidates[Math.floor(Math.random() * candidates.length)].id
  } catch {
    return candidates[Math.floor(Math.random() * candidates.length)].id
  }
}

export async function decideLastWords(context: PlayerContext, config: AIConfig): Promise<string> {
  const identity = context.self.role === Role.Werewolf ? '狼人' : '好人阵营'
  const prompt = serializeContextForPrompt(context, `遗言：你已出局，这是你最后一次在群聊中发言。请根据你的${identity}身份和当前局势，给出有价值的最后信息：可以点出你怀疑的人、分析票型、给好人方向、或（如你是狼人）混淆视听。控制在100字以内，语气符合你的性格。${ROLEPLAY_STYLE_RULE}`)
  const fallback = context.self.role === Role.Werewolf
    ? '我是好人出局的，大家仔细看票型，别被带偏了。'
    : '好人加油，仔细看发言和票型，狼人藏在跟风的人里。'
  return callOrFallback(context, config, prompt, fallback, 'lastWords')
}

export async function decideFreeDiscussionSpeech(context: PlayerContext, config: AIConfig): Promise<string> {
  const prompt = serializeContextForPrompt(context, `现在是自由讨论时间，轮到你了，请发言。自由讨论不是按编号顺序发言，系统随机指定发言人，叫到你就说。每人可再发言1-2轮。你可以回应前面人的质疑、改变立场、抛出新的怀疑、或归票。控制在100字以内。如果没什么可补充的回复"过"。${ROLEPLAY_STYLE_RULE}`)
  return callOrFallback(context, config, prompt, '过', 'freeDiscussion')
}

export async function decideKnightDuel(context: PlayerContext, config: AIConfig): Promise<{ duel: false } | { duel: true; targetId: number }> {
  const aliveTargets = context.players.filter(p => p.isAlive && p.id !== context.self.id)
  if (!aliveTargets.length) return { duel: false }
  const targetsStr = aliveTargets.map(p => `${p.number}号`).join('、')
  const prompt = serializeContextForPrompt(context, `骑士决斗：你是骑士，可以在白天翻牌决斗一名存活玩家。对方是狼人→对方出局；对方是好人→你出局。这是一次性技能。当前存活可决斗目标：${targetsStr}。回复 duel:玩家号码 或 pass。只选择合法目标。${ROLEPLAY_STYLE_RULE}`)
  try {
    const result = await callLLM(systemFor(context), prompt, config, { task: 'knightDuel', context })
    if (/^\s*pass\s*$/i.test(result.content)) return { duel: false }
    const match = result.content.match(/duel\s*[:：]\s*(\d+)/i)
    if (!match) return { duel: false }
    const targetNumber = Number(match[1])
    const target = context.players.find(p => p.number === targetNumber && p.isAlive && p.id !== context.self.id)
    return target ? { duel: true, targetId: target.id } : { duel: false }
  } catch {
    return { duel: false }
  }
}

export async function decideCupidLink(context: PlayerContext, config: AIConfig): Promise<{ loverIds: [number, number] } | null> {
  const targets = context.players.filter(p => p.isAlive && p.id !== context.self.id)
  if (targets.length < 2) return null
  const targetsStr = targets.map(p => `${p.number}号(${p.name})`).join('、')
  const prompt = serializeContextForPrompt(context, `丘比特连情侣：你是丘比特，在游戏开始前选择两名存活玩家成为情侣。情侣同生共死（其中一人死亡，另一人也立即死亡）。你可以连任意两名玩家（可以连自己和另一人）。回复 link:号码1,号码2。当前可选目标：${targetsStr}。${ROLEPLAY_STYLE_RULE}`)
  try {
    const result = await callLLM(systemFor(context), prompt, config, { task: 'cupidLink', context })
    const match = result.content.match(/link\s*[:：]\s*(\d+)\s*[,，]\s*(\d+)/i)
    if (!match) return null
    const a = Number(match[1])
    const b = Number(match[2])
    const playerA = context.players.find(p => p.number === a && p.isAlive)
    const playerB = context.players.find(p => p.number === b && p.isAlive && p.id !== playerA?.id)
    if (playerA && playerB) return { loverIds: [playerA.id, playerB.id] }
    return null
  } catch {
    return null
  }
}

const WEREWOLF_RULES = `【狼人杀核心规则，必须遵守】
1. 顺序发言：白天按编号顺序依次发言，每人说一次，不能插话。还没轮到的人不能评价其"沉默"。
2. 女巫规则：解药和毒药各一瓶，整局各只能用一次。用过解药后不再获知刀口信息。
3. 预言家规则：查验结果只有"狼人"或"好人"，不能说验出了具体神职。
4. 投票规则：每人一票，不能投自己，不能投死人。狼人不能投狼队友（除非无合法目标）。
5. 狼人规则：首夜必须达成击杀共识才能闭眼。可自刀、可空刀。
6. 有性格≠降智：你的性格是说话风格，不是智力缺陷。说话可以短但要有逻辑，强势可以但要基于已知信息。`

const ALL_PERSONALITY_GUIDES = Object.entries(PERSONALITY_GUIDES)
  .map(([name, guide]) => `【${name}】\n${guide}`)
  .join('\n\n')

const CACHEABLE_SYSTEM_PROMPT = [
  WEREWOLF_RULES,
  '',
  '先在隐藏推理中完成角色代入和策略判断，但最终只在 content 输出对其他玩家说出口的话；不要把隐藏推理、心理活动、旁白或计划草稿写进 content。',
  '',
  ROLEPLAY_STYLE_RULE,
  '',
  FINAL_CONTENT_RULE,
  '',
  '性格设定不等于智力缺陷——性格是说话风格，策略判断仍需基于实际信息和逻辑。不同性格在推理时都要保持智力水准，输出风格按性格来。',
  '',
  '【性格风格参考】',
  ALL_PERSONALITY_GUIDES,
  '',
  '上下文策略：完整未压缩上下文。字段按公开信息、私密信息、历史事件分组；只能使用提供的上下文信息做判断，不要凭空编造。',
].join('\n')

function systemFor(_context: PlayerContext): string {
  return CACHEABLE_SYSTEM_PROMPT
}

function buildDynamicUserPrefix(context: PlayerContext): string {
  const personalityGuide = PERSONALITY_GUIDES[context.self.personality] ?? ''
  const ownHistory = context.history.publicChat
    .filter(m => m.playerId === context.self.id)
    .slice(-5)
    .map(m => `[第${m.round}轮] 你说过："${m.content}"`)
    .join('\n')
  const selfReminder = ownHistory
    ? `\n【你自己的历史发言，必须与之保持一致，不能前后矛盾】：\n${ownHistory}`
    : ''
  const orderInfo = context.speakingOrder
    ? `\n当前你是第${context.speakingOrder.position}个发言。已发言：${context.speakingOrder.alreadySpoken.map(s => `${s.number}号`).join('、') || '无'}。后面还有：${context.speakingOrder.notYetSpoken.map(n => `${n}号`).join('、')}（注意：尚未发言的人不能批评他们"沉默"或"不敢说话"，他们只是还没轮到）。`
    : ''
  return `你是${context.self.number}号${context.self.name}，身份是${context.self.role}。\n性格设定：${context.self.personality}。${personalityGuide}${orderInfo}${selfReminder}`
}

export function serializeContextForPrompt(context: PlayerContext, instruction: string): string {
  return JSON.stringify({
    instruction,
    self: context.self,
    table: {
      round: context.round,
      phase: context.phase,
      players: context.players.map(p => ({ id: p.id, number: p.number, isAlive: p.isAlive, role: p.role })),
      deaths: context.deaths,
      publicVotes: context.publicVotes,
    },
    privateKnowledge: {
      wolfPartners: context.wolfPartners.map(p => ({ id: p.id, number: p.number, isAlive: p.isAlive })),
      wolfChat: context.wolfChat,
      seerChecks: context.seerChecks,
      witch: context.witch,
      guardHistory: context.guardHistory,
      ownActions: context.ownActions,
    },
    completeHistory: {
      events: context.history.events,
      publicChat: context.history.publicChat,
      wolfChat: context.history.wolfChat,
      nightActionHistory: context.history.nightActionHistory,
      ownActionHistory: context.history.ownActionHistory,
    },
    winner: context.winner,
    memory: context.memory,
  })
}

async function callOrFallback(context: PlayerContext, config: AIConfig, prompt: string, fallback: string, task: string): Promise<string> {
  try {
    const result = await callLLM(systemFor(context), prompt, config, { task, context })
    if (result.content) return stripInnerThoughts(result.content)
    logFallback(context, config, 'empty response', task)
    return fallback
  } catch (error) {
    logFallback(context, config, error, task)
    return fallback
  }
}

function logFallback(context: PlayerContext, config: AIConfig, error: unknown, task = fallbackTask(context)): void {
  const provider = config.providers.find(p => p.id === config.activeProviderId)
  appendApiLog({
    ...providerLabel(config),
    status: 'fallback',
    task,
    player: playerLabel(context),
    role: context.self.role,
    error: error instanceof Error ? error.message : String(error),
  })
  console.warn('[AI fallback]', {
    task,
    player: `${context.self.number}号 ${context.self.name}`,
    role: context.self.role,
    provider: provider?.name ?? (config.activeProviderId || 'none'),
    model: config.activeModel || provider?.models[0] || 'none',
    reason: error instanceof Error ? error.message : String(error),
  })
}

function fallbackTask(context: PlayerContext): string {
  if (context.phase === 'wolfDiscussion') return 'wolfDiscussion'
  if (context.phase === 'dayDiscussion') return 'daySpeech'
  if (context.phase === 'vote') return 'vote'
  return context.phase
}

function firstGoodTarget(context: PlayerContext): number {
  if (context.self.role === Role.Werewolf) return firstUnknownTarget(context)
  const target = context.players.find(p => p.isAlive && p.id !== context.self.id)
  return target?.id ?? context.self.id
}

function firstUnknownTarget(context: PlayerContext): number {
  const wolfIds = new Set([context.self.id, ...context.wolfPartners.map(p => p.id)])
  const target = context.players.find(p => p.isAlive && !wolfIds.has(p.id))
    ?? context.players.find(p => p.isAlive && p.id !== context.self.id)
  return target?.id ?? context.self.id
}

function firstVoteTarget(context: PlayerContext): number {
  const wolfIds = new Set([context.self.id, ...context.wolfPartners.map(p => p.id)])
  const target = context.players.find(p => p.isAlive && p.id !== context.self.id && !wolfIds.has(p.id))
    ?? context.players.find(p => p.isAlive && p.id !== context.self.id)
  return target?.id ?? context.self.id
}

function extractReasoningFromContent(content: string): string {
  // when thinking is disabled or model uses inline reasoning markers
  const m = content.match(/<think>([\s\S]*?)<\/think>/i)
  if (m) return m[1].trim()
  const rm = content.match(/[（(]\s*(?:心想|内心OS|内心|想法|推理)\s*[:：]([\s\S]*?)[）)]/i)
  if (rm) return rm[1].trim()
  return ''
}

function stripInnerThoughts(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/[（(]\s*(?:心想|内心OS|内心|想法|旁白|os|推理)\s*[:：][\s\S]*?[）)]/gi, '')
    .replace(/^\s*(?:心想|内心OS|内心|旁白)\s*[:：].*$/gim, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function summarizeStateForDebug(state: FullGameState): string {
  return `${state.round}轮 ${state.phase} 存活${state.players.filter(p => p.isAlive).length}人`
}



