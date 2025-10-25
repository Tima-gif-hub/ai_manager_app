import type { Task } from "@/types";
import { djangoApi, apiRequest as baseRequest } from "@/lib/djangoApi";

export { djangoApi };
export { ApiError, apiRequest, HistoryItem } from "@/lib/djangoApi";

const request = baseRequest;

export const tasksApi = djangoApi.tasks;
export const authApi = djangoApi.auth;

export const profileApi = {
  async getProfile(): Promise<{ name: string; avatarUrl: string }> {
    const data = await request<{ name: string; avatar_url: string }>("/profile/");
    return {
      name: data.name ?? "",
      avatarUrl: data.avatar_url ?? "",
    };
  },

  async updateProfile(payload: { name?: string; avatarUrl?: string }) {
    const body: Record<string, unknown> = {};
    if (payload.name !== undefined) body.name = payload.name;
    if (payload.avatarUrl !== undefined) body.avatar_url = payload.avatarUrl;

    const data = await request<{ name: string; avatar_url: string }>("/profile/", {
      method: "PUT",
      body: JSON.stringify(body),
    });

    return {
      name: data.name ?? "",
      avatarUrl: data.avatar_url ?? "",
    };
  },
};

export const settingsApi = {
  async getSettings(): Promise<{
    theme: "light" | "dark";
    aiStyle: "concise" | "detailed";
    language: string;
  }> {
    const data = await request<{
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

    const data = await request<{
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

export const aiApi = {
  async askAssistant(message: string, tasks: Task[]): Promise<string> {
    const condensedTasks = tasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
    }));

    const { response } = await djangoApi.ai.askAssistant({
      message,
      tasks: condensedTasks,
    });

    return response;
  },
  getHistory: djangoApi.ai.getHistory,
  deleteHistory: djangoApi.ai.deleteHistory,
};
