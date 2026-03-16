'use client';

import { createContext, useContext } from 'react';

/**
 * Context for the currently selected account in the top-nav account switcher.
 * null = "All Accounts" (no filter).
 */
const AccountContext = createContext({
  selectedAccount: null,
  setSelectedAccount: () => {},
});

export const AccountProvider = AccountContext.Provider;

export function useSelectedAccount() {
  return useContext(AccountContext);
}
