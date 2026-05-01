
import { useState } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { templateProjectService, CreateTemplateProjectDTO } from '@/services/templateProjectService';
import { useRealtimeQuery } from './useRealtimeQuery';
import { useCurrentUser } from './useCurrentUser';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

// --- Queries ---

export const useTemplateProjectsQuery = () => {
    const { user } = useCurrentUser();
    const orgId = user?.organizationId ?? null;
    return useRealtimeQuery({
        queryKey: ['template_projects', orgId],
        queryFn: templateProjectService.getAll,
        table: 'template_projects',
        events: ['INSERT', 'UPDATE', 'DELETE'],
    });
};

export const useTemplateProjectDetailsQuery = (id: string) => {
    return useRealtimeQuery({
        queryKey: ['template_projects', id],
        queryFn: () => templateProjectService.getById(id),
        table: 'template_project_items',
        filter: `project_id=eq.${id}`,
        events: ['INSERT', 'UPDATE', 'DELETE'],
        // Note: This primarily listens to ITEM changes. 
        // Project-level changes (status) might need a separate subscription or manual invalidation if they happen outside this user's context.
        // For now, this is sufficient for the generation flow.
    });
};

// --- Mutations ---

export const useTemplateProjectMutations = () => {
    const queryClient = useQueryClient();
    const router = useRouter();
    const [isCreating, setIsCreating] = useState(false);

    const createProjectMutation = useMutation({
        mutationFn: async (dto: CreateTemplateProjectDTO) => {
            setIsCreating(true);
            return await templateProjectService.create(dto);
        },
        onSuccess: (project) => {
            // Invalidate list
            queryClient.invalidateQueries({ queryKey: ['template_projects'] });
            toast.success('Projeto criado com sucesso');
            // Navigate to details
            router.push(`/templates/${project.id}`);
        },
        onError: (error) => {
            console.error('Error creating project:', error);
            toast.error('Erro ao criar projeto');
        },
        onSettled: () => {
            setIsCreating(false);
        }
    });

    const deleteProjectMutation = useMutation({
        mutationFn: templateProjectService.delete,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['template_projects'] });
            toast.success('Projeto excluído');
            router.push('/templates');
        },
        onError: (error) => {
            console.error('Error deleting project:', error);
            toast.error('Erro ao excluir projeto');
        }
    });

    return {
        createProject: createProjectMutation.mutateAsync,
        deleteProject: deleteProjectMutation.mutateAsync,
        isCreating,
        isDeleting: deleteProjectMutation.isPending
    };
};
