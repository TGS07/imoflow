'use client'
import { TopNav } from './TopNav'
import { SidebarNav } from './SidebarNav'
import { MobileNav } from './MobileNav'
import { CommandPalette } from '@/components/CommandPalette'
import { PushBanner } from '@/components/pwa/PushBanner'
import { ToastContainer } from '@/components/ui/Toast'
import type { LayoutMode } from './LayoutToggle'

type Props = {
  children: React.ReactNode
  userName: string
  userEmail: string
  userInitials: string
  userRole: 'admin' | 'agent'
  userTheme: 'light' | 'dark'
  userLayout: LayoutMode
}

export function AppShell({ children, userName, userEmail, userInitials, userRole, userTheme, userLayout }: Props) {
  if (userLayout === 'sidebar') {
    return (
      <div className="app-layout-sidebar">
        <CommandPalette />
        <ToastContainer />
        <SidebarNav
          userName={userName}
          userEmail={userEmail}
          userInitials={userInitials}
          userRole={userRole}
          userTheme={userTheme}
        />
        <div className="app-main-sidebar">
          <PushBanner />
          <main className="app-content-v2">
            {children}
          </main>
        </div>
        <MobileNav userRole={userRole} />
      </div>
    )
  }

  return (
    <div className="app-layout-v2">
      <CommandPalette />
      <ToastContainer />
      <TopNav
        userName={userName}
        userEmail={userEmail}
        userInitials={userInitials}
        userRole={userRole}
        userTheme={userTheme}
      />
      <PushBanner />
      <main className="app-content-v2">
        {children}
      </main>
      <MobileNav userRole={userRole} />
    </div>
  )
}
