import React from 'react';
import { useTaskStore } from '../store/store';
import { formatDate, relativeLabel, getWeekKey } from '../utils/timeUtils';

interface ArchivePanelProps {
    isOpen: boolean;
    onClose: () => void;
}

const CheckIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" width="14" height="14">
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

const UndoIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
        <path d="M3 7v6h6" />
        <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6.39 2.64L3 13" />
    </svg>
);

export const ArchivePanel: React.FC<ArchivePanelProps> = ({ isOpen, onClose }) => {
    const { getArchivedItems, currentTime, routines, unarchiveItem } = useTaskStore();

    const archivedItems = getArchivedItems();
    const presentWeek = getWeekKey(currentTime);
    const routineMap = new Map(routines.map(r => [r.id, r]));

    return (
        <div className="archive-panel-content">
            <div className="routine-panel-header">
                <h2>Archive</h2>
            </div>
            {archivedItems.length === 0 ? (
                <div className="archive-empty">No archived tasks yet.</div>
            ) : (
                <div className="archive-list">
                    {archivedItems.map((item) => {
                        const routine = item.routineId ? routineMap.get(item.routineId) : undefined;

                        return (
                            <div key={item.id} className="archive-item">
                                {/* Completed indicator */}
                                <div className="archive-check">
                                    <CheckIcon />
                                </div>

                                {/* Content */}
                                <div className="archive-item-content">
                                    <div className="archive-item-title">{item.title}</div>

                                    <div className="archive-item-meta">
                                        <span className="chip schedule">
                                            {relativeLabel(item.week, presentWeek)}
                                        </span>

                                        {routine && (
                                            <span className="chip routine">{routine.cadence}</span>
                                        )}

                                        {item.minutesGoal !== undefined && item.minutesGoal > 0 && item.minutes !== undefined && (
                                            <span className="chip time-logged">{item.minutes} min</span>
                                        )}

                                        {item.targetCount !== undefined && item.targetCount > 1 && (
                                            <span className="chip occurrence">{item.completedCount ?? item.targetCount}/{item.targetCount}</span>
                                        )}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="archive-item-actions">
                                    <button
                                        className="undo-btn"
                                        onClick={() => unarchiveItem(item.id)}
                                        aria-label="Restore to task list"
                                        title="Restore"
                                    >
                                        <UndoIcon />
                                    </button>
                                    <div className="archive-item-date">
                                        {formatDate(item.completedAt!, 'MMM D')}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
