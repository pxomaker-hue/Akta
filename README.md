# Akta — Suivi d'activité personnel

Application de bureau pour Windows qui suit automatiquement ton temps de travail : applications et fenêtres utilisées, sessions facturables, projets, mode Focus et coaching. Tout reste **en local** (SQLite), sans compte ni cloud.

Construit avec Electron, React, TypeScript et SQLite. Interface disponible en **français, anglais et allemand**.

## Installation

Télécharge `Akta.Setup.<version>.exe` depuis la page [Releases](https://github.com/pxomaker-hue/Akta/releases) et lance-le (Windows 64 bits). L'application se met à jour automatiquement ensuite.

## Fonctionnalités

### Suivi automatique
- Détection de la fenêtre active en arrière-plan, avec pause automatique en cas d'inactivité (délai réglable)
- Exclusions d'inactivité par application ou mot-clé du titre (regarder une vidéo sans toucher la souris, par exemple)
- Catégories avec règles de reconnaissance automatique (par application et par mot-clé du titre), tags libres, marquage facturable / personnel
- Timeline de la journée, tableau de bord, rapports hebdomadaires et analyses de productivité

### Sessions, projets et facturation
- Sessions de travail démarrables, pausables et arrêtables (bouton, icône de la zone de notification ou raccourcis globaux `Alt+Shift+S` / `Alt+Shift+X`)
- Clients, projets et **phases de projet** (ex. Esquisse, PC, DCE, Chantier), avec taux horaire
- **Budget (heures ou €), échéance et archivage** pour chaque projet *et* chaque phase ; un projet archivé met aussi ses phases en sommeil
- Notifications de dépassement de budget ou d'échéance, et prédictions de date d'atteinte du budget
- Exports CSV et PDF (par projet ou mensuel) pour la facturation

### Mode Focus et coaching
- Sessions minutées en mode simple ou chaîné façon Pomodoro, avec blocage des applications distrayantes
- Coaching en mode TDAH (micro-cycles, streaks, défis, jalons à débloquer) ou standard
- Recommandations personnalisées et durée de cycle optimale calculée à partir de ton historique

### Au quotidien
- Widget d'aperçu dans la zone de notification (épinglable en widget flottant)
- Thème clair / sombre / auto et couleur d'accent personnalisable
- Lancement au démarrage de Windows, réduction en arrière-plan à la fermeture
- Synchronisation optionnelle entre plusieurs ordinateurs via un fichier partagé (NAS, disque réseau…)
- Sauvegarde et restauration complètes au format JSON

## Développement

### Prérequis
Node.js, et les outils de compilation Windows nécessaires à `better-sqlite3` / `active-win`.

### Lancer le projet

```bash
npm install
npm run dev        # Electron + serveur Vite (http://localhost:3000)
```

### Compiler

```bash
npm run build      # compile le processus principal (tsc) et le renderer (Vite)
npm run dist       # génère l'installeur Windows dans release/
```

Le dossier `release/` n'est pas versionné : les installeurs sont publiés via les [Releases GitHub](https://github.com/pxomaker-hue/Akta/releases).

## Architecture

```
src/
├── main/                  # Processus principal Electron
│   ├── index.ts           # Fenêtres, tray, raccourcis, handlers IPC
│   ├── preload.ts         # Pont sécurisé main ↔ renderer
│   ├── database.ts        # Schéma SQLite, migrations, import/export
│   ├── tracker.ts         # Suivi de la fenêtre active, inactivité, sessions
│   ├── categorizer.ts     # Reconnaissance automatique des catégories
│   ├── focus-mode.ts      # Sessions Focus et blocage d'applications
│   ├── coach.ts           # Coaching, recommandations, notifications
│   ├── challenges.ts      # Défis et jalons
│   ├── analytics.ts       # Scores et tendances de productivité
│   ├── sync.ts            # Synchronisation par fichier partagé
│   ├── pdf-export.ts      # Exports PDF
│   ├── updater.ts         # Mises à jour automatiques
│   └── i18n.ts            # Traductions du texte généré côté main (fr/en/de)
├── renderer/              # Interface React
│   ├── App.tsx
│   ├── components/        # Écrans et composants (dont UI/ pour les éléments génériques)
│   ├── hooks/             # useTranslation, useTheme, useAccentColor…
│   └── locales/           # fr.json, en.json, de.json
└── shared/types.ts        # Types partagés main ↔ renderer
```

### Traductions
Le texte de l'interface passe par `t('clé', 'texte par défaut')` (`src/renderer/hooks/useTranslation.ts`). Toute nouvelle clé doit être ajoutée aux trois fichiers de `src/renderer/locales/` — sans quoi le texte par défaut (français) s'affiche dans toutes les langues. Le texte généré par le processus principal (notifications, tray, coaching, exports) est traduit dans `src/main/i18n.ts`.

## Confidentialité

Toutes les données restent sur ta machine. Aucune télémétrie : le seul accès réseau est la vérification des mises à jour.
