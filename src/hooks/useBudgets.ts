import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Budget, BudgetPeriod, BudgetScope } from '@/lib/db-types';

const KEY = ['budgets'] as const;

export function useBudgets() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<Budget[]> => {
      const { data, error } = await supabase
        .from('budgets')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export interface BudgetInput {
  scope: BudgetScope;
  scope_id: string | null;
  amount: number;
  period: BudgetPeriod;
  active?: boolean;
}

export function useCreateBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: BudgetInput): Promise<Budget> => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) throw new Error('Not signed in');
      const { data, error } = await supabase
        .from('budgets')
        .insert({
          user_id: user.id,
          scope: input.scope,
          scope_id: input.scope_id,
          amount: input.amount,
          period: input.period,
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

export function useUpdateBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<Budget>;
    }): Promise<Budget> => {
      const { data, error } = await supabase
        .from('budgets')
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

export function useDeleteBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('budgets').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
