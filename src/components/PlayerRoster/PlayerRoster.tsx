import { useState } from 'react'
import { ROLE_COLORS, ROLE_NAMES } from '../../domain/types'
import type { Player } from '../../domain/types'

interface Props {
  players: Player[]
  sheriffId?: number | null
  thoughtsByPlayer?: Record<number, string[]>
}

export default function PlayerRoster({ players, sheriffId, thoughtsByPlayer }: Props) {
  const [modalPlayer, setModalPlayer] = useState<Player | null>(null)
  const aliveCount = players.filter(p => p.isAlive).length
  const thoughts = modalPlayer ? (thoughtsByPlayer?.[modalPlayer.id] ?? []) : []

  return (
    <>
      <aside className="flex max-h-[calc(100vh-96px)] min-h-0 flex-col overflow-hidden rounded-2xl surface-wood shadow-card">
        {/* Header */}
        <div className="px-3 pt-3 pb-2 border-b border-border">
          <p className="font-heading text-sm font-semibold text-accent">冒险者名册</p>
          <p className="font-body text-[12px] text-text-muted mt-0.5">点击头像查看内心独白</p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="inline-flex items-center gap-1 rounded-md bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-accent">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              {aliveCount} 存活
            </span>
            {players.length - aliveCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-md bg-wolf/10 px-2 py-0.5 text-[11px] font-semibold text-wolf">
                {players.length - aliveCount} 出局
              </span>
            )}
          </div>
        </div>

        {/* Player list */}
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-2 py-2">
          {players.map((player, idx) => (
            <div key={player.id} className="animate-fade-in" style={{ animationDelay: `${idx * 40}ms` }}>
              <button
                onClick={() => setModalPlayer(player)}
                className={`w-full rounded-xl border p-2.5 text-left transition-all duration-200
                  ${player.isAlive ? 'hover:bg-bg-elevated' : 'opacity-50'}
                  ${player.id === sheriffId ? 'border-accent shadow-[0_0_12px_rgba(212,168,83,0.3)] bg-accent/5' : 'border-iron bg-bg-surface/50'}`}
              >
                <div className="flex items-center gap-2.5">
                  {/* Number badge */}
                  <div
                    className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-number text-sm font-bold text-white shadow-md"
                    style={{
                      background: `linear-gradient(135deg, ${ROLE_COLORS[player.role]}cc, ${ROLE_COLORS[player.role]}44)`,
                    }}
                  >
                    {player.number}
                    <span
                      className={`absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-bg-surface
                        ${player.isAlive ? 'bg-emerald-400' : 'bg-text-muted'}`}
                    />
                    {player.id === sheriffId && (
                      <span className="absolute -bottom-1 -right-1 rounded-full bg-accent w-5 h-5 flex items-center justify-center text-[11px] font-bold text-bg-base leading-tight shadow-[0_0_8px_rgba(212,168,83,0.6)] ring-2 ring-bg-surface">
                        👑
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className={`font-body text-sm font-semibold truncate ${player.id === sheriffId ? 'text-accent-glow drop-shadow-[0_0_6px_rgba(240,192,96,0.5)]' : 'text-text-primary'}`}>
                      {player.name}
                      {player.id === sheriffId && <span className="ml-1.5 text-[13px]">👑</span>}
                    </p>
                    <p className="font-body text-[12px] text-text-dim truncate">
                      {player.personality}
                    </p>
                  </div>

                  {/* Role badge */}
                  <span
                    className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-bold font-body"
                    style={{
                      color: ROLE_COLORS[player.role],
                      backgroundColor: `${ROLE_COLORS[player.role]}14`,
                    }}
                  >
                    {ROLE_NAMES[player.role]}
                  </span>
                </div>

                {!player.isAlive && (
                  <p className="mt-1.5 font-body text-[12px] font-semibold text-wolf">⚰ 已出局</p>
                )}
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* Thought Modal */}
      {modalPlayer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 animate-fade-in p-6"
          style={{ backdropFilter: 'blur(6px)' }}
          onClick={() => setModalPlayer(null)}
        >
          <div
            className="w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl animate-slide-up rounded-2xl overflow-hidden"
            style={{
              background: 'linear-gradient(180deg, #231e16 0%, #1a1510 100%)',
              border: '1px solid rgba(212,168,83,0.25)',
              filter: 'url(#parchment-noise)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-accent">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg font-number text-base font-bold text-white shadow-md"
                  style={{
                    background: `linear-gradient(135deg, ${ROLE_COLORS[modalPlayer.role]}dd, ${ROLE_COLORS[modalPlayer.role]}44)`,
                  }}
                >
                  {modalPlayer.number}
                </div>
                <div>
                  <h2 className="font-heading text-lg font-bold text-text-primary">
                    {modalPlayer.name} 的内心独白
                  </h2>
                  <p className="font-body text-xs text-text-dim">
                    {modalPlayer.personality} · {ROLE_NAMES[modalPlayer.role]}
                    {modalPlayer.id === sheriffId ? ' · 警长' : ''}
                    {!modalPlayer.isAlive ? ' · 已出局' : ' · 存活'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalPlayer(null)}
                className="text-text-dim hover:text-text-primary text-2xl leading-none px-2 transition-colors"
              >
                &times;
              </button>
            </div>

            {/* Thoughts content */}
            <div className="flex-1 overflow-y-auto p-6">
              {thoughts.length > 0 ? (
                <div className="space-y-3">
                  {thoughts.map((t, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-border-accent bg-bg-surface/60 p-4 animate-fade-in"
                      style={{ animationDelay: `${i * 60}ms` }}
                    >
                      <p className="font-body text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
                        {t}
                      </p>
                      <p className="mt-2 font-body text-[12px] text-text-muted">
                        思考片段 #{i + 1}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <span className="text-4xl mb-4 opacity-30">💭</span>
                  <p className="font-heading text-base text-text-dim mb-1">暂无思考记录</p>
                  <p className="font-body text-sm text-text-muted">
                    {modalPlayer.name} 还没有留下内心独白。等待 AI 思考后再次查看。
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
