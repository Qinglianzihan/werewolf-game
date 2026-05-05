import type { ChatMessage, Player } from '../../domain/types'

export default function WolfChannel({ messages, players }: { messages: ChatMessage[]; players: Player[] }) {
  return (
    <section className="min-h-0 overflow-hidden rounded-2xl shadow-card"
      style={{
        background: 'linear-gradient(180deg, #1a1215 0%, #150f11 100%)',
        border: '1px solid rgba(192,57,43,0.15)',
      }}
    >
      <div className="flex items-center justify-between border-b border-wolf/10 px-4 py-3"
        style={{ borderBottomColor: 'rgba(192,57,43,0.1)' }}
      >
        <div>
          <p className="font-heading text-sm font-semibold text-wolf">🐺 暗影密语</p>
          <p className="font-body text-[12px] text-text-muted mt-0.5">狼队夜间私聊 · 仅观战可见</p>
        </div>
        {messages.length > 0 && (
          <span className="rounded-full bg-wolf/10 px-2 py-0.5 text-[11px] font-bold text-wolf">
            {messages.length} 条
          </span>
        )}
      </div>
      <div className="h-52 space-y-1.5 overflow-y-auto overscroll-contain p-3">
        {messages.length === 0 && (
          <p className="py-8 text-center font-body text-xs text-text-muted italic">
            狼队尚未在暗处耳语...
          </p>
        )}
        {messages.map(message => {
          const player = players.find(p => p.id === message.playerId)
          return (
            <div
              key={message.id}
              className="rounded-xl p-2.5 animate-fade-in"
              style={{
                background: 'linear-gradient(135deg, rgba(192,57,43,0.06) 0%, rgba(26,18,21,0.8) 100%)',
                border: '1px solid rgba(192,57,43,0.08)',
              }}
            >
              <p className="mb-0.5 font-body text-[12px] font-semibold text-wolf/70">
                {player ? `${player.number}号 ${player.name}` : '狼人'}
              </p>
              <p className="font-body text-[14px] leading-relaxed text-text-primary">
                {message.content}
              </p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
