import activeWin from 'active-win'

export async function getActiveWindowInfo(): Promise<{ appName: string; windowTitle: string } | null> {
  try {
    const window = await activeWin()
    if (!window) return null
    return {
      appName: window.owner?.name || '',
      windowTitle: window.title || '',
    }
  } catch (error) {
    console.error('Error getting active window:', error)
    return null
  }
}
