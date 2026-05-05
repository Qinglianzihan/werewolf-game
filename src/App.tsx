import { useGameStore } from './store/gameStore'
import { Phase } from './domain/types'
import Lobby from './components/Lobby/Lobby'
import Game from './components/Game/Game'

function App() {
  const phase = useGameStore(s => s.phase)
  const isLobby = phase === Phase.Lobby

  return (
    <div className="relative min-h-screen bg-bg-base font-body text-text-primary overflow-hidden">
      {/* SVG texture filters — referenced via CSS filter: url(#parchment-noise) */}
      <svg className="absolute w-0 h-0" aria-hidden="true">
        <defs>
          <filter id="parchment-noise">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.04"
              numOctaves="4"
              stitchTiles="stitch"
            />
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer>
              <feFuncA type="table" tableValues="0 0 0.06 0.08" />
            </feComponentTransfer>
            <feBlend in="SourceGraphic" mode="multiply" />
          </filter>
          <filter id="parchment-noise-heavy">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.02"
              numOctaves="5"
              stitchTiles="stitch"
            />
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer>
              <feFuncA type="table" tableValues="0 0.04 0.08 0.12" />
            </feComponentTransfer>
            <feBlend in="SourceGraphic" mode="multiply" />
          </filter>
        </defs>
      </svg>

      {/* Ambient light pools */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: `
            radial-gradient(ellipse 40% 50% at 15% 20%, rgba(212,168,83,0.04) 0%, transparent 70%),
            radial-gradient(ellipse 30% 40% at 85% 80%, rgba(212,168,83,0.03) 0%, transparent 70%),
            radial-gradient(ellipse 50% 30% at 50% 0%, rgba(240,192,96,0.02) 0%, transparent 60%)
          `,
        }}
      />

      {/* Moonlight vignette */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: 'radial-gradient(ellipse at 50% 0%, transparent 40%, rgba(0,0,0,0.5) 100%)',
        }}
      />

      {/* Main content */}
      <div className="relative z-10">
        {isLobby ? <Lobby /> : <Game />}
      </div>
    </div>
  )
}

export default App
