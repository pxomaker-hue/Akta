import { useSyncExternalStore } from 'react'
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

type TranslateFn = (key: string, defaultValue?: string) => string

// Une fonction t stable par langue : les composants qui la mettent en dépendance d'un effet ne
// se relancent que lorsque la langue change réellement.
const translators = {} as Record<Language, TranslateFn>
function translatorFor(language: Language): TranslateFn {
  if (!translators[language]) {
    const dict = translations[language] || translations.fr
    translators[language] = (key, defaultValue) => dict[key] || defaultValue || key
  }
  return translators[language]
}

// État de langue partagé au niveau du module. Chaque composant appelait auparavant
// get-setting et s'abonnait à 'setting-changed' pour son propre compte : une page comme
// Activités (une ligne = un composant traduit) dépassait ainsi les 150 écouteurs IPC simultanés.
// Désormais il n'y a qu'un seul écouteur IPC et une seule lecture du réglage, peu importe le
// nombre de composants montés.
let currentLanguage: Language = 'fr'
const subscribers = new Set<() => void>()
let unsubscribeIpc: (() => void) | undefined
let languageLoaded = false

function applyLanguage(newLanguage: Language) {
  const next: Language = translations[newLanguage] ? newLanguage : 'fr'
  document.documentElement.lang = next
  if (next === currentLanguage) return
  currentLanguage = next
  subscribers.forEach((notify) => notify())
}

async function loadLanguage() {
  try {
    const saved = (await window.electron.ipc.invoke('get-setting', 'language')) as Language
    applyLanguage(saved || 'fr')
  } catch (error) {
    console.error('Error loading language:', error)
    applyLanguage('fr')
  }
}

function subscribe(notify: () => void) {
  subscribers.add(notify)
  if (!unsubscribeIpc) {
    unsubscribeIpc = window.electron?.ipc?.on('setting-changed', (data: { key: string; value: string }) => {
      if (data.key === 'language') applyLanguage(data.value as Language)
    })
  }
  if (!languageLoaded) {
    languageLoaded = true
    loadLanguage()
  }
  return () => {
    subscribers.delete(notify)
    if (subscribers.size === 0) {
      unsubscribeIpc?.()
      unsubscribeIpc = undefined
    }
  }
}

export function useTranslation() {
  const language = useSyncExternalStore(subscribe, () => currentLanguage)
  return { language, t: translatorFor(language), setLanguage: applyLanguage }
}
