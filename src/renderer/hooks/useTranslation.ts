import { useEffect, useState } from 'react'
import frTranslations from '../locales/fr.json'
import enTranslations from '../locales/en.json'

type Language = 'fr' | 'en'

interface Translations {
  [key: string]: string
}

const translations: Record<Language, Translations> = {
  fr: frTranslations,
  en: enTranslations,
}

export function useTranslation() {
  const [language, setLanguage] = useState<Language>('fr')
  const [t, setT] = useState<(key: string, defaultValue?: string) => string>(() => (key: string) => key)

  useEffect(() => {
    loadLanguage()

    // Listen for language changes via IPC
    const handleSettingChange = (data: { key: string; value: string }) => {
      if (data.key === 'language') {
        applyLanguage(data.value as Language)
      }
    }

    window.electron?.ipc?.on('setting-changed', handleSettingChange)

    return () => {
      window.electron?.ipc?.off('setting-changed', handleSettingChange)
    }
  }, [])

  async function loadLanguage() {
    try {
      const savedLanguage = (await window.electron.ipc.invoke('get-setting', 'language')) as Language
      const langValue = (savedLanguage || 'fr') as Language
      applyLanguage(langValue)
    } catch (error) {
      console.error('Error loading language:', error)
      applyLanguage('fr')
    }
  }

  function applyLanguage(newLanguage: Language) {
    setLanguage(newLanguage)

    const currentTranslations = translations[newLanguage] || translations['fr']

    const translationFunction = (key: string, defaultValue?: string) => {
      const value = currentTranslations[key]
      return value || defaultValue || key
    }

    setT(() => translationFunction)

    // Update HTML lang attribute
    document.documentElement.lang = newLanguage
  }

  return { language, t, setLanguage: applyLanguage }
}
