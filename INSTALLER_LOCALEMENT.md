# 📝 Instructions Manuelles - Installer & Lancer Akta

Il y a un problème avec l'installation npm automatique sur cette machine. Suivez ces étapes manuellement.

## ⚡ Étape 1: Terminal & Dossier

Ouvrez un **PowerShell** ou **CMD** et allez dans le dossier:

```powershell
cd Z:\Dev - Applications\Akta
```

## 📦 Étape 2: Installer les Dépendances

Exécutez cette commande (peut prendre 10-15 minutes):

```powershell
npm install
```

Si ça bloque ou échoue, essayez:

```powershell
npm install --legacy-peer-deps
```

**Attendez que ce soit 100% complet** (regardez le message "added XXX packages").

## ✅ Étape 3: Vérifier l'Installation

Vérifiez que TypeScript est installé:

```powershell
npm ls typescript
```

Vous devriez voir quelque chose comme:
```
akta@0.1.0 Z:\Dev - Applications\Akta
`-- typescript@5.3.3
```

## 🔨 Étape 4: Build le Projet

Une fois npm install réussi, compilez:

```powershell
npm run build
```

Cela crée:
- `dist/main/` (backend compilé)
- `dist/renderer/` (React bundlé)

## 🚀 Étape 5: Lancer l'App

```powershell
npm run dev
```

L'app Electron s'ouvre automatiquement! ✨

## 🐛 Si Ça Ne Marche Pas

### Problème: npm install bloque ou échoue

**Solution 1:**
```powershell
npm cache clean --force
npm install --legacy-peer-deps
```

**Solution 2:** Utilisez yarn
```powershell
npm install -g yarn
yarn install
yarn dev
```

**Solution 3:** Nettoyez complètement
```powershell
rm -r node_modules
rm package-lock.json
npm install --legacy-peer-deps
```

### Problème: npm run build échoue

Assurez-vous que npm install a 100% réussi avant de builder.

### Problème: npm run dev ne démarre pas Electron

Essayez de relancer le terminal ou redémarrez votre machine.

## 📋 Résumé des Commandes

```powershell
cd Z:\Dev - Applications\Akta
npm install                    # Installer (le plus long)
npm run build                  # Compiler
npm run dev                    # Lancer l'app
npm run dist                   # Créer installer Windows .exe
```

## 🎯 Points Clés

✅ **npm install doit 100% réussir** avant de faire build/dev  
✅ **Attendez les messages de fin** (ne fermez pas le terminal trop tôt)  
✅ **Si ça bloque:** Ctrl+C pour arrêter, puis réessayez  
✅ **Si toujours bloqué:** Utilisez yarn à la place  

## 📚 Documentation

Pour plus d'info, consultez:
- `LISEZ_MOI.txt` — Point d'entrée simple
- `DEMARRAGE.md` — Guide démarrage rapide
- `README.md` — Vue d'ensemble

## ✨ Quand Ça Marche

Vous verrez:

1. **npm install:**
   ```
   added 200 packages in 5m
   ```

2. **npm run build:**
   ```
   dist/main/ créé
   dist/renderer/ créé
   ```

3. **npm run dev:**
   ```
   Fenêtre Electron s'ouvre
   App affiche 3 onglets: Activités | Dashboard | Paramètres
   ```

---

**Bon courage! 🚀** Suivez ces étapes à la lettre et ça devrait marcher.

Si vous êtes bloqué à npm install depuis 30+ minutes, essayez yarn.
