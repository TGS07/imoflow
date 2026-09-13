'use client'
import { useState, useRef, useEffect, type ReactNode } from 'react'
import Link from 'next/link'
import type { IconName } from '@/components/ui/Icon'
import { Icon } from '@/components/ui/Icon'

type DropdownItem = {
  href?: string
  label: string
  icon?: IconName
  onClick?: () => void
  divider?: boolean
}

type Props = {
  trigger: ReactNode
  items: DropdownItem[]
  align?: 'left' | 'right'
}

export function Dropdown({ trigger, items, align = 'right' }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div className="dropdown" ref={ref}>
      <div onClick={() => setOpen(!open)}>{trigger}</div>
      {open && (
        <div className="dropdown-menu" style={align === 'left' ? { left: 0, right: 'auto' } : undefined}>
          {items.map((item, i) => {
            if (item.divider) return <div key={i} className="dropdown-divider" />
            if (item.href) {
              return (
                <Link key={i} href={item.href} className="dropdown-item" onClick={() => setOpen(false)}>
                  {item.icon && <Icon name={item.icon} size={14} />}
                  {item.label}
                </Link>
              )
            }
            return (
              <button key={i} className="dropdown-item" onClick={() => { item.onClick?.(); setOpen(false) }}>
                {item.icon && <Icon name={item.icon} size={14} />}
                {item.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
