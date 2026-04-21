import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { RecurringCadence, RecurringRule } from '@/lib/db-types';

const KEY = ['recurring_rules'] as const;

export function useRecurringRules() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<RecurringRule[]> => {
      const { data, error } = await supabase
        .from('recurring_rules')
        .select('*')
        .order('next_run_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export interface RecurringInput {
  template: Record<string, unknown>;
  cadence: RecurringCadence;
  day_of_period?: number | null;
  next_run_at: string;
  active?: boolean;
}

export function useCreateRecurring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: RecurringInput): Promise<RecurringRule> => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) throw new Error('Not signed in');
      const { data, error } = await supabase
        .from('recurring_rules')
        .insert({
          user_id: user.id,
          template: input.template,
          cadence: input.cadence,
          day_of_period: input.day_of_period ?? null,
          next_run_at: input.next_run_at,
          active: input.active ?? true,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateRecurring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<RecurringRule>;
    }): Promise<RecurringRule> => {
      const { data, error } = await supabase
        .from('recurring_rules')
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

export function useDeleteRecurring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('recurring_rules')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
