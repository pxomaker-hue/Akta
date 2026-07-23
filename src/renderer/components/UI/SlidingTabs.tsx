import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export interface SlidingTab<T extends string> {
  id: T
  label: string
  icon?: React.ReactNode
}

interface SlidingTabsProps<T extends string> {
  tabs: SlidingTab<T>[]
  activeId: T
  onChange: (id: T) => void
  className?: string
}

function SlidingTabs<T extends string>({ tabs, activeId, onChange, className = '' }: SlidingTabsProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null)

  const measure = () => {
    const btn = buttonRefs.current.get(activeId)
    const container = containerRef.current
    if (!btn || !container) return
    const containerRect = container.getBoundingClientRect()
    const btnRect = btn.getBoundingClientRect()
    setIndicator({ left: btnRect.left - containerRect.left, width: btnRect.width })
  }

  useLayoutEffect(() => {
    measure()
  }, [activeId, tabs.length])

  // Recalcule une fois les polices chargées (le swap de police change la largeur du texte)
  useEffect(() => {
    document.fonts?.ready?.then(() => measure())
  }, [])

  // Recalcule si la taille des boutons change pour une autre raison (resize, i18n, zoom OS...)
  useEffect(() => {
    const container = containerRef.current
    if (!container || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => measure())
    observer.observe(container)
    container.querySelectorAll('button').forEach((btn) => observer.observe(btn))
    return () => observer.disconnect()
  }, [activeId, tabs.length])

  useEffect(() => {
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [activeId])

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="flex space-x-8">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            ref={(el) => {
              if (el) buttonRefs.current.set(tab.id, el)
            }}
            onClick={() => onChange(tab.id)}
            className={`relative flex items-center gap-2 px-1 py-4 text-sm font-medium transition-colors duration-200 ${
              activeId === tab.id
                ? 'accent-text'
                : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {indicator && (
        <div
          className="absolute bottom-0 h-1 accent-gradient-bg rounded-t transition-all duration-300 ease-out"
          style={{ left: indicator.left, width: indicator.width }}
        />
      )}
    </div>
  )
}

export default SlidingTabs
