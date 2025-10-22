import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit3, Trash2, Calendar, Flag } from 'lucide-react';
import { Task } from '@/types';
import { format, isAfter, isBefore } from 'date-fns';

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onToggleComplete: (id: string) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onEdit, onDelete, onToggleComplete }) => {
  const priorityColors = {
    low: 'bg-muted text-muted-foreground border-muted',
    medium: 'bg-warning/10 text-warning border-warning/30',
    high: 'bg-destructive/10 text-destructive border-destructive/30'
  };

  const statusColors = {
    todo: 'bg-muted text-muted-foreground border-muted',
    'in-progress': 'bg-primary/10 text-primary border-primary/30',
    completed: 'bg-success/10 text-success border-success/30'
  };

  const isOverdue = task.dueDate && task.status !== 'completed' && isBefore(new Date(task.dueDate), new Date());
  const isCompleted = task.status === 'completed';

  return (
    <Card className={`transition-all duration-200 hover:shadow-lg ${isCompleted ? 'opacity-60' : ''} ${isOverdue ? 'border-destructive/40' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className={`font-semibold ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>
              {task.title}
            </h3>
            {task.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {task.description}
              </p>
            )}
          </div>
          <div className="flex gap-1 ml-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(task)}
              className="h-8 w-8 p-0"
            >
              <Edit3 className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(task.id)}
              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={priorityColors[task.priority]}>
              <Flag className="h-3 w-3 mr-1" />
              {task.priority}
            </Badge>
            
            <Badge variant="outline" className={statusColors[task.status]}>
              {task.status}
            </Badge>
            
            {task.dueDate && (
              <Badge variant="outline" className={isOverdue ? 'border-destructive text-destructive' : ''}>
                <Calendar className="h-3 w-3 mr-1" />
                {format(new Date(task.dueDate), 'MMM dd')}
              </Badge>
            )}
          </div>
          
          <Button
            variant={isCompleted ? "outline" : "default"}
            size="sm"
            onClick={() => onToggleComplete(task.id)}
            className={isCompleted ? '' : 'bg-success hover:bg-success/90 text-white'}
          >
            {isCompleted ? 'Undo' : 'Complete'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};