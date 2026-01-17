import React from 'react';
import { useTaskStore } from '../store/store';
import { getWeekKey } from '../utils/timeUtils';
import { TaskCard } from './TaskCard';

interface ArchivePanelProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ArchivePanel: React.FC<ArchivePanelProps> = ({ isOpen: _isOpen, onClose: _onClose }) => {
    const { getArchivedItems, currentTime, routines } = useTaskStore();

    const archivedItems = getArchivedItems();
    const presentWeek = getWeekKey(currentTime);
    const routineMap = new Map(routines.map(r => [r.id, r]));

    return (
        <div className="side-panel-container">
            <div className="panel-header">
                <h2>Archive</h2>
            </div>
            <div className="panel-content">
                {archivedItems.length === 0 ? (
                    <div className="panel-empty-state">No archived tasks yet.</div>
                ) : (
                    <div className="archive-list">
                        {archivedItems.map((item) => {
                            const routine = item.routineId ? routineMap.get(item.routineId) : undefined;

                            return (
                                <TaskCard
                                    key={item.id}
                                    item={item}
                                    routine={routine}
                                    presentWeek={presentWeek}
                                    currentTime={currentTime}
                                    showScheduleChip={false}
                                    isArchived={true}
                                />
                            );
                        })}
                    </div>
                )}
            </div>
        </div >
    );
};
