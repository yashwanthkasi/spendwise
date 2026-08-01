import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type {
  LendingDetails,
  Transaction,
  TransactionSource,
  TransactionType,
} from '@/lib/db-types';

export interface TransactionFilters {
  type?: TransactionType | 'all';
  groupId?: string | 'all';
  categoryId?: string | 'all';
  search?: string;
  from?: string; // ISO date
  to?: string; // ISO date
  limit?: number;
}

export interface TransactionWithRelations extends Transaction {
  category: { id: string; name: string; emoji: string | null; color: string | null } | null;
  group: { id: string; name: string; emoji: string | null; color: string | null } | null;
  lending_details: LendingDetails | null;
}

const KEY = ['transactions'] as const;

export function useTransactions(filters: TransactionFilters = {}) {
  return useQuery({
    queryKey: [...KEY, filters],
    queryFn: async (): Promise<TransactionWithRelations[]> => {
      let q = supabase
        .from('transactions')
        .select(
          `*,
          category:categories(id,name,emoji,color),
          group:groups(id,name,emoji,color),
          lending_details(*)`,
        )
        .order('occurred_at', { ascending: false })
        .limit(filters.limit ?? 200);

      if (filters.type && filters.type !== 'all') q = q.eq('type', filters.type);
      if (filters.groupId && filters.groupId !== 'all')
        q = q.eq('group_id', filters.groupId);
      if (filters.categoryId && filters.categoryId !== 'all')
        q = q.eq('category_id', filters.categoryId);
      if (filters.from) q = q.gte('occurred_at', filters.from);
      if (filters.to) q = q.lte('occurred_at', filters.to);
      if (filters.search) q = q.ilike('note', `%${filters.search}%`);

      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? []) as unknown as Array<
        Transaction & {
          category: TransactionWithRelations['category'];
          group: TransactionWithRelations['group'];
          lending_details:
            | LendingDetails
            | LendingDetails[]
            | null;
        }
      >;
      return rows.map((row) => ({
        ...row,
        lending_details: Array.isArray(row.lending_details)
          ? (row.lending_details[0] ?? null)
          : row.lending_details,
      }));
    },
  });
}

export interface TransactionInput {
  amount: number;
  type: TransactionType;
  category_id: string | null;
  group_id: string | null;
  occurred_at: string;
  note: string | null;
  raw_input?: string | null;
  source?: TransactionSource;
  latitude?: number | null;
  longitude?: number | null;
  place_label?: string | null;
  lending?: {
    counterparty: string;
    direction: 'lent' | 'borrowed';
    due_date?: string | null;
  } | null;
}

export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TransactionInput): Promise<Transaction> => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) throw new Error('Not signed in');

      const { data: txn, error } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          amount: input.amount,
          type: input.type,
          category_id: input.category_id,
          group_id: input.group_id,
          occurred_at: input.occurred_at,
          note: input.note,
          raw_input: input.raw_input ?? null,
          source: input.source ?? 'manual',
          latitude: input.latitude ?? null,
          longitude: input.longitude ?? null,
          place_label: input.place_label ?? null,
        })
        .select()
        .single();
      if (error) throw error;

      if (input.type === 'lending' && input.lending) {
        const { error: lErr } = await supabase.from('lending_details').insert({
          transaction_id: txn.id,
          counterparty: input.lending.counterparty,
          direction: input.lending.direction,
          settled: false,
          settled_at: null,
          due_date: input.lending.due_date ?? null,
        });
        if (lErr) throw lErr;
      }
      return txn;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
      lending,
    }: {
      id: string;
      patch: Partial<Transaction>;
      lending?: {
        counterparty?: string;
        direction?: 'lent' | 'borrowed';
        settled?: boolean;
        due_date?: string | null;
      };
    }): Promise<Transaction> => {
      const { data, error } = await supabase
        .from('transactions')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;

      if (lending !== undefined) {
        const { error: upErr } = await supabase
          .from('lending_details')
          .update({
            ...(lending.counterparty !== undefined && {
              counterparty: lending.counterparty,
            }),
            ...(lending.direction !== undefined && { direction: lending.direction }),
            ...(lending.settled !== undefined && {
              settled: lending.settled,
              settled_at: lending.settled ? new Date().toISOString() : null,
            }),
            ...(lending.due_date !== undefined && { due_date: lending.due_date }),
          })
          .eq('transaction_id', id);
        if (upErr) throw upErr;
      }

      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
