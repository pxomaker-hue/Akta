/// <reference types="vite/client" />

declare global {
  interface Window {
    electron: {
      ipc: {
        invoke: (channel: string, ...args: any[]) => Promise<any>
        // Renvoie la fonction de désabonnement (il n'y a plus de off() : voir preload.ts)
        on: (channel: string, listener: (...args: any[]) => void) => () => void
        once: (channel: string, listener: (...args: any[]) => void) => void
      }
    }
  }
}
