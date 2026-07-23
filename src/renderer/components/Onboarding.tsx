import { useEffect, useState } from 'react'
import { Icon, type IconName } from './UI'

interface OnboardingStep {
  icon: IconName
  title: string
  description: string
}

const STEPS: OnboardingStep[] = [
  {
    icon: 'sparkles',
    title: 'Bienvenue sur Akta',
    description:
      "Akta suit ton temps de travail automatiquement, en arrière-plan — plus besoin de penser à démarrer un chrono à chaque fois que tu changes de tâche.",
  },
  {
    icon: 'laptop',
    title: 'Suivi automatique',
    description:
      "Dès que tu utilises ton ordinateur, Akta enregistre les applications et fenêtres utilisées, et détecte les pauses d'inactivité pour ne compter que ton temps réellement actif.",
  },
  {
    icon: 'moon',
    title: "Détection d'inactivité",
    description:
      "Si tu ne bouges pas la souris ni ne changes d'application pendant un moment, ta session se met automatiquement en pause. Tu regardes une vidéo sans toucher à la souris ? Exclus l'appli concernée dans Paramètres → Inactivité pour éviter les fausses pauses.",
  },
  {
    icon: 'chart-line',
    title: 'Timeline & tableau de bord',
    description:
      "Visualise ta journée heure par heure sur la Timeline, navigue vers les jours précédents, et retrouve tes statistiques — temps facturable, deep work, répartition par catégorie — sur le Tableau de bord.",
  },
  {
    icon: 'target',
    title: 'Sessions & facturation',
    description:
      "Démarre une session pour délimiter une tâche facturable — depuis le bouton en haut de l'app ou les raccourcis Alt+Shift+S (démarrer / pause / reprendre) et Alt+Shift+X (arrêter). Marque ensuite chaque session comme facturable en un clic.",
  },
  {
    icon: 'brain',
    title: 'Mode Focus',
    description:
      "Lance une session minutée pendant laquelle Akta peut bloquer les applications qui te distraient (réseaux sociaux, etc.), pour rester concentré sur une tâche précise sans y penser. Accessible depuis le Tableau de bord.",
  },
  {
    icon: 'folder',
    title: 'Projets & clients',
    description:
      "Crée tes clients et projets avec un taux horaire pour chacun. Rattache tes sessions à un projet pour obtenir automatiquement le montant facturable de chaque mission.",
  },
  {
    icon: 'tag',
    title: 'Catégories & tags',
    description:
      "Organise ton activité par catégories (avec reconnaissance automatique par application) et ajoute des tags libres pour retrouver facilement une activité précise.",
  },
  {
    icon: 'check',
    title: 'Tes données restent chez toi',
    description:
      "Aucune donnée n'est envoyée dans le cloud : tout reste stocké localement sur ta machine. Tu peux exporter une sauvegarde ou synchroniser plusieurs machines via un simple fichier partagé (Paramètres → Sauvegarde).",
  },
]

interface OnboardingProps {
  onComplete: () => void
}

function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0)
  const isLast = step === STEPS.length - 1
  const current = STEPS[step]

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
          Passer l'introduction
        </button>

        <div key={step} className="flex-1 flex flex-col items-center justify-center text-center gap-4 animate-pop-in">
          <div className="w-16 h-16 rounded-full accent-gradient-bg flex items-center justify-center text-white shadow-md flex-shrink-0">
            <Icon name={current.icon} size={28} />
          </div>
          <h2 className="text-xl font-bold accent-gradient-text">{current.title}</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed max-w-sm">{current.description}</p>
        </div>

        <div className="flex justify-center gap-1.5 mb-6">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              aria-label={`Étape ${i + 1}`}
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
            Précédent
          </button>
          <button
            onClick={next}
            className="px-5 py-2 text-sm rounded-lg accent-gradient-bg text-white font-semibold hover:brightness-110 transition-all shadow-sm"
          >
            {isLast ? 'Commencer à utiliser Akta' : 'Suivant'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default Onboarding
