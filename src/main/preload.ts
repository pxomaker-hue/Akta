import { contextBridge, ipcRenderer } from 'electron'

// Map du listener "public" (celui passé par le code renderer) vers le wrapper réellement
// enregistré auprès d'ipcRenderer (qui strip le premier argument `event`) — indispensable pour que
// off() retire le bon listener : sans ça, off(listener) ne matchait jamais rien puisque le wrapper
// enregistré par on() était une closure différente à chaque appel, et les listeners s'accumulaient
// indéfiniment à chaque montage de composant (fuite mémoire + MaxListenersExceededWarning).
const listenerWrappers = new WeakMap<(...args: any[]) => void, (event: unknown, ...args: any[]) => void>()

contextBridge.exposeInMainWorld('electron', {
  ipc: {
    invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
    on: (channel: string, listener: (...args: any[]) => void) => {
      const wrapper = (event: unknown, ...args: any[]) => listener(...args)
      listenerWrappers.set(listener, wrapper)
      ipcRenderer.on(channel, wrapper)
    },
    once: (channel: string, listener: (...args: any[]) => void) => {
      ipcRenderer.once(channel, (event, ...args) => listener(...args))
    },
    off: (channel: string, listener: (...args: any[]) => void) => {
      const wrapper = listenerWrappers.get(listener)
      if (wrapper) {
        ipcRenderer.off(channel, wrapper)
        listenerWrappers.delete(listener)
      }
    },
  },
})
