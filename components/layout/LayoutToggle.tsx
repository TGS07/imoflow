'use client'

import { useState } from 'react'
import { Icon } from '@/components/ui/Icon'

export type LayoutMode = 'sidebar' | 'topbar'

function applyLayout(mode: LayoutMode) {
  document.documentElement.dataset.layout = mode
  document.cookie = `layout=${mode}; path=/; max-age=31536000; SameSite=Lax`
}

export function LayoutToggle({ initialLayout }: { initialLayout: LayoutMode }) {
  const [layout, setLayout] = useState<LayoutMode>(initialLayout)

  function toggle() {
    const next: LayoutMode = layout === 'sidebar' ? 'topbar' : 'sidebar'
    applyLayout(next)
    setLayout(next)
    window.location.reload()
  }

  const isSidebar = layout === 'sidebar'

  return (
    <button
      onClick={toggle}
      className={isSidebar ? 'sv2-menu-item' : 'tn3-user-item'}
      title={isSidebar ? 'Mudar para barra superior' : 'Mudar para barra lateral'}
    >
      <Icon name={isSidebar ? 'layout-top' : 'layout-side'} size={16} />
      {isSidebar ? 'Barra superior' : 'Barra lateral'}
    </button>
  )
}
