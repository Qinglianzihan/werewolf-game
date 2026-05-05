import { useEffect, useState } from 'react'
import { Phase } from '../../domain/types'
import { useGameStore } from '../../store/gameStore'
import { useSettingsStore } from '../../store/settingsStore'
import { buildPlayerThoughts, buildSpectatorTimeline } from '../../spectator/eventLog'
import Settings from '../Settings/Settings'
import ChatRoom from '../ChatRoom/ChatRoom'
import GodPanel from '../GodPanel/GodPanel'
import PlayerRoster from '../PlayerRoster/PlayerRoster'
import Recap from '../Recap/Recap'
import VoteBoard from '../VoteBoard/VoteBoard'
import WolfChannel from '../WolfChannel/WolfChannel'
import LogPanel from '../LogPanel/LogPanel'

const PHASE_LABELS: Record<Phase, string> = {
  [Phase.Lobby]: '大厅',
  [Phase.Night]: '🌙 夜晚降临',
  [Phase.WolfDiscussion]: '🐺 狼人夜聊',
  [Phase.NightActions]: '🔮 夜间行动',
  [Phase.DayDiscussion]: '☀ 白天讨论',
  [Phase.FreeDiscussion]: '💬 自由讨论',
  [Phase.Vote]: '⚖ 投票表决',
  [Phase.HunterShot]: '🏹 猎人开枪',
  [Phase.KnightDuel]: '⚔ 骑士决斗',
  [Phase.SheriffElection]: '👑 警长竞选',
  [Phase.PostGameDiscussion]: '📜 赛后群聊',
  [Phase.GameOver]: '🏁 终局',
}

export default function Game() {
  const state = useGameStore()
  const providers = useSettingsStore(s => s.providers)
  const activeProviderId = useSettingsStore(s => s.activeProviderId)
  const activeModel = useSettingsStore(s => s.activeModel)
  const activeModelsByProvider = useSettingsStore(s => s.activeModelsByProvider)
  const [showSettings, setShowSettings] = useState(false)
  const [visible, setVisible] = useState(false)

  const timeline = buildSpectatorTimeline(state)
  const thoughtsByPlayer = buildPlayerThoughts(state)
  const aliveCount = state.players.filter(p => p.isAlive).length

  // Entrance animation
  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  // Auto-run game step
  useEffect(() => {
    if (state.phase === Phase.Lobby || state.phase === Phase.GameOver || state.isPaused || state.isRunning) return
    const t = setTimeout(() => {
      void state.runStep({ providers, activeProviderId, activeModel, activeModelsByProvider })
    }, 0)
    return () => clearTimeout(t)
  }, [state, providers, activeProviderId, activeModel, activeModelsByProvider])

  return (
    <div
      className={`relative flex h-screen flex-col overflow-hidden bg-bg-base transition-opacity duration-700 ${visible ? 'opacity-100' : 'opacity-0'}`}
    >
      {/* —— HEADER —— */}
      <header className="relative z-20 mx-3 mt-3 flex items-center justify-between rounded-2xl border border-border-accent bg-bg-surface/70 px-5 py-3 backdrop-blur-xl shadow-card">
        <div className="flex items-center gap-3">
          {/* Moon icon */}
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 ring-1 ring-accent/20">
            <span className="text-xl animate-moon-glow">🌙</span>
          </div>
          <div>
            <p className="font-heading text-base font-bold text-text-primary tracking-wide">
              AI 狼人杀 · 月下酒馆
            </p>
            <p className="font-body text-xs text-text-dim">
              第 {state.round} 轮 · {PHASE_LABELS[state.phase]} · <span className="text-accent/70">{state.aiStatus}</span>
            </p>
          </div>
          <div className="hidden rounded-full bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent md:flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-soft-pulse" />
            存活 {aliveCount}/{state.players.length}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={state.isPaused ? state.resume : state.pause}
            className="rounded-lg border border-iron bg-bg-elevated px-3 py-1.5 text-xs font-medium text-text-secondary
              hover:text-text-primary hover:bg-bg-hover transition-all duration-200"
          >
            {state.isPaused ? '▶ 继续' : '⏸ 暂停'}
          </button>
          <button
            onClick={() => void state.runStep({ providers, activeProviderId, activeModel, activeModelsByProvider })}
            className="rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-bg-base
              hover:bg-accent-glow hover:shadow-glow transition-all duration-200 active:scale-95"
          >
            ⏭ 单步推进
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="rounded-lg border border-iron bg-bg-elevated px-3 py-1.5 text-xs text-text-dim
              hover:text-text-primary hover:bg-bg-hover transition-all duration-200"
          >
            设置
          </button>
          <button
            onClick={state.resetGame}
            className="rounded-lg border border-blood/20 bg-bg-elevated px-3 py-1.5 text-xs text-wolf
              hover:bg-wolf/10 hover:border-wolf/30 transition-all duration-200"
          >
            退局
          </button>
        </div>
      </header>

      {/* —— MAIN LAYOUT —— */}
      <main className="relative z-10 grid min-h-0 flex-1 grid-cols-[248px_minmax(0,1fr)_312px] gap-3 overflow-hidden p-3 pt-3">
        {/* Left: Adventurer Roster */}
        <div className="min-h-0 animate-fade-in" style={{ animationDelay: '100ms' }}>
          <PlayerRoster
            players={state.players}
            sheriffId={state.sheriffId}
            thoughtsByPlayer={thoughtsByPlayer}
          />
        </div>

        {/* Center: Village Square (Chat) */}
        <section
          className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden animate-fade-in"
          style={{ animationDelay: '200ms' }}
        >
          <ChatRoom
            messages={state.publicChat}
            players={state.players}
            timeline={timeline}
          />
        </section>

        {/* Right: Shadow Director Booth */}
        <aside
          className="min-h-0 space-y-2.5 overflow-y-auto overscroll-contain animate-fade-in"
          style={{ animationDelay: '300ms' }}
        >
          <WolfChannel messages={state.wolfChat} players={state.players} />
          <VoteBoard votes={state.votes} players={state.players} />
          <GodPanel state={state} />
          <LogPanel state={state} />
          {(state.phase === Phase.PostGameDiscussion || state.phase === Phase.GameOver) && (
            <Recap state={state} />
          )}
        </aside>
      </main>

      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
    </div>
  )
}
