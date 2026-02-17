import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase-queries';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DocumentCategory {
  id: string;
  tenant_id: string;
  name: string;
  display_order: number;
  is_default: boolean;
  created_at: string;
}

export interface Document {
  id: string;
  tenant_id: string;
  category_id: string | null;
  title: string;
  description: string | null;
  file_url: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  min_role_required: 'owner' | 'manager' | 'lead' | 'employee';
  requires_acknowledgment: boolean;
  review_interval_days: number | null;
  review_assigned_to: string | null;
  last_reviewed_at: string | null;
  last_reviewed_by: string | null;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
  // joined fields
  uploader_name?: string | null;
  category_name?: string | null;
  reviewer_name?: string | null;
  assignee_name?: string | null;
  acknowledgment_count?: number;
}

export interface DocumentAcknowledgment {
  id: string;
  tenant_id: string;
  document_id: string;
  user_id: string;
  acknowledged_at: string;
  user_name?: string | null;
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

const keys = {
  categories: ['document-categories'] as const,
  documents: ['documents'] as const,
  acknowledgments: ['document-acknowledgments'] as const,
};

// ---------------------------------------------------------------------------
// Default categories to seed
// ---------------------------------------------------------------------------

const DEFAULT_CATEGORIES = [
  { name: 'Policies', display_order: 1 },
  { name: 'Procedures', display_order: 2 },
  { name: 'Forms', display_order: 3 },
  { name: 'Checklists', display_order: 4 },
];

// ---------------------------------------------------------------------------
// Category hooks
// ---------------------------------------------------------------------------

export function useDocumentCategories() {
  const { tenant } = useAuth();
  return useQuery({
    queryKey: [...keys.categories, tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await supabase
        .from('document_categories')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('display_order', { ascending: true });
      if (error) throw error;
      return (data || []) as DocumentCategory[];
    },
    enabled: !!tenant?.id,
  });
}

export function useCreateDocumentCategory() {
  const queryClient = useQueryClient();
  const { tenant } = useAuth();
  return useMutation({
    mutationFn: async (input: { name: string; display_order?: number }) => {
      if (!tenant?.id) throw new Error('No tenant context');
      const { data, error } = await supabase
        .from('document_categories')
        .insert({
          tenant_id: tenant.id,
          name: input.name,
          display_order: input.display_order ?? 99,
          is_default: false,
        })
        .select()
        .single();
      if (error) throw error;
      return data as DocumentCategory;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.categories });
    },
  });
}

export function useDeleteDocumentCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('document_categories')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.categories });
      queryClient.invalidateQueries({ queryKey: keys.documents });
    },
  });
}

export function useSeedDefaultCategories() {
  const queryClient = useQueryClient();
  const { tenant } = useAuth();
  return useMutation({
    mutationFn: async () => {
      if (!tenant?.id) throw new Error('No tenant context');
      const rows = DEFAULT_CATEGORIES.map((c) => ({
        tenant_id: tenant.id,
        name: c.name,
        display_order: c.display_order,
        is_default: true,
      }));
      const { error } = await supabase
        .from('document_categories')
        .insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.categories });
    },
  });
}

// ---------------------------------------------------------------------------
// Document hooks
// ---------------------------------------------------------------------------

export function useDocuments(categoryId?: string | null) {
  const { tenant } = useAuth();
  return useQuery({
    queryKey: [...keys.documents, tenant?.id, categoryId ?? 'all'],
    queryFn: async () => {
      if (!tenant?.id) return [];
      let query = supabase
        .from('documents')
        .select('*, uploader:user_profiles!uploaded_by(full_name), category:document_categories!category_id(name), reviewer:user_profiles!last_reviewed_by(full_name), assignee:user_profiles!review_assigned_to(full_name)')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });

      if (categoryId) {
        query = query.eq('category_id', categoryId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((d: any) => ({
        ...d,
        uploader_name: d.uploader?.full_name ?? null,
        category_name: d.category?.name ?? null,
        reviewer_name: d.reviewer?.full_name ?? null,
        assignee_name: d.assignee?.full_name ?? null,
      })) as Document[];
    },
    enabled: !!tenant?.id,
  });
}

export function useCreateDocument() {
  const queryClient = useQueryClient();
  const { tenant } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      description?: string;
      category_id?: string | null;
      file_url: string;
      file_name: string;
      file_type?: string;
      file_size?: number;
      min_role_required: 'owner' | 'manager' | 'lead' | 'employee';
      requires_acknowledgment: boolean;
      review_interval_days?: number | null;
      review_assigned_to?: string | null;
      uploaded_by: string;
    }) => {
      if (!tenant?.id) throw new Error('No tenant context');
      const { data, error } = await supabase
        .from('documents')
        .insert({
          tenant_id: tenant.id,
          ...input,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Document;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.documents });
    },
  });
}

export function useUpdateDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: {
      id: string;
      title?: string;
      description?: string | null;
      category_id?: string | null;
      min_role_required?: 'owner' | 'manager' | 'lead' | 'employee';
      requires_acknowledgment?: boolean;
      review_interval_days?: number | null;
      review_assigned_to?: string | null;
      last_reviewed_at?: string | null;
      last_reviewed_by?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('documents')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Document;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.documents });
    },
  });
}

export function useReviewDocument() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (documentId: string) => {
      if (!user?.id) throw new Error('No auth context');
      const { data, error } = await supabase
        .from('documents')
        .update({
          last_reviewed_at: new Date().toISOString(),
          last_reviewed_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', documentId)
        .select()
        .single();
      if (error) throw error;
      return data as Document;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.documents });
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.documents });
    },
  });
}

// ---------------------------------------------------------------------------
// Acknowledgment hooks
// ---------------------------------------------------------------------------

export function useDocumentAcknowledgments(documentId?: string) {
  return useQuery({
    queryKey: [...keys.acknowledgments, documentId],
    queryFn: async () => {
      if (!documentId) return [];
      const { data, error } = await supabase
        .from('document_acknowledgments')
        .select('*, user:user_profiles!user_id(full_name)')
        .eq('document_id', documentId)
        .order('acknowledged_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((a: any) => ({
        ...a,
        user_name: a.user?.full_name ?? null,
      })) as DocumentAcknowledgment[];
    },
    enabled: !!documentId,
  });
}

export function useAcknowledgeDocument() {
  const queryClient = useQueryClient();
  const { tenant, user } = useAuth();
  return useMutation({
    mutationFn: async (documentId: string) => {
      if (!tenant?.id || !user?.id) throw new Error('No auth context');
      const { data, error } = await supabase
        .from('document_acknowledgments')
        .insert({
          tenant_id: tenant.id,
          document_id: documentId,
          user_id: user.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data as DocumentAcknowledgment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.acknowledgments });
      queryClient.invalidateQueries({ queryKey: keys.documents });
    },
  });
}

// ---------------------------------------------------------------------------
// Tenant members (for assignee picker + who-hasn't-read)
// ---------------------------------------------------------------------------

export interface TenantMember {
  id: string;
  full_name: string;
  role: string;
}

export function useTenantMembers() {
  const { tenant } = useAuth();
  return useQuery({
    queryKey: ['tenant-members', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, full_name, role')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .order('full_name');
      if (error) throw error;
      return (data || []) as TenantMember[];
    },
    enabled: !!tenant?.id,
    staleTime: 5 * 60_000,
  });
}
