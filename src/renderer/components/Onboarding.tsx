import { useEffect, useState } from 'react'
import { Icon, type IconName } from './UI'
import { useTranslation, type Language } from '../hooks/useTranslation'

const LANGUAGE_OPTIONS: { value: Language; label: string }[] = [
  { value: 'fr', label: '🇫🇷 Français' },
  { value: 'en', label: '🇬🇧 English' },
  { value: 'de', label: '🇩🇪 Deutsch' },
]

interface OnboardingStep {
  icon: IconName
  key: string
  title: string
  description: string
}

// title/description : texte français par défaut, utilisé comme fallback si la clé de traduction
// (onboarding.<key>.title / .description) est absente pour la langue active.
const STEPS: OnboardingStep[] = [
  {
    icon: 'sparkles',
    key: 'welcome',
    title: 'Bienvenue sur Akta',
    description:
      "Akta suit ton temps de travail automatiquement, en arrière-plan — plus besoin de penser à démarrer un chrono à chaque fois que tu changes de tâche.",
  },
  {
    icon: 'laptop',
    key: 'autoTracking',
    title: 'Suivi automatique',
    description:
      "Dès que tu utilises ton ordinateur, Akta enregistre les applications et fenêtres utilisées, et détecte les pauses d'inactivité pour ne compter que ton temps réellement actif.",
  },
  {
    icon: 'moon',
    key: 'inactivity',
    title: "Détection d'inactivité",
    description:
      "Si tu ne bouges pas la souris ni ne changes d'application pendant un moment, ta session se met automatiquement en pause. Tu regardes une vidéo sans toucher à la souris ? Exclus l'appli concernée (par nom ou mot-clé dans le titre de la fenêtre) dans Paramètres → Inactivité pour éviter les fausses pauses.",
  },
  {
    icon: 'chart-line',
    key: 'timeline',
    title: 'Timeline & tableau de bord',
    description:
      "Visualise ta journée heure par heure sur la Timeline, navigue vers les jours précédents, et retrouve tes statistiques — temps facturable, deep work, répartition par catégorie — sur le Tableau de bord.",
  },
  {
    icon: 'target',
    key: 'sessions',
    title: 'Sessions & facturation',
    description:
      "Démarre une session pour délimiter une tâche facturable — depuis le bouton en haut de l'app ou les raccourcis Alt+Shift+S (démarrer / pause / reprendre) et Alt+Shift+X (arrêter). Marque ensuite chaque session comme facturable en un clic.",
  },
  {
    icon: 'brain',
    key: 'focusMode',
    title: 'Mode Focus',
    description:
      "Lance une session minutée pour bloquer les applications qui te distraient. Choisis le mode Simple (un seul minuteur) ou Chaîné façon Pomodoro (plusieurs sessions de concentration entrecoupées de pauses, entièrement configurables). L'option \"Créer une session de travail\" démarre en parallèle une session facturable si aucune n'est déjà en cours.",
  },
  {
    icon: 'award',
    key: 'coaching',
    title: 'Coaching & Défis Focus',
    description:
      "Akta analyse tes sessions passées pour te proposer un cycle optimal et des recommandations personnalisées (avec un bouton pour les lancer directement). En mode TDAH (Paramètres → Coaching), profite en plus de défis, d'un streak de jours consécutifs et de jalons à débloquer — survole-les pour voir le détail.",
  },
  {
    icon: 'chart-pie',
    key: 'activities',
    title: 'Activités',
    description:
      "Filtre tes activités par plage de dates, catégories, tags ou facturation grâce aux pastilles de filtre. Le résumé à droite de la liste affiche la répartition Professionnel / Personnel de tes activités sous forme de camembert.",
  },
  {
    icon: 'folder',
    key: 'projects',
    title: 'Projets & clients',
    description:
      "Crée tes clients et projets avec un taux horaire pour chacun. Rattache tes sessions à un projet pour obtenir automatiquement le montant facturable de chaque mission, et consulte tes prévisions de budget en bas de l'onglet.",
  },
  {
    icon: 'tag',
    key: 'categories',
    title: 'Catégories & tags',
    description:
      "Organise ton activité par catégories, avec une reconnaissance automatique à la fois par application et par mot-clé dans le titre de la fenêtre (ex : Crunchyroll dans ton navigateur part en Divertissement, pas en Navigation web). Ajoute aussi des tags libres pour retrouver facilement une activité précise.",
  },
  {
    icon: 'pin',
    key: 'trayWidget',
    title: 'Aperçu depuis la zone de notification',
    description:
      "Clique sur l'icône Akta dans la zone de notification (à côté de l'horloge) pour un petit aperçu : session en cours, minuteur Focus, résumé du jour — sans ouvrir la fenêtre principale. Épingle-le pour en faire un widget flottant permanent, ou double-clique sur l'icône pour ouvrir Akta en entier.",
  },
  {
    icon: 'check',
    key: 'privacy',
    title: 'Tes données restent chez toi',
    description:
      "Aucune donnée n'est envoyée dans le cloud : tout reste stocké localement sur ta machine. Tu peux exporter une sauvegarde ou synchroniser plusieurs machines via un simple fichier partagé (Paramètres → Sauvegarde) — les suppressions sont bien prises en compte entre les machines synchronisées.",
  },
]

interface OnboardingProps {
  onComplete: () => void
}

function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0)
  const { language, setLanguage, t } = useTranslation()
  const isLast = step === STEPS.length - 1
  const current = STEPS[step]
  const currentTitle = t(`onboarding.${current.key}.title`, current.title)
  const currentDescription = t(`onboarding.${current.key}.description`, current.description)

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang)
    window.electron.ipc.invoke('set-setting', 'language', lang).catch((error) => {
      console.error('Error saving language:', error)
    })
  }

  const next = () => {
    if (isLast) onComplete()
    else setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }
  const prev = () => setStep((s) => Math.max(s - 1, 0))

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onComplete()
      if (e.key === 'Enter' || e.key === 'ArrowRight') next()
      if (e.key === 'ArrowLeft') prev()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      {/* Hauteur fixe (et contenu du milieu centré dedans) : sinon la fenêtre change de taille
          d'une slide à l'autre selon la longueur du texte, ce qui donne un effet de saut disgracieux. */}
      <div className="relative w-full max-w-lg h-[560px] flex flex-col bg-gradient-to-br from-white via-gray-50 to-gray-100 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 p-8 animate-fade-in-scale">
        <button
          onClick={onComplete}
          className="absolute top-5 right-5 text-xs text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
        >
          {t('onboarding.skip', "Passer l'introduction")}
        </button>

        <div key={step} className="flex-1 flex flex-col items-center justify-center text-center gap-4 animate-pop-in">
          <div className="w-16 h-16 rounded-full accent-gradient-bg flex items-center justify-center text-white shadow-md flex-shrink-0">
            <Icon name={current.icon} size={28} />
          </div>
          <h2 className="text-xl font-bold accent-gradient-text">{currentTitle}</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed max-w-sm">{currentDescription}</p>

          {step === 0 && (
            <div className="flex gap-2 mt-1">
              {LANGUAGE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleLanguageChange(opt.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 active:scale-95 ${
                    language === opt.value
                      ? 'accent-gradient-bg text-white'
                      : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-center gap-1.5 mb-6">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              aria-label={`${t('onboarding.step', 'Étape')} ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? 'w-6 accent-gradient-bg' : 'w-1.5 bg-gray-300 dark:bg-slate-600 hover:bg-gray-400 dark:hover:bg-slate-500'
              }`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={prev}
            disabled={step === 0}
            className="px-4 py-2 text-sm rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 font-medium hover:bg-gray-200 dark:hover:bg-slate-700 disabled:opacity-0 disabled:pointer-events-none transition-colors"
          >
            {t('onboarding.prev', 'Précédent')}
          </button>
          <button
            onClick={next}
            className="px-5 py-2 text-sm rounded-lg accent-gradient-bg text-white font-semibold hover:brightness-110 transition-all shadow-sm"
          >
            {isLast ? t('onboarding.finish', 'Commencer à utiliser Akta') : t('onboarding.next', 'Suivant')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default Onboarding
