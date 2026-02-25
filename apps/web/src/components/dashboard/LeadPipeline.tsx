'use client';

import React from 'react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { motion } from 'framer-motion';
import { GlassCard } from '../ui/GlassCard';
import { trpc } from '@/lib/trpc';
import { cn, statusColor } from '@/lib/utils';

const PIPELINE_STAGES = [
  { key: 'NEW', label: 'New', color: 'border-neon-cyan/40' },
  { key: 'QUALIFYING', label: 'Qualifying', color: 'border-yellow-400/40' },
  { key: 'QUALIFIED', label: 'Qualified', color: 'border-neon-green/40' },
  { key: 'ATTENDING', label: 'Attending', color: 'border-neon-purple/40' },
  { key: 'ENROLLED', label: 'Enrolled', color: 'border-neon-gold/40' },
] as const;

export function LeadPipeline() {
  const { data: kanban, isLoading } = trpc.leads.getKanban.useQuery({});
  const { data: counts } = trpc.leads.getPipelineCounts.useQuery({});
  const updateStatus = trpc.leads.updateStatus.useMutation();
  const utils = trpc.useUtils();

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const leadId = result.draggableId;
    const newStatus = result.destination.droppableId as 'NEW' | 'QUALIFYING' | 'QUALIFIED' | 'ATTENDING' | 'ENROLLED' | 'LOST';
    updateStatus.mutate(
      { id: leadId, status: newStatus },
      { onSuccess: () => utils.leads.getKanban.invalidate() }
    );
  };

  return (
    <GlassCard className="h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-white">Lead Pipeline</h3>
        <span className="text-xs text-gray-400">
          {Object.values((counts ?? {}) as Record<string, number>).reduce((a, b) => a + b, 0)} total leads
        </span>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-5 gap-2 min-h-[200px]">
          {PIPELINE_STAGES.map(({ key, label, color }) => {
            const leads = kanban?.[key] ?? [];
            const count = counts?.[key] ?? 0;

            return (
              <div key={key} className="flex flex-col gap-2">
                {/* Column header */}
                <div className={cn('text-center py-1.5 rounded-lg border bg-surface-raised/30', color)}>
                  <p className="text-xs font-medium text-gray-300">{label}</p>
                  <p className={cn('text-sm font-bold', statusColor(key))}>{count}</p>
                </div>

                {/* Droppable area */}
                <Droppable droppableId={key}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={cn(
                        'flex-1 rounded-lg p-1 min-h-[120px] transition-colors duration-200',
                        snapshot.isDraggingOver ? 'bg-neon-cyan/5 border border-neon-cyan/20' : 'bg-surface-raised/10'
                      )}
                    >
                      {leads.slice(0, 5).map((lead: any, index: number) => (
                        <Draggable key={lead.id} draggableId={lead.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={cn(
                                'mb-1.5 p-2 rounded-md glass text-xs transition-all cursor-grab active:cursor-grabbing',
                                snapshot.isDragging && 'shadow-glow-cyan opacity-90'
                              )}
                            >
                              <p className="font-medium text-white truncate">{lead.name}</p>
                              <p className="text-gray-500 truncate mt-0.5">{lead.city ?? 'India'}</p>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      {count > 5 && (
                        <p className="text-center text-xs text-gray-600 mt-1">+{count - 5} more</p>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>
    </GlassCard>
  );
}
