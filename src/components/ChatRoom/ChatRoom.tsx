import { useEffect, useRef } from 'react'
import { ROLE_COLORS, ROLE_NAMES } from '../../domain/types'
import type { ChatMessage, Player } from '../../domain/types'
import type { SpectatorTimelineItem } from '../../spectator/eventLog'

export default function ChatRoom({
  messages,
  players,
  timeline,
}: {
  messages: ChatMessage[]
  players: Player[]
  timeline?: SpectatorTimelineItem[]
}) {
  const items = timeline ?? messages.map(message => ({ id: message.id, kind: 'chat' as const, message }))
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const prevLen = useRef(items.length)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [items.length])

  return (
    <section
      className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-2xl surface-parchment shadow-card"
      style={{ filter: 'url(#parchment-noise)' }}
    >
      {/* Board header */}
      <div className="flex items-center justify-between border-b border-border-accent bg-bg-surface/80 px-5 py-3 backdrop-blur">
        <div>
          <p className="font-heading text-base font-semibold text-accent">村庄公告板</p>
          <p className="font-body text-[13px] text-text-muted mt-0.5">法官播报 · 发言 · 事件</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-soft-pulse" />
          {items.length > 0 && prevLen.current !== items.length && (
            <span className="text-accent-glow animate-fade-in">新</span>
          )}
        </div>
      </div>

      {/* Message stream */}
      <div className="min-h-0 flex-1 overflow-y-scroll overscroll-contain scroll-smooth px-5 py-4">
        {items.length === 0 && (
          <div className="flex justify-center mt-16">
            <p className="font-body text-sm text-text-muted italic">
              —— 等待第一条消息，酒馆暂时寂静 ——
            </p>
          </div>
        )}

        {items.map((item, idx) => {
          // Event (system broadcast)
          if (item.kind === 'event') {
            return (
              <div key={item.id} className="my-3 flex justify-center">
                <span
                  className="max-w-[80%] rounded-lg border border-border-accent bg-bg-surface/60 px-3 py-1.5
                    font-body text-xs text-text-dim text-center animate-fade-in"
                >
                  📜 {item.content}
                </span>
              </div>
            )
          }

          if (item.kind !== 'chat' || !item.message) return null
          const message = item.message
          const player = players.find(p => p.id === message.playerId)

          // System message
          if (message.channel === 'system' || !player) {
            return (
              <div key={item.id} className="my-2.5 flex justify-center">
                <span className="rounded-lg bg-bg-elevated/40 px-3 py-1 font-body text-xs text-text-muted">
                  {message.content}
                </span>
              </div>
            )
          }

          // Player message
          const isNew = idx === items.length - 1 && items.length > prevLen.current
          return (
            <div
              key={item.id}
              className={`mb-4 flex gap-3 animate-slide-up ${isNew ? 'animate-message-new' : ''}`}
            >
              {/* Avatar token */}
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-number text-xs font-bold text-white shadow-md"
                style={{
                  background: `linear-gradient(135deg, ${ROLE_COLORS[player.role]}dd, ${ROLE_COLORS[player.role]}66)`,
                }}
              >
                {player.number}
              </div>

              {/* Message bubble */}
              <div className="max-w-[72%]">
                <div className="mb-1 flex items-center gap-2 text-[12px]">
                  <span className="font-semibold text-text-primary">{player.name}</span>
                  <span
                    className="rounded px-1.5 py-0.5 text-[11px] font-bold"
                    style={{ color: ROLE_COLORS[player.role], background: `${ROLE_COLORS[player.role]}15` }}
                  >
                    {ROLE_NAMES[player.role]}
                  </span>
                  {message.tags?.map((tag: string) => (
                    <span
                      key={tag}
                      className="rounded px-1.5 py-0.5 text-[11px] font-bold text-accent bg-accent/10"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <div
                  className={`rounded-2xl rounded-tl-sm px-4 py-2.5 font-body text-[14px] leading-relaxed text-text-primary
                    border border-border bg-bg-elevated/70 transition-shadow duration-300
                    ${isNew ? 'glow-candle' : ''}`}
                >
                  {message.content}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>
    </section>
  )
}
