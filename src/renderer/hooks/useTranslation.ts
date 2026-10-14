import { useEffect, useState } from 'react'
import frTranslations from '../locales/fr.json'
import enTranslations from '../locales/en.json'
import deTranslations from '../locales/de.json'

export type Language = 'fr' | 'en' | 'de'

// Tag de locale pour Intl/toLocaleDateString etc. — plusieurs composants formatent des dates avec
// un tag figé en dur ('fr-FR'), ce qui reste français même quand la langue de l'app change.
const LOCALE_TAGS: Record<Language, string> = {
  fr: 'fr-FR',
  en: 'en-US',
  de: 'de-DE',
}

export function localeTag(language: Language): string {
  return LOCALE_TAGS[language] || 'fr-FR'
}

interface Translations {
  [key: string]: string
}

const translations: Record<Language, Translations> = {
  fr: frTranslations,
  en: enTranslations,
  de: deTranslations,
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
