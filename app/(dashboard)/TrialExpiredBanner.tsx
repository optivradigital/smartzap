'use client'

interface Props {
  daysLeft: number
  expired: boolean
}

export function TrialExpiredBanner({ daysLeft, expired }: Props) {
  if (expired) {
    return (
      <div className="bg-red-950 border-b border-red-800 px-4 py-3 text-center text-sm">
        <span className="text-red-300 font-medium">Seu período de teste encerrou.</span>{' '}
        <a href="/settings/billing" className="text-white underline underline-offset-2 hover:text-red-200">
          Assine agora para continuar usando o SmartZap
        </a>
      </div>
    )
  }

  return (
    <div className="bg-amber-950 border-b border-amber-800 px-4 py-2.5 text-center text-sm">
      <span className="text-amber-300">
        {daysLeft <= 0
          ? 'Seu teste expira hoje.'
          : `Seu teste gratuito expira em ${daysLeft} dia${daysLeft === 1 ? '' : 's'}.`}
      </span>{' '}
      <a href="/settings/billing" className="text-white underline underline-offset-2 hover:text-amber-200">
        Ver planos
      </a>
    </div>
  )
}
