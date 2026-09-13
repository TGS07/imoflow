'use client'
import { TopNav } from './TopNav'
import { Breadcrumbs } from './Breadcrumbs'
import { MobileNav } from './MobileNav'
import { CommandPalette } from '@/components/CommandPalette'
import { PushBanner } from '@/components/pwa/PushBanner'
import { ToastContainer } from '@/components/ui/Toast'

type Props = {
  children: React.ReactNode
  userName: string
  userInitials: string
  userRole: 'admin' | 'agent'
  userTheme: 'light' | 'dark'
}

export function AppShell({ children, userName, userInitials, userRole, userTheme }: Props) {
  return (
    <div className="app-layout-v2">
      <CommandPalette />
      <ToastContainer />
      <TopNav
        userName={userName}
        userInitials={userInitials}
        userRole={userRole}
        userTheme={userTheme}
      />
      <Breadcrumbs />
      <PushBanner />
      <main className="app-content-v2">
        {children}
      </main>
      <MobileNav userRole={userRole} />
    </div>
  )
}
