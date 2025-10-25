import { authStore, type StoredAuthState } from "@/lib/authStore";
import type { AuthSession, Task, User } from "@/types";

const DEFAULT_API_URL = "http://localhost:8000/api";
const rawBaseUrl = (
  (import.meta.env.VITE_API_URL as string | undefined) ??
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  DEFAULT_API_URL
).trim();
const API_BASE_URL = rawBaseUrl.replace(/\/$/, "");

type RequestOptions = RequestInit & { skipAuth?: boolean };

type RawUser = {
  id: number | string;
  email?: string;
  name?: string;
};

type RawTask = {
  id: number | string;
  title?: string;
  description?: string | null;
  dueDate?: string | null;
  priority?: Task["priority"];
  status?: Task["status"];
  createdAt?: string;
  updatedAt?: string;
  userId?: number | string | null;
};

type RawHistoryItem = {
  id: number | string;
  title?: string;
  query?: string;
  response?: string;
  createdAt?: string;
  created_at?: string;
  userId?: number | string | null;
  user?: number | string | null;
};

type AuthTokensResponse = {
  access: string;
  refresh: string;
  user: RawUser;
};

type ProfilePayload = {
  id?: number | string;
  userId?: number | string | null;
  name?: string;
  avatarUrl?: string;
  theme?: string;
  language?: string;
  aiResponseStyle?: string;
};

type MeResponse = {
  id: number | string;
  email: string;
  name?: string;
  profile?: ProfilePayload | null;
};

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

const normalizeUser = (payload: RawUser): User => ({
  id: String(payload.id),
  email: payload.email ?? "",
  name: payload.name ?? payload.email ?? "",
});

const normalizeTask = (payload: RawTask): Task => ({
  id: String(payload.id),
  title: payload.title ?? "",
  description: payload.description ?? "",
  dueDate: payload.dueDate ?? null,
  priority: payload.priority ?? "medium",
  status: payload.status ?? "todo",
  createdAt: payload.createdAt ?? "",
  updatedAt: payload.updatedAt ?? "",
  userId: payload.userId !== undefined && payload.userId !== null ? String(payload.userId) : "",
});

export type HistoryItem = {
  id: string;
  title: string;
  query: string;
  response: string;
  createdAt: string;
  userId: string;
};

const normalizeHistoryItem = (payload: RawHistoryItem): HistoryItem => ({
  id: String(payload.id),
  title: payload.title ?? "",
  query: payload.query ?? "",
  response: payload.response ?? "",
  createdAt: payload.createdAt ?? payload.created_at ?? "",
  userId:
    payload.userId !== undefined && payload.userId !== null
      ? String(payload.userId)
      : payload.user !== undefined && payload.user !== null
        ? String(payload.user)
        : "",
});

const refreshAccessToken = async (): Promise<string | null> => {
  const state = authStore.getState();
  if (!state?.tokens.refresh) {
    return null;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: state.tokens.refresh }),
    });

    if (!response.ok) {
      authStore.clear();
      return null;
    }

    const data = (await response.json()) as { access: string };

    const nextState: StoredAuthState = {
      tokens: { access: data.access, refresh: state.tokens.refresh },
      user: state.user,
    };
    authStore.setState(nextState);
    return data.access;
  } catch (error) {
    console.error("Failed to refresh access token", error);
    authStore.clear();
    return null;
  }
};

const request = async <T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> => {
  const { skipAuth = false, headers, ...init } = options;
  const mergedHeaders = new Headers(headers ?? {});

  if (!mergedHeaders.has("Accept")) {
    mergedHeaders.set("Accept", "application/json");
  }

  if (
    !(init.body instanceof FormData) &&
    !mergedHeaders.has("Content-Type") &&
    init.method &&
    init.method !== "GET"
  ) {
    mergedHeaders.set("Content-Type", "application/json");
  }

  const state = authStore.getState();
  if (!skipAuth && state?.tokens.access) {
    mergedHeaders.set("Authorization", `Bearer ${state.tokens.access}`);
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${API_BASE_URL}${normalizedPath}`;
  const execute = () => fetch(url, { ...init, headers: mergedHeaders });

  let response = await execute();

  if (response.status === 401 && !skipAuth && state?.tokens.refresh) {
    const newAccess = await refreshAccessToken();
    if (newAccess) {
      mergedHeaders.set("Authorization", `Bearer ${newAccess}`);
      response = await execute();
    }
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("Content-Type") ?? "";
  let data: unknown = null;

  if (contentType.includes("application/json")) {
    data = await response.json();
  } else if (contentType.length > 0) {
    data = await response.text();
  }

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    if (data && typeof data === "object") {
      const record = data as Record<string, unknown>;
      const detail = record.detail;
      const fallbackMessage = record.message;
      if (typeof detail === "string") {
        message = detail;
      } else if (typeof fallbackMessage === "string") {
        message = fallbackMessage;
      }
    }

    if (response.status === 401 && !skipAuth) {
      authStore.clear();
    }

    throw new ApiError(String(message), response.status, data);
  }

  return data as T;
};

type TaskPayload = Omit<Task, "id" | "createdAt" | "updatedAt" | "userId">;
type TaskUpdatePayload = Partial<Omit<Task, "createdAt" | "updatedAt" | "userId">>;

const buildQueryString = (params?: Record<string, unknown>) => {
  if (!params) return "";

  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    searchParams.append(key, String(value));
  }

  const query = searchParams.toString();
  return query ? `?${query}` : "";
};

const djangoApi = {
  request,
  auth: {
    async login({
      email,
      password,
    }: {
      email: string;
      password: string;
    }): Promise<AuthSession> {
      const data = await request<AuthTokensResponse>("/auth/login/", {
        method: "POST",
        skipAuth: true,
        body: JSON.stringify({ email, password }),
      });

      const user = normalizeUser(data.user);
      authStore.setState({
        tokens: { access: data.access, refresh: data.refresh },
        user,
      });

      return {
        accessToken: data.access,
        refreshToken: data.refresh,
        user,
      };
    },

    async register({
      email,
      password,
      name,
    }: {
      email: string;
      password: string;
      name: string;
    }): Promise<AuthSession> {
      const data = await request<AuthTokensResponse>("/auth/register/", {
        method: "POST",
        skipAuth: true,
        body: JSON.stringify({ email, password, name }),
      });

      const user = normalizeUser(data.user);
      authStore.setState({
        tokens: { access: data.access, refresh: data.refresh },
        user,
      });

      return {
        accessToken: data.access,
        refreshToken: data.refresh,
        user,
      };
    },

    async logout(): Promise<void> {
      const state = authStore.getState();
      if (state?.tokens.refresh) {
        try {
          await request("/auth/logout/", {
            method: "POST",
            body: JSON.stringify({ refresh: state.tokens.refresh }),
          });
        } catch (error) {
          console.warn("Failed to revoke refresh token", error);
        }
      }

      authStore.clear();
    },

    async getCurrentUser(): Promise<User | null> {
      try {
        const data = await request<MeResponse>("/auth/me/");
        const profile = data.profile ?? {};
        const normalized = normalizeUser({
          id: data.id,
          email: data.email,
          name: data.name ?? profile?.name,
        });
        authStore.updateUser(normalized);
        return normalized;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          authStore.clear();
          return null;
        }
        throw error;
      }
    },

    getSession(): AuthSession | null {
      const state = authStore.getState();
      if (!state) return null;

      return {
        accessToken: state.tokens.access,
        refreshToken: state.tokens.refresh,
        user: state.user,
      };
    },

    onAuthStateChange(callback: (session: AuthSession | null) => void) {
      const subscription = authStore.subscribe((state) => {
        if (!state) {
          callback(null);
          return;
        }

        callback({
          accessToken: state.tokens.access,
          refreshToken: state.tokens.refresh,
          user: state.user,
        });
      });

      return {
        unsubscribe: () => subscription.unsubscribe(),
      };
    },
  },

  tasks: {
    async getTasks(params?: Record<string, unknown>): Promise<Task[]> {
      const query = buildQueryString(params);
      const data = await request<RawTask[]>(`/tasks/${query}`);
      return data.map(normalizeTask);
    },

    async createTask(payload: TaskPayload): Promise<Task> {
      const data = await request<RawTask>("/tasks/", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      return normalizeTask(data);
    },

    async updateTask(id: string, payload: TaskUpdatePayload): Promise<Task> {
      const data = await request<RawTask>(`/tasks/${id}/`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      return normalizeTask(data);
    },

    async deleteTask(id: string): Promise<void> {
      await request<void>(`/tasks/${id}/`, { method: "DELETE" });
    },
  },

  ai: {
    async getHistory(): Promise<HistoryItem[]> {
      const data = await request<RawHistoryItem[]>("/ai/history/");
      return data.map(normalizeHistoryItem);
    },

    async deleteHistory(id: string): Promise<void> {
      await request<void>(`/ai/history/${id}/`, { method: "DELETE" });
    },

    async askAssistant({
      message,
      tasks,
    }: {
      message: string;
      tasks?: Array<Pick<Task, "id" | "title" | "status">>;
    }): Promise<{ response: string; historyId: string }> {
      const condensedTasks = (tasks ?? []).map((task) => ({
        id: Number(task.id),
        title: task.title,
        status: task.status,
      }));

      const data = await request<{ response: string; historyId: number }>("/ai/ask/", {
        method: "POST",
        body: JSON.stringify({
          message,
          tasks: condensedTasks,
        }),
      });

      return {
        response: data.response,
        historyId: String(data.historyId),
      };
    },
  },
};

export { djangoApi, request as apiRequest };
