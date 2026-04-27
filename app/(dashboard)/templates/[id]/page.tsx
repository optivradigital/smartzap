'use client';

import React, { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTemplateProjectDetailsQuery } from '@/hooks/useTemplateProjects';
import {
    Loader2, ArrowLeft, Check, AlertCircle, Clock, Send, Trash2,
    RefreshCw, Filter, ChevronDown, CheckCircle, XCircle, AlertTriangle,
    Copy, CheckSquare, Square, Eye
} from 'lucide-react';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { cn } from '@/lib/utils';
import { WhatsAppPhonePreview } from '@/components/ui/WhatsAppPhonePreview';

export default function TemplateProjectDetailsPage() {
    const params = useParams();
    const id = params.id as string;
    const router = useRouter();
    const queryClient = useQueryClient();
    const [selectedItems, setSelectedItems] = useState<string[]>([]);
    const [expandedSection, setExpandedSection] = useState<'APPROVED' | 'REJECTED' | 'PENDING' | 'DRAFT' | 'ALL'>('ALL');
    const [previewItem, setPreviewItem] = useState<any | null>(null);

    const { data: project, isLoading, error, refetch } = useTemplateProjectDetailsQuery(id);

    // DEBUG: Inspect loaded items
    React.useEffect(() => {
        if (project?.items) {
            console.log('[DEBUG] Loaded Items:', JSON.stringify(project.items.map((i: any) => ({ name: i.name, category: i.category })), null, 2));
        }
    }, [project]);

    // Toggle selection
    const toggleSelection = (itemId: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        setSelectedItems(prev =>
            prev.includes(itemId)
                ? prev.filter(id => id !== itemId)
                : [...prev, itemId]
        );
    };

    const toggleSelectAll = () => {
        if (!project?.items) return;
        const validItems = project.items.filter((i: any) => !i.meta_id); // Only select draft items

        if (selectedItems.length === validItems.length) {
            setSelectedItems([]);
        } else {
            setSelectedItems(validItems.map((i: any) => i.id));
        }
    };

    // Bulk Submit Mutation
    const bulkSubmitMutation = useMutation({
        mutationFn: async (itemIds: string[]) => {
            const itemsToSubmit = (project?.items || []).filter((i: any) => itemIds.includes(i.id));
            const results = [];

            for (const item of itemsToSubmit) {
                try {
                    const payload = {
                        itemId: item.id, // ID for server-side DB update
                        projectId: id,
                        name: item.name,
                        category: item.category || 'UTILITY', // Use item category (MARKETING/UTILITY)
                        language: item.language || 'pt_BR',
                        content: item.content,
                        header: item.header,
                        footer: item.footer,
                        buttons: item.buttons
                    };

                    const response = await fetch('/api/templates/create', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    if (!response.ok) throw new Error('Falha na API');

                    const result = await response.json();

                    if (result.results && result.results[0] && result.results[0].success) {
                        results.push(item.id);
                    } else {
                        throw new Error(result.results?.[0]?.error || 'Erro desconhecido');
                    }
                } catch (e) {
                    console.error(`Erro ao enviar item ${item.name}`, e);
                }
            }
            return results;
        },
        onSuccess: (results) => {
            queryClient.invalidateQueries({ queryKey: ['template_projects', id] });
            toast.success(`${results.length} templates enviados com sucesso para a Meta!`);
            setSelectedItems([]);
        },
        onError: () => {
            toast.error('Erro ao enviar alguns templates. Verifique e tente novamente.');
        }
    });

    // Delete Item Mutation
    const deleteItemMutation = useMutation({
        mutationFn: async (itemId: string) => {
            const response = await fetch(`/api/template-projects/items/${itemId}`, {
                method: 'DELETE',
            });
            if (!response.ok) throw new Error('Falha ao excluir item');
        },
        onSuccess: () => {
            // Invalidate list
            queryClient.invalidateQueries({ queryKey: ['template_projects', id] });
            toast.success('Rascunho excluído');
        },
        onError: () => {
            toast.error('Erro ao excluir rascunho');
        }
    });

    // Sync Project Mutation
    const syncProjectMutation = useMutation({
        mutationFn: async () => {
            const response = await fetch(`/api/template-projects/${id}/sync`, { method: 'POST' });
            if (!response.ok) throw new Error('Falha ao sincronizar');
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['template_projects', id] });
            toast.success('Status atualizados da Meta!');
        },
        onError: () => {
            toast.error('Erro ao sincronizar status.');
        }
    });

    // Grouping Logic
    const groups = useMemo(() => {
        if (!project?.items) return { APPROVED: [], REJECTED: [], PENDING: [], DRAFT: [] };
        return {
            APPROVED: project.items.filter((i: any) => i.meta_status === 'APPROVED'),
            REJECTED: project.items.filter((i: any) => i.meta_status === 'REJECTED'),
            PENDING: project.items.filter((i: any) => i.meta_status && i.meta_status !== 'APPROVED' && i.meta_status !== 'REJECTED'),
            DRAFT: project.items.filter((i: any) => !i.meta_status) // Strictly no status = Draft
        };
    }, [project?.items]);

    const sections = [
        { id: 'APPROVED', label: 'Aprovados', count: groups.APPROVED.length, color: 'emerald', icon: CheckCircle },
        { id: 'REJECTED', label: 'Rejeitados', count: groups.REJECTED.length, color: 'red', icon: XCircle },
        { id: 'PENDING', label: 'Em Análise', count: groups.PENDING.length, color: 'yellow', icon: Clock },
        { id: 'DRAFT', label: 'Rascunhos (Não Enviados)', count: groups.DRAFT.length, color: 'zinc', icon: Filter },
    ] as const;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (error || !project) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen gap-4">
                <div className="p-4 bg-red-50 text-red-600 rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    <span>Erro ao carregar projeto ou projeto não encontrado.</span>
                </div>
                <button
                    onClick={() => router.push('/templates')}
                    className="flex items-center gap-2 text-zinc-500 hover:text-zinc-900"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Voltar para lista
                </button>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-12 h-[calc(100vh-80px)] md:h-[calc(100vh-60px)] gap-6 p-6 overflow-hidden w-full">
            {/* --- LEFT SIDE: LIST & STATS --- */}
            <div className="col-span-12 lg:col-span-8 flex flex-col min-w-0 h-full">

                {/* Header Actions */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push('/templates')}
                            className="p-2 -ml-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h1 className="text-xl font-bold flex items-center gap-2">
                                {project.title}
                                <span className="px-2 py-0.5 text-xs rounded-full border bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400">
                                    {groups.DRAFT.length === 0 && groups.PENDING.length === 0 ? 'Concluído' : 'Em Progresso'}
                                </span>
                            </h1>
                            <p className="text-xs text-zinc-500 mt-1">
                                Criado em {new Date(project.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })}
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-2 w-full md:w-auto">
                        <button
                            onClick={() => syncProjectMutation.mutate()}
                            disabled={syncProjectMutation.isPending}
                            className="px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-2 text-sm disabled:opacity-50"
                        >
                            <RefreshCw className={cn("w-4 h-4", syncProjectMutation.isPending && "animate-spin")} />
                            {syncProjectMutation.isPending ? 'Sincronizando...' : 'Sincronizar Meta'}
                        </button>

                        {groups.DRAFT.length > 0 && (
                            <button
                                onClick={toggleSelectAll}
                                className="px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-2 text-sm"
                            >
                                {selectedItems.length === groups.DRAFT.length ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                                Selecionar Tudo
                            </button>
                        )}

                        {selectedItems.length > 0 && (
                            <button
                                onClick={() => bulkSubmitMutation.mutate(selectedItems)}
                                disabled={bulkSubmitMutation.isPending}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2 text-sm font-medium disabled:opacity-50"
                            >
                                {bulkSubmitMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                Enviar ({selectedItems.length}) para Meta
                            </button>
                        )}
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 shrink-0">
                    <StatCard
                        label="Aprovados"
                        count={groups.APPROVED.length}
                        total={project.items.length}
                        color="emerald"
                        icon={CheckCircle}
                    />
                    <StatCard
                        label="Em Análise"
                        count={groups.PENDING.length}
                        total={project.items.length}
                        color="yellow"
                        icon={Clock}
                    />
                    <StatCard
                        label="Rejeitados"
                        count={groups.REJECTED.length}
                        total={project.items.length}
                        color="red"
                        icon={XCircle}
                    />
                    <StatCard
                        label="Rascunhos"
                        count={groups.DRAFT.length}
                        total={project.items.length}
                        color="zinc"
                        icon={Filter}
                    />
                </div>

                {/* Template List */}
                <div className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-y-auto">
                    {sections.map(section => {
                        if (section.count === 0) return null;

                        const isExpanded = expandedSection === 'ALL' || expandedSection === section.id;
                        // @ts-ignore
                        const sectionItems = groups[section.id];

                        return (
                            <div key={section.id} className="border-b border-zinc-200 dark:border-zinc-800 last:border-0">
                                <button
                                    onClick={() => setExpandedSection(isExpanded && expandedSection !== 'ALL' ? 'ALL' : section.id)}
                                    className="w-full flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors sticky top-0 bg-white dark:bg-zinc-900 z-10"
                                >
                                    <div className="flex items-center gap-3">
                                        <section.icon className={cn("w-5 h-5", {
                                            'text-blue-500': section.color === 'emerald',
                                            'text-red-500': section.color === 'red',
                                            'text-yellow-500': section.color === 'yellow',
                                            'text-zinc-500': section.color === 'zinc',
                                        })} />
                                        <span className="font-medium">{section.label}</span>
                                        <span className="px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-xs text-zinc-500">
                                            {section.count}
                                        </span>
                                    </div>
                                    <ChevronDown className={cn("w-4 h-4 text-zinc-400 transition-transform", { "rotate-180": isExpanded })} />
                                </button>

                                {isExpanded && (
                                    <div className="px-4 pb-4 space-y-2">
                                        {/* @ts-ignore */}
                                        {sectionItems.map((item: any) => {
                                            const isSelected = selectedItems.includes(item.id);
                                            const isDraft = !item.meta_id;
                                            const isActive = previewItem?.id === item.id;

                                            return (
                                                <div
                                                    key={item.id}
                                                    onClick={() => setPreviewItem(item)}
                                                    className={cn(
                                                        "p-3 rounded-lg border transition-all cursor-pointer flex gap-3 relative group",
                                                        isActive
                                                            ? "bg-blue-50 dark:bg-blue-900/10 border-blue-500 ring-1 ring-blue-500"
                                                            : "bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                                                    )}
                                                >
                                                    {isDraft && (
                                                        <div
                                                            onClick={(e) => toggleSelection(item.id, e)}
                                                            className={cn(
                                                                "mt-1 w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0 z-10",
                                                                isSelected
                                                                    ? "bg-blue-500 border-blue-500 text-white"
                                                                    : "border-zinc-300 dark:border-zinc-600 text-transparent hover:border-zinc-400"
                                                            )}
                                                        >
                                                            <Check className="w-3.5 h-3.5" />
                                                        </div>
                                                    )}

                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex justify-between items-start mb-1">
                                                            <span className="text-sm font-medium flex items-center gap-2 truncate">
                                                                {item.name}
                                                            </span>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs text-zinc-400 flex items-center gap-1 shrink-0">
                                                                    <Copy className="w-3 h-3" />
                                                                    {item.language}
                                                                </span>
                                                                {isDraft && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            if (confirm('Excluir este rascunho?')) {
                                                                                deleteItemMutation.mutate(item.id);
                                                                            }
                                                                        }}
                                                                        className="p-1 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors opacity-0 group-hover:opacity-100"
                                                                        title="Excluir rascunho"
                                                                    >
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">
                                                            {item.content}
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* --- RIGHT SIDE: PREVIEW --- */}
            <div className="hidden lg:flex col-span-4 border-l border-zinc-200 dark:border-zinc-800 pl-6 flex-col justify-center">
                {previewItem ? (
                    <div className="sticky top-6 w-full">
                        <h3 className="text-sm font-medium text-zinc-400 mb-4 text-center">
                            Pré-visualização
                        </h3>
                        <WhatsAppPhonePreview
                            components={[
                                previewItem.header ? { type: 'HEADER', ...previewItem.header } : null,
                                { type: 'BODY', text: previewItem.content },
                                previewItem.footer ? { type: 'FOOTER', ...previewItem.footer } : null,
                                previewItem.buttons?.length ? { type: 'BUTTONS', buttons: previewItem.buttons } : null
                            ].filter(Boolean)}
                            fallbackContent={previewItem.content}
                            variables={['Nome do Contato', 'Valor', 'Data']} // Placeholder
                            size="md"
                        />
                        <div className="mt-6 p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg">
                            <h4 className="text-sm font-medium mb-2">Detalhes Técnicos</h4>
                            <div className="space-y-2 text-xs text-zinc-500">
                                <div className="flex justify-between">
                                    <span>Status Meta:</span>
                                    <span className={cn(
                                        "font-medium",
                                        previewItem.meta_status === 'APPROVED' && "text-blue-500",
                                        previewItem.meta_status === 'REJECTED' && "text-red-500",
                                        previewItem.meta_status === 'PENDING' && "text-yellow-500",
                                    )}>{previewItem.meta_status || 'Rascunho'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>ID:</span>
                                    <span className="font-mono">{previewItem.id.slice(0, 8)}...</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-400 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50 dark:bg-zinc-900/30 w-full">
                        <Eye className="w-12 h-12 mb-4 opacity-50" />
                        <p className="text-sm">Selecione um template para visualizar</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function StatCard({ label, count, total, color, icon: Icon }: any) {
    const percent = total > 0 ? Math.round((count / total) * 100) : 0;

    const colors: Record<string, string> = {
        emerald: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20',
        yellow: 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-500/10 border-yellow-100 dark:border-yellow-500/20',
        red: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border-red-100 dark:border-red-500/20',
        zinc: 'text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-500/10 border-zinc-100 dark:border-zinc-500/20',
    };

    return (
        <div className={cn("p-4 rounded-xl border flex flex-col justify-between h-24", colors[color])}>
            <div className="flex justify-between items-start">
                <Icon className="w-5 h-5 opacity-70" />
                <span className="text-2xl font-bold">{count}</span>
            </div>
            <div className="flex justify-between items-end">
                <span className="text-xs opacity-80 font-medium">{label}</span>
                <span className="text-xs opacity-60 font-mono">{percent}%</span>
            </div>
        </div>
    );
}
