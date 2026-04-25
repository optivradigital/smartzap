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

  const urgent = daysLeft <= 3

  return (
    <div className={`border-b px-4 py-2.5 text-center text-sm ${urgent ? 'bg-red-950/60 border-red-800/50' : 'bg-blue-950/40 border-blue-800/30'}`}>
      <span className={urgent ? 'text-red-300' : 'text-blue-300'}>
        {daysLeft <= 0
          ? 'Seu teste expira hoje.'
          : `Teste gratuito · ${daysLeft} dia${daysLeft === 1 ? '' : 's'} restante${daysLeft === 1 ? '' : 's'}.`}
      </span>{' '}
      <a href="/settings/billing" className="text-white font-medium hover:underline underline-offset-2 ml-1">
        Ver planos →
      </a>
    </div>
  )
}
