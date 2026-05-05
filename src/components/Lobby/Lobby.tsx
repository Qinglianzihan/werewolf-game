import { useState } from 'react'
import { useGameStore } from '../../store/gameStore'
import { useSettingsStore } from '../../store/settingsStore'
import { ROLE_COLORS, ROLE_NAMES } from '../../domain/types'
import type { BoardType, GameConfig } from '../../domain/types'
import { getStandardRoles } from '../../domain/rulesets'
import Settings from '../Settings/Settings'

const BOARD_LABELS: Record<BoardType, string> = {
  standard: '标准 · 预女猎守',
  idiot: '白痴板 · 预女猎白',
  knight: '骑士板 · 预女骑守',
  cupid: '丘比特板 · 情侣链',
}

const BOARD_FLAVOR: Record<BoardType, string> = {
  standard: '经典四神对决，均衡战术',
  idiot: '白痴替罪，反转生局',
  knight: '骑士决斗，生死一线',
  cupid: '爱神之箭，情链暗涌',
}

export default function Lobby() {
  const startGame = useGameStore(s => s.startGame)
  const activeModel = useSettingsStore(s => s.activeModel)
  const [playerCount, setPlayerCount] = useState<6 | 9 | 12>(6)
  const [board, setBoard] = useState<BoardType>('standard')
  const [showSettings, setShowSettings] = useState(false)
  const [entering, setEntering] = useState(false)
  const roles = getStandardRoles(playerCount, board)

  const handleStart = () => {
    setEntering(true)
    setTimeout(() => {
      const config: GameConfig = { playerCount, board }
      startGame(config)
    }, 600)
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center px-6 py-10">
      {/* Moon backdrop */}
      <div
        className="pointer-events-none fixed top-12 right-16 w-48 h-48 rounded-full opacity-20 animate-moon-glow z-0"
        style={{
          background: 'radial-gradient(circle at 60% 40%, rgba(240,192,96,0.3) 0%, rgba(212,168,83,0.08) 50%, transparent 70%)',
        }}
      />

      {/* Curtain transition */}
      {entering && (
        <div className="fixed inset-0 z-50 bg-bg-base animate-curtain-rise" style={{ transformOrigin: 'top' }} />
      )}

      <div className={`relative z-10 w-full max-w-4xl transition-all duration-700 ${entering ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
        {/* Header */}
        <header className="text-center mb-10">
          <p className="font-display text-accent/60 text-sm tracking-[0.3em] uppercase mb-3">
            The Tavern of Moonlit Village
          </p>
          <h1 className="font-heading text-5xl font-bold text-text-primary tracking-wide mb-3">
            AI 狼人杀斗蛐蛐
          </h1>
          <p className="font-body text-base text-text-dim max-w-md mx-auto leading-relaxed">
            月光笼罩的村庄暗流涌动，AI 们在酒馆中密谋、指控、投票与死亡。你——坐在暗角的观战者，窥视一切。
          </p>
        </header>

        {/* Main selection area */}
        <div className="grid gap-6 md:grid-cols-[1fr_360px]">
          {/* Left: Player count + Board */}
          <section className="surface-wood rounded-2xl p-6 texture-parchment">
            <h2 className="font-heading text-lg font-semibold text-accent mb-5 flex items-center gap-2">
              <span className="text-xl">⚙</span> 局型选择
            </h2>

            {/* Player count buttons — styled as rune stones */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[6, 9, 12].map((n, idx) => (
                <button
                  key={n}
                  onClick={() => {
                    setPlayerCount(n as 6 | 9 | 12)
                    if (n !== 12) setBoard('standard')
                  }}
                  className={`relative rounded-xl p-4 text-center transition-all duration-300 border
                    ${playerCount === n
                      ? 'border-gold bg-accent-bg scale-[1.02]'
                      : 'border-iron bg-bg-surface/50 hover:bg-bg-elevated hover:border-border-accent'
                    }`}
                  style={{ animationDelay: `${idx * 80}ms` }}
                >
                  <span
                    className={`block font-number text-3xl mb-1 ${playerCount === n ? 'text-accent' : 'text-text-primary'}`}
                  >
                    {n}
                  </span>
                  <span className="text-xs text-text-dim font-body">人上帝局</span>
                  {playerCount === n && (
                    <span className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full bg-accent animate-soft-pulse" />
                  )}
                </button>
              ))}
            </div>

            {/* Board selection — tarot-style cards for 12-player */}
            {playerCount === 12 && (
              <div className="mb-5">
                <p className="font-heading text-sm text-text-dim mb-3">十二人固定板子</p>
                <div className="grid grid-cols-2 gap-2.5">
                  {(Object.keys(BOARD_LABELS) as BoardType[]).map((item, idx) => (
                    <button
                      key={item}
                      onClick={() => setBoard(item)}
                      className={`rounded-xl p-3.5 text-left transition-all duration-300 border
                        ${board === item
                          ? 'border-gold bg-accent-bg'
                          : 'border-iron bg-bg-surface/50 hover:bg-bg-elevated hover:border-border-accent'
                        }`}
                      style={{ animationDelay: `${idx * 60}ms` }}
                    >
                      <span className={`block font-heading text-sm font-semibold mb-0.5 ${board === item ? 'text-accent' : 'text-text-primary'}`}>
                        {BOARD_LABELS[item]}
                      </span>
                      <span className="text-xs text-text-muted font-body">{BOARD_FLAVOR[item]}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Role pool */}
            <div>
              <p className="font-heading text-sm text-text-dim mb-3">本局身份池</p>
              <div className="flex flex-wrap gap-2">
                {roles.map((role, i) => (
                  <span
                    key={`${role}-${i}`}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold border"
                    style={{
                      color: ROLE_COLORS[role],
                      borderColor: `${ROLE_COLORS[role]}33`,
                      backgroundColor: `${ROLE_COLORS[role]}10`,
                    }}
                  >
                    {ROLE_NAMES[role]}
                  </span>
                ))}
              </div>
            </div>
          </section>

          {/* Right: Rules + Start */}
          <aside className="surface-parchment rounded-2xl p-6 flex flex-col">
            <h2 className="font-display text-xl text-accent mb-4">观察者守则</h2>
            <ul className="font-body text-sm text-text-secondary space-y-2.5 leading-relaxed flex-1">
              <li className="flex gap-2">
                <span className="text-accent shrink-0">◈</span>
                <span>默认上帝模式——身份、夜间行动、狼聊全可见</span>
              </li>
              <li className="flex gap-2">
                <span className="text-accent shrink-0">◈</span>
                <span>AI 只持应知信息——信息隔离确保公平</span>
              </li>
              <li className="flex gap-2">
                <span className="text-accent shrink-0">◈</span>
                <span>节奏由模型自然推演——无人工加速</span>
              </li>
              <li className="flex gap-2">
                <span className="text-accent shrink-0">◈</span>
                <span>狼人先密谋夜聊，再统一刀口</span>
              </li>
              <li className="flex gap-2">
                <span className="text-accent shrink-0">◈</span>
                <span>右面板实时展示票型、查验、用药</span>
              </li>
            </ul>

            <button
              onClick={handleStart}
              className="mt-6 w-full rounded-xl bg-accent px-6 py-4 font-heading text-base font-bold text-bg-base
                transition-all duration-300 hover:bg-accent-glow hover:shadow-glow active:scale-[0.98]"
            >
              踏入酒馆，开始观战
            </button>

            {!activeModel && (
              <p className="mt-3 text-xs text-amber-400/70 text-center font-body">
                ⚠ 未选择模型时使用 fallback 文案
              </p>
            )}

            <button
              onClick={() => setShowSettings(true)}
              className="mt-3 w-full rounded-lg border border-iron bg-bg-surface/30 px-4 py-2 text-xs text-text-dim font-body
                hover:text-text-primary hover:bg-bg-elevated transition-colors"
            >
              模型设置
            </button>
          </aside>
        </div>
      </div>

      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
    </div>
  )
}
