import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Group, GroupKind } from '@/lib/db-types';

const KEY = ['groups'] as const;

export function useGroups(opts: { includeArchived?: boolean } = {}) {
  return useQuery({
    queryKey: [...KEY, opts],
    queryFn: async (): Promise<Group[]> => {
      let q = supabase
        .from('groups')
        .select('*')
        .order('created_at', { ascending: true });
      if (!opts.includeArchived) q = q.eq('archived', false);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export interface GroupInput {
  name: string;
  emoji?: string | null;
  color?: string | null;
  kind?: GroupKind;
  start_date?: string | null;
  end_date?: string | null;
}

export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: GroupInput): Promise<Group> => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) throw new Error('Not signed in');
      const { data, error } = await supabase
        .from('groups')
        .insert({
          user_id: user.id,
          name: input.name.trim(),
          emoji: input.emoji ?? null,
          color: input.color ?? null,
          kind: input.kind ?? 'persistent',
          start_date: input.start_date ?? null,
          end_date: input.end_date ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<Group>;
    }): Promise<Group> => {
      const { data, error } = await supabase
        .from('groups')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('groups').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
