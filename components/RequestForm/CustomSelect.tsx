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
  const listRef = useRef<HTMLUListElement>(null)
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

  // Design Ref: 대표 피드백(2026-08-27) — 드롭다운이 화면 하단으로 넘어가면 자동 스크롤 없이는
  // 잘려 보인다는 지적(모바일 스크린샷). 열릴 때 목록 전체가 뷰포트 안에 들어오도록 스크롤한다.
  //
  // BUG FIX (같은 날, 후속 리포트): el.scrollIntoView()는 "가장 가까운 스크롤 가능한 조상"을
  // 브라우저가 알아서 고르는데, Hero 카루셀 트랙처럼 overflow-hidden + 고정 height를 가진
  // 컨테이너도 (스크롤바가 안 보여도) scrollHeight > clientHeight라서 "스크롤 가능"으로 취급된다.
  // 그 결과 Hero 안에서 카테고리 드롭다운을 열면 트랙 내부가 프로그램적으로 스크롤되어, 위에 있는
  // "What are you looking for" textarea가 그 안에서 밀려 올라가 안 보이는 회귀가 생겼다(/request
  // 페이지에는 이런 overflow-hidden 조상이 없어서 그때는 드러나지 않았다). window만 명시적으로
  // 스크롤해 이 문제를 피한다 — 어떤 조상 요소도 건드리지 않는다.
  useEffect(() => {
    if (!open) return
    const el = listRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const overflow = rect.bottom - window.innerHeight
    if (overflow > 0) {
      window.scrollBy({ top: overflow + 16, behavior: 'smooth' })
    }
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
          ref={listRef}
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
