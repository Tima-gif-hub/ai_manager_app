import { authStore, type StoredAuthState } from "@/lib/authStore";
import type { AuthSession, Task, User } from "@/types";

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ??
  "http://localhost:8000/api";

type ApiRequestOptions = RequestInit & { skipAuth?: boolean };

class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

const normalizeUser = (payload: any): User => ({
  id: String(payload.id),
  email: payload.email,
  name: payload.name ?? payload.email,
});

const normalizeTask = (payload: any): Task => ({
  id: String(payload.id),
  title: payload.title,
  description: payload.description ?? "",
  dueDate: payload.dueDate ?? null,
  priority: payload.priority ?? "medium",
  status: payload.status ?? "todo",
  createdAt: payload.createdAt,
  updatedAt: payload.updatedAt,
  userId: payload.userId ? String(payload.userId) : "",
});

const refreshAccessToken = async (): Promise<string | null> => {
  const state = authStore.getState();
  if (!state) return null;

  try {
    const response = await fetch(`${API_BASE_URL}/auth/token/refresh/`, {
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

const apiRequest = async <T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> => {
  const { skipAuth, headers: rawHeaders, ...rest } = options;
  const headers = new Headers(rawHeaders);

  if (!(rest.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const state = authStore.getState();
  if (!skipAuth && state?.tokens.access) {
    headers.set("Authorization", `Bearer ${state.tokens.access}`);
  }

  const requestInit: RequestInit = {
    ...rest,
    headers,
  };

  const execute = () => fetch(`${API_BASE_URL}${path}`, requestInit);

  let response = await execute();

  if (response.status === 401 && !skipAuth && state?.tokens.refresh) {
    const newAccess = await refreshAccessToken();
    if (newAccess) {
      headers.set("Authorization", `Bearer ${newAccess}`);
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
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const message =
      (data as any)?.detail ??
      (data as any)?.message ??
      `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, data);
  }

  return data as T;
};

// Task CRUD operations via Django REST API
export const tasksApi = {
  async getTasks(): Promise<Task[]> {
    const data = await apiRequest<any[]>("/tasks/");
    return data.map(normalizeTask);
  },

  async createTask(taskData: Omit<Task, "id" | "createdAt" | "updatedAt" | "userId">): Promise<Task> {
    const payload = {
      title: taskData.title,
      description: taskData.description,
      dueDate: taskData.dueDate,
      priority: taskData.priority,
      status: taskData.status,
    };

    const data = await apiRequest<any>("/tasks/", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    return normalizeTask(data);
  },

  async updateTask(id: string, updates: Partial<Task>): Promise<Task> {
    const payload: Record<string, unknown> = {};

    if (updates.title !== undefined) payload.title = updates.title;
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.dueDate !== undefined) payload.dueDate = updates.dueDate;
    if (updates.priority !== undefined) payload.priority = updates.priority;
    if (updates.status !== undefined) payload.status = updates.status;

    const data = await apiRequest<any>(`/tasks/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });

    return normalizeTask(data);
  },

  async deleteTask(id: string): Promise<void> {
    await apiRequest<void>(`/tasks/${id}/`, { method: "DELETE" });
  },
};

// Authentication operations
export const authApi = {
  async login(email: string, password: string): Promise<void> {
    const data = await apiRequest<any>("/auth/login/", {
      method: "POST",
      body: JSON.stringify({ email, password }),
      skipAuth: true,
    });

    const user = normalizeUser(data.user);
    authStore.setState({
      tokens: { access: data.access, refresh: data.refresh },
      user,
    });
  },

  async register(email: string, password: string, name: string): Promise<void> {
    const data = await apiRequest<any>("/auth/register/", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
      skipAuth: true,
    });

    const user = normalizeUser(data.user);
    authStore.setState({
      tokens: { access: data.access, refresh: data.refresh },
      user,
    });
  },

  async logout(): Promise<void> {
    const state = authStore.getState();

    if (state?.tokens.refresh) {
      try {
        await apiRequest("/auth/logout/", {
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
      const user = await apiRequest<User>("/auth/me/");
      const normalized = normalizeUser(user);
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
};

// User profile management
export const profileApi = {
  async getProfile(): Promise<{ name: string; avatarUrl: string }> {
    const data = await apiRequest<{ name: string; avatar_url: string }>("/profile/");
    return {
      name: data.name ?? "",
      avatarUrl: data.avatar_url ?? "",
    };
  },

  async updateProfile(payload: { name?: string; avatarUrl?: string }) {
    const body: Record<string, unknown> = {};
    if (payload.name !== undefined) body.name = payload.name;
    if (payload.avatarUrl !== undefined) body.avatar_url = payload.avatarUrl;

    const data = await apiRequest<{ name: string; avatar_url: string }>("/profile/", {
      method: "PUT",
      body: JSON.stringify(body),
    });

    return {
      name: data.name ?? "",
      avatarUrl: data.avatar_url ?? "",
    };
  },
};

// User settings management
export const settingsApi = {
  async getSettings(): Promise<{
    theme: "light" | "dark";
    aiStyle: "concise" | "detailed";
    language: string;
  }> {
    const data = await apiRequest<{
      theme: "light" | "dark";
      ai_response_style: "concise" | "detailed";
      language: string;
    }>("/settings/");

    return {
      theme: data.theme,
      aiStyle: data.ai_response_style,
      language: data.language,
    };
  },

  async updateSettings(payload: Partial<{
    theme: "light" | "dark";
    aiStyle: "concise" | "detailed";
    language: string;
  }>) {
    const body: Record<string, unknown> = {};
    if (payload.theme !== undefined) body.theme = payload.theme;
    if (payload.aiStyle !== undefined) body.ai_response_style = payload.aiStyle;
    if (payload.language !== undefined) body.language = payload.language;

    const data = await apiRequest<{
      theme: "light" | "dark";
      ai_response_style: "concise" | "detailed";
      language: string;
    }>("/settings/", {
      method: "PUT",
      body: JSON.stringify(body),
    });

    return {
      theme: data.theme,
      aiStyle: data.ai_response_style,
      language: data.language,
    };
  },
};

// AI Assistant operations (still mocked locally)
export const aiApi = {
  async askAssistant(message: string, tasks: Task[]): Promise<string> {
    const lowercaseMessage = message.toLowerCase();

    if (
      lowercaseMessage.includes("priority") ||
      lowercaseMessage.includes("first") ||
      lowercaseMessage.includes("important")
    ) {
      const highPriorityTasks = tasks.filter(
        (t) => t.priority === "high" && t.status !== "completed",
      );
      if (highPriorityTasks.length > 0) {
        return `I recommend focusing on these high-priority tasks: ${highPriorityTasks
          .map((t) => `"${t.title}"`)
          .join(", ")}. Start with the ones due soonest!`;
      }
      return "You're doing great! Focus on your medium-priority tasks or take a well-deserved break.";
    }

    if (lowercaseMessage.includes("overdue") || lowercaseMessage.includes("late")) {
      const overdueTasks = tasks.filter((t) => {
        if (!t.dueDate || t.status === "completed") return false;
        return new Date(t.dueDate) < new Date();
      });
      if (overdueTasks.length > 0) {
        return `You have ${overdueTasks.length} overdue task(s): ${overdueTasks
          .map((t) => `"${t.title}"`)
          .join(", ")}. Consider prioritizing these!`;
      }
      return "Great news! You don't have any overdue tasks. Keep up the excellent work!";
    }

    if (lowercaseMessage.includes("progress") || lowercaseMessage.includes("status")) {
      const completedCount = tasks.filter((t) => t.status === "completed").length;
      const totalCount = tasks.length;
      const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
      return `You've completed ${completedCount} out of ${totalCount} tasks (${percentage}%). ${
        percentage >= 75
          ? "Excellent progress!"
          : percentage >= 50
            ? "Good momentum!"
            : "Keep going!"
      }`;
    }

    const responses = [
      "Based on your current tasks, I suggest tackling the high-priority items first. They'll give you the biggest impact!",
      "Consider breaking down larger tasks into smaller, manageable chunks. It makes progress feel more achievable.",
      "Don't forget to take breaks between tasks. Productivity isn't just about doing more-it's about sustainable focus.",
      "Try time-blocking your tasks. Assign specific time slots to each task to maintain focus and momentum.",
      "Review your completed tasks regularly. It's a great way to see your progress and stay motivated!",
    ];

    return responses[Math.floor(Math.random() * responses.length)];
  },
};

export { ApiError, apiRequest };
