import { useEffect, useState } from 'react'
import Lottie from 'lottie-react'
import neutralVideo from '../assets/mascot/neutral.mp4'
import focusedVideo from '../assets/mascot/focused.mp4'

export type MascotMood = 'happy' | 'neutral' | 'sleepy' | 'focused' | 'celebrate'

interface MascotProps {
  mood: MascotMood
  size?: number
  message?: string
  background?: 'gray' | 'white'
}

// Chargées à la demande (et non inlinées au build) : chaque fichier Lottie pèse ~90-110KB, les
// embarquer directement dans le bundle principal l'alourdissait inutilement au démarrage.
const LOTTIE_LOADERS: Partial<Record<MascotMood, () => Promise<{ default: object }>>> = {
  sleepy: () => import('../assets/mascot/sleepy.json'),
  happy: () => import('../assets/mascot/happy.json'),
  celebrate: () => import('../assets/mascot/celebrate.json'),
}

const VIDEO_SOURCES: Partial<Record<MascotMood, string>> = {
  neutral: neutralVideo,
  focused: focusedVideo,
}

const lottieCache = new Map<MascotMood, object>()

function Mascot({ mood, size = 64, message, background = 'gray' }: MascotProps) {
  const [lottieData, setLottieData] = useState<object | null>(lottieCache.get(mood) ?? null)
  const videoSrc = VIDEO_SOURCES[mood]

  useEffect(() => {
    const loader = LOTTIE_LOADERS[mood]
    if (!loader) {
      setLottieData(null)
      return
    }
    const cached = lottieCache.get(mood)
    if (cached) {
      setLottieData(cached)
      return
    }
    let cancelled = false
    loader().then((mod) => {
      const data = mod.default ?? (mod as unknown as object)
      lottieCache.set(mood, data)
      if (!cancelled) setLottieData(data)
    })
    return () => {
      cancelled = true
    }
  }, [mood])

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        key={mood}
        className={`rounded-full overflow-hidden flex-shrink-0 shadow-md animate-pop-in ${background === 'white' ? 'bg-white' : 'bg-gray-50'}`}
        style={{ width: size, height: size }}
      >
        {lottieData ? (
          <Lottie animationData={lottieData} loop autoplay style={{ width: size, height: size }} />
        ) : videoSrc ? (
          // key força un remount (donc un redémarrage propre de la lecture) à chaque changement d'état
          <video
            key={mood}
            src={videoSrc}
            autoPlay
            loop
            muted
            playsInline
            style={{ width: size, height: size, objectFit: 'cover' }}
          />
        ) : null}
      </div>

      {message && <p className="text-xs text-gray-600 dark:text-gray-400 text-center max-w-[140px] font-medium">{message}</p>}
    </div>
  )
}

export default Mascot
