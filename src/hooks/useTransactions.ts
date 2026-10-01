import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./useAuth";
import type {
  LendingDetails,
  Transaction,
  TransactionSource,
  TransactionType,
} from "@/lib/db-types";
export interface TransactionFilters {
  id?: string;
  type?: TransactionType | "all";
  groupId?: string;
  categoryId?: string;
  search?: string;
  from?: string;
  to?: string;
  ruleId?: string;
}
export interface TransactionWithRelations extends Transaction {
  category: {
    id: string;
    name: string;
    emoji: string | null;
    color: string | null;
  } | null;
  group: {
    id: string;
    name: string;
    emoji: string | null;
    color: string | null;
  } | null;
  lending_details: LendingDetails | null;
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
    direction: "lent" | "borrowed";
    due_date?: string | null;
  } | null;
}
export interface Summary {
  count: number;
  by_type: Partial<Record<TransactionType, { amount: number; count: number }>>;
  categories: {
    id: string | null;
    name: string;
    amount: number;
    count: number;
  }[];
  groups: { id: string | null; name: string; amount: number; count: number }[];
  locations: { name: string; amount: number; count: number }[];
  lent: number;
  borrowed: number;
  revision: string;
}
export type Cursor = { id: string; occurred_at: string } | null;
export async function fetchPage(
  filters: TransactionFilters = {},
  cursor: Cursor = null,
  size = 50,
): Promise<TransactionWithRelations[]> {
  const query = filters;
  const { data, error } = await supabase.rpc("transaction_page", {
    p_filters: query,
    p_cursor: cursor,
    p_size: size,
  });
  if (error) throw error;
  return data as TransactionWithRelations[];
}
export async function fetchAllTransactions(
  filters: TransactionFilters = {},
): Promise<TransactionWithRelations[]> {
  const rows: TransactionWithRelations[] = [];
  let cursor: Cursor = null;
  for (;;) {
    const page = await fetchPage(filters, cursor, 500);
    rows.push(...page);
    if (page.length < 500) return rows;
    cursor = page[page.length - 1];
  }
}
export function useTransactions(filters: TransactionFilters = {}) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["transactions", user?.id, "all", filters],
    enabled: !!user,
    queryFn: () => fetchAllTransactions(filters),
  });
}
export function useTransactionFeed(filters: TransactionFilters = {}) {
  const { user } = useAuth();
  return useInfiniteQuery({
    refetchInterval: 60000,
    queryKey: ["transactions", user?.id, "feed", filters],
    enabled: !!user,
    initialPageParam: null as Cursor,
    queryFn: ({ pageParam }) => fetchPage(filters, pageParam),
    getNextPageParam: (last) =>
      last.length === 50 ? last[last.length - 1] : undefined,
  });
}
export function useSummary(filters: TransactionFilters = {}) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["transactions", user?.id, "summary", filters],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("transaction_summary", {
        p_filters: filters,
      });
      if (error) throw error;
      return data as Summary;
    },
  });
}
export async function saveTransactions(
  items: TransactionInput[],
  requestId: string,
): Promise<string[]> {
  const { data, error } = await supabase.rpc("save_transactions", {
    p_request_id: requestId,
    p_items: items,
  });
  if (error) throw error;
  return data as string[];
}
export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TransactionInput & { requestId?: string }) => {
      const { requestId, ...item } = input;
      const ids = await saveTransactions(
        [item],
        requestId ?? crypto.randomUUID(),
      );
      return { id: ids[0] } as Transaction;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["transactions"] }),
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
      lending?: Partial<LendingDetails>;
    }) => {
      const { data, error } = await supabase.rpc("update_transaction", {
        p_id: id,
        p_patch: patch,
        p_lending: lending ?? null,
      });
      if (error) throw error;
      return data as Transaction;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["transactions"] }),
  });
}
export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("update_transaction", {
        p_id: id,
        p_patch: { deleted_at: new Date().toISOString() },
        p_lending: null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["transactions"] }),
  });
}
export async function setDeleted(ids: string[], deleted: boolean) {
  const { error } = await supabase.rpc("set_transactions_deleted", {
    p_ids: ids,
    p_deleted: deleted,
  });
  if (error) throw error;
}
