import { createContext, useContext } from 'react';

type ThemeCtxValue = {
  isDark: boolean;
  setDark: (v: boolean) => void;
};

export const ThemeCtx = createContext<ThemeCtxValue>({ isDark: false, setDark: () => {} });

export function useTheme(): ThemeCtxValue {
  return useContext(ThemeCtx);
}
