'use client'

import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useDashboardController } from '@/hooks/useDashboard'
import { DashboardView } from '@/components/features/dashboard/DashboardView'
import type { ChartPeriod } from '@/components/features/dashboard/DashboardView'

const DEFAULT_STATS = {
    sent24h: '0',
    deliveryRate: '0%',
    activeCampaigns: '0',
    failedMessages: '0',
    chartData: []
}

export function DashboardClientWrapper({ initialData }: { initialData: any }) {
    const [activePeriod, setActivePeriod] = useState<ChartPeriod>('7D')
    const { stats, recentCampaigns, isLoading } = useDashboardController(initialData, activePeriod)
    const queryClient = useQueryClient()

    // Prefetch outras páginas em background após o dashboard carregar
    useEffect(() => {
        if (!isLoading) {
            const timeout = setTimeout(() => {
                queryClient.prefetchQuery({
                    queryKey: ['campaigns'],
                    staleTime: 30000
                })
                queryClient.prefetchQuery({
                    queryKey: ['templates'],
                    staleTime: Infinity
                })
            }, 1000)

            return () => clearTimeout(timeout)
        }
    }, [isLoading, queryClient])

    return (
        <DashboardView
            stats={stats ?? DEFAULT_STATS}
            recentCampaigns={recentCampaigns ?? []}
            isLoading={isLoading}
            activePeriod={activePeriod}
            onPeriodChange={setActivePeriod}
        />
    )
}
