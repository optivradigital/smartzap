'use client'

/**
 * Setup Page - Redirects to the appropriate setup step
 */

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function SetupPage() {
  const router = useRouter()

  useEffect(() => {
    // Check if we have Vercel token in storage 
    const hasToken = localStorage.getItem('setup_token')

    if (hasToken) {
      // Continue with wizard
      router.push('/setup/wizard')
    } else {
      // Must enter token to potentially fix/finish setup
      router.push('/setup/start')
    }
  }, [router])

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
    </div>
  )
}
