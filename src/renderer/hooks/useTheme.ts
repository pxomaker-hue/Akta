import { useEffect, useRef, useState } from 'react'

type Theme = 'light' | 'dark' | 'auto'

export function useTheme() {
  const [theme, setTheme] = useState<Theme>('dark')
  const [isDark, setIsDark] = useState(false)
  // Thème choisi courant, lu par l'écouteur système (qui ne doit pas être réabonné à chaque changement)
  const themeRef = useRef<Theme>('dark')

  // En mode Auto, suivre en direct le basculement clair/sombre de Windows (sans redémarrer l'app)
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handleSystemChange = () => {
      if (themeRef.current === 'auto') applyTheme('auto')
    }
    media.addEventListener('change', handleSystemChange)
    return () => media.removeEventListener('change', handleSystemChange)
  }, [])

  useEffect(() => {
    // Load theme from settings
    loadTheme()

    // Listen for setting changes via IPC
    const handleSettingChange = (key: string, value: string) => {
      if (key === 'theme') {
        applyTheme(value as Theme)
      }
    }

    const unsubscribe = window.electron?.ipc?.on('setting-changed', (data: { key: string; value: string }) => {
      handleSettingChange(data.key, data.value)
    })

    return () => {
      unsubscribe?.()
    }
  }, [])

  async function loadTheme() {
    try {
      const savedTheme = await window.electron.ipc.invoke('get-setting', 'theme')
      const themeValue = (savedTheme as Theme) || 'dark'
      applyTheme(themeValue)
    } catch (error) {
      console.error('Error loading theme:', error)
      applyTheme('dark')
    }
  }

  function applyTheme(newTheme: Theme) {
    themeRef.current = newTheme
    setTheme(newTheme)

    let shouldBeDark = false

    if (newTheme === 'auto') {
      // Check system preference
      shouldBeDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    } else {
      shouldBeDark = newTheme === 'dark'
    }

    setIsDark(shouldBeDark)

    // Apply to DOM
    if (shouldBeDark) {
      document.documentElement.classList.add('dark')
      document.documentElement.style.colorScheme = 'dark'
    } else {
      document.documentElement.classList.remove('dark')
      document.documentElement.style.colorScheme = 'light'
    }
  }

  const handleSetTheme = async (newTheme: Theme) => {
    await window.electron.ipc.invoke('set-setting', 'theme', newTheme)
    applyTheme(newTheme)
  }

  return { theme, isDark, setTheme: handleSetTheme }
}
