import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark' | 'auto'

export function useTheme() {
  const [theme, setTheme] = useState<Theme>('dark')
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    // Load theme from settings
    loadTheme()

    // Listen for setting changes via IPC
    const handleSettingChange = (key: string, value: string) => {
      if (key === 'theme') {
        applyTheme(value as Theme)
      }
    }

    window.electron?.ipc?.on('setting-changed', (data: { key: string; value: string }) => {
      handleSettingChange(data.key, data.value)
    })

    return () => {
      window.electron?.ipc?.off('setting-changed', handleSettingChange)
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
