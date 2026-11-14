// Journal de diagnostic, actif uniquement en dev. En production, les logs détaillés (appelés à chaque
// poll, avec les titres de fenêtres) remplissaient la console et exposaient inutilement ce que
// l'utilisateur consulte.
export const debugLog: (...args: unknown[]) => void =
  process.env.NODE_ENV === 'development' ? (...args) => console.log(...args) : () => {}
