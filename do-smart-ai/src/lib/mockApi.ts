import { Task, User, AIMessage } from '@/types';

// Mock data storage
let mockTasks: Task[] = [
  {
    id: '1',
    title: 'Complete project proposal',
    description: 'Draft and finalize the Q4 project proposal for the new AI initiative',
    dueDate: '2024-01-15',
    priority: 'high',
    status: 'in-progress',
    createdAt: '2024-01-01T10:00:00Z',
    updatedAt: '2024-01-10T14:30:00Z',
    userId: 'user1'
  },
  {
    id: '2',
    title: 'Review team performance',
    description: 'Conduct quarterly performance reviews for the development team',
    dueDate: '2024-01-20',
    priority: 'medium',
    status: 'todo',
    createdAt: '2024-01-05T09:00:00Z',
    updatedAt: '2024-01-05T09:00:00Z',
    userId: 'user1'
  },
  {
    id: '3',
    title: 'Update documentation',
    description: 'Update API documentation and user guides',
    dueDate: null,
    priority: 'low',
    status: 'completed',
    createdAt: '2023-12-20T15:00:00Z',
    updatedAt: '2024-01-08T11:00:00Z',
    userId: 'user1'
  }
];

let mockUser: User = {
  id: 'user1',
  email: 'demo@taskmanager.com',
  name: 'Demo User'
};

// Simulate API delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const mockAuthApi = {
  async login(email: string, password: string): Promise<{ user: User; token: string }> {
    await delay(500);
    if (email === 'demo@taskmanager.com' && password === 'demo123') {
      const token = 'mock-jwt-token';
      localStorage.setItem('authToken', token);
      localStorage.setItem('user', JSON.stringify(mockUser));
      return { user: mockUser, token };
    }
    throw new Error('Invalid credentials');
  },

  async register(email: string, password: string, name: string): Promise<{ user: User; token: string }> {
    await delay(500);
    const newUser: User = {
      id: Date.now().toString(),
      email,
      name
    };
    const token = 'mock-jwt-token';
    localStorage.setItem('authToken', token);
    localStorage.setItem('user', JSON.stringify(newUser));
    return { user: newUser, token };
  },

  async logout(): Promise<void> {
    await delay(200);
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
  },

  getCurrentUser(): User | null {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },

  isAuthenticated(): boolean {
    return !!localStorage.getItem('authToken');
  }
};

export const mockTasksApi = {
  async getTasks(): Promise<Task[]> {
    await delay(300);
    return [...mockTasks];
  },

  async createTask(taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'userId'>): Promise<Task> {
    await delay(400);
    const newTask: Task = {
      ...taskData,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userId: 'user1'
    };
    mockTasks.push(newTask);
    return newTask;
  },

  async updateTask(id: string, updates: Partial<Task>): Promise<Task> {
    await delay(300);
    const taskIndex = mockTasks.findIndex(task => task.id === id);
    if (taskIndex === -1) throw new Error('Task not found');
    
    mockTasks[taskIndex] = {
      ...mockTasks[taskIndex],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    return mockTasks[taskIndex];
  },

  async deleteTask(id: string): Promise<void> {
    await delay(300);
    mockTasks = mockTasks.filter(task => task.id !== id);
  }
};

export const mockAIApi = {
  async askAssistant(message: string, tasks: Task[]): Promise<string> {
    await delay(800);
    
    const lowercaseMessage = message.toLowerCase();
    
    if (lowercaseMessage.includes('priority') || lowercaseMessage.includes('first') || lowercaseMessage.includes('important')) {
      const highPriorityTasks = tasks.filter(t => t.priority === 'high' && t.status !== 'completed');
      if (highPriorityTasks.length > 0) {
        return `I recommend focusing on these high-priority tasks: ${highPriorityTasks.map(t => `"${t.title}"`).join(', ')}. Start with the ones due soonest!`;
      }
      return "You're doing great! Focus on your medium-priority tasks or take a well-deserved break.";
    }
    
    if (lowercaseMessage.includes('overdue') || lowercaseMessage.includes('late')) {
      const overdueTasks = tasks.filter(t => {
        if (!t.dueDate || t.status === 'completed') return false;
        return new Date(t.dueDate) < new Date();
      });
      if (overdueTasks.length > 0) {
        return `You have ${overdueTasks.length} overdue task(s): ${overdueTasks.map(t => `"${t.title}"`).join(', ')}. Consider prioritizing these!`;
      }
      return "Great news! You don't have any overdue tasks. Keep up the excellent work!";
    }
    
    if (lowercaseMessage.includes('progress') || lowercaseMessage.includes('status')) {
      const completedCount = tasks.filter(t => t.status === 'completed').length;
      const totalCount = tasks.length;
      const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
      return `You've completed ${completedCount} out of ${totalCount} tasks (${percentage}%). ${percentage >= 75 ? "Excellent progress!" : percentage >= 50 ? "Good momentum!" : "Keep going!"}`;
    }
    
    const responses = [
      "Based on your current tasks, I suggest tackling the high-priority items first. They'll give you the biggest impact!",
      "Consider breaking down larger tasks into smaller, manageable chunks. It makes progress feel more achievable.",
      "Don't forget to take breaks between tasks. Productivity isn't just about doing more—it's about sustainable focus.",
      "Try time-blocking your tasks. Assign specific time slots to each task to maintain focus and momentum.",
      "Review your completed tasks regularly. It's a great way to see your progress and stay motivated!"
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
  }
};