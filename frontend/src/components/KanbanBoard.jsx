import React from 'react';
import { DndContext, closestCenter, DragOverlay, useSensor, useSensors, PointerSensor, useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const statusMap = {
  0: 'To Do',
  1: 'In Progress',
  2: 'In Review',
  3: 'Blocked',
  4: 'Done'
};

const priorityMap = {
  0: 'Low',
  1: 'Medium',
  2: 'High',
  3: 'Urgent'
};

const getPriorityColor = (priority) => {
  if (priority === 3) return 'text-red-600 bg-red-100';
  if (priority === 2) return 'text-orange-600 bg-orange-100';
  if (priority === 1) return 'text-blue-600 bg-blue-100';
  return 'text-slate-600 bg-slate-100';
};

function SortableTaskItem({ task, onClick, isSelected }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onClick(task)}
      className={`mb-3 flex flex-col justify-between cursor-grab rounded-xl border bg-white p-5 shadow-sm active:cursor-grabbing transition-all min-h-[130px] ${
        isSelected
          ? 'border-brand-500 ring-2 ring-brand-200 shadow-md'
          : 'border-slate-200 hover:border-brand-300'
      }`}
    >
      <div className="flex-1 flex flex-col justify-between outline-none">
        <div className="flex justify-between gap-2">
          <h4 className="font-semibold text-slate-800">{task.title}</h4>
          {isSelected && (
            <span className="shrink-0 h-2 w-2 mt-1.5 rounded-full bg-brand-500" />
          )}
        </div>
        <div className="mt-4 flex items-center justify-between">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${getPriorityColor(task.priority)}`}>
            {priorityMap[task.priority]}
          </span>
          {task.deadline && (
            <span className="text-xs font-medium text-slate-500">
              Due {new Date(task.deadline).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function KanbanColumn({ statusId, title, tasks, onTaskClick, selectedTaskId }) {
  const { setNodeRef } = useDroppable({
    id: `col-${statusId}`
  });

  return (
    <div 
      ref={setNodeRef}
      className="flex w-80 shrink-0 flex-col rounded-2xl bg-slate-50 p-4 border border-slate-200 h-full overflow-hidden"
    >
      <div className="mb-4 flex items-center justify-between px-1 shrink-0">
        <h3 className="font-semibold text-slate-700">{title}</h3>
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
          {tasks.length}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto min-h-[150px] pr-1">
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <SortableTaskItem 
              key={task.id} 
              task={task} 
              onClick={onTaskClick}
              isSelected={selectedTaskId === task.id}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

export default function KanbanBoard({ tasks, onTaskMove, onTaskClick, selectedTaskId, statusFilter = 'all' }) {
  const [activeTask, setActiveTask] = React.useState(null);
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const handleDragStart = (event) => {
    const { active } = event;
    setActiveTask(tasks.find((t) => t.id === active.id));
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    // Check if we dropped on another task or a column
    // For simplicity, we just need to determine the target column
    const activeTaskId = active.id;
    const overId = over.id;

    // Find the task we dragged
    const task = tasks.find(t => t.id === activeTaskId);
    if (!task) return;

    // Find the column we dropped it into
    // If overId is a task, find its status
    let targetStatus = null;
    
    // Check if over is a status column id (we'll need to set those up)
    // To make it robust, let's wrap columns with a droppable area.
    
    // For a basic implementation, let's just find the status of the item we hovered over
    const overTask = tasks.find(t => t.id === overId);
    if (overTask) {
      targetStatus = overTask.status;
    } else {
      // It might be dropping on an empty column string id like "col-0"
      if (typeof overId === 'string' && overId.startsWith('col-')) {
        targetStatus = parseInt(overId.replace('col-', ''), 10);
      }
    }

    if (targetStatus !== null && targetStatus !== task.status) {
      onTaskMove(activeTaskId, targetStatus);
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex h-full gap-6 overflow-x-auto pb-4 flex-wrap items-start">
        {Object.entries(statusMap).map(([statusIdStr, title]) => {
          const statusId = parseInt(statusIdStr, 10);
          if (statusFilter !== 'all' && statusFilter !== statusId) return null;
          
          const columnTasks = tasks.filter((t) => t.status === statusId);
          return (
            <KanbanColumn
              key={statusId}
              statusId={statusId}
              title={title}
              tasks={columnTasks}
              onTaskClick={onTaskClick}
              selectedTaskId={selectedTaskId}
            />
          );
        })}
      </div>
      
      <DragOverlay>
        {activeTask ? (
          <div className="mb-3 cursor-grabbing rounded-xl border border-brand-300 bg-white p-4 shadow-xl opacity-90 scale-105">
            <div className="flex justify-between gap-2">
              <h4 className="font-semibold text-slate-800">{activeTask.title}</h4>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${getPriorityColor(activeTask.priority)}`}>
                {priorityMap[activeTask.priority]}
              </span>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
