import { getSetting } from './database'

export type Language = 'fr' | 'en' | 'de'

// Le processus principal n'a pas accès au hook useTranslation() du renderer : on relit la même
// clé 'language' (table settings, déjà utilisée par get-setting/set-setting côté renderer) pour
// garder les deux en phase sans plomberie IPC supplémentaire.
export function getMainLanguage(): Language {
  const value = getSetting('language')
  return value === 'en' || value === 'de' ? value : 'fr'
}

type Dict = Record<string, string>

const tray: Record<Language, Dict> = {
  fr: {
    sessionStarted: 'Session démarrée',
    sessionPaused: 'Session en pause',
    sessionResumed: 'Session reprise',
    sessionStopped: 'Session arrêtée',
    pause: 'Pause',
    resume: 'Reprendre',
    stop: 'Arrêter',
    showApp: 'Afficher Akta',
    quit: 'Quitter',
    tooltip: "Akta — Suivi d'activité",
    statusRunning: 'en cours',
    statusPaused: 'pause',
    statusStopped: 'arrêtée',
  },
  en: {
    sessionStarted: 'Session started',
    sessionPaused: 'Session paused',
    sessionResumed: 'Session resumed',
    sessionStopped: 'Session stopped',
    pause: 'Pause',
    resume: 'Resume',
    stop: 'Stop',
    showApp: 'Show Akta',
    quit: 'Quit',
    tooltip: 'Akta — Activity tracker',
    statusRunning: 'running',
    statusPaused: 'paused',
    statusStopped: 'stopped',
  },
  de: {
    sessionStarted: 'Sitzung gestartet',
    sessionPaused: 'Sitzung pausiert',
    sessionResumed: 'Sitzung fortgesetzt',
    sessionStopped: 'Sitzung gestoppt',
    pause: 'Pause',
    resume: 'Fortsetzen',
    stop: 'Stoppen',
    showApp: 'Akta anzeigen',
    quit: 'Beenden',
    tooltip: 'Akta — Aktivitätsverfolgung',
    statusRunning: 'läuft',
    statusPaused: 'pausiert',
    statusStopped: 'gestoppt',
  },
}

const notifications: Record<Language, Dict> = {
  fr: {
    noProjectTitle: 'Akta — Sessions sans projet',
    noProjectBody: "Tu as {{count}} session(s) non attribuée(s) aujourd'hui. Assigne-les à un projet pour une meilleure facturation.",
    budgetExceededTitle: 'Akta — Budget dépassé',
    budgetExceededHoursBody: 'Le projet "{{project}}" a dépassé son budget en heures.',
    budgetExceededAmountBody: 'Le projet "{{project}}" a dépassé son budget en montant.',
    deadlinePassedTitle: 'Akta — Deadline passée',
    deadlinePassedBody: 'La deadline du projet "{{project}}" est passée.',
    deadlineApproachingTitle: 'Akta — Deadline approche',
    deadlineApproachingBody: 'La deadline du projet "{{project}}" approche ({{days}} jour(s) restant(s)).',
    phaseBudgetExceededHoursBody: 'La phase "{{phase}}" du projet "{{project}}" a dépassé son budget en heures.',
    phaseBudgetExceededAmountBody: 'La phase "{{phase}}" du projet "{{project}}" a dépassé son budget en montant.',
    phaseDeadlinePassedBody: 'La deadline de la phase "{{phase}}" du projet "{{project}}" est passée.',
    phaseDeadlineApproachingBody: 'La deadline de la phase "{{phase}}" du projet "{{project}}" approche ({{days}} jour(s) restant(s)).',
    focusSessionDoneTitle: 'Akta — Session terminée !',
    focusSessionDoneBody: 'Ta session de concentration est terminée, bien joué !',
  },
  en: {
    noProjectTitle: 'Akta — Sessions without project',
    noProjectBody: "You have {{count}} unassigned session(s) today. Assign them to a project for better billing.",
    budgetExceededTitle: 'Akta — Budget exceeded',
    budgetExceededHoursBody: 'Project "{{project}}" has exceeded its hours budget.',
    budgetExceededAmountBody: 'Project "{{project}}" has exceeded its amount budget.',
    deadlinePassedTitle: 'Akta — Deadline passed',
    deadlinePassedBody: 'The deadline for project "{{project}}" has passed.',
    deadlineApproachingTitle: 'Akta — Deadline approaching',
    deadlineApproachingBody: 'The deadline for project "{{project}}" is approaching ({{days}} day(s) left).',
    phaseBudgetExceededHoursBody: 'Phase "{{phase}}" of project "{{project}}" has exceeded its hours budget.',
    phaseBudgetExceededAmountBody: 'Phase "{{phase}}" of project "{{project}}" has exceeded its amount budget.',
    phaseDeadlinePassedBody: 'The deadline for phase "{{phase}}" of project "{{project}}" has passed.',
    phaseDeadlineApproachingBody: 'The deadline for phase "{{phase}}" of project "{{project}}" is approaching ({{days}} day(s) left).',
    focusSessionDoneTitle: 'Akta — Session complete!',
    focusSessionDoneBody: 'Your focus session is complete, well done!',
  },
  de: {
    noProjectTitle: 'Akta — Sitzungen ohne Projekt',
    noProjectBody: 'Du hast heute {{count}} nicht zugewiesene Sitzung(en). Weise sie einem Projekt zu für eine bessere Abrechnung.',
    budgetExceededTitle: 'Akta — Budget überschritten',
    budgetExceededHoursBody: 'Projekt "{{project}}" hat sein Stundenbudget überschritten.',
    budgetExceededAmountBody: 'Projekt "{{project}}" hat sein Betragsbudget überschritten.',
    deadlinePassedTitle: 'Akta — Frist abgelaufen',
    deadlinePassedBody: 'Die Frist für Projekt "{{project}}" ist abgelaufen.',
    deadlineApproachingTitle: 'Akta — Frist naht',
    deadlineApproachingBody: 'Die Frist für Projekt "{{project}}" naht ({{days}} Tag(e) verbleibend).',
    phaseBudgetExceededHoursBody: 'Die Phase "{{phase}}" des Projekts "{{project}}" hat ihr Stundenbudget überschritten.',
    phaseBudgetExceededAmountBody: 'Die Phase "{{phase}}" des Projekts "{{project}}" hat ihr Betragsbudget überschritten.',
    phaseDeadlinePassedBody: 'Die Frist für die Phase "{{phase}}" des Projekts "{{project}}" ist abgelaufen.',
    phaseDeadlineApproachingBody: 'Die Frist für die Phase "{{phase}}" des Projekts "{{project}}" naht ({{days}} Tag(e) verbleibend).',
    focusSessionDoneTitle: 'Akta — Sitzung abgeschlossen!',
    focusSessionDoneBody: 'Deine Fokus-Sitzung ist abgeschlossen, gut gemacht!',
  },
}

const coach: Record<Language, Dict> = {
  fr: {
    scatteredTitle: 'Akta — Un peu dispersé ?',
    scatteredAppSwitchBody: 'Tu as changé {{count}} fois d\'application ces dernières minutes.',
    streakTitle: 'Akta — 🏆 Streak en cours !',
    genericTitle: 'Akta',
    focusMinutesBody: '{{minutes}} minutes de concentration.',
    milestoneUnlockedTdahTitle: '🏆 Jalon Débloqué !',
    milestoneUnlockedTdahBody: '{{name}} — Vous êtes une légende ! 🌟',
    milestoneUnlockedStandardTitle: 'Jalon débloqué',
    challengeCompletedTdahTitle: '🏅 Défi Complété !',
    challengeCompletedStandardTitle: 'Défi complété',
    driftingTitle: 'Akta — Petit écart ?',
    onAppBody: 'Vous êtes sur {{app}}.',
    focusSessionCompletedTdahTitle: '✅ Focus Session Complétée !',
    focusSessionCompletedStandardTitle: 'Session complétée',
    focusSessionCompletedStandardBody: '{{minutes}} minutes.',
    challengeCompletedTdahBody1: '🎊 {{name}} COMPLÉTÉ ! Vous êtes une MACHINE !',
    challengeCompletedTdahBody2: '🚀 WOW ! {{name}} — Bravo champion !',
    challengeCompletedTdahBody3: '⚡ BOOM ! {{name}} — Vous êtes inarrêtable !',
    noSessionTodayBody: "Tu n'as pas lancé de session focus aujourd'hui. Une petite session de 15 min pour démarrer ?",
    scatteredAdviceBody: 'Ton focus est dispersé. Essaie des micro-cycles de 18 min (optimisé pour le TDAH) au lieu de 25.',
    improvingAdviceBody: "Ton focus s'améliore ! Continue avec des sessions régulières chaque jour.",
    cycleShort: 'Tu as du mal à tenir les cycles plus longs, on commence petit.',
    cycleTdah: 'Cycle court — optimal pour le TDAH, bien adapté si le focus se disperse vite.',
    cyclePomodoro: 'Pomodoro classique, tu as la capacité pour ce rythme.',
    cycleLong: 'Tu gères bien les sessions longues, autant en profiter.',
    recoPeakHour: 'Tu es le plus productif vers {{hour}}h. Bloque ce créneau pour du focus intense.',
    recoStreak: "C'est {{days}} jours d'affilée ! 🔥 Continue la série.",
    recoBillableHigh: "Tu as {{percent}}% de travail pro aujourd'hui. N'oublie pas de décompresser un peu !",
    recoBillableBalanced: 'Bonne répartition ! {{percent}}% pro, {{rest}}% perso. Bien dosé !',
    recoWorstHour: 'C\'est historiquement une mauvaise heure pour toi. Reste vigilant ou prends une pause recharge.',
    recoLongSession: 'Tes sessions durent {{minutes}} min en moyenne. Les micro-cycles de 18 min pourraient mieux te convenir !',
    recoMomentumSingular: "Tu as {{count}} session aujourd'hui. Une de plus pour la victoire ? 💪",
    recoMomentumPlural: "Tu as {{count}} sessions aujourd'hui. Une de plus pour la victoire ? 💪",
    adjustLowCompletion: 'seulement {{percent}}% de tes sessions vont au bout',
    adjustHighCompletion: '{{percent}}% de sessions complétées, tu peux viser plus long',
    adjustLowConsistency: 'peu de régularité récente, autant viser facile et souvent',
    adjustWorstHour: "c'est historiquement une heure difficile pour toi",
    deepWorkMsg1: '🔥 Incroyable ! {{minutes}} minutes de concentration pure !',
    deepWorkMsg2: "⭐ Vous dominez ! {{minutes}}min c'est du lourd !",
    deepWorkMsg3: '💪 Impressionnant ! Continuez cette énergie !',
    deepWorkMsg4: '🎯 En feu ! {{minutes}}min de deep work pur !',
    distraction1: 'Hé ho ! 👀 Tu driftes sur "{{app}}" — Retour au focus ?',
    distraction2: '⚠️ Dodo alerte ! "{{app}}" c\'est pendant la pause, pas pendant la session !',
    distraction3: '🎮 J\'ai vu ça ! On se refocalise champion ?',
    sessionDone1: '🎉 Session terminée ! {{minutes}} minutes de pure CONCENTRATION !',
    sessionDone2: '⭐ Champion ! Streak à {{days}} jours !',
    sessionDone3: '🏆 Vous êtes en FEU ! Session complétée avec succès !',
  },
  en: {
    scatteredTitle: 'Akta — A bit scattered?',
    scatteredAppSwitchBody: "You've switched apps {{count}} times in the last few minutes.",
    streakTitle: 'Akta — 🏆 Streak going!',
    genericTitle: 'Akta',
    focusMinutesBody: '{{minutes}} minutes of focus.',
    milestoneUnlockedTdahTitle: '🏆 Milestone Unlocked!',
    milestoneUnlockedTdahBody: '{{name}} — You\'re a legend! 🌟',
    milestoneUnlockedStandardTitle: 'Milestone unlocked',
    challengeCompletedTdahTitle: '🏅 Challenge Completed!',
    challengeCompletedStandardTitle: 'Challenge completed',
    driftingTitle: 'Akta — Drifting a bit?',
    onAppBody: "You're on {{app}}.",
    focusSessionCompletedTdahTitle: '✅ Focus Session Complete!',
    focusSessionCompletedStandardTitle: 'Session complete',
    focusSessionCompletedStandardBody: '{{minutes}} minutes.',
    challengeCompletedTdahBody1: '🎊 {{name}} COMPLETE! You\'re a MACHINE!',
    challengeCompletedTdahBody2: '🚀 WOW! {{name}} — Nice one, champion!',
    challengeCompletedTdahBody3: "⚡ BOOM! {{name}} — You're unstoppable!",
    noSessionTodayBody: "You haven't started a focus session today. A quick 15 min session to get going?",
    scatteredAdviceBody: 'Your focus is scattered. Try 18-min micro-cycles (optimized for ADHD) instead of 25.',
    improvingAdviceBody: 'Your focus is improving! Keep it up with regular daily sessions.',
    cycleShort: "You're finding it hard to hold longer cycles, let's start small.",
    cycleTdah: 'Short cycle — optimal for ADHD, good fit if focus scatters quickly.',
    cyclePomodoro: 'Classic Pomodoro, you can handle this pace.',
    cycleLong: "You handle long sessions well, might as well make the most of it.",
    recoPeakHour: "You're most productive around {{hour}}:00. Block that slot for intense focus.",
    recoStreak: "That's {{days}} days in a row! 🔥 Keep the streak going.",
    recoBillableHigh: "You've done {{percent}}% billable work today. Don't forget to decompress a little!",
    recoBillableBalanced: 'Good balance! {{percent}}% billable, {{rest}}% personal. Well dosed!',
    recoWorstHour: 'This is historically a bad hour for you. Stay alert or take a recharge break.',
    recoLongSession: 'Your sessions average {{minutes}} min. 18-min micro-cycles might suit you better!',
    recoMomentumSingular: 'You have {{count}} session today. One more for the win? 💪',
    recoMomentumPlural: 'You have {{count}} sessions today. One more for the win? 💪',
    adjustLowCompletion: 'only {{percent}}% of your sessions make it to the end',
    adjustHighCompletion: '{{percent}}% of sessions completed, you can aim longer',
    adjustLowConsistency: 'not much recent consistency, better to aim easy and often',
    adjustWorstHour: 'this is historically a tough hour for you',
    deepWorkMsg1: '🔥 Amazing! {{minutes}} minutes of pure focus!',
    deepWorkMsg2: "⭐ You're dominating! {{minutes}}min, that's serious!",
    deepWorkMsg3: '💪 Impressive! Keep that energy going!',
    deepWorkMsg4: '🎯 On fire! {{minutes}}min of pure deep work!',
    distraction1: 'Hey! 👀 You\'re drifting on "{{app}}" — Back to focus?',
    distraction2: '⚠️ Heads up! "{{app}}" is for breaks, not for the session!',
    distraction3: '🎮 Caught you! Let\'s refocus, champion?',
    sessionDone1: '🎉 Session complete! {{minutes}} minutes of pure FOCUS!',
    sessionDone2: '⭐ Champion! {{days}}-day streak!',
    sessionDone3: "🏆 You're ON FIRE! Session completed successfully!",
  },
  de: {
    scatteredTitle: 'Akta — Etwas abgelenkt?',
    scatteredAppSwitchBody: 'Du hast in den letzten Minuten {{count}} Mal die App gewechselt.',
    streakTitle: 'Akta — 🏆 Serie läuft!',
    genericTitle: 'Akta',
    focusMinutesBody: '{{minutes}} Minuten Konzentration.',
    milestoneUnlockedTdahTitle: '🏆 Meilenstein freigeschaltet!',
    milestoneUnlockedTdahBody: '{{name}} — Du bist eine Legende! 🌟',
    milestoneUnlockedStandardTitle: 'Meilenstein freigeschaltet',
    challengeCompletedTdahTitle: '🏅 Herausforderung abgeschlossen!',
    challengeCompletedStandardTitle: 'Herausforderung abgeschlossen',
    driftingTitle: 'Akta — Ein wenig abgeschweift?',
    onAppBody: 'Du bist bei {{app}}.',
    focusSessionCompletedTdahTitle: '✅ Fokus-Sitzung abgeschlossen!',
    focusSessionCompletedStandardTitle: 'Sitzung abgeschlossen',
    focusSessionCompletedStandardBody: '{{minutes}} Minuten.',
    challengeCompletedTdahBody1: '🎊 {{name}} ABGESCHLOSSEN! Du bist eine MASCHINE!',
    challengeCompletedTdahBody2: '🚀 WOW! {{name}} — Bravo, Champion!',
    challengeCompletedTdahBody3: '⚡ BOOM! {{name}} — Du bist nicht aufzuhalten!',
    noSessionTodayBody: 'Du hast heute noch keine Fokus-Sitzung gestartet. Eine kurze 15-Minuten-Sitzung zum Einstieg?',
    scatteredAdviceBody: 'Dein Fokus ist zerstreut. Versuche 18-Minuten-Mikrozyklen (optimiert für ADHS) statt 25.',
    improvingAdviceBody: 'Dein Fokus verbessert sich! Mach weiter mit regelmäßigen täglichen Sitzungen.',
    cycleShort: 'Dir fällt es schwer, längere Zyklen durchzuhalten, wir fangen klein an.',
    cycleTdah: 'Kurzer Zyklus — optimal für ADHS, gut geeignet, wenn der Fokus schnell abschweift.',
    cyclePomodoro: 'Klassischer Pomodoro, du kannst dieses Tempo gut halten.',
    cycleLong: 'Du kommst gut mit langen Sitzungen zurecht, nutze es aus.',
    recoPeakHour: 'Du bist am produktivsten gegen {{hour}} Uhr. Blockiere dieses Zeitfenster für intensiven Fokus.',
    recoStreak: 'Das sind {{days}} Tage in Folge! 🔥 Mach weiter mit der Serie.',
    recoBillableHigh: 'Du hast heute {{percent}}% abrechenbare Arbeit geleistet. Vergiss nicht, etwas abzuschalten!',
    recoBillableBalanced: 'Gute Balance! {{percent}}% beruflich, {{rest}}% privat. Gut dosiert!',
    recoWorstHour: 'Das ist historisch eine schlechte Stunde für dich. Bleib wachsam oder mach eine Erholungspause.',
    recoLongSession: 'Deine Sitzungen dauern im Schnitt {{minutes}} Min. 18-Minuten-Mikrozyklen könnten besser zu dir passen!',
    recoMomentumSingular: 'Du hast heute {{count}} Sitzung. Noch eine für den Sieg? 💪',
    recoMomentumPlural: 'Du hast heute {{count}} Sitzungen. Noch eine für den Sieg? 💪',
    adjustLowCompletion: 'nur {{percent}}% deiner Sitzungen werden zu Ende geführt',
    adjustHighCompletion: '{{percent}}% der Sitzungen abgeschlossen, du kannst länger anstreben',
    adjustLowConsistency: 'wenig Regelmäßigkeit zuletzt, lieber leicht und oft anpeilen',
    adjustWorstHour: 'das ist historisch eine schwierige Stunde für dich',
    deepWorkMsg1: '🔥 Unglaublich! {{minutes}} Minuten reine Konzentration!',
    deepWorkMsg2: '⭐ Du dominierst! {{minutes}} Min., das ist stark!',
    deepWorkMsg3: '💪 Beeindruckend! Mach weiter mit dieser Energie!',
    deepWorkMsg4: '🎯 In Flammen! {{minutes}} Min. purer Deep Work!',
    distraction1: 'Hallo! 👀 Du driftest bei "{{app}}" ab — zurück zum Fokus?',
    distraction2: '⚠️ Achtung! "{{app}}" ist für die Pause, nicht für die Sitzung!',
    distraction3: '🎮 Erwischt! Refokussieren, Champion?',
    sessionDone1: '🎉 Sitzung beendet! {{minutes}} Minuten reine KONZENTRATION!',
    sessionDone2: '⭐ Champion! {{days}}-Tage-Serie!',
    sessionDone3: 'Du bist in FORM! Sitzung erfolgreich abgeschlossen!',
  },
}

// Identité stable (type + seuil/durée/cible) plutôt que le texte affiché : le nom stocké en base
// peut rester en français pour les lignes déjà créées sans que ça casse la traduction à l'affichage.
const milestoneTranslations: Record<Language, Record<string, { name: string }>> = {
  fr: {
    'first_session:1': { name: '🌱 First Focus' },
    'sessions:10': { name: '🚀 Session 10' },
    'sessions:50': { name: '⭐ Session 50' },
    'sessions:100': { name: '🏆 Session 100' },
    'sessions:365': { name: '💎 Session 365' },
    'deep_work_hours:10': { name: '⏱️ 10h Deep Work' },
    'deep_work_hours:50': { name: '🎖️ 50h Deep Work' },
    'deep_work_hours:100': { name: '👑 100h Deep Work' },
  },
  en: {
    'first_session:1': { name: '🌱 First Focus' },
    'sessions:10': { name: '🚀 Session 10' },
    'sessions:50': { name: '⭐ Session 50' },
    'sessions:100': { name: '🏆 Session 100' },
    'sessions:365': { name: '💎 Session 365' },
    'deep_work_hours:10': { name: '⏱️ 10h Deep Work' },
    'deep_work_hours:50': { name: '🎖️ 50h Deep Work' },
    'deep_work_hours:100': { name: '👑 100h Deep Work' },
  },
  de: {
    'first_session:1': { name: '🌱 Erster Fokus' },
    'sessions:10': { name: '🚀 10 Sitzungen' },
    'sessions:50': { name: '⭐ 50 Sitzungen' },
    'sessions:100': { name: '🏆 100 Sitzungen' },
    'sessions:365': { name: '💎 365 Sitzungen' },
    'deep_work_hours:10': { name: '⏱️ 10 Std. Deep Work' },
    'deep_work_hours:50': { name: '🎖️ 50 Std. Deep Work' },
    'deep_work_hours:100': { name: '👑 100 Std. Deep Work' },
  },
}

const challengeTranslations: Record<Language, Record<string, { name: string; description: string }>> = {
  fr: {
    'streak:weekly:7': { name: '💪 7-Jour Streak', description: '7 jours consécutifs avec au moins 1 session focus' },
    'hours:monthly:50': { name: '🔥 50h Deep Work', description: '50 heures de deep work dans le mois' },
    'sessions:monthly:100': { name: '🎯 100 Sessions', description: '100 sessions focus complétées' },
    'consistency:weekly:7': { name: '⚡ Perfect Week', description: 'Chaque jour de la semaine avec session focus' },
  },
  en: {
    'streak:weekly:7': { name: '💪 7-Day Streak', description: '7 consecutive days with at least 1 focus session' },
    'hours:monthly:50': { name: '🔥 50h Deep Work', description: '50 hours of deep work this month' },
    'sessions:monthly:100': { name: '🎯 100 Sessions', description: '100 focus sessions completed' },
    'consistency:weekly:7': { name: '⚡ Perfect Week', description: 'Every day of the week with a focus session' },
  },
  de: {
    'streak:weekly:7': { name: '💪 7-Tage-Serie', description: '7 aufeinanderfolgende Tage mit mindestens 1 Fokus-Sitzung' },
    'hours:monthly:50': { name: '🔥 50 Std. Deep Work', description: '50 Stunden Deep Work in diesem Monat' },
    'sessions:monthly:100': { name: '🎯 100 Sitzungen', description: '100 Fokus-Sitzungen abgeschlossen' },
    'consistency:weekly:7': { name: '⚡ Perfekte Woche', description: 'Jeder Tag der Woche mit einer Fokus-Sitzung' },
  },
}

export function milestoneKey(type: string, threshold: number): string {
  return `${type}:${threshold}`
}

export function challengeKey(type: string, duration: string, target: number): string {
  return `${type}:${duration}:${target}`
}

export function translateMilestoneName(type: string, threshold: number, fallback: string, lang: Language = getMainLanguage()): string {
  return milestoneTranslations[lang][milestoneKey(type, threshold)]?.name ?? fallback
}

export function translateChallenge(
  type: string,
  duration: string,
  target: number,
  fallback: { name: string; description?: string },
  lang: Language = getMainLanguage()
): { name: string; description?: string } {
  const entry = challengeTranslations[lang][challengeKey(type, duration, target)]
  return entry ? { name: entry.name, description: entry.description } : fallback
}

// Les catégories par défaut (DEFAULT_CATEGORIES dans database.ts) restent volontairement seedées
// en français quelle que soit la langue : la vérification d'existence à chaque démarrage matche sur
// ce nom français exact (identité stable), donc traduire le libellé au seed casserait cette
// vérification pour les installations déjà existantes et dupliquerait les catégories par défaut.
// Les catégories restent de toute façon librement renommables par l'utilisateur après coup.

const csv: Record<Language, Dict> = {
  fr: {
    date: 'Date',
    startTime: 'Heure début',
    endTime: 'Heure fin',
    durationMin: 'Durée (min)',
    application: 'Application',
    windowTitle: 'Titre de fenêtre',
    category: 'Catégorie',
    billable: 'Facturable',
    phase: 'Phase',
    session: 'Session',
    billableDurationH: 'Durée facturable (h)',
    amount: 'Montant (€)',
    client: 'Client',
    project: 'Projet',
    uncategorized: 'Non catégorisé',
    yes: 'Oui',
    no: 'Non',
  },
  en: {
    date: 'Date',
    startTime: 'Start time',
    endTime: 'End time',
    durationMin: 'Duration (min)',
    application: 'Application',
    windowTitle: 'Window title',
    category: 'Category',
    billable: 'Billable',
    phase: 'Phase',
    session: 'Session',
    billableDurationH: 'Billable duration (h)',
    amount: 'Amount (€)',
    client: 'Client',
    project: 'Project',
    uncategorized: 'Uncategorized',
    yes: 'Yes',
    no: 'No',
  },
  de: {
    date: 'Datum',
    startTime: 'Startzeit',
    endTime: 'Endzeit',
    durationMin: 'Dauer (Min.)',
    application: 'Anwendung',
    windowTitle: 'Fenstertitel',
    category: 'Kategorie',
    billable: 'Abrechenbar',
    phase: 'Phase',
    session: 'Sitzung',
    billableDurationH: 'Abrechenbare Dauer (Std.)',
    amount: 'Betrag (€)',
    client: 'Kunde',
    project: 'Projekt',
    uncategorized: 'Nicht kategorisiert',
    yes: 'Ja',
    no: 'Nein',
  },
}

const LOCALE_TAGS: Record<Language, string> = { fr: 'fr-FR', en: 'en-US', de: 'de-DE' }
export function mainLocaleTag(lang: Language = getMainLanguage()): string {
  return LOCALE_TAGS[lang]
}

const misc: Record<Language, Dict> = {
  fr: { you: '🎮 Toi' },
  en: { you: '🎮 You' },
  de: { you: '🎮 Du' },
}

export function mt(dict: 'tray' | 'notifications' | 'coach' | 'csv' | 'misc', key: string, lang: Language = getMainLanguage()): string {
  const table = { tray, notifications, coach, csv, misc }[dict]
  return table[lang][key] ?? table.fr[key] ?? key
}

export function mtf(dict: 'tray' | 'notifications' | 'coach' | 'csv' | 'misc', key: string, values: Record<string, string | number>, lang: Language = getMainLanguage()): string {
  const text = mt(dict, key, lang)
  return Object.entries(values).reduce((acc, [k, v]) => acc.split(`{{${k}}}`).join(String(v)), text)
}
