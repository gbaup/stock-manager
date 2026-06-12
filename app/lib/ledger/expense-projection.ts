import type { Movement } from './types';
import type { ExpenseRecord } from '../domain';

// An expense is an outflow in one currency, attributed to whoever paid.
export function projectExpense(expense: ExpenseRecord): Movement[] {
  return [{
    id: `gasto-${expense.id}`,
    kind: 'gasto',
    date: expense.date,
    person: expense.paidByAlias,
    title: expense.title,
    sub: expense.currency,
    uyu: expense.currency === 'UYU' ? -expense.amount : 0,
    usd: expense.currency === 'USD' ? -expense.amount : 0,
  }];
}
