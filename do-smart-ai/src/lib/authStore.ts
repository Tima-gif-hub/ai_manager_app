import type { User } from "@/types";

const STORAGE_KEY = "do-smart-ai.auth";

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface StoredAuthState {
  tokens: AuthTokens;
  user: User;
}

type Listener = (state: StoredAuthState | null) => void;

const listeners = new Set<Listener>();

const isBrowser = typeof window !== "undefined";

const readStorage = (): StoredAuthState | null => {
  if (!isBrowser) return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredAuthState;
  } catch (error) {
    console.error("Failed to read auth storage", error);
    return null;
  }
};

const writeStorage = (state: StoredAuthState | null) => {
  if (!isBrowser) return;

  if (state) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } else {
    window.localStorage.removeItem(STORAGE_KEY);
  }
};

const notify = (state: StoredAuthState | null) => {
  for (const listener of listeners) {
    listener(state);
  }
};

export const authStore = {
  getState(): StoredAuthState | null {
    return readStorage();
  },

  getTokens(): AuthTokens | null {
    return readStorage()?.tokens ?? null;
  },

  setState(state: StoredAuthState) {
    writeStorage(state);
    notify(state);
  },

  clear() {
    writeStorage(null);
    notify(null);
  },

  updateUser(user: User) {
    const current = readStorage();
    if (!current) return;
    const next = { ...current, user };
    writeStorage(next);
    notify(next);
  },

  subscribe(listener: Listener) {
    listeners.add(listener);
    return {
      unsubscribe: () => listeners.delete(listener),
    };
  },
};
