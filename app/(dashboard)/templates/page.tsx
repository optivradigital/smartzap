'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTemplatesController } from '@/hooks/useTemplates';
import { TemplateListView } from '@/components/features/templates/TemplateListView';
import { useTemplateProjectsQuery, useTemplateProjectMutations } from '@/hooks/useTemplateProjects';
import { Loader2, Plus, Folder, Search, RefreshCw, CheckCircle, AlertTriangle, Trash2, Calendar, LayoutGrid, Copy, X, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const StatusBadge = ({ status, approvedCount, totalCount }: { status: string; approvedCount?: number; totalCount?: number }) => {
  const isComplete = approvedCount && totalCount && approvedCount === totalCount && totalCount > 0;
  const isPartial = approvedCount && approvedCount > 0 && !isComplete;
  if (isComplete) return <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Concluído</span>;
  if (isPartial) return <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border bg-blue-500/10 text-blue-400 border-blue-500/20"><span className="relative flex h-2 w-2 mr-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span></span>Em Progresso</span>;
  return <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border bg-zinc-500/10 text-zinc-400 border-zinc-500/20">Rascunho</span>;
};

export default function TemplatesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const controller = useTemplatesController();
  const { data: projects, isLoading: isLoadingProjects, refetch } = useTemplateProjectsQuery();
  const { deleteProject } = useTemplateProjectMutations();
  const [searchTerm, setSearchTerm] = React.useState('');
  const [activeTab, setActiveTab] = React.useState<'projects' | 'approved'>('projects');

  // Detect Evolution mode
  const { data: waStatus } = useQuery({
    queryKey: ['whatsapp-status'],
    queryFn: async () => {
      const r = await fetch('/api/whatsapp/status');
      if (!r.ok) return null;
      return r.json();
    },
    staleTime: 60_000,
  });
  const isEvolution = waStatus?.provider === 'evolution';

  // Evolution template creation state
  const [isNewTemplateOpen, setIsNewTemplateOpen] = React.useState(false);
  const [newName, setNewName] = React.useState('');
  const [newContent, setNewContent] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);

  const handleSaveLocalTemplate = async () => {
    if (!newName.trim() || !newContent.trim()) {
      toast.error('Preencha o nome e o conteúdo do template');
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch('/api/templates/local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), content: newContent.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar');
      toast.success(`Template "${data.name}" criado com sucesso`);
      setIsNewTemplateOpen(false);
      setNewName('');
      setNewContent('');
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar template');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProject = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteProject(id);
  };

  const filteredProjects = React.useMemo(() => {
    if (!projects) return [];
    if (!searchTerm) return projects;
    return projects.filter(p => p.title.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [projects, searchTerm]);

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Templates</h1>
          <p className="text-gray-400">
            {isEvolution
              ? 'Crie templates de texto livre para disparos via WhatsApp Business (QR Code).'
              : 'Gerencie sua fábrica de templates e aprovados.'}
          </p>
        </div>
        {isEvolution ? (
          <button
            onClick={() => setIsNewTemplateOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition-all shadow-lg hover:shadow-emerald-500/20"
          >
            <Plus className="w-5 h-5" />
            Novo Template
          </button>
        ) : (
          <button
            onClick={() => router.push('/templates/new')}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition-all shadow-lg hover:shadow-emerald-500/20"
          >
            <Plus className="w-5 h-5" />
            Novo Projeto
          </button>
        )}
      </div>

      {/* TABS — hide Projects tab for Evolution orgs */}
      {!isEvolution && (
        <div className="flex gap-1 bg-zinc-900 border border-white/5 p-1 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('projects')}
            className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'projects' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
          >
            <LayoutGrid className="w-4 h-4" />
            Projetos (Fábrica)
          </button>
          <button
            onClick={() => setActiveTab('approved')}
            className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'approved' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
          >
            <CheckCircle className="w-4 h-4" />
            Aprovados (Meta)
          </button>
        </div>
      )}

      {/* Projects tab (Meta only) */}
      {!isEvolution && activeTab === 'projects' && (
        <>
          <div className="glass-panel p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full sm:w-96 bg-zinc-900 border border-white/5 rounded-lg px-4 py-2.5 focus-within:border-primary-500/50 focus-within:ring-1 focus-within:ring-primary-500/50 transition-all">
              <Search size={18} className="text-gray-500" />
              <input type="text" placeholder="Buscar projetos..." className="bg-transparent border-none outline-none text-sm w-full text-white placeholder-gray-600" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <button onClick={() => refetch()} className="p-2.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg border border-white/10 transition-colors" title="Atualizar">
              <RefreshCw size={18} />
            </button>
          </div>
          <div className="glass-panel rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/5 border-b border-white/5 text-gray-400 uppercase tracking-wider text-xs">
                  <tr>
                    <th className="px-6 py-4 font-medium">Nome</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium text-center">Templates</th>
                    <th className="px-6 py-4 font-medium">Progresso</th>
                    <th className="px-6 py-4 font-medium">Criado em</th>
                    <th className="px-6 py-4 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {isLoadingProjects ? (
                    <tr><td colSpan={6} className="px-6 py-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-emerald-500 mx-auto" /></td></tr>
                  ) : filteredProjects.length === 0 ? (
                    <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-500">Nenhum projeto encontrado.</td></tr>
                  ) : (
                    filteredProjects.map((project) => {
                      const approvedPercent = project.template_count > 0 ? Math.round((project.approved_count / project.template_count) * 100) : 0;
                      return (
                        <tr key={project.id} onClick={() => router.push(`/templates/${project.id}`)} className="hover:bg-white/5 transition-colors group cursor-pointer">
                          <td className="px-6 py-4"><div className="flex items-center gap-3"><div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400"><Folder size={16} /></div><p className="font-medium text-white group-hover:text-primary-400 transition-colors">{project.title}</p></div></td>
                          <td className="px-6 py-4"><StatusBadge status={project.status} approvedCount={project.approved_count} totalCount={project.template_count} /></td>
                          <td className="px-6 py-4 text-center text-gray-400 font-mono">{project.template_count}</td>
                          <td className="px-6 py-4"><div className="flex items-center gap-3"><div className="flex-1 w-24 bg-zinc-800 rounded-full h-1"><div className="bg-emerald-500 h-1 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]" style={{ width: `${approvedPercent}%` }} /></div><span className="text-xs text-gray-400 font-mono w-10">{approvedPercent}%</span></div></td>
                          <td className="px-6 py-4 text-gray-500 font-mono text-xs">{new Date(project.created_at).toLocaleDateString('pt-BR')}</td>
                          <td className="px-6 py-4 text-right"><div className="flex items-center justify-end gap-2"><button onClick={(e) => handleDeleteProject(e, project.id)} title="Excluir" className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10"><Trash2 size={16} /></button></div></td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Approved templates (Meta) or all templates (Evolution) */}
      {(isEvolution || activeTab === 'approved') && (
        <TemplateListView {...controller} />
      )}

      {/* Evolution: Simple template creation modal */}
      {isNewTemplateOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-white/10 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-xl">
                  <FileText className="text-emerald-400" size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Novo Template</h3>
                  <p className="text-xs text-gray-400">WhatsApp Business (QR Code)</p>
                </div>
              </div>
              <button onClick={() => setIsNewTemplateOpen(false)} className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Nome <span className="text-gray-500 font-normal">(sem espaços)</span></label>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="ex: boas_vindas_cliente"
                  className="w-full bg-zinc-900 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Mensagem <span className="text-gray-500 font-normal">Use {'{{1}}'} para nome do contato</span>
                </label>
                <textarea
                  value={newContent}
                  onChange={e => setNewContent(e.target.value)}
                  placeholder={'Olá {{1}}, tudo bem? Temos uma oferta especial para você! 🎉'}
                  rows={5}
                  className="w-full bg-zinc-900 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setIsNewTemplateOpen(false)} className="flex-1 px-4 py-2.5 text-gray-300 bg-zinc-800 hover:bg-zinc-700 rounded-lg font-medium transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleSaveLocalTemplate}
                disabled={isSaving || !newName.trim() || !newContent.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {isSaving ? <><Loader2 size={16} className="animate-spin" /> Salvando...</> : 'Salvar Template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
