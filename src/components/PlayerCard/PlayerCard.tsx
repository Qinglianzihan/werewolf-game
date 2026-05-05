import type { Player } from '../../game/types'
import { getRoleColor, getRoleName } from '../../game/roles'

interface PlayerCardProps {
  player: Player
  isCurrentSpeaker?: boolean
  isVoted?: boolean
  showRole?: boolean
  onClick?: () => void
  size?: 'sm' | 'md' | 'lg'
}

const sizeMap = {
  sm: { card: 'w-10 h-10', num: 'text-sm', name: 'text-[11px]' },
  md: { card: 'w-14 h-14', num: 'text-lg', name: 'text-xs' },
  lg: { card: 'w-18 h-18', num: 'text-xl', name: 'text-sm' },
}

export default function PlayerCard({
  player,
  isCurrentSpeaker,
  isVoted,
  showRole,
  onClick,
  size = 'md',
}: PlayerCardProps) {
  const s = sizeMap[size]
  const roleColor = getRoleColor(player.role)

  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`flex flex-col items-center gap-1 transition-all duration-300
        ${onClick ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-default'}
        ${!player.isAlive ? 'opacity-50' : ''}`}
    >
      {/* Token base — wood grain + metal inlay */}
      <div
        className={`relative rounded-full ${s.card} flex items-center justify-center font-number font-bold
          shadow-card transition-all duration-300
          ${isCurrentSpeaker ? 'scale-110 glow-candle-strong' : ''}`}
        style={{
          background: `linear-gradient(135deg, #2c2520 0%, #1a1510 60%, #231e16 100%)`,
          border: `2px solid ${isCurrentSpeaker ? roleColor : 'rgba(212,168,83,0.25)'}`,
          boxShadow: isCurrentSpeaker
            ? `0 0 20px ${roleColor}44, 0 0 40px ${roleColor}22`
            : '0 2px 6px rgba(0,0,0,0.5)',
        }}
      >
        {/* Player number — engraved metal style */}
        <span
          className={`${s.num} text-text-primary`}
          style={{
            textShadow: '0 1px 2px rgba(0,0,0,0.6), 0 0 4px rgba(212,168,83,0.2)',
          }}
        >
          {player.number}
        </span>

        {/* Speaker pulse ring */}
        {isCurrentSpeaker && (
          <span
            className="absolute inset-0 rounded-full animate-soft-pulse"
            style={{
              border: `2px solid ${roleColor}44`,
              boxShadow: `inset 0 0 8px ${roleColor}22`,
            }}
          />
        )}

        {/* Dead overlay */}
        {!player.isAlive && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 backdrop-blur-[1px]">
            <span className="text-wolf font-number font-bold text-lg">✕</span>
          </div>
        )}

        {/* Voted marker */}
        {isVoted && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-wolf text-[10px] font-bold text-white shadow-md">
            !
          </span>
        )}
      </div>

      {/* Player name */}
      <span className={`${s.name} text-text-secondary font-body text-center max-w-[5rem] truncate`}>
        {player.name}
      </span>

      {/* Role — if revealed */}
      {showRole && (
        <span
          className={`${s.name} font-semibold`}
          style={{ color: roleColor }}
        >
          {getRoleName(player.role)}
        </span>
      )}
    </button>
  )
}
