import { useMemo, useState, useEffect } from 'react'
import type { WorkSession } from '../../shared/types'
import { Icon, Stat } from './UI'
import { useTranslation } from '../hooks/useTranslation'

function tf(text: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((acc, [key, value]) => acc.replaceAll(`{{${key}}}`, String(value)), text)
}

interface LiveSessionStatProps {
  sessions: WorkSession[]
}

function LiveSessionStat({ sessions }: LiveSessionStatProps) {
  const { t } = useTranslation()
  const [nowTick, setNowTick] = useState(Date.now())

  useEffect(() => {
    const tick = setInterval(() => setNowTick(Date.now()), 1000)
    return () => clearInterval(tick)
  }, [])

  const totalSessionSeconds = useMemo(() => {
    return sessions.reduce((sum, s) => {
      if (s.end_time === null) return sum + Math.floor((nowTick - s.start_time) / 1000)
      return sum + s.duration_seconds
    }, 0)
  }, [sessions, nowTick])

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours === 0) return `${minutes}m`
    return `${hours}h ${minutes}m`
  }

  return (
    <Stat
      label={t('liveSessionStat.sessionTime', 'Temps de session')}
      value={formatTime(totalSessionSeconds)}
      icon={<Icon name="target" size={18} />}
      subtext={tf(
        sessions.length === 1 ? t('liveSessionStat.countSingular', '{{n}} session') : t('liveSessionStat.countPlural', '{{n}} sessions'),
        { n: sessions.length }
      )}
      gradient="from-violet-50 to-violet-100 dark:from-violet-900/30 dark:to-violet-800/20"
    />
  )
}

export default LiveSessionStat
