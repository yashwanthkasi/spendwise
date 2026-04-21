import type { TransactionType } from './db-types';

export const TYPE_META: Record<
  TransactionType,
  { label: string; emoji: string; color: string; signHint: 'debit' | 'credit' | 'neutral' }
> = {
  expense: { label: 'Expense', emoji: '💸', color: '#ef4444', signHint: 'debit' },
  income: { label: 'Income', emoji: '💰', color: '#22c55e', signHint: 'credit' },
  investment: {
    label: 'Investment',
    emoji: '📈',
    color: '#0d9488',
    signHint: 'debit',
  },
  lending: { label: 'Lending', emoji: '🤝', color: '#6366f1', signHint: 'neutral' },
  transfer: { label: 'Transfer', emoji: '🔁', color: '#94a3b8', signHint: 'neutral' },
};

export const TYPE_ORDER: TransactionType[] = [
  'expense',
  'income',
  'investment',
  'lending',
  'transfer',
];

export const COLOR_PALETTE = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#10b981',
  '#14b8a6',
  '#0ea5e9',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#a855f7',
  '#ec4899',
  '#f43f5e',
  '#64748b',
];

export const EMOJI_SUGGESTIONS = [
  '🏠',
  '🏢',
  '🍽️',
  '🛒',
  '🚗',
  '✈️',
  '🎉',
  '🎬',
  '💼',
  '💰',
  '📈',
  '🎁',
  '🧳',
  '🏖️',
  '⛽',
  '🛍️',
];

export const PARSE_CONFIDENCE_THRESHOLD = 0.75;
