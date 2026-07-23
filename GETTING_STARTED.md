# Démarrage avec Akta

## Prérequis

- Node.js 16+ installé (vérifiez avec `node --version`)
- npm 8+ (vient avec Node.js)
- Windows 10/11 (pour support `active-win`)

## Installation & Configuration

### 1. Installer les dépendances

```bash
cd Z:\Dev - Applications\Akta
npm install --legacy-peer-deps
```

Installe ~200 packages:
- Electron + TypeScript pour main process
- React + Vite pour renderer
- SQLite (better-sqlite3)
- Recharts pour graphiques
- Tailwind CSS pour styles

**Première installation: 3-5 minutes** (better-sqlite3 compile les bindings natifs)

### 2. Vérifier l'installation

Testez la compilation TypeScript:
```bash
npm run build:main
```

Si succès, vous verrez le dossier `dist/main/` créé.

## Development

### Start Dev Mode

```bash
npm run dev
```

This starts:
1. **Main process watcher** — Monitors `src/main/**/*.ts`, recompiles on change
2. **React dev server** — Vite on `http://localhost:3000`, hot reload
3. **Electron app** — Opens window pointing to dev server

Your terminal will show:
```
> tsc --watch ...
> vite
> electron .
```

All 3 must be running simultaneously. If one crashes, restart all 3 with `npm run dev`.

### Make Changes

**While `npm run dev` is running:**

#### React Changes (instant hot reload)
- Edit `src/renderer/App.tsx` → changes appear in Electron window
- Edit components in `src/renderer/components/` → auto-refresh

#### TypeScript Changes (main process)
- Edit `src/main/index.ts` or `src/main/tracker.ts`
- Watcher auto-recompiles
- You may need to restart Electron manually (Ctrl+R in Electron window)

#### Database Schema Changes
- Edit `src/main/database.ts`
- Close Electron, re-run `npm run dev`
- (Fresh start ensures DB schema is re-initialized)

### Test Features

#### Feature 1: Activity Tracking
1. Start `npm run dev`
2. Wait 5 seconds (tracker starts polling)
3. Click on different windows (Chrome, VS Code, Discord, etc.)
4. Go to **Activities** tab
5. You should see entries like:
   - "Chrome" — google.com
   - "Visual Studio Code" — index.ts
   - etc.

#### Feature 2: Dashboard
1. Click **Dashboard** tab
2. You should see:
   - Summary stats (0 total time initially)
   - Bar chart (empty until you assign categories)
   - Pie chart (empty until categories assigned)

3. Go to **Settings** tab
4. Create a category:
   - Name: "Work"
   - Color: Blue
   - Check "Mark as billable"
   - Click "Create Category"

5. Go back to **Activities** tab
6. In activity dropdowns, select "Work" category for some activities
7. Return to **Dashboard** → Charts update instantly!

#### Feature 3: Focus Mode
1. (Feature 3 currently in renderer only, no timer yet)
2. Go to **Settings** tab and scroll down for Focus Mode section
3. Set duration to 5 minutes
4. Add blocked apps: "Discord", "Slack"
5. Click "Start Focus Session"
6. Timer counts down: 5:00 → 4:59 → ...
7. Sessions appear in history table below

## Build for Production

### Compile All Code

```bash
npm run build
```

Generates:
- `dist/main/` — Compiled main process
- `dist/renderer/` — Bundled React app (HTML + JS + CSS)

### Create Windows Installer (.exe)

```bash
npm run dist
```

Creates:
- `dist/Akta Setup 0.1.0.exe` — Installer
- `dist/Akta 0.1.0.exe` — Standalone executable

To test the built app without installing:
```bash
npm run pack
```

Opens `out/` folder with built app ready to run.

## Project Structure Quick Reference

```
src/main/              # Node.js processes (runs in background)
  ├─ index.ts         # Electron window + IPC handlers
  ├─ tracker.ts       # Activity polling every 2 sec
  ├─ focus-mode.ts    # Focus session logic
  └─ database.ts      # SQLite schema + helpers

src/renderer/          # React UI (what you see)
  ├─ App.tsx          # Main component + tab navigation
  ├─ components/      # Reusable React components
  │   ├─ ActivityList.tsx
  │   ├─ Dashboard.tsx         # Charts + analytics
  │   ├─ CategoryForm.tsx       # Create category
  │   ├─ FocusMode.tsx          # Pomodoro timer
  │   └─ FocusHistory.tsx       # Session history
  └─ index.css        # Tailwind CSS imports

src/shared/
  └─ types.ts         # TypeScript interfaces (used by both main + renderer)

index.html            # Electron window template (loads React app)
package.json          # Dependencies + scripts
tsconfig.json         # TypeScript compiler options
vite.config.ts        # React bundler config
tailwind.config.js    # CSS framework config
```

## Troubleshooting

### Error: "tsc is not recognized"
```bash
# TypeScript didn't install. Fix:
npm install typescript --save-dev
```

### Error: "active-win is not installed"
```bash
# Windows-specific package. On other OS:
npm install active-win
```

### Error: "Module not found: react"
```bash
# Dependencies missing
rm -r node_modules package-lock.json
npm install
```

### Electron won't open
1. Check that React dev server is running (should see "http://localhost:3000")
2. Manually reload Electron: Press `Ctrl+R` in Electron window
3. Or restart: `npm run dev` again

### Changes not showing
- **React changes?** → Make sure Vite is running (`npm run dev:renderer`)
- **Main process?** → Restart Electron (`Ctrl+R`) or restart `npm run dev`
- **Database?** → Close Electron, delete `~/.config/Akta/akta.db`, restart

### Database file location
- Windows: `%APPDATA%\Akta\akta.db`
- Or: `C:\Users\<YourUsername>\AppData\Roaming\Akta\akta.db`

To reset data:
```bash
rm "%APPDATA%\Akta\akta.db"
# Restart Electron
```

## Development Workflow

### Add a New Component

1. Create `src/renderer/components/MyComponent.tsx`:
```tsx
import { useState } from 'react'

function MyComponent() {
  return <div>Hello</div>
}

export default MyComponent
```

2. Import in `src/renderer/App.tsx`:
```tsx
import MyComponent from './components/MyComponent'
```

3. Use in JSX:
```tsx
<MyComponent />
```

4. Save → Vite hot-reloads → See change immediately

### Add IPC Handler

1. Create function in `src/main/index.ts`:
```ts
ipcMain.handle('my-channel', async (event, arg) => {
  console.log('Received:', arg)
  return 'Hello from main'
})
```

2. Call from React (`src/renderer/components/`):
```tsx
const result = await window.electron.ipc.invoke('my-channel', 'world')
console.log(result) // "Hello from main"
```

3. Save → Watcher recompiles → Restart Electron (`Ctrl+R`)

### Add Database Table

1. Edit `src/main/database.ts`:
```ts
db.exec(`
  CREATE TABLE IF NOT EXISTS my_table (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at INTEGER
  )
`)
```

2. Delete `akta.db` file (or `~/.config/Akta/akta.db`)
3. Restart Electron
4. Schema is recreated on startup

## Tips & Best Practices

- **Use TypeScript types** → Fewer bugs
- **Keep IPC channels simple** → Easier to test
- **Use Tailwind classes** → Consistent styling
- **Dark mode works by default** → No extra setup needed
- **SQLite is fast** → No need to optimize queries (yet)

## Next Steps

1. ✅ Get the project running locally (`npm run dev`)
2. ✅ Test the tracker (Activities tab)
3. ✅ Create categories and view dashboard
4. ✅ Try the focus mode timer
5. 📝 Implement auto-categorization (match_rules)
6. 📝 Add actual app blocking during focus
7. 📝 Add notifications at session end

## Resources

- **Electron Docs**: https://www.electronjs.org/docs
- **React Docs**: https://react.dev
- **TypeScript Handbook**: https://www.typescriptlang.org/docs/
- **Tailwind CSS**: https://tailwindcss.com/docs
- **Recharts**: https://recharts.org/
- **SQLite**: https://www.sqlite.org/

## Questions?

Check these docs first:
- `README.md` — Project overview
- `ARCHITECTURE.md` — How pieces fit together
- `FEATURE_*.md` — Detailed feature docs
- `PROJECT_STATUS.md` — Current state & roadmap

Good luck! 🚀
