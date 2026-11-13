import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTaskStore } from '../store/store';
import { formatDate, relativeLabel, getWeekKey } from '../utils/timeUtils';

const BackIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
        <polyline points="15 18 9 12 15 6" />
    </svg>
);

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

export const CompletedList: React.FC = () => {
    const navigate = useNavigate();
    const { getArchivedItems, currentTime, routines, unarchiveItem } = useTaskStore();

    const archivedItems = getArchivedItems();
    const presentWeek = getWeekKey(currentTime);
    const routineMap = new Map(routines.map(r => [r.id, r]));

    const handleBack = () => navigate('/tasks');

    return (
        <div className="archive-page">
            <header className="app-header">
                <div className="archive-header-left">
                    <button className="header-btn" onClick={handleBack} aria-label="Back to tasks">
                        <BackIcon />
                    </button>
                    <h1>Archive</h1>
                </div>
            </header>

            <div className="archive-content">
                {archivedItems.length === 0 ? (
                    <div className="task-list-empty">No archived tasks yet.</div>
                ) : (
                    <div className="task-list">
                        {archivedItems.map((item) => {
                            const routine = item.routineId ? routineMap.get(item.routineId) : undefined;

                            return (
                                <div key={item.id} className="task-card archived">
                                    {/* Completed indicator */}
                                    <div className="action-indicator complete static">
                                        <CheckIcon />
                                    </div>

                                    {/* Content */}
                                    <div className="task-content">
                                        <div className="task-title">{item.title}</div>

                                        <div className="task-meta">
                                            <span className="chip schedule">
                                                {relativeLabel(item.week, presentWeek)}
                                            </span>

                                            {item.hasDueDate && item.dueDateISO && (
                                                <span className="chip due-date future">
                                                    Due {formatDate(item.dueDateISO, 'MMM D')}
                                                </span>
                                            )}

                                            {routine && <span className="chip routine">{routine.cadence}</span>}

                                            {item.minutes !== undefined && item.minutes > 0 && (
                                                <span className="chip time-logged">{item.minutes} min</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="archive-actions">
                                        <button
                                            className="undo-btn"
                                            onClick={() => unarchiveItem(item.id)}
                                            aria-label="Restore to task list"
                                            title="Restore to task list"
                                        >
                                            <UndoIcon />
                                        </button>
                                        <div className="archived-date">
                                            {formatDate(item.completedAt!, 'MMM D')}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
