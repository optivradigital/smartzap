'use client';

import { StrategySelectorModal, AIStrategy } from '@/components/templates/StrategySelectorModal';
import { Badge } from '@/components/ui/badge';
import { VenetianMask, Megaphone, Wrench } from 'lucide-react';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTemplateProjectMutations } from '@/hooks/useTemplateProjects';
import { toast } from 'sonner';
import {
    Sparkles, ArrowLeft, Wand2, Loader2, Check, Save,
    AlertCircle, PenLine, Plus, Trash2, ChevronDown, ChevronUp, Link
} from 'lucide-react';
import { GeneratedTemplate } from '@/lib/ai/services/template-agent';
import { templateService } from '@/lib/whatsapp/template.service';

// ─── Manual template builder state ───────────────────────────────────────────
interface ManualBtn { type: 'URL' | 'QUICK_REPLY'; text: string; url: string }
interface ManualDraft {
    name: string
    category: 'MARKETING' | 'UTILITY'
    language: string
    headerText: string
    content: string
    footerText: string
    buttons: ManualBtn[]
}
const emptyDraft = (): ManualDraft => ({
    name: '', category: 'UTILITY', language: 'pt_BR',
    headerText: '', content: '', footerText: '', buttons: []
})
const draftToGenerated = (d: ManualDraft): GeneratedTemplate => ({
    id: `manual_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    name: d.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 512) || 'template_manual',
    content: d.content,
    header: d.headerText ? { format: 'TEXT', text: d.headerText } : undefined,
    footer: d.footerText ? { text: d.footerText } : undefined,
    buttons: d.buttons.length ? d.buttons.map(b => ({ type: 'URL', text: b.text, url: b.url })) : undefined,
    category: d.category,
    language: d.language,
})

// ─── Main page ────────────────────────────────────────────────────────────────
export default function NewTemplateProjectPage() {
    const router = useRouter();
    const { createProject, isCreating } = useTemplateProjectMutations();

    // Steps: 'config' | 'generating' | 'review'
    const [step, setStep] = useState<'config' | 'generating' | 'review'>('config');
    const [mode, setMode] = useState<'ai' | 'manual'>('ai');

    // AI config state
    const [prompt, setPrompt] = useState('');
    const [quantity, setQuantity] = useState(5);
    const [language, setLanguage] = useState('pt_BR');
    const [universalUrl, setUniversalUrl] = useState('');
    const [strategy, setStrategy] = useState<AIStrategy | null>(null);

    // Manual mode state
    const [draft, setDraft] = useState<ManualDraft>(emptyDraft());
    const [projectTitle, setProjectTitle] = useState('');
    const [showDraftForm, setShowDraftForm] = useState(true);

    // Results (shared AI + manual)
    const [generatedTemplates, setGeneratedTemplates] = useState<GeneratedTemplate[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // ── AI Generation ───────────────────────────────────────────────────────
    const handleGenerate = async () => {
        if (!prompt) return toast.error('Digite um comando para a IA');
        setStep('generating');
        try {
            const response = await templateService.generateUtilityTemplates({
                prompt, quantity, language: language as any,
                strategy: strategy || 'bypass'
            });
            let templates = response.templates;
            if (universalUrl && templates) {
                templates = templates.map(t => ({
                    ...t,
                    buttons: t.buttons?.map(b => ({ ...b, url: b.type === 'URL' ? universalUrl : b.url }))
                }));
            }
            setGeneratedTemplates(templates);
            const valid = templates.filter(t => !t.judgment || t.judgment.approved || t.wasFixed);
            setSelectedIds(new Set(valid.map(t => t.id)));
            setStep('review');
        } catch (error) {
            console.error(error);
            toast.error('Erro ao gerar templates');
            setStep('config');
        }
    };

    // ── Manual: add draft to list ───────────────────────────────────────────
    const handleAddManual = () => {
        if (!draft.content.trim()) return toast.error('Preencha o corpo do template');
        if (!draft.name.trim()) return toast.error('Preencha o nome do template');
        const t = draftToGenerated(draft);
        setGeneratedTemplates(prev => {
            const next = [...prev, t];
            setSelectedIds(ids => new Set([...ids, t.id]));
            return next;
        });
        setDraft(emptyDraft());
        setShowDraftForm(false);
        toast.success('Template adicionado');
    };

    const handleRemoveTemplate = (id: string) => {
        setGeneratedTemplates(prev => prev.filter(t => t.id !== id));
        setSelectedIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    };

    const handleGoToReview = () => {
        if (generatedTemplates.length === 0) return toast.error('Adicione pelo menos um template');
        setStep('review');
    };

    // ── Save Project ────────────────────────────────────────────────────────
    const handleSaveProject = async () => {
        if (selectedIds.size === 0) return toast.error('Selecione pelo menos um template');
        try {
            const selected = generatedTemplates.filter(t => selectedIds.has(t.id));
            const title = mode === 'manual'
                ? (projectTitle.trim() || `Projeto Manual – ${new Date().toLocaleDateString('pt-BR')}`)
                : prompt.substring(0, 50) + (prompt.length > 50 ? '...' : '');

            await createProject({
                title,
                prompt: mode === 'manual' ? (projectTitle || 'Criado manualmente') : prompt,
                status: 'draft',
                items: selected.map(t => ({
                    name: t.name,
                    content: t.content,
                    header: t.header,
                    footer: t.footer,
                    buttons: t.buttons,
                    language: t.language || language,
                    category: t.category,
                    meta_status: undefined
                }))
            });
        } catch { /* handled by mutation */ }
    };

    const toggleSelect = (id: string) => {
        const s = new Set(selectedIds);
        s.has(id) ? s.delete(id) : s.add(id);
        setSelectedIds(s);
    };

    // ── Render ──────────────────────────────────────────────────────────────
    return (
        <div className="container mx-auto py-8 max-w-5xl">

            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <button onClick={() => router.back()} className="p-2 hover:bg-zinc-800 rounded-full">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="text-2xl font-bold">Novo Projeto de Templates</h1>
                {strategy && (
                    <Badge variant="outline" className="ml-4 gap-2 py-1 px-3">
                        {strategy === 'marketing' && <Megaphone className="w-3 h-3" />}
                        {strategy === 'utility' && <Wrench className="w-3 h-3" />}
                        {strategy === 'bypass' && <VenetianMask className="w-3 h-3" />}
                        Modo: {strategy.toUpperCase()}
                    </Badge>
                )}
            </div>

            {/* Strategy selector modal */}
            <StrategySelectorModal
                isOpen={!strategy}
                onSelect={setStrategy}
                onClose={() => router.push('/templates')}
            />

            {/* ── STEP: CONFIG ── */}
            {strategy && step === 'config' && (
                <div className="space-y-6">

                    {/* Mode toggle */}
                    <div className="flex gap-2 p-1 bg-zinc-900 border border-zinc-800 rounded-xl w-fit">
                        <button
                            onClick={() => setMode('ai')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'ai' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                        >
                            <Wand2 className="w-4 h-4" /> Gerar com IA
                        </button>
                        <button
                            onClick={() => setMode('manual')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'manual' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                        >
                            <PenLine className="w-4 h-4" /> Criar Manualmente
                        </button>
                    </div>

                    {/* ── AI mode ── */}
                    {mode === 'ai' && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-2 space-y-6">
                                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl">
                                    <div className="flex items-center gap-2 mb-4 text-blue-500">
                                        <Sparkles className="w-5 h-5" />
                                        <h2 className="font-semibold">O que você deseja criar?</h2>
                                    </div>
                                    <textarea
                                        value={prompt}
                                        onChange={e => setPrompt(e.target.value)}
                                        placeholder="Ex: Templates para confirmação de agendamento de consulta médica com opção de remarcar..."
                                        className="w-full h-40 p-4 rounded-lg border border-zinc-700 bg-zinc-950 focus:ring-2 focus:ring-blue-500 outline-none resize-none text-lg text-white"
                                    />
                                    <div className="flex items-center justify-between mt-4 text-sm text-zinc-500">
                                        <span>Dica: Seja específico sobre o objetivo e tom de voz.</span>
                                        <span>{prompt.length} caracteres</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
                                        <label className="block text-sm font-medium mb-2 text-gray-300">Quantidade</label>
                                        <select
                                            value={quantity}
                                            onChange={e => setQuantity(Number(e.target.value))}
                                            className="w-full p-2 rounded bg-zinc-950 border border-zinc-700 text-white"
                                        >
                                            <option value={1}>1 Opção</option>
                                            <option value={3}>3 Opções</option>
                                            <option value={5}>5 Opções</option>
                                            <option value={10}>10 Opções</option>
                                        </select>
                                    </div>
                                    <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
                                        <label className="block text-sm font-medium mb-2 text-gray-300">Idioma</label>
                                        <select
                                            value={language}
                                            onChange={e => setLanguage(e.target.value)}
                                            className="w-full p-2 rounded bg-zinc-950 border border-zinc-700 text-white"
                                        >
                                            <option value="pt_BR">Português (Brasil)</option>
                                            <option value="en_US">Inglês (EUA)</option>
                                            <option value="es_ES">Espanhol</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
                                    <label className="block text-sm font-medium mb-2 text-gray-300">URL Padrão (Opcional)</label>
                                    <input
                                        type="url"
                                        value={universalUrl}
                                        onChange={e => setUniversalUrl(e.target.value)}
                                        placeholder="https://seu-site.com"
                                        className="w-full p-2 rounded bg-zinc-950 border border-zinc-700 text-white"
                                    />
                                    <p className="text-xs text-zinc-500 mt-1">Será usada nos botões dos templates gerados.</p>
                                </div>

                                <button
                                    onClick={handleGenerate}
                                    disabled={!prompt}
                                    className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Wand2 className="w-5 h-5" />
                                    Gerar Templates com IA
                                </button>
                            </div>

                            <div className="space-y-6">
                                <div className="bg-blue-900/10 border border-blue-800 p-6 rounded-xl">
                                    <h3 className="font-semibold text-blue-100 mb-2">Como funciona?</h3>
                                    <ul className="space-y-3 text-sm text-blue-200">
                                        <li className="flex items-start gap-2">
                                            <span className="mt-1 block w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                                            Nossa IA analisa seu pedido e busca melhores práticas da Meta.
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="mt-1 block w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                                            Gera templates otimizados para aprovação.
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="mt-1 block w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                                            O AI Judge verifica e corrige proibições automaticamente.
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Manual mode ── */}
                    {mode === 'manual' && (
                        <div className="space-y-6">
                            {/* Project title */}
                            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
                                <label className="block text-sm font-medium mb-2 text-gray-300">Nome do Projeto</label>
                                <input
                                    type="text"
                                    value={projectTitle}
                                    onChange={e => setProjectTitle(e.target.value)}
                                    placeholder="Ex: Templates de boas-vindas"
                                    className="w-full p-2 rounded bg-zinc-950 border border-zinc-700 text-white"
                                />
                            </div>

                            {/* Templates added so far */}
                            {generatedTemplates.length > 0 && (
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-300 mb-3">
                                        Templates adicionados ({generatedTemplates.length})
                                    </h3>
                                    <div className="space-y-2">
                                        {generatedTemplates.map(t => (
                                            <div key={t.id} className="flex items-center justify-between bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3">
                                                <div>
                                                    <span className="text-xs font-mono text-zinc-400">{t.name}</span>
                                                    <p className="text-sm text-white line-clamp-1 mt-0.5">{t.content}</p>
                                                </div>
                                                <button
                                                    onClick={() => handleRemoveTemplate(t.id)}
                                                    className="ml-4 p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Draft form */}
                            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                                <button
                                    onClick={() => setShowDraftForm(f => !f)}
                                    className="w-full flex items-center justify-between px-5 py-4 text-left"
                                >
                                    <span className="font-medium text-white flex items-center gap-2">
                                        <Plus className="w-4 h-4 text-blue-400" />
                                        {generatedTemplates.length === 0 ? 'Criar template' : 'Adicionar outro template'}
                                    </span>
                                    {showDraftForm ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                                </button>

                                {showDraftForm && (
                                    <div className="px-5 pb-5 space-y-4 border-t border-zinc-800">
                                        <div className="grid grid-cols-2 gap-4 pt-4">
                                            <div>
                                                <label className="block text-xs text-gray-400 mb-1">Nome do template *</label>
                                                <input
                                                    type="text"
                                                    value={draft.name}
                                                    onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                                                    placeholder="boas_vindas_cliente"
                                                    className="w-full p-2 rounded bg-zinc-950 border border-zinc-700 text-white text-sm"
                                                />
                                                <p className="text-xs text-zinc-600 mt-1">Letras, números e underscores</p>
                                            </div>
                                            <div>
                                                <label className="block text-xs text-gray-400 mb-1">Categoria</label>
                                                <select
                                                    value={draft.category}
                                                    onChange={e => setDraft(d => ({ ...d, category: e.target.value as any }))}
                                                    className="w-full p-2 rounded bg-zinc-950 border border-zinc-700 text-white text-sm"
                                                >
                                                    <option value="UTILITY">UTILITY</option>
                                                    <option value="MARKETING">MARKETING</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-xs text-gray-400 mb-1">Cabeçalho (opcional)</label>
                                            <input
                                                type="text"
                                                value={draft.headerText}
                                                onChange={e => setDraft(d => ({ ...d, headerText: e.target.value }))}
                                                placeholder="Texto do cabeçalho..."
                                                className="w-full p-2 rounded bg-zinc-950 border border-zinc-700 text-white text-sm"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs text-gray-400 mb-1">Corpo *</label>
                                            <textarea
                                                value={draft.content}
                                                onChange={e => setDraft(d => ({ ...d, content: e.target.value }))}
                                                placeholder="Olá {{1}}, sua mensagem aqui..."
                                                rows={4}
                                                className="w-full p-2 rounded bg-zinc-950 border border-zinc-700 text-white text-sm resize-none"
                                            />
                                            <p className="text-xs text-zinc-600 mt-1">Use {'{{1}}'}, {'{{2}}'} para variáveis.</p>
                                        </div>

                                        <div>
                                            <label className="block text-xs text-gray-400 mb-1">Rodapé (opcional)</label>
                                            <input
                                                type="text"
                                                value={draft.footerText}
                                                onChange={e => setDraft(d => ({ ...d, footerText: e.target.value }))}
                                                placeholder="Responda SAIR para cancelar"
                                                className="w-full p-2 rounded bg-zinc-950 border border-zinc-700 text-white text-sm"
                                            />
                                        </div>

                                        {/* Buttons */}
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <label className="text-xs text-gray-400">Botões (opcional, máx. 3)</label>
                                                {draft.buttons.length < 3 && (
                                                    <button
                                                        onClick={() => setDraft(d => ({ ...d, buttons: [...d.buttons, { type: 'URL', text: '', url: '' }] }))}
                                                        className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                                                    >
                                                        <Plus className="w-3 h-3" /> Adicionar botão
                                                    </button>
                                                )}
                                            </div>
                                            {draft.buttons.map((btn, i) => (
                                                <div key={i} className="flex gap-2 mb-2">
                                                    <input
                                                        type="text"
                                                        value={btn.text}
                                                        onChange={e => setDraft(d => ({ ...d, buttons: d.buttons.map((b, j) => j === i ? { ...b, text: e.target.value } : b) }))}
                                                        placeholder="Texto do botão"
                                                        className="flex-1 p-2 rounded bg-zinc-950 border border-zinc-700 text-white text-sm"
                                                    />
                                                    <input
                                                        type="url"
                                                        value={btn.url}
                                                        onChange={e => setDraft(d => ({ ...d, buttons: d.buttons.map((b, j) => j === i ? { ...b, url: e.target.value } : b) }))}
                                                        placeholder="https://..."
                                                        className="flex-1 p-2 rounded bg-zinc-950 border border-zinc-700 text-white text-sm"
                                                    />
                                                    <button
                                                        onClick={() => setDraft(d => ({ ...d, buttons: d.buttons.filter((_, j) => j !== i) }))}
                                                        className="p-2 text-zinc-500 hover:text-red-400 transition-colors"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>

                                        <button
                                            onClick={handleAddManual}
                                            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 text-sm"
                                        >
                                            <Plus className="w-4 h-4" /> Adicionar template
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Go to review */}
                            {generatedTemplates.length > 0 && (
                                <button
                                    onClick={handleGoToReview}
                                    className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium flex items-center justify-center gap-2"
                                >
                                    <Save className="w-5 h-5" />
                                    Revisar e Salvar ({generatedTemplates.length} template{generatedTemplates.length !== 1 ? 's' : ''})
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ── STEP: GENERATING ── */}
            {step === 'generating' && (
                <div className="flex flex-col items-center justify-center min-h-[400px]">
                    <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                    <h2 className="text-xl font-semibold mb-2">Criando seus templates...</h2>
                    <p className="text-zinc-500">O Agente está consultando as diretrizes da Meta e gerando variações.</p>
                </div>
            )}

            {/* ── STEP: REVIEW ── */}
            {step === 'review' && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setStep('config')}
                                className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                            >
                                <ArrowLeft className="w-4 h-4" />
                            </button>
                            <h2 className="text-xl font-semibold">Revise os Templates Gerados</h2>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-zinc-500">{selectedIds.size} selecionados</span>
                            <button
                                onClick={handleSaveProject}
                                disabled={isCreating || selectedIds.size === 0}
                                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center gap-2 disabled:opacity-50"
                            >
                                {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Salvar Projeto
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {generatedTemplates.map(t => (
                            <div
                                key={t.id}
                                onClick={() => toggleSelect(t.id)}
                                className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all hover:shadow-md ${
                                    selectedIds.has(t.id)
                                        ? 'border-blue-500 bg-blue-900/10'
                                        : 'border-transparent bg-zinc-900 shadow-sm'
                                }`}
                            >
                                {selectedIds.has(t.id) && (
                                    <div className="absolute top-2 right-2 p-1 bg-blue-500 text-white rounded-full">
                                        <Check className="w-3 h-3" />
                                    </div>
                                )}

                                <div className="mb-3">
                                    <span className="text-xs font-mono text-zinc-500">{t.name}</span>
                                    {t.header && (
                                        <div className="mt-1 font-bold text-sm text-zinc-200">
                                            {t.header.text || `[Mídia: ${t.header.format}]`}
                                        </div>
                                    )}
                                </div>

                                <div className="text-sm text-zinc-300 whitespace-pre-wrap mb-4">{t.content}</div>

                                {t.footer && <div className="mb-3 text-xs text-zinc-500">{t.footer.text}</div>}

                                {t.buttons && t.buttons.length > 0 && (
                                    <div className="space-y-2">
                                        {t.buttons.map((btn, i) => (
                                            <div key={i} className="w-full py-2 px-3 bg-zinc-800 text-center text-blue-400 text-sm rounded font-medium flex items-center justify-center gap-1">
                                                <Link className="w-3 h-3" />
                                                {btn.text}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {t.judgment && !t.judgment.approved && (
                                    <div className="mt-4 p-2 bg-red-900/20 text-red-400 text-xs rounded border border-red-800 flex items-start gap-1">
                                        <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                                        <div><span className="font-bold">Atenção:</span> {t.judgment.issues[0]?.reason || 'Problemas detectados'}</div>
                                    </div>
                                )}
                                {t.wasFixed && (
                                    <div className="mt-4 p-2 bg-blue-900/20 text-blue-400 text-xs rounded border border-blue-800 flex items-start gap-1">
                                        <Sparkles className="w-3 h-3 shrink-0 mt-0.5" />
                                        <div>Corrigido automaticamente pelo AI Judge</div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
