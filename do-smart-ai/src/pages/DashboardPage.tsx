import { useState, useEffect } from 'react';
import { CheckSquare, Clock, ListTodo, AlertCircle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { StatCard } from '@/components/dashboard/StatCard';
import { TaskCard } from '@/components/tasks/TaskCard';
import { TaskForm } from '@/components/tasks/TaskForm';
import { Task } from '@/types';
import { tasksApi } from '@/lib/database';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { isBefore } from 'date-fns';
import { AIAssistantButton } from '@/components/ai/AIAssistantButton';

export default function DashboardPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const data = await tasksApi.getTasks();
      setTasks(data);
    } catch (error) {
      toast({
        title: 'Error loading tasks',
        description: 'Failed to load your tasks. Please try again.',
        variant: 'destructive',
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
        title: 'Task created',
        description: 'Your new task has been created successfully.',
      });
    } catch (error) {
      toast({
        title: 'Error creating task',
        description: 'Failed to create the task. Please try again.',
        variant: 'destructive',
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
        title: newStatus === 'completed' ? 'Task completed!' : 'Task reopened',
        description: newStatus === 'completed' ? 'Great job!' : 'Task moved back to your todo list.',
      });
    } catch (error) {
      toast({
        title: 'Error updating task',
        description: 'Failed to update the task status.',
        variant: 'destructive',
      });
    }
  };

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const inProgressTasks = tasks.filter(t => t.status === 'in-progress').length;
  const overdueTasks = tasks.filter(t => 
    t.status !== 'completed' && t.dueDate && isBefore(new Date(t.dueDate), new Date())
  ).length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const recentTasks = tasks.slice(0, 5);

  return (
    <>
      <div className="p-4 md:p-6 space-y-6">
        {/* Greeting */}
      <div>
        <h1 className="text-3xl font-bold">{getGreeting()}, {user?.name?.split(' ')[0] || 'there'}!</h1>
        <p className="text-muted-foreground mt-1">Here's what you have on your plate today</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Tasks"
          value={totalTasks}
          icon={ListTodo}
        />
        <StatCard
          title="Completed"
          value={completedTasks}
          icon={CheckSquare}
          className="border-success/50"
        />
        <StatCard
          title="In Progress"
          value={inProgressTasks}
          icon={Clock}
          className="border-primary/50"
        />
        <StatCard
          title="Overdue"
          value={overdueTasks}
          icon={AlertCircle}
          className="border-destructive/50"
        />
      </div>

      {/* Progress Card */}
      <Card>
        <CardHeader>
          <CardTitle>Overall Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Completion Rate</span>
              <span className="font-medium">{completionRate}%</span>
            </div>
            <Progress value={completionRate} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            <Button onClick={() => setShowTaskForm(true)} className="w-full">
              <Plus className="mr-2 h-4 w-4" />
              New Task
            </Button>
            <Button variant="outline" className="w-full" disabled>
              Continue Last Task
            </Button>
            <Button variant="outline" className="w-full" disabled>
              Upload Document
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Tasks */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Tasks</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => window.location.href = '/tasks'}>
            View All
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-muted rounded-lg p-4 animate-pulse">
                  <div className="h-4 bg-muted-foreground/20 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-muted-foreground/20 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : recentTasks.length > 0 ? (
            <div className="space-y-3">
              {recentTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onToggleComplete={handleToggleComplete}
                  onEdit={() => {}}
                  onDelete={() => {}}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No tasks yet. Create one to get started!</p>
              <Button onClick={() => setShowTaskForm(true)} className="mt-4">
                <Plus className="mr-2 h-4 w-4" />
                Create First Task
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Task Form Modal */}
      {showTaskForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-background rounded-lg w-full max-w-md">
            <TaskForm
              onSubmit={handleCreateTask}
              onCancel={() => setShowTaskForm(false)}
            />
          </div>
        </div>
      )}
      </div>
      
      {/* AI Assistant Floating Button */}
      <AIAssistantButton tasks={tasks} />
    </>
  );
}
