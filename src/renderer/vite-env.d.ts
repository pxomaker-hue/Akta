/// <reference types="vite/client" />

declare global {
  interface Window {
    electron: {
      ipc: {
        invoke: (channel: string, ...args: any[]) => Promise<any>
        on: (channel: string, listener: (...args: any[]) => void) => void
        once: (channel: string, listener: (...args: any[]) => void) => void
        off: (channel: string, listener: (...args: any[]) => void) => void
      }
    }
  }
}
