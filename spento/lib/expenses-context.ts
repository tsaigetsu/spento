import { createContext, useContext } from 'react';
import type { Expense } from './data';

export const ExpensesCtx = createContext<Expense[]>([]);

export function useExpenses(): Expense[] {
  return useContext(ExpensesCtx);
}
