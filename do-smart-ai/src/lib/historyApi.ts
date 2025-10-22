import { apiRequest } from "@/lib/database";

export interface HistoryItem {
  id: string;
  title: string;
  query: string;
  response: string;
  createdAt: string;
}

const normalize = (item: any): HistoryItem => ({
  id: String(item.id),
  title: item.title,
  query: item.query,
  response: item.response,
  createdAt: item.createdAt,
});

export const historyApi = {
  async list(): Promise<HistoryItem[]> {
    const data = await apiRequest<any[]>("/ai-history/");
    return data.map(normalize);
  },

  async saveInteraction(query: string, response: string): Promise<HistoryItem> {
    const title = `${query.slice(0, 50)}${query.length > 50 ? "..." : ""}`;

    const data = await apiRequest<any>("/ai-history/", {
      method: "POST",
      body: JSON.stringify({ title, query, response }),
    });

    return normalize(data);
  },

  async delete(id: string): Promise<void> {
    await apiRequest<void>(`/ai-history/${id}/`, { method: "DELETE" });
  },
};
