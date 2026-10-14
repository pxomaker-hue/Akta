import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'
import { useTranslation } from '../../hooks/useTranslation'

export interface DropdownOption {
  value: string
  label: string
  color?: string
}

interface DropdownProps {
  value: string
  options: DropdownOption[]
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

function Dropdown({ value, options, onChange, placeholder, className = '', disabled }: DropdownProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const resolvedPlaceholder = placeholder ?? t('dropdown.selectPlaceholder', 'Sélectionner...')

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selected = options.find((o) => o.value === value)

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm font-medium hover:border-gray-400 dark:hover:border-slate-500 focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] disabled:opacity-50 transition-colors"
      >
        <span className="flex items-center gap-2 truncate">
          {selected?.color && <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: selected.color }} />}
          <span className="truncate">{selected ? selected.label : resolvedPlaceholder}</span>
        </span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={`flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1.5 w-full max-h-60 overflow-y-auto rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg py-1">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value)
                setOpen(false)
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                option.value === value
                  ? 'bg-gray-100 dark:bg-slate-700 font-medium text-gray-900 dark:text-white'
                  : 'text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/60'
              }`}
            >
              {option.color && <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: option.color }} />}
              <span className="truncate">{option.label}</span>
              {option.value === value && <Icon name="check" size={13} className="ml-auto accent-text flex-shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default Dropdown
