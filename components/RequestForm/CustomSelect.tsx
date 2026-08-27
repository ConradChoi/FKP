// Design Ref: 대표 피드백(2026-08-27) — 네이티브 <select>의 옵션 목록은 브라우저/OS가 그리는
// 기본 UI라 앱 디자인을 입힐 수 없고, 모바일에서 특히 어색하게 보인다는 지적. role="combobox"
// 버튼 + role="listbox" 커스텀 목록으로 교체해 디자인 토큰(inputClass 등)을 그대로 적용한다.
// 외부 UI 라이브러리 없이(PRD OQ-7) 직접 구현한 최소 기능 리스트박스.
'use client'

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from 'react'
import { inputClass } from './styles'

export interface SelectOption {
  value: string
  label: string
}

interface CustomSelectProps {
  value: string
  onChange: (value: string) => void
  placeholder: string
  options: SelectOption[]
  onFocus?: () => void
  className?: string
}

export function CustomSelect({ value, onChange, placeholder, options, onFocus, className = '' }: CustomSelectProps) {
  const [open, setOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  // FormField wraps this component in a native <label>. Clicking an <li> inside it makes the
  // browser ALSO fire a separate native synthetic click directly on the <button> (the label's
  // associated control) right after — this is the browser's built-in label-activation behavior,
  // not a bubbled event, so stopPropagation() on the <li> click has no effect on it. That
  // synthetic click would otherwise reopen the dropdown we just closed. Suppress just that one
  // click via a ref flag cleared on the next tick (the synthetic click always fires
  // synchronously right after, in the same task).
  const suppressNextButtonClickRef = useRef(false)

  const selected = options.find((o) => o.value === value)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  function openList() {
    setOpen(true)
    setHighlightedIndex(options.findIndex((o) => o.value === value))
  }

  function selectOption(index: number) {
    const opt = options[index]
    if (!opt) return
    onChange(opt.value)
    setOpen(false)
    suppressNextButtonClickRef.current = true
    setTimeout(() => {
      suppressNextButtonClickRef.current = false
    }, 0)
    buttonRef.current?.focus()
  }

  function handleKeyDown(e: ReactKeyboardEvent<HTMLButtonElement>) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        openList()
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((i) => Math.min(i + 1, options.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      selectOption(highlightedIndex)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        onFocus={onFocus}
        onClick={() => {
          if (suppressNextButtonClickRef.current) return
          open ? setOpen(false) : openList()
        }}
        onKeyDown={handleKeyDown}
        className={`${inputClass} flex w-full items-center justify-between text-left ${
          selected ? '' : 'text-neutral-400'
        } ${className}`}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={`ml-2 h-4 w-4 shrink-0 text-neutral-400 transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-auto rounded-input border border-neutral-200 bg-neutral-0 py-1 shadow-lg"
        >
          {options.map((opt, i) => (
            <li
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              onMouseEnter={() => setHighlightedIndex(i)}
              onClick={(e: ReactMouseEvent) => {
                e.stopPropagation()
                selectOption(i)
              }}
              className={`cursor-pointer px-4 py-2 text-body text-neutral-900 ${i === highlightedIndex ? 'bg-primary-50' : ''} ${
                opt.value === value ? 'font-medium text-primary-600' : ''
              }`}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
