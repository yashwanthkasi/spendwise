import type {
  Category,
  Group,
  LendingDirection,
  TransactionType,
} from '@/lib/db-types';

export interface ParseContext {
  categories: Category[];
  groups: Group[];
  defaultGroupId: string | null;
  now: Date;
  timezone: string;
}

export interface ParsedTransaction {
  type: TransactionType;
  amount: number;
  categoryId: string | null;
  categoryName: string | null;
  groupId: string | null;
  groupName: string | null;
  occurredAt: string; // ISO
  note: string | null;
  lending: {
    counterparty: string;
    direction: LendingDirection;
  } | null;
  confidence: number;
  engine: 'ai' | 'regex';
  rawInput: string;
  reasoning?: string;
}
