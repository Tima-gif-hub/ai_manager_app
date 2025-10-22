import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Task } from '@/types';
import { TaskCard } from '@/components/tasks/TaskCard';
import { tasksApi } from '@/lib/database';
import { TaskForm } from '@/components/tasks/TaskForm';
import { useToast } from "@/hooks/use-toast";

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
  const { toast } = useToast();

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      const data = await tasksApi.getTasks();
      setTasks(data);
    } catch (error) {
      toast({
        title: "Error loading tasks",
        description: "Failed to load your tasks. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'userId'>) => {
    try {
      const newTask = await tasksApi.createTask(taskData);
      setTasks([newTask, ...tasks]);
      setShowTaskForm(false);
      toast({
        title: "Task created",
        description: "Your new task has been created successfully.",
      });
    } catch (error) {
      toast({
        title: "Error creating task",
        description: "Failed to create the task. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleUpdateTask = async (taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'userId'>) => {
    if (!editingTask) return;
    
    try {
      const updatedTask = await tasksApi.updateTask(editingTask.id, taskData);
      setTasks(tasks.map(task => task.id === editingTask.id ? updatedTask : task));
      setEditingTask(undefined);
      toast({
        title: "Task updated",
        description: "Your task has been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Error updating task",
        description: "Failed to update the task. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteTask = async (id: string) => {
    try {
      await tasksApi.deleteTask(id);
      setTasks(tasks.filter(task => task.id !== id));
      toast({
        title: "Task deleted",
        description: "The task has been deleted successfully.",
      });
    } catch (error) {
      toast({
        title: "Error deleting task",
        description: "Failed to delete the task. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleToggleComplete = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    const newStatus = task.status === 'completed' ? 'todo' : 'completed';
    
    try {
      const updatedTask = await tasksApi.updateTask(id, { status: newStatus });
      setTasks(tasks.map(t => t.id === id ? updatedTask : t));
      toast({
        title: newStatus === 'completed' ? "Task completed!" : "Task reopened",
        description: newStatus === 'completed' ? "Great job on completing this task!" : "Task moved back to your todo list.",
      });
    } catch (error) {
      toast({
        title: "Error updating task",
        description: "Failed to update the task status. Please try again.",
        variant: "destructive",
      });
    }
  };

  const filterTasks = (status?: string) => {
    let filtered = tasks;

    if (searchTerm) {
      filtered = filtered.filter(task =>
        task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (status === 'completed') {
      filtered = filtered.filter(task => task.status === 'completed');
    } else if (status === 'in-progress') {
      filtered = filtered.filter(task => task.status === 'in-progress');
    } else if (status === 'overdue') {
      const now = new Date();
      filtered = filtered.filter(task => 
        task.dueDate && new Date(task.dueDate) < now && task.status !== 'completed'
      );
    }

    return filtered;
  };

  const TaskList = ({ status }: { status?: string }) => {
    const filteredTasks = filterTasks(status);

    if (filteredTasks.length === 0) {
      return (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {tasks.length === 0 
              ? "No tasks yet. Create your first task!" 
              : "No tasks match your filters."
            }
          </p>
        </div>
      );
    }

    return (
      <div className="grid gap-4">
        {filteredTasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onToggleComplete={handleToggleComplete}
            onEdit={(task) => setEditingTask(task)}
            onDelete={handleDeleteTask}
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="h-8 bg-muted rounded w-48 animate-pulse"></div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card p-4 rounded-lg animate-pulse">
              <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-muted rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Tasks</h1>
          <p className="text-muted-foreground mt-1">Manage and organize your tasks</p>
        </div>
        <Button 
          onClick={() => setShowTaskForm(true)}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          New Task
        </Button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder="Search tasks..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">All Tasks</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="in-progress">In Progress</TabsTrigger>
          <TabsTrigger value="overdue">Overdue</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" className="mt-6">
          <TaskList />
        </TabsContent>
        
        <TabsContent value="completed" className="mt-6">
          <TaskList status="completed" />
        </TabsContent>
        
        <TabsContent value="in-progress" className="mt-6">
          <TaskList status="in-progress" />
        </TabsContent>
        
        <TabsContent value="overdue" className="mt-6">
          <TaskList status="overdue" />
        </TabsContent>
      </Tabs>

      {/* Task Form Modal */}
      {(showTaskForm || editingTask) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-background rounded-lg w-full max-w-md">
            <TaskForm
              task={editingTask}
              onSubmit={editingTask ? handleUpdateTask : handleCreateTask}
              onCancel={() => {
                setShowTaskForm(false);
                setEditingTask(undefined);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
