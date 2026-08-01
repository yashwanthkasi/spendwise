export type TransactionType =
  | 'expense'
  | 'income'
  | 'investment'
  | 'lending'
  | 'transfer';

export type GroupKind = 'persistent' | 'trip';

export type TransactionSource =
  | 'manual'
  | 'text_nl'
  | 'voice_nl'
  | 'recurring'
  | 'import';

export type LendingDirection = 'lent' | 'borrowed';

export type BudgetScope = 'overall' | 'type' | 'category' | 'group';

export type BudgetPeriod = 'monthly' | 'weekly';

export type RecurringCadence = 'daily' | 'weekly' | 'monthly';

export type Profile = {
  id: string;
  display_name: string | null;
  default_group_id: string | null;
  timezone: string;
  created_at: string;
}

export type Group = {
  id: string;
  user_id: string;
  name: string;
  emoji: string | null;
  color: string | null;
  kind: GroupKind;
  start_date: string | null;
  end_date: string | null;
  archived: boolean;
  created_at: string;
}

export type Category = {
  id: string;
  user_id: string;
  name: string;
  type: TransactionType;
  emoji: string | null;
  color: string | null;
  is_system: boolean;
  description: string | null;
  created_at: string;
}

export type Transaction = {
  id: string;
  user_id: string;
  amount: number;
  type: TransactionType;
  category_id: string | null;
  group_id: string | null;
  occurred_at: string;
  note: string | null;
  raw_input: string | null;
  source: TransactionSource;
  latitude: number | null;
  longitude: number | null;
  place_label: string | null;
  created_at: string;
  updated_at: string;
}

export type LendingDetails = {
  transaction_id: string;
  counterparty: string;
  direction: LendingDirection;
  settled: boolean;
  settled_at: string | null;
  due_date: string | null;
}

export type Budget = {
  id: string;
  user_id: string;
  scope: BudgetScope;
  scope_id: string | null;
  amount: number;
  period: BudgetPeriod;
  active: boolean;
  created_at: string;
}

export type RecurringRule = {
  id: string;
  user_id: string;
  template: Record<string, unknown>;
  cadence: RecurringCadence;
  day_of_period: number | null;
  next_run_at: string;
  last_run_at: string | null;
  active: boolean;
  created_at: string;
}

export type ParseLog = {
  id: string;
  user_id: string;
  raw_input: string;
  parsed: Record<string, unknown>;
  accepted: boolean;
  corrected: Record<string, unknown> | null;
  model: string | null;
  created_at: string;
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: {
          id: string;
          display_name?: string | null;
          default_group_id?: string | null;
          timezone?: string;
          created_at?: string;
        };
        Update: Partial<Profile>;
        Relationships: [];
      };
      groups: {
        Row: Group;
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          emoji?: string | null;
          color?: string | null;
          kind?: GroupKind;
          start_date?: string | null;
          end_date?: string | null;
          archived?: boolean;
          created_at?: string;
        };
        Update: Partial<Group>;
        Relationships: [];
      };
      categories: {
        Row: Category;
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          type: TransactionType;
          emoji?: string | null;
          color?: string | null;
          is_system?: boolean;
          description?: string | null;
          created_at?: string;
        };
        Update: Partial<Category>;
        Relationships: [];
      };
      transactions: {
        Row: Transaction;
        Insert: {
          id?: string;
          user_id: string;
          amount: number;
          type: TransactionType;
          category_id?: string | null;
          group_id?: string | null;
          occurred_at?: string;
          note?: string | null;
          raw_input?: string | null;
          source?: TransactionSource;
          latitude?: number | null;
          longitude?: number | null;
          place_label?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Transaction>;
        Relationships: [];
      };
      lending_details: {
        Row: LendingDetails;
        Insert: LendingDetails;
        Update: Partial<LendingDetails>;
        Relationships: [];
      };
      budgets: {
        Row: Budget;
        Insert: {
          id?: string;
          user_id: string;
          scope: BudgetScope;
          scope_id?: string | null;
          amount: number;
          period?: BudgetPeriod;
          active?: boolean;
          created_at?: string;
        };
        Update: Partial<Budget>;
        Relationships: [];
      };
      recurring_rules: {
        Row: RecurringRule;
        Insert: {
          id?: string;
          user_id: string;
          template: Record<string, unknown>;
          cadence: RecurringCadence;
          day_of_period?: number | null;
          next_run_at: string;
          last_run_at?: string | null;
          active?: boolean;
          created_at?: string;
        };
        Update: Partial<RecurringRule>;
        Relationships: [];
      };
      parse_logs: {
        Row: ParseLog;
        Insert: {
          id?: string;
          user_id: string;
          raw_input: string;
          parsed: Record<string, unknown>;
          accepted?: boolean;
          corrected?: Record<string, unknown> | null;
          model?: string | null;
          created_at?: string;
        };
        Update: Partial<ParseLog>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      transaction_type: TransactionType;
      group_kind: GroupKind;
      transaction_source: TransactionSource;
      lending_direction: LendingDirection;
      budget_scope: BudgetScope;
      budget_period: BudgetPeriod;
      recurring_cadence: RecurringCadence;
    };
  };
}
