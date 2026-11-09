import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { Toaster } from 'sonner'
import { ClerkProvider } from '@clerk/nextjs'

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
})

export const metadata: Metadata = {
  title: 'SmartZap - WhatsApp Manager',
  description: 'Plataforma de automação de marketing via WhatsApp',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <html lang="pt-BR" className={geist.variable} suppressHydrationWarning>
        <body className="font-sans antialiased">
          <Providers>
            <Toaster richColors position="top-right" theme="dark" />
            {children}
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  )
}
