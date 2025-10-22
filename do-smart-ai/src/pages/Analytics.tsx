import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, TrendingUp, Calendar, Target } from 'lucide-react';
import { tasksApi } from '@/lib/database';
import { Task } from '@/types';
import { format, startOfWeek, eachDayOfInterval, subDays, isAfter, isBefore, parseISO } from 'date-fns';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Bar, BarChart, Line, LineChart, Pie, PieChart, Cell, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer } from 'recharts';

export default function Analytics() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      const data = await tasksApi.getTasks();
      setTasks(data);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  // Task Trends - Last 7 days
  const getTaskTrends = () => {
    const last7Days = eachDayOfInterval({
      start: subDays(new Date(), 6),
      end: new Date(),
    });

    return last7Days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const completed = tasks.filter(task => 
        task.status === 'completed' && 
        task.updatedAt && 
        format(new Date(task.updatedAt), 'yyyy-MM-dd') === dayStr
      ).length;
      const created = tasks.filter(task => 
        task.createdAt && 
        format(new Date(task.createdAt), 'yyyy-MM-dd') === dayStr
      ).length;

      return {
        date: format(day, 'EEE'),
        completed,
        created,
      };
    });
  };

  // Completion Rate by Priority
  const getCompletionRate = () => {
    const priorities = ['low', 'medium', 'high'] as const;
    return priorities.map(priority => {
      const totalTasks = tasks.filter(t => t.priority === priority).length;
      const completedTasks = tasks.filter(t => t.priority === priority && t.status === 'completed').length;
      const rate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      return {
        priority: priority.charAt(0).toUpperCase() + priority.slice(1),
        rate,
        total: totalTasks,
      };
    });
  };

  // Productivity Streaks
  const getStreaks = () => {
    const last7Days = eachDayOfInterval({
      start: subDays(new Date(), 6),
      end: new Date(),
    });

    return last7Days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const tasksCompleted = tasks.filter(task => 
        task.status === 'completed' && 
        task.updatedAt && 
        format(new Date(task.updatedAt), 'yyyy-MM-dd') === dayStr
      ).length;

      return {
        date: format(day, 'MMM dd'),
        tasks: tasksCompleted,
      };
    });
  };

  // Task Distribution
  const getDistribution = () => {
    const statuses = [
      { name: 'To Do', value: tasks.filter(t => t.status === 'todo').length, color: 'hsl(var(--info))' },
      { name: 'In Progress', value: tasks.filter(t => t.status === 'in-progress').length, color: 'hsl(var(--primary))' },
      { name: 'Completed', value: tasks.filter(t => t.status === 'completed').length, color: 'hsl(var(--success))' },
    ];
    return statuses.filter(s => s.value > 0);
  };

  const taskTrends = getTaskTrends();
  const completionRate = getCompletionRate();
  const streaks = getStreaks();
  const distribution = getDistribution();

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="text-muted-foreground mt-1">Track your productivity and progress</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardHeader>
                <div className="h-6 bg-muted animate-pulse rounded w-1/2" />
              </CardHeader>
              <CardContent>
                <div className="h-64 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Analytics</h1>
        <p className="text-muted-foreground mt-1">Track your productivity and progress</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Task Trends */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Task Trends
            </CardTitle>
            <CardDescription>Your task completion over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                completed: {
                  label: 'Completed',
                  color: 'hsl(var(--success))',
                },
                created: {
                  label: 'Created',
                  color: 'hsl(var(--primary))',
                },
              }}
              className="h-64"
            >
              <LineChart data={taskTrends}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />
                <Line type="monotone" dataKey="completed" stroke="hsl(var(--success))" strokeWidth={2} />
                <Line type="monotone" dataKey="created" stroke="hsl(var(--primary))" strokeWidth={2} />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Completion Rate */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Completion Rate
            </CardTitle>
            <CardDescription>Your success rate by priority</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                rate: {
                  label: 'Completion Rate',
                  color: 'hsl(var(--primary))',
                },
              }}
              className="h-64"
            >
              <BarChart data={completionRate}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="priority" className="text-xs" />
                <YAxis className="text-xs" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="rate" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Streaks */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Productivity Streaks
            </CardTitle>
            <CardDescription>Your consistent performance</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                tasks: {
                  label: 'Tasks Completed',
                  color: 'hsl(var(--success))',
                },
              }}
              className="h-64"
            >
              <BarChart data={streaks}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="tasks" fill="hsl(var(--success))" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Task Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Task Distribution
            </CardTitle>
            <CardDescription>Tasks by status and priority</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                todo: {
                  label: 'To Do',
                  color: 'hsl(var(--info))',
                },
                inProgress: {
                  label: 'In Progress',
                  color: 'hsl(var(--primary))',
                },
                completed: {
                  label: 'Completed',
                  color: 'hsl(var(--success))',
                },
              }}
              className="h-64"
            >
              <PieChart>
                <Pie
                  data={distribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {distribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
