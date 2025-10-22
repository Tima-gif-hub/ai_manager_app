import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { historyApi, type HistoryItem } from "@/lib/historyApi";

export default function History() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const loadHistory = async () => {
      if (!user) return;

      try {
        const items = await historyApi.list();
        setHistory(items);
      } catch (error) {
        console.error("Failed to load history", error);
        toast({
          title: "Error",
          description: "Could not load your AI history.",
          variant: "destructive",
        });
      }
    };

    loadHistory();
  }, [user, toast]);

  const deleteHistoryItem = async (id: string) => {
    try {
      await historyApi.delete(id);
      setHistory((prev) => prev.filter((item) => item.id !== id));
      setSelectedItem(null);
      toast({
        title: "Deleted",
        description: "History item removed",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete history entry.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <h1 className="text-3xl font-bold mb-6">AI History</h1>
      
      {history.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              No AI interactions yet. Start a conversation with the AI assistant!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {history.map((item) => (
            <Card
              key={item.id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setSelectedItem(item)}
            >
              <CardHeader>
                <CardTitle className="text-lg line-clamp-1">{item.title}</CardTitle>
                <CardDescription>
                  {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {item.query}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{selectedItem?.title}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-4">
              <div>
                <Badge className="mb-2">Query</Badge>
                <p className="text-sm">{selectedItem?.query}</p>
              </div>
              <div>
                <Badge className="mb-2">Response</Badge>
                <p className="text-sm whitespace-pre-wrap">{selectedItem?.response}</p>
              </div>
            </div>
          </ScrollArea>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => selectedItem && deleteHistoryItem(selectedItem.id)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
