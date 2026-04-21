import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ThemeProvider } from '@/lib/theme-context'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    default: 'FigPM — Figma Comment Manager',
    template: '%s · FigPM',
  },
  description: 'Manage Figma comment statuses across your design files. Track Open, In Progress, Clarify, and Done — all in one Kanban board.',
  keywords: ['Figma', 'comments', 'project management', 'design workflow', 'Kanban'],
  authors: [{ name: 'Shrikant Naik' }],
  // ✅ ADD THIS BLOCK
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
    shortcut: '/favicon.svg',
  },
  openGraph: {
    title: 'FigPM — Figma Comment Manager',
    description: 'Track and manage Figma comment statuses in a live Kanban board.',
    type: 'website',
    locale: 'en_IN',
  },
  metadataBase: new URL('http://localhost:3000'),
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }} className={inter.className}>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}