# 🚀 Akta - Guide de Démarrage Rapide

Bienvenue! Ce guide vous montre comment lancer l'app Akta en 5 minutes.

## ⚡ Installation Rapide

```bash
cd Z:\Dev - Applications\Akta

# 1. Installer les dépendances
npm install --legacy-peer-deps

# 2. Lancer l'application en développement
npm run dev

# ✨ L'app s'ouvre automatiquement!
```

**C'est tout!** Vous verrez la fenêtre Electron avec 3 onglets:
- **Activités** — Suivi en temps réel
- **Dashboard** — Analytics et graphiques
- **Paramètres** — Créer des catégories

---

## 📝 Qu'est-ce qu'Akta?

Akta est un **suivi d'activité personnel** pour Windows:

1. **Détecte automatiquement** chaque app/fenêtre que vous ouvrez
2. **Mesure le temps** passé sur chaque tâche
3. **Catégorise** vos activités (Travail, Personnel, etc.)
4. **Affiche des analytics** (graphiques temps/catégorie, % billable)
5. **Timer Pomodoro** pour les sessions focus

**Tout est 100% local** — aucune donnée envoyée en ligne. Stockage SQLite sur votre disque.

---

## 🎯 Test Rapide (5 min)

### 1. Lancer l'app
```bash
npm run dev
```
Attend 3 secondes que tout charge.

### 2. Voir le suivi en action
- Onglet **Activités**
- Cliquez entre différentes apps (Chrome, VS Code, etc.)
- Attendez 5 secondes
- Vous devez voir les entrées s'ajouter ✨

### 3. Voir le dashboard
- Onglet **Paramètres**
- "Créer une catégorie": nom="Travail", couleur=bleu, billable ✓
- Onglet **Activités** → dropdown → assigner "Travail" à quelques activités
- Onglet **Dashboard** → les graphiques se mettent à jour! 📊

### 4. Tester le timer Pomodoro
- Onglet **Paramètres** (scroll down)
- Focus Mode: "5 minutes" + Add apps "Discord", "Slack"
- "Start Focus Session"
- Timer compte à rebours ⏱️

---

## 📁 Structure du Projet

```
src/
├─ main/          ← Code backend (Node.js)
│  ├─ index.ts       App Electron + gestion IPC
│  ├─ tracker.ts     Suivi activités (poll toutes 2s)
│  ├─ database.ts    Schéma SQLite
│  └─ focus-mode.ts  Logique Pomodoro
├─ renderer/      ← Interface React (ce que vous voyez)
│  ├─ App.tsx        Composant principal + onglets
│  └─ components/    Listes, graphiques, formulaires
└─ shared/
   └─ types.ts       Types TypeScript partagés
```

---

## 🛠️ Commandes Utiles

```bash
# Développement
npm run dev              # Lance tout (tracker + React + Electron)
npm run dev:main        # Seulement main process watcher
npm run dev:renderer    # Seulement React dev server

# Build
npm run build           # Compile TypeScript + bundle React
npm run dist            # Crée installer Windows (.exe)

# Autres
npm run build:main      # Compile juste main process
npm run build:renderer  # Bundle juste React
npm run pack            # Test build sans installer
```

---

## 🐛 Problèmes Courants

| Problème | Solution |
|----------|----------|
| `npm install` bloque | Voir `INSTALL_TROUBLESHOOTING.md` |
| Pas d'activités visibles | Attendez 5s puis cliquez autre app |
| Dashboard vide | Créez catégorie, assignez-la aux activités |
| Electron ne se lance pas | `npm run dev` à nouveau, Ctrl+R dans Electron |
| Changes ne s'affichent pas | React: change se voit instantly. Main: restart Electron |

---

## 📚 Documentation Complète

Fichiers par besoin:

| Besoin | Fichier |
|--------|---------|
| Vue d'ensemble | `README.md` |
| Installation détaillée | `GETTING_STARTED.md` |
| Résolution problèmes npm | `INSTALL_TROUBLESHOOTING.md` |
| Architecture interne | `ARCHITECTURE.md` |
| Statut fonctionnalités | `PROJECT_STATUS.md` |
| Tous les fichiers créés | `FILES_CREATED.md` |
| Détails Feature 2 | `FEATURE_2_DASHBOARD.md` |
| Détails Feature 3 | `FEATURE_3_FOCUS_MODE.md` |

---

## 🎓 Appris en créant ce projet

✅ Architecture app Electron complète  
✅ React + TypeScript en production  
✅ Communication IPC sécurisée  
✅ SQLite synchrone et efficace  
✅ Graphiques avec Recharts  
✅ UI responsive (Tailwind CSS)  
✅ Dark mode intégré  

---

## ⏭️ Prochaine Étape

**Maintenant:** 
```bash
npm install --legacy-peer-deps
npm run dev
```

**Puis:** Explorez les 3 onglets et testez les features!

---

## 💡 Tips

- **Debug React**: Ctrl+Shift+I dans Electron window
- **Logs main process**: Vérifiez terminal où vous avez lancé `npm run dev`
- **Reset data**: Supprimez `~/.config/Akta/akta.db`
- **Changer app icon**: Remplacez `assets/icon.png`

---

Bon développement! 🚀 Des questions? Consultez les docs ou le code (bien commenté en français).
