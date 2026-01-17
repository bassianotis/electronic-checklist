import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { TaskCard } from './TaskCard';
import { InlineTaskEditor } from './InlineTaskEditor';
import { useTaskStore } from '../store/store';
import { IDEAS_WEEK_KEY } from '../types';

interface IdeasPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

export const IdeasPanel: React.FC<IdeasPanelProps> = ({ onClose: _onClose }) => {
    const { getIdeasItems } = useTaskStore();
    const items = getIdeasItems();
    const [isAdding, setIsAdding] = useState(false);

    // Droppable for Dnd
    const { setNodeRef } = useDroppable({
        id: IDEAS_WEEK_KEY,
        data: {
            type: 'container',
            week: IDEAS_WEEK_KEY
        }
    });

    return (
        <div className="side-panel-container">
            <div className="panel-header">
                <h2>Ideas</h2>
            </div>

            <div className="panel-content" ref={setNodeRef}>
                <button
                    className="add-idea-btn"
                    onClick={() => setIsAdding(true)}
                    style={{ display: isAdding ? 'none' : 'block' }}
                >
                    + Add Idea
                </button>

                {isAdding && (
                    <div className="inline-task-editor-wrapper">
                        <InlineTaskEditor
                            week={IDEAS_WEEK_KEY}
                            orderIndex={0} // Add to top
                            onComplete={() => setIsAdding(false)}
                            onCancel={() => setIsAdding(false)}
                        />
                    </div>
                )}

                <div className="ideas-list">
                    <SortableContext
                        items={items.map(i => i.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        {items.length === 0 && !isAdding ? (
                            <div className="panel-empty-state">
                                <p>Bank your ideas here for later.</p>
                            </div>
                        ) : (
                            items.map(item => (
                                <TaskCard
                                    key={item.id}
                                    item={item}
                                    presentWeek="" // Not used for ideas
                                    currentTime=""
                                    isSpacer={item.isSpacer}
                                />
                            ))
                        )}
                    </SortableContext>
                </div>
            </div>
        </div>
    );
};
