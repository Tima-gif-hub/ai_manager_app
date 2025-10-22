import { useState, useEffect } from 'react';
import Tasks from './Tasks';
import { AIAssistantButton } from '@/components/ai/AIAssistantButton';
import { tasksApi } from '@/lib/database';
import { Task } from '@/types';

export default function TasksWrapper() {
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      const data = await tasksApi.getTasks();
      setTasks(data);
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  };

  return (
    <>
      <Tasks />
      <AIAssistantButton tasks={tasks} />
    </>
  );
}
