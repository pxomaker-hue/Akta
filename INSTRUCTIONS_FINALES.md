# ⚠️ Problème npm - Instructions Manuelles

Il y a un problème d'environnement npm sur cette machine. Les packages s'installent mais les binaires ne se trouvent pas.

## 🔧 Solution 1: Utiliser Yarn (Recommandé)

Yarn gère mieux les binaires. Voici comment:

### Étape 1: Installer Yarn

```powershell
npm install -g yarn
```

### Étape 2: Aller au dossier du projet

```powershell
cd "X:\Travail\Apprentissage\Codage\Akta"
```

### Étape 3: Nettoyer et réinstaller avec Yarn

```powershell
rm -r node_modules
rm package-lock.json
yarn install
```

### Étape 4: Build avec Yarn

```powershell
yarn build
```

### Étape 5: Lancer l'app

```powershell
yarn dev
```

---

## 🔧 Solution 2: Nettoyer npm Complètement

Si vous préférez rester avec npm:

```powershell
# 1. Nettoyage complet
cd "X:\Travail\Apprentissage\Codage\Akta"
rm -r node_modules
rm package-lock.json
npm cache clean --force

# 2. Réinstaller
npm install

# 3. Build
npm run build

# 4. Lancer
npm run dev
```

---

## 🔧 Solution 3: Réinitialiser npm

```powershell
# Réinitialiser npm
npm config set registry https://registry.npmjs.org/

# Puis réinstaller
npm install
```

---

## 📝 Résumé

**Le problème:** npm installe les packages mais les binaires (tsc, vite, concurrently) ne sont pas accessibles

**Les solutions:**
1. ✅ **Yarn** (meilleure option) → `yarn install` then `yarn dev`
2. ✅ **Nettoyer npm** → `rm -r node_modules && npm install`
3. ✅ **Réinitialiser npm** → `npm config set registry`

**Je recommande Yarn.** C'est plus rapide et plus fiable.

---

## ✨ Une Fois Que Ça Marche

```powershell
yarn dev          # Lance l'app
# ou
npm run dev       # Si vous utilisiez npm
```

L'app Electron s'ouvre et vous verrez 3 onglets:
- Activités
- Dashboard  
- Paramètres

---

**Essayez la Solution 1 (Yarn) en priorité.** C'est la plus fiable! 🚀
