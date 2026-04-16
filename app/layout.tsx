import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { Toaster } from 'sonner'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
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
    <html lang="pt-BR" className={`dark ${inter.variable}`} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Providers>
          <Toaster richColors position="top-right" theme="dark" />
          {children}
        </Providers>
      </body>
    </html>
  )
}
