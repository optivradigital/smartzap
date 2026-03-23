'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
    LayoutDashboard,
    MessageSquare,
    Users,
    Settings,
    Plus,
    LogOut,
    Menu,
    X,
    Bell,
    Zap,
    FileText,
    AlertTriangle,
    CheckCircle2,
    RefreshCw,
    Database,
    MessageCircle,
    Sparkles,
    ExternalLink,
    ChevronRight,
    Workflow
} from 'lucide-react'
import React from 'react'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { HealthStatus } from '@/lib/health-check'

// Setup step interface
interface SetupStep {
    id: 'database' | 'redis' | 'qstash' | 'whatsapp'
    title: string
    description: string
    status: 'pending' | 'configured' | 'error'
    icon: React.ReactNode
    actionLabel?: string
    actionUrl?: string
    errorMessage?: string
    isRequired: boolean
    instructions: string[]
    helpUrl?: string
}

// Onboarding Overlay Component
const OnboardingOverlay = ({
    health,
    isLoading,
    onRefresh
}: {
    health: HealthStatus | null
    isLoading: boolean
    onRefresh: () => void
}) => {
    // Get Vercel stores URL from health check (dynamically detected)
    const storesUrl = health?.vercel?.storesUrl
    // Fallback to generic Vercel stores if not available
    const fallbackStoresUrl = 'https://vercel.com/dashboard/stores'

    // Build setup steps from health status
    const steps: SetupStep[] = [
        {
            id: 'database',
            title: 'Supabase Database',
            description: 'Banco de dados PostgreSQL',
            status: health?.services.database?.status === 'ok'
                ? 'configured'
                : health?.services.database?.status === 'error'
                    ? 'error'
                    : 'pending',
            icon: React.createElement(Database, { size: 20, className: 'text-emerald-400' }),
            actionLabel: 'Abrir Assistente de Configuração',
            actionUrl: '/setup',
            errorMessage: health?.services.database?.message,
            isRequired: true,
            instructions: [
                'Detectamos que o banco de dados não está conectado.',
                'Utilize nosso assistente para configurar automaticamente.',
                'Você poderá usar a Connection String ou chaves manuais.',
            ],
        },
        {
            id: 'redis',
            title: 'Upstash Redis',
            description: 'Cache e filas',
            status: health?.services.redis.status === 'ok'
                ? 'configured'
                : health?.services.redis.status === 'error'
                    ? 'error'
                    : 'pending',
            icon: React.createElement(Database, { size: 20, className: 'text-red-400' }),
            actionLabel: 'Configurar no Assistente',
            actionUrl: '/setup',
            errorMessage: health?.services.redis.message,
            isRequired: true,
            instructions: [
                'Redis é necessário para filas e cache.',
                'Use o assistente para configurar automaticamente.',
            ],
            helpUrl: 'https://upstash.com/docs/redis/overall/getstarted',
        },
        {
            id: 'qstash',
            title: 'Upstash QStash',
            description: 'Filas de processamento',
            status: health?.services.qstash.status === 'ok'
                ? 'configured'
                : health?.services.qstash.status === 'error'
                    ? 'error'
                    : 'pending',
            icon: React.createElement(Zap, { size: 20, className: 'text-purple-400' }),
            actionLabel: 'Configurar no Assistente',
            actionUrl: '/setup',
            errorMessage: health?.services.qstash.message,
            isRequired: true,
            instructions: [
                'QStash gerencia as filas de background.',
                'Configure facilmente através do assistente.',
            ],
            helpUrl: 'https://upstash.com/docs/qstash/overall/getstarted',
        },
        {
            id: 'whatsapp',
            title: 'WhatsApp Business',
            description: 'Credenciais da Meta',
            status: health?.services.whatsapp.status === 'ok'
                ? 'configured'
                : health?.services.whatsapp.status === 'error'
                    ? 'error'
                    : 'pending',
            icon: React.createElement(MessageCircle, { size: 20, className: 'text-green-400' }),
            errorMessage: health?.services.whatsapp.message,
            isRequired: true,
            actionLabel: 'Configurar WhatsApp',
            actionUrl: '/setup',
            instructions: [
                'Configure as credenciais do WhatsApp Business.',
                'Use o assistente para validar o token.',
            ],
            helpUrl: 'https://developers.facebook.com/docs/whatsapp/cloud-api/get-started',
        },
    ]

    const completedSteps = steps.filter(s => s.status === 'configured').length
    const progressPercent = (completedSteps / steps.length) * 100
    const infrastructureReady = steps
        .filter(s => s.id === 'database' || s.id === 'redis' || s.id === 'qstash')
        .every(s => s.status === 'configured')

    return (
        <div className="min-h-screen bg-grid-dots flex items-center justify-center p-6">
            <div className="max-w-2xl w-full">
                {/* Header */}
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500 to-emerald-600 mb-6 shadow-lg shadow-primary-500/20">
                        <Sparkles size={40} className="text-white" />
                    </div>
                    <h1 className="text-4xl font-bold text-white tracking-tight mb-3">
                        Configuração Necessária
                    </h1>
                    <p className="text-gray-400 text-lg max-w-md mx-auto mb-6">
                        Para utilizar o sistema, precisamos configurar os serviços essenciais. Utilize nosso assistente para facilitar o processo.
                    </p>
                    <a
                        href="/setup"
                        className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-500 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg hover:shadow-primary-500/25"
                    >
                        <Sparkles size={18} />
                        Iniciar Assistente de Configuração
                    </a>
                </div>

                {/* Progress Bar */}
                <div className="mb-8">
                    <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-gray-400">
                            Progresso: {completedSteps}/{steps.length} configurados
                        </span>
                        <button
                            onClick={onRefresh}
                            disabled={isLoading}
                            className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors"
                        >
                            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                            Verificar novamente
                        </button>
                    </div>
                    <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-primary-500 to-emerald-500 transition-all duration-500"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>

                    {/* Redeploy warning */}
                    {completedSteps === 0 && (
                        <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                            <p className="text-sm text-amber-300 mb-2">
                                💡 <strong>Importante:</strong> Após configurar Redis e QStash, faça um <strong>redeploy</strong> para ativar as variáveis.
                            </p>
                            <div className="flex gap-2">
                                {health?.vercel?.dashboardUrl && (
                                    <a
                                        href={`${health.vercel.dashboardUrl}/deployments`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg transition-colors"
                                    >
                                        Abrir Deployments →
                                    </a>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Steps */}
                <div className="space-y-4">
                    {
                        steps.map((step, index) => {
                            const isPending = step.status === 'pending'
                            const isConfigured = step.status === 'configured'
                            const isError = step.status === 'error'

                            const previousStepsConfigured = steps
                                .slice(0, index)
                                .filter(s => s.isRequired)
                                .every(s => s.status === 'configured')
                            const isNextStep = isPending && previousStepsConfigured

                            return (
                                <div
                                    key={step.id}
                                    className={`relative rounded-2xl border transition-all duration-300 overflow-hidden ${isConfigured
                                        ? 'bg-emerald-500/5 border-emerald-500/30'
                                        : isError
                                            ? 'bg-red-500/5 border-red-500/30'
                                            : isNextStep
                                                ? 'bg-primary-500/5 border-primary-500/30 ring-2 ring-primary-500/20'
                                                : 'bg-zinc-900/50 border-white/10 opacity-60'
                                        }`}
                                >
                                    {/* Step number badge */}
                                    <div className={`absolute top-4 left-4 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${isConfigured
                                        ? 'bg-emerald-500 text-white'
                                        : isError
                                            ? 'bg-red-500 text-white'
                                            : isNextStep
                                                ? 'bg-primary-500 text-white'
                                                : 'bg-zinc-700 text-gray-400'
                                        }`}>
                                        {isConfigured ? <CheckCircle2 size={16} /> : index + 1}
                                    </div>

                                    <div className="pl-16 pr-6 py-5">
                                        {/* Header */}
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <h3 className={`font-semibold ${isConfigured ? 'text-emerald-400' : isError ? 'text-red-400' : 'text-white'
                                                    }`}>
                                                    {step.title}
                                                </h3>
                                                {step.isRequired && !isConfigured && (
                                                    <span className="px-1.5 py-0.5 bg-white/10 text-gray-400 text-[10px] font-medium rounded">
                                                        OBRIGATÓRIO
                                                    </span>
                                                )}
                                            </div>
                                            {isConfigured && (
                                                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                                                    {step.icon}
                                                </div>
                                            )}
                                        </div>

                                        <p className="text-sm text-gray-400">
                                            {step.description}
                                        </p>

                                        {isError && step.errorMessage && (
                                            <div className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2 mt-3">
                                                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                                                <span>{step.errorMessage}</span>
                                            </div>
                                        )}

                                        {isConfigured && (
                                            <div className="flex items-center gap-2 text-sm text-emerald-400 mt-3">
                                                <CheckCircle2 size={14} />
                                                <span>Configurado</span>
                                            </div>
                                        )}

                                        {/* Instructions + Action - TOGETHER */}
                                        {isNextStep && step.instructions.length > 0 && (
                                            <div className="mt-4 bg-zinc-800/50 rounded-xl p-4 border border-white/5">
                                                <ol className="space-y-2 mb-4">
                                                    {step.instructions.map((instruction, i) => (
                                                        <li
                                                            key={i}
                                                            className="flex items-center gap-3 text-sm text-gray-300"
                                                        >
                                                            <span className="shrink-0 w-5 h-5 rounded-full bg-primary-500/20 text-primary-400 flex items-center justify-center text-xs font-bold">
                                                                {i + 1}
                                                            </span>
                                                            <span>{instruction}</span>
                                                        </li>
                                                    ))}
                                                </ol>

                                                {/* Action button INSIDE the instructions box */}
                                                {step.actionUrl && (
                                                    <a
                                                        href={step.actionUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium text-sm bg-primary-500 hover:bg-primary-400 text-white transition-all"
                                                    >
                                                        {step.actionLabel}
                                                        <ExternalLink size={14} />
                                                    </a>
                                                )}

                                                {step.helpUrl && (
                                                    <a
                                                        href={step.helpUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                                                    >
                                                        <span>Precisa de ajuda? Ver documentação</span>
                                                    </a>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {index < steps.length - 1 && (
                                        <div className="absolute -bottom-4 left-7 z-10">
                                            <div className={`w-0.5 h-8 ${isConfigured ? 'bg-emerald-500/30' : 'bg-zinc-700'}`} />
                                        </div>
                                    )}
                                </div>
                            )
                        })
                    }
                </div >

                {/* Bottom message */}
                {
                    infrastructureReady && steps.find(s => s.id === 'whatsapp')?.status !== 'configured' && (
                        <div className="mt-8 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                            <div className="flex items-start gap-3">
                                <div className="p-2 bg-amber-500/20 rounded-lg">
                                    <MessageCircle size={20} className="text-amber-400" />
                                </div>
                                <div>
                                    <h4 className="font-medium text-amber-300 mb-1">
                                        Infraestrutura pronta!
                                    </h4>
                                    <p className="text-sm text-amber-200/70">
                                        Redis e QStash estão configurados. Agora adicione suas credenciais do WhatsApp
                                        na página de configurações.
                                    </p>
                                    <Link
                                        href="/settings"
                                        prefetch={false}
                                        className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-medium rounded-lg transition-colors"
                                    >
                                        Configurar WhatsApp
                                        <ChevronRight size={16} />
                                    </Link>
                                </div>
                            </div>
                        </div>
                    )
                }

                {
                    !infrastructureReady && (
                        <div className="mt-8 p-4 bg-zinc-800/50 border border-white/10 rounded-xl text-center">
                            <p className="text-gray-400 text-sm">
                                Complete os passos acima na ordem para liberar o acesso ao sistema.
                            </p>
                            <p className="text-gray-500 text-xs mt-2">
                                Após configurar cada serviço no Vercel, clique em "Verificar novamente".
                            </p>
                        </div>
                    )
                }

                {/* Help links */}
                <div className="mt-8 pt-6 border-t border-white/5">
                    <h4 className="text-sm font-medium text-gray-400 mb-3">Precisa de ajuda?</h4>
                    <div className="grid grid-cols-2 gap-3">
                        <a
                            href="https://vercel.com/docs/storage/upstash"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 p-3 bg-zinc-800/50 hover:bg-zinc-800 border border-white/10 rounded-xl text-sm text-gray-300 transition-colors"
                        >
                            <Database size={16} className="text-red-400" />
                            Docs: Upstash no Vercel
                            <ExternalLink size={12} className="text-gray-500 ml-auto" />
                        </a>
                        <a
                            href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 p-3 bg-zinc-800/50 hover:bg-zinc-800 border border-white/10 rounded-xl text-sm text-gray-300 transition-colors"
                        >
                            <MessageCircle size={16} className="text-green-400" />
                            Docs: WhatsApp Cloud API
                            <ExternalLink size={12} className="text-gray-500 ml-auto" />
                        </a>
                    </div>
                </div>
            </div >
        </div >
    )
}

import { PrefetchLink } from '@/components/ui/PrefetchLink'
import { AccountAlertBanner } from '@/components/ui/AccountAlertBanner'

interface SidebarItemProps {
    href: string
    icon: React.ComponentType<{ size?: number }>
    label: string
    isActive: boolean
    onClick?: () => void
    onMouseEnter?: () => void
}

const SidebarItem = ({ href, icon: Icon, label, isActive, onClick, onMouseEnter }: SidebarItemProps) => (
    <PrefetchLink
        href={href}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 mb-1 ${isActive
            ? 'bg-primary-500/10 text-primary-400 font-medium border border-primary-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]'
            : 'text-gray-400 hover:bg-white/5 hover:text-white'
            }`}
    >
        <Icon size={20} />
        <span>{label}</span>
    </PrefetchLink>
)

export function DashboardShell({
    children,
    initialAuthStatus,
    initialHealthStatus
}: {
    children: React.ReactNode
    initialAuthStatus: any
    initialHealthStatus: HealthStatus
}) {
    const pathname = usePathname()
    const router = useRouter()
    const queryClient = useQueryClient()
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    const [isLoggingOut, setIsLoggingOut] = useState(false)

    // Enable real-time toast notifications for global events
    // This shows toasts when campaigns complete, new contacts are added, etc.
    const { useRealtimeNotifications } = require('@/hooks/useRealtimeNotifications')
    useRealtimeNotifications({ enabled: true })

    // Hydrate auth status in React Query if needed, or just use it directly
    // For now we use the prop directly for immediate rendering

    const companyName = initialAuthStatus?.company?.name
    const { user: currentAuthUser, isSuperAdmin: isAuthSuperAdmin } = useCurrentUser()
    const [branding, setBranding] = React.useState({ brand_name: 'SmartZap', brand_logo_url: '', brand_primary_color: '#16a34a' })
    React.useEffect(() => {
      fetch('/api/settings/branding').then(r => r.ok ? r.json() : null).then(d => { if (d) setBranding(d) }).catch(() => {})
    }, [])

    // Logout handler
    const handleLogout = async () => {
        setIsLoggingOut(true)
        try {
            await fetch('/api/auth/logout', { method: 'POST' })
            router.push('/login')
            router.refresh()
        } catch (error) {
            console.error('Logout error:', error)
        } finally {
            setIsLoggingOut(false)
        }
    }

    // Prefetch data on hover for faster page loads
    const prefetchRoute = useCallback((path: string) => {
        // console.log('Prefetching route:', path) // Debug
        switch (path) {
            case '/':
                queryClient.prefetchQuery({ queryKey: ['dashboardStats'], staleTime: 15000 })
                break
            case '/campaigns':
                queryClient.prefetchQuery({ queryKey: ['campaigns'], staleTime: 15000 })
                break
            case '/templates':
                queryClient.prefetchQuery({ queryKey: ['templates'], staleTime: Infinity })
                break
            case '/contacts':
                queryClient.prefetchQuery({ queryKey: ['contacts'], staleTime: 30000 })
                break
            case '/settings':
                queryClient.prefetchQuery({ queryKey: ['systemStatus'], staleTime: 60000 })
                break
        }
    }, [queryClient])

    // Health check query for onboarding
    const { data: healthStatus, refetch: refetchHealth, isFetching: isHealthFetching } = useQuery<HealthStatus>({
        queryKey: ['healthStatus'],
        queryFn: async () => {
            const response = await fetch('/api/health')
            if (!response.ok) throw new Error('Failed to fetch health')
            return response.json()
        },
        initialData: initialHealthStatus,
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        refetchInterval: (query) => {
            const data = query.state.data
            const isSetupComplete = data &&
                data.services.database?.status === 'ok' &&
                data.services.redis?.status === 'ok' &&
                data.services.qstash?.status === 'ok'
            return isSetupComplete ? false : 30000 // Polling a cada 30s se não estiver configurado
        },
    })

    const needsSetup = !healthStatus ||
        healthStatus.services.database?.status !== 'ok' ||
        healthStatus.services.redis.status !== 'ok' ||
        healthStatus.services.qstash.status !== 'ok'

    const navItems = [
        { path: '/', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/campaigns', label: 'Campanhas', icon: MessageSquare },
        { path: '/workflows', label: 'Workflows', icon: Workflow, hidden: true }, // TODO: In development
        { path: '/conversations', label: 'Conversas', icon: MessageCircle, hidden: true },
        { path: '/templates', label: 'Templates', icon: FileText },
        { path: '/contacts', label: 'Contatos', icon: Users },
        { path: '/settings', label: 'Configurações', icon: Settings },
    ].filter(item => !item.hidden)

    const getPageTitle = (path: string) => {
        if (path === '/') return 'Dashboard'
        if (path === '/campaigns') return 'Campanhas'
        if (path.startsWith('/campaigns/new')) return 'Nova Campanha'
        if (path.startsWith('/campaigns/')) return 'Detalhes da Campanha'
        if (path === '/workflows') return 'Workflows'
        if (path === '/conversations') return 'Conversas'
        if (path.startsWith('/conversations/')) return 'Conversa'
        if (path === '/templates') return 'Templates'
        if (path.startsWith('/contacts')) return 'Contatos'
        if (path.startsWith('/settings')) return 'Configurações'
        return 'App'
    }

    // Show onboarding overlay if setup is needed
    if (needsSetup) {
        return (
            <OnboardingOverlay
                health={healthStatus || null}
                isLoading={isHealthFetching}
                onRefresh={() => refetchHealth()}
            />
        )
    }

    return (
        <div className="min-h-screen bg-grid-dots text-gray-100 flex font-sans selection:bg-primary-500/30">
            {/* Mobile Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 lg:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`fixed lg:static inset-y-0 left-0 z-50 w-72 bg-zinc-950 lg:bg-transparent border-r border-white/5 transform transition-transform duration-200 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
                    }`}
            >
                <div className="h-full flex flex-col p-4">
                    {/* Logo */}
                    <div className="h-16 flex items-center px-2 mb-6">
                        <div className="w-10 h-10 bg-gradient-to-br from-primary-600 to-primary-800 rounded-xl flex items-center justify-center mr-3 shadow-lg shadow-primary-900/20 border border-white/10">
                            <Zap className="text-white" size={20} fill="currentColor" />
                        </div>
                        <div>
                            {branding.brand_logo_url ? (
                              <img src={branding.brand_logo_url} alt={branding.brand_name} className="h-9 object-contain" />
                            ) : (
                              <span className="text-xl font-bold text-white tracking-tight block">{branding.brand_name}</span>
                            )}
                            <span className="text-[10px] text-gray-500 uppercase tracking-widest font-medium">by Optivra</span>
                        </div>
                        <button
                            className="ml-auto lg:hidden"
                            onClick={() => setIsMobileMenuOpen(false)}
                        >
                            <X size={20} className="text-gray-400" />
                        </button>
                    </div>

                    {/* Nav */}
                    <nav className="flex-1 space-y-6 overflow-y-auto no-scrollbar">
                        <div>
                            <PrefetchLink
                                href="/campaigns/new"
                                className="w-full group relative flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-all shadow-lg shadow-primary-900/20 overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-primary-600 group-hover:bg-primary-500 transition-colors"></div>
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                                <Plus size={18} className="relative z-10 text-white" />
                                <span className="relative z-10 text-white">Nova Campanha</span>
                            </PrefetchLink>
                        </div>

                        <div className="space-y-1">
                            <p className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Menu</p>
                            {navItems.map((item) => (
                                <SidebarItem
                                    key={item.path}
                                    href={item.path}
                                    icon={item.icon}
                                    label={item.label}
                                    isActive={pathname === item.path}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    onMouseEnter={() => prefetchRoute(item.path)}
                                />
                            ))}
                        </div>
                    </nav>

                    {/* User Profile */}
                    <div className="pt-4 mt-4 border-t border-white/5">
                        <button
                            onClick={handleLogout}
                            disabled={isLoggingOut}
                            className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 cursor-pointer transition-colors border border-transparent hover:border-white/5"
                        >
                            <div className="w-9 h-9 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center overflow-hidden">
                                <span className="text-lg font-bold text-primary-400">
                                    {companyName?.charAt(0)?.toUpperCase() || 'S'}
                                </span>
                            </div>
                            <div className="flex-1 min-w-0 text-left">
                                <p className="text-sm font-medium text-white truncate">{companyName || 'SmartZap'}</p>
                                <p className="text-xs text-gray-500 truncate">
                                  {currentAuthUser?.role === 'super_admin' ? 'Super Admin' : currentAuthUser?.role === 'manager' ? 'Manager' : 'Usuário'}
                                </p>
                            </div>
                            {isLoggingOut ? (
                                <div className="w-4 h-4 border-2 border-gray-500 border-t-white rounded-full animate-spin" />
                            ) : (
                                <LogOut size={16} className="text-gray-500 hover:text-white transition-colors" />
                            )}
                        </button>
                    </div>
                    {/* Version */}
                    <div className="pt-2 pb-1 text-center">
                      <span className="text-[10px] text-zinc-600 font-mono">v2.0.0</span>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
                {/* Header */}
                <header className="h-20 flex items-center justify-between px-6 lg:px-10 flex-shrink-0">
                    <div className="flex items-center">
                        <button
                            className="lg:hidden p-2 text-gray-400 mr-4"
                            onClick={() => setIsMobileMenuOpen(true)}
                        >
                            <Menu size={24} />
                        </button>

                        <div className="hidden md:flex items-center text-sm text-gray-500">
                            <span className="hover:text-white cursor-pointer transition-colors">App</span>
                            <span className="mx-2 text-gray-700">/</span>
                            <span className="text-gray-300">{getPageTitle(pathname || '/')}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Org name badge */}
                        {currentAuthUser?.organizationId && (
                          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700">
                            <span className="w-2 h-2 rounded-full bg-green-500"></span>
                            <span className="text-xs text-gray-300 font-medium">
                              {branding.brand_name !== 'SmartZap' ? branding.brand_name : (currentAuthUser?.name || 'Organização')}
                            </span>
                            {isAuthSuperAdmin && (
                              <span className="text-xs px-1.5 py-0.5 rounded-md bg-purple-500/20 text-purple-400 font-semibold ml-0.5">Admin</span>
                            )}
                          </div>
                        )}
                        <div className="relative group">
                            <Bell size={20} className="text-gray-500 group-hover:text-white transition-colors cursor-pointer" />
                            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-primary-500 rounded-full border-2 border-zinc-950"></span>
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <main className={`flex-1 ${pathname?.includes('/campaigns/new') || (pathname?.includes('/templates/') && pathname !== '/templates')
                    ? 'overflow-hidden'
                    : 'overflow-auto p-6 lg:p-10'
                    }`}>
                    <div className={
                        pathname?.includes('/campaigns/new') || (pathname?.includes('/templates/') && pathname !== '/templates')
                            ? 'h-full'
                            : 'max-w-7xl mx-auto'
                    }>
                        {/* Account alerts banner - hide in fullscreen mode */}
                        {!pathname?.includes('/campaigns/new') && <AccountAlertBanner />}

                        {children}
                    </div>
                </main>
            </div>
        </div>
    )
}
