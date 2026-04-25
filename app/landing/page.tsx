import Link from 'next/link'
import { CheckCircle, Zap, MessageSquare, BarChart3, Shield, ArrowRight } from 'lucide-react'

export const metadata = {
  title: 'SmartZap — Automação de WhatsApp para negócios',
  description: 'Envie campanhas em massa, automatize respostas e acompanhe resultados. 14 dias grátis.',
}

const features = [
  { icon: MessageSquare, title: 'Envios em massa', desc: 'Dispare campanhas para milhares de contatos com personalização por variáveis.' },
  { icon: Zap, title: 'Agente IA', desc: 'Responda clientes automaticamente com IA treinada no contexto do seu negócio.' },
  { icon: BarChart3, title: 'Relatórios em tempo real', desc: 'Acompanhe entregas, leituras e falhas em tempo real com métricas detalhadas.' },
  { icon: Shield, title: 'Anti-ban integrado', desc: 'Delays inteligentes e limites automáticos para proteger seu número.' },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Nav */}
      <nav className="border-b border-zinc-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
              <span className="text-sm font-bold text-white">S</span>
            </div>
            <span className="font-bold text-lg">SmartZap</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-zinc-400 hover:text-white text-sm transition-colors">
              Entrar
            </Link>
            <Link
              href="/signup"
              className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
            >
              Começar grátis
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm px-4 py-1.5 rounded-full mb-8">
          <Zap className="w-3.5 h-3.5" />
          14 dias grátis · Sem cartão de crédito
        </div>
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6 leading-tight">
          WhatsApp Business<br />
          <span className="text-blue-400">em escala</span>
        </h1>
        <p className="text-xl text-zinc-400 max-w-2xl mx-auto mb-10">
          Envie campanhas, automatize respostas com IA e acompanhe resultados — tudo numa plataforma pensada para negócios B2B.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link
            href="/signup"
            className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-8 py-3.5 rounded-xl transition-colors flex items-center gap-2 text-lg"
          >
            Criar conta grátis
            <ArrowRight className="w-5 h-5" />
          </Link>
          <Link
            href="/login"
            className="text-zinc-300 hover:text-white border border-zinc-700 hover:border-zinc-600 px-8 py-3.5 rounded-xl transition-colors text-lg"
          >
            Já tenho conta
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-blue-400" />
              </div>
              <h3 className="text-white font-semibold text-lg mb-2">{title}</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Preço simples e transparente</h2>
          <p className="text-zinc-400">Um plano que cresce com você.</p>
        </div>
        <div className="max-w-sm mx-auto bg-zinc-900 border border-blue-500/30 rounded-2xl p-8">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <Zap className="w-4 h-4 text-blue-400" />
            </div>
            <span className="text-white font-semibold">SmartZap Basic</span>
          </div>
          <div className="flex items-baseline gap-2 mb-6">
            <span className="text-4xl font-bold text-white">R$ 197</span>
            <span className="text-zinc-400">/mês</span>
          </div>
          <ul className="space-y-3 mb-8">
            {[
              '1 número WhatsApp incluso',
              'Campanhas ilimitadas',
              'Agente IA incluso',
              'Números extras: R$ 97/mês cada',
              'Suporte prioritário',
            ].map(item => (
              <li key={item} className="flex items-center gap-2 text-sm text-zinc-300">
                <CheckCircle className="w-4 h-4 text-blue-400 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
          <Link
            href="/signup"
            className="block w-full bg-blue-600 hover:bg-blue-500 text-white font-medium text-center py-3 rounded-xl transition-colors"
          >
            Começar 14 dias grátis
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 px-6 py-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-zinc-500 text-sm">
          <span>SmartZap © {new Date().getFullYear()} — Optivra Digital</span>
          <Link href="/login" className="hover:text-zinc-300 transition-colors">Entrar</Link>
        </div>
      </footer>
    </div>
  )
}
