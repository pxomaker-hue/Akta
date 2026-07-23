# Akta - Suivi d'Activité Personnel

Application de suivi d'activité légère pour Windows. Enregistrez chaque application et fenêtre que vous utilisez, catégorisez-les, et analysez vos patterns de productivité. Construit avec Electron, React et SQLite (100% local).

## Architecture

### Structure des dossiers

```
akta/
├── src/
│   ├── main/              # Processus principal Electron (backend)
│   │   ├── index.ts       # Initialisation Electron & IPC
│   │   ├── preload.ts     # Pont de sécurité main ↔ renderer
│   │   ├── database.ts    # SQLite schéma & initialisation
│   │   └── tracker.ts     # Suivi activité & détection idle
│   ├── renderer/          # Interface React (frontend)
│   │   ├── main.tsx       # Point d'entrée React
│   │   ├── App.tsx        # Composant principal
│   │   ├── index.css      # Styles Tailwind
│   │   └── components/    # Composants React réutilisables
│   └── shared/
│       └── types.ts       # Interfaces TypeScript partagées
├── index.html             # Template HTML fenêtre Electron
├── vite.config.ts         # Config bundler Vite
├── tsconfig.json          # Config TypeScript (renderer)
├── tsconfig.main.json     # Config TypeScript (main)
├── package.json           # Dépendances & scripts
├── tailwind.config.js     # Config Tailwind CSS
└── postcss.config.js      # Config PostCSS
```

### Technologies Clés

- **Electron**: Framework app desktop
- **TypeScript**: Typage statique partout
- **React**: Composants UI & gestion d'état
- **Tailwind CSS**: Styles utility-first
- **SQLite (better-sqlite3)**: Stockage local
- **active-win**: Détecte fenêtre active (Windows)
- **Recharts**: Graphiques dashboard

---

## Démarrage

### 1. Installer les dépendances

```bash
npm install --legacy-peer-deps
```

### 2. Lancer en développement

```bash
npm run dev
```

Démarre:
- Processus main Electron (TypeScript watcher)
- Serveur React Vite (http://localhost:3000)
- Fenêtre Electron

### 3. Build production

```bash
npm run build       # Compile TypeScript & bundle React
npm run dist        # Crée installer Windows (.exe)
```

---

## Comment ça marche

### Suivi d'Activité (Main Process)

**Fichier:** `src/main/tracker.ts`

1. **Boucle de polling** (toutes les 2 secondes)
   - Détecte fenêtre active via `active-win`
   - Compar avec fenêtre précédente
   - Si change: termine activité et en démarre une nouvelle

2. **Détection Idle**
   - Si pas d'input (souris/clavier) pendant 3+ min: pause automatique
   - Reprend quand il y a de l'activité

3. **Écriture Base de Données**
   - Chaque activité sauvegardée immédiatement en SQLite
   - Colonnes: `app_name`, `window_title`, `start_time`, `end_time`, `duration_seconds`, `category_id`, `billable`

### Communication IPC (Main ↔ Renderer)

Le pont `preload.ts` expose sécurisément les canaux:

- `get-activities`: Récupère activités depuis DB
- `get-categories`: Récupère catégories
- `create-category`: Crée catégorie
- `update-activity-category`: Assigne catégorie à activité

### Schéma Base de Données

**Tables:**

1. **activities** — Chaque changement de fenêtre
   - Liens catégories via `category_id`
   - Flags billable/personnel basé catégorie par défaut

2. **categories** — Créées par l'utilisateur
   - Exemple: "Travail", "Personnel", "Apprentissage"
   - Couleur pour visualisation
   - Flag `billable_default`
   - `match_rules`: JSON mots-clés pour auto-catégorisation (futur)

3. **focus_sessions** — Sessions Pomodoro
   - Timer focus configurables
   - Apps bloquées pendant session

---

## Features - Phase 1 (Actuel)

✅ **Suivi Activité**
- Poll fenêtre active toutes 2 sec
- Détecte idle (>3 min sans input)
- Stocke en SQLite

✅ **Catégorisation**
- Créer catégories personnalisées
- Assigner catégories manuellement
- Flag billable par catégorie

⏳ **Prochaines** (Phase 2)
- Dashboard analytique
- Graphiques temps/catégorie (bar + pie)
- Timer Pomodoro avec blocage d'apps

---

## Notes Développement

### Debug

- **Main Process**: Logs console; DevTools Electron (Ctrl+Shift+I)
- **Renderer**: React DevTools dans Electron DevTools
- **Database**: Fichier SQLite dans dossier `userData` d'Electron

### Compilation TypeScript

- **Renderer**: Compilé par Vite (à la volée en dev)
- **Main**: Compilé par `tsc` avant app

### Pourquoi `better-sqlite3`?

- Rapide, bindings synchrones SQLite
- Parfait pour apps locales sans réseau
- Tous les données sur disque, pas de sync cloud

---

## Objectifs Projet

- 100% local, zéro télémétrie
- Code simple et lisible (pour débutants)
- Architecture extensible (futures features)

---

## Limitations v0.1

- Windows uniquement (uses `active-win`)
- Assignation catégories manuelle (pas d'auto-matching encore)
- Pas d'export données historiques

