import Mascot from './Mascot'
import { useLiveSession } from '../contexts/LiveSessionContext'

function LiveSessionMascot() {
  const { status, mood } = useLiveSession()

  if (!status) return null

  return <Mascot mood={mood} size={110} />
}

export default LiveSessionMascot
