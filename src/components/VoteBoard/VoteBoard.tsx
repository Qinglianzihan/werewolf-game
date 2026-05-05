import type { Player, Vote } from '../../domain/types'

export default function VoteBoard({ votes, players }: { votes: Vote[]; players: Player[] }) {
  const counts = votes.reduce<Record<number, number>>((acc, vote) => {
    acc[vote.targetId] = (acc[vote.targetId] ?? 0) + 1
    return acc
  }, {})

  const maxVotes = Math.max(1, ...Object.values(counts))

  return (
    <section className="min-h-0 overflow-hidden rounded-2xl surface-wood shadow-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <p className="font-heading text-sm font-semibold text-accent">⚖ 审判天平</p>
          <p className="font-body text-[12px] text-text-muted mt-0.5">票数公开 · 理由仅观战可见</p>
        </div>
        <span className="rounded-md bg-accent/10 px-2 py-0.5 text-[11px] font-bold text-accent">
          {votes.length} 票
        </span>
      </div>
      <div className="max-h-52 space-y-2 overflow-y-auto p-3">
        {votes.length === 0 && (
          <p className="py-6 text-center font-body text-xs text-text-muted italic">天平尚未倾斜...</p>
        )}

        {Object.entries(counts)
          .sort(([, a], [, b]) => b - a)
          .map(([targetId, count]) => {
            const target = players.find(p => p.id === Number(targetId))
            const ratio = count / maxVotes
            const voterIds = votes
              .filter(v => v.targetId === Number(targetId))
              .map(v => {
                const voter = players.find(p => p.id === v.voterId)
                return voter ? `${voter.number}号` : `${v.voterId}号`
              })

            return (
              <div key={targetId} className="rounded-xl border border-iron bg-bg-surface/60 p-3 animate-fade-in">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-body text-sm font-semibold text-text-primary">
                    {target ? `${target.number}号 ${target.name}` : `#${targetId}`}
                  </span>
                  <span
                    className="font-number text-sm font-bold"
                    style={{ color: ratio > 0.6 ? '#ef4444' : 'var(--color-accent)' }}
                  >
                    {count} 票
                  </span>
                </div>

                {/* Vote bar */}
                <div className="h-1.5 rounded-full bg-bg-elevated overflow-hidden mb-2">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${ratio * 100}%`,
                      background: ratio > 0.6
                        ? 'linear-gradient(90deg, #c0392b, #ef4444)'
                        : 'linear-gradient(90deg, rgba(212,168,83,0.6), rgba(212,168,83,0.9))',
                    }}
                  />
                </div>

                <p className="font-body text-[12px] text-text-dim">
                  {voterIds.join(' · ')} 已投票
                </p>
              </div>
            )
          })}
      </div>
    </section>
  )
}
