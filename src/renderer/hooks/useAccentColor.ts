import { useEffect, useState } from 'react'
import { ACCENT_PRESETS, DEFAULT_ACCENT_ID, getAccentPreset } from '../../shared/accentPresets'

function applyAccent(id: string) {
  const preset = getAccentPreset(id)
  document.documentElement.style.setProperty('--accent-primary', preset.primary)
  document.documentElement.style.setProperty('--accent-secondary', preset.secondary)
}

export function useAccentColor() {
  const [accentId, setAccentId] = useState(DEFAULT_ACCENT_ID)

  useEffect(() => {
    loadAccent()

    const handleSettingChange = (data: { key: string; value: string }) => {
      if (data.key === 'accent_color') {
        setAccentId(data.value)
        applyAccent(data.value)
      }
    }

    window.electron?.ipc?.on('setting-changed', handleSettingChange)
    return () => {
      window.electron?.ipc?.off('setting-changed', handleSettingChange)
    }
  }, [])

  async function loadAccent() {
    try {
      const saved = await window.electron.ipc.invoke('get-setting', 'accent_color')
      const id = saved || DEFAULT_ACCENT_ID
      setAccentId(id)
      applyAccent(id)
    } catch (error) {
      console.error('Error loading accent color:', error)
      applyAccent(DEFAULT_ACCENT_ID)
    }
  }

  const setAccent = async (id: string) => {
    await window.electron.ipc.invoke('set-setting', 'accent_color', id)
    setAccentId(id)
    applyAccent(id)
  }

  return { accentId, setAccent, presets: ACCENT_PRESETS }
}
