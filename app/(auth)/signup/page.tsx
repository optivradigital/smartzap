'use client'

import { SignUp } from '@clerk/nextjs'

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 gap-6">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-linear-to-br from-emerald-500 to-emerald-600 mb-4">
          <span className="text-3xl font-bold text-white">S</span>
        </div>
        <h1 className="text-2xl font-bold text-white">SmartZap</h1>
        <p className="text-zinc-400 text-sm mt-1">14 dias grátis. Sem cartão de crédito.</p>
      </div>

      <SignUp
        appearance={{
          elements: {
            rootBox: 'w-full max-w-md',
            card: 'bg-zinc-900 border border-zinc-800 shadow-xl rounded-2xl',
            headerTitle: 'text-white',
            headerSubtitle: 'text-zinc-400',
            socialButtonsBlockButton: 'border-zinc-700 text-white hover:bg-zinc-800',
            formFieldLabel: 'text-zinc-300',
            formFieldInput:
              'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 focus:ring-emerald-500 focus:border-emerald-500',
            formButtonPrimary:
              'bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl',
            footerActionLink: 'text-emerald-400 hover:text-emerald-300',
          },
        }}
        fallbackRedirectUrl="/onboarding"
        signInUrl="/login"
      />

      <p className="text-zinc-600 text-sm">
        SmartZap © {new Date().getFullYear()}
      </p>
    </div>
  )
}
