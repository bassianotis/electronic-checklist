import React, { useState, useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Item, Routine, WeekKey } from '../types';
import {
    relativeLabel,
    formatDate,
    formatDynamicDueDate,
    isFutureWeek
} from '../utils/timeUtils';
import { useTaskStore } from '../store/store';
import dayjs from 'dayjs';
import { RichText } from './RichText';



interface TaskCardProps {
    item: Item;
    routine?: Routine;
    presentWeek: WeekKey;
    currentTime: string;
    showScheduleChip?: boolean; // Show "This week"/"Next week" etc. chip (default: false)
    isOverlay?: boolean; // Rendered in DragOverlay
    isSpacer?: boolean; // Rendered as an invisible spacer to hold layout
    isArchived?: boolean; // Rendered in ArchivePanel (read-only, restore action)
}

const GripIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="9" cy="5" r="1" fill="currentColor" />
        <circle cx="9" cy="12" r="1" fill="currentColor" />
        <circle cx="9" cy="19" r="1" fill="currentColor" />
        <circle cx="15" cy="5" r="1" fill="currentColor" />
        <circle cx="15" cy="12" r="1" fill="currentColor" />
        <circle cx="15" cy="19" r="1" fill="currentColor" />
    </svg>
);

const CheckIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

const ClockProgress = ({ progress, size = 20 }: { progress: number; size?: number }) => {
    const radius = size / 2 - 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - progress * circumference;

    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="clock-progress">
            <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="clock-bg"
                opacity="0.3"
            />
            <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                className="clock-value"
            />
        </svg>
    );
};

const UndoIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
        <path d="M3 7v6h6" />
        <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6.39 2.64L3 13" />
    </svg>
);

export const TaskCard: React.FC<TaskCardProps> = ({
    item,
    routine,
    presentWeek,
    currentTime,
    showScheduleChip = false,
    isOverlay = false,
    isSpacer = false,
    isArchived = false,
}) => {
    const { completeItem, uncompleteItem, incrementProgress, incrementOccurrence, decrementOccurrence, archiveItem, unarchiveItem, updateItem, deleteItem } = useTaskStore();
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(item.title);

    // ... restored state variables

    const [editMinutesGoal, setEditMinutesGoal] = useState<number | undefined>(item.minutesGoal);
    const [editTargetCount, setEditTargetCount] = useState<number | undefined>(item.targetCount);
    const [editDueDateISO, setEditDueDateISO] = useState<string | undefined>(item.dueDateISO);

    const [editNotes, setEditNotes] = useState<string>(item.notes || '');
    const editInputRef = useRef<HTMLInputElement>(null);
    const cardRef = useRef<HTMLDivElement>(null);

    const isComplete = item.status === 'complete';
    const isIncomplete = item.status === 'incomplete';

    // Safety check for special keys like 'ideas'
    const isIdeas = item.week === 'ideas';

    // Archived items are never "future" or "present" in the active sense
    const isFuture = !isIdeas && !isArchived && isFutureWeek(item.week, presentWeek);
    const isPresent = !isIdeas && !isArchived && item.week === presentWeek;

    // Disable dragging for archived items
    const canDrag = !isArchived;

    // Multi-occurrence logic
    const isMultiOccurrence = item.targetCount !== undefined && item.targetCount > 1;
    const targetCount = item.targetCount ?? 1;
    const completedCount = item.completedCount ?? 0;

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: isSpacer && item?.id ? `spacer-${item.id}` : item?.id ?? 'spacer',
        disabled: !canDrag || isOverlay || isSpacer,
    });

    const style: React.CSSProperties = {
        transform: isOverlay ? undefined : CSS.Transform.toString(transform),
        transition,
        opacity: isDragging || isSpacer ? 0 : 1,
        pointerEvents: isSpacer ? 'none' : undefined,
    };

    // Determine chip tint class for schedule
    let scheduleChipClass = '';
    if (isPresent && isIncomplete) {
        scheduleChipClass = 'present';
    } else if (isFuture) {
        scheduleChipClass = 'future';
    }

    // Due date logic
    const hasDueDate = item.hasDueDate && item.dueDateISO;
    const isDueDatePast = hasDueDate && dayjs(item.dueDateISO).isBefore(dayjs(currentTime).startOf('day'));

    // Progress logic
    const hasTimeProgress = item.minutesGoal !== undefined && item.minutesGoal > 0;
    const currentMinutes = item.minutes ?? 0;
    const goalMinutes = item.minutesGoal ?? 0;
    const timeProgress = hasTimeProgress ? Math.min(1, currentMinutes / goalMinutes) : 0;
    const timeGoalMet = !hasTimeProgress || currentMinutes >= goalMinutes;

    const canUncomplete = isComplete; // Archived implies completed usually, but we check status

    const handleStatusClick = () => {
        if (isArchived) return; // Status click disabled in archive (use restore button)
        if (isIdeas) return; // Cannot complete ideas directly

        if (isIncomplete && timeGoalMet) {
            completeItem(item.id);
        } else if (canUncomplete) {
            uncompleteItem(item.id);
        }
    };

    const [isNoteExpanded, setIsNoteExpanded] = useState(false);

    // Edit mode handlers
    const handleCardClick = (_e: React.MouseEvent) => {
        if (isArchived) {
            // In archive, clicking toggles note expansion
            setIsNoteExpanded(!isNoteExpanded);
            return;
        }
        if (isEditing) return;

        setIsEditing(true);
        // ... set state ...
        setEditTitle(item.title);
        setEditMinutesGoal(item.minutesGoal);
        setEditTargetCount(item.targetCount);
        setEditDueDateISO(item.dueDateISO ? item.dueDateISO.split('T')[0] : undefined);
        setEditNotes(item.notes || '');
        setTimeout(() => editInputRef.current?.focus(), 0);
    };

    // ... handleEditSave, handleEditCancel, handleEditKeyDown, useEffect (keep same)

    const handleEditSave = () => {
        if (editTitle.trim()) {
            updateItem(item.id, {
                title: editTitle.trim(),
                minutesGoal: editMinutesGoal ?? 0,
                targetCount: editTargetCount,
                dueDateISO: editDueDateISO,
                notes: editNotes,
            });
        }
        setIsEditing(false);
    };

    // ... (keep helper functions)

    const handleEditCancel = () => {
        setIsEditing(false);
        setEditTitle(item.title);
    };

    const handleEditKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleEditSave();
        } else if (e.key === 'Escape') {
            handleEditCancel();
        }
    };

    useEffect(() => {
        if (!isEditing) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
                handleEditSave();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isEditing, editTitle, handleEditSave]);


    // Determine action indicator type
    let actionIndicatorType: 'complete' | 'future' | 'due-empty' | 'due-progress' = 'due-empty';
    if (isComplete) {
        actionIndicatorType = 'complete';
    } else if (isFuture) {
        actionIndicatorType = 'future';
    } else if (timeProgress > 0) {
        actionIndicatorType = 'due-progress';
    } else {
        actionIndicatorType = 'due-empty';
    }

    return (
        <div
            ref={(el) => {
                setNodeRef(el);
                (cardRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
            }}
            style={style}
            className={`task-card ${isComplete ? 'completed' : ''} ${isDragging ? 'dragging' : ''} ${isEditing ? 'editing' : ''} ${isArchived ? 'side-panel-card' : ''}`} // Add side-panel-card if archived to ensure specific overrides if needed, though task-card is base
            data-is-spacer={isSpacer ? 'true' : undefined}
            data-item-id={item.id}
            data-week={item.week}
            onClick={handleCardClick}
        >
            {/* Drag handle - specific visibility logic */}
            <div
                className={`drag-handle ${!canDrag ? 'disabled' : ''}`}
                {...(canDrag ? { ...attributes, ...listeners } : {})}
                aria-label={canDrag ? 'Drag to reorder' : 'Cannot reorder'}
                onClick={(e) => e.stopPropagation()}
                style={{ opacity: isArchived ? 0 : undefined, pointerEvents: isArchived ? 'none' : undefined }} // Hide drag handle in archive
            >
                <GripIcon />
            </div>

            {/* Content */}
            <div className="task-content">
                {isEditing ? (
                    // ... Edit Mode Render (keep existing)
                    <>
                        <input
                            ref={editInputRef}
                            type="text"
                            className="editor-title-input"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onKeyDown={handleEditKeyDown}
                        />
                        <textarea
                            className="editor-notes-input"
                            placeholder="Add notes (1200 chars max)"
                            maxLength={1200}
                            rows={Math.max(1, editNotes.split('\n').length)}
                            value={editNotes}
                            onChange={(e) => setEditNotes(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    if (e.shiftKey) {
                                        // Allow default behavior (newline)
                                        return;
                                    }
                                    // Save on Enter without Shift
                                    e.preventDefault();
                                    handleEditSave();
                                } else if (e.key === 'Escape') {
                                    handleEditCancel();
                                }
                            }}
                        />
                        <div className="inline-editor-options">
                            <div className="editor-option">
                                <label>⏱️</label>
                                <input
                                    type="number"
                                    placeholder="min"
                                    min="0"
                                    value={editMinutesGoal ?? ''}
                                    onChange={(e) => setEditMinutesGoal(e.target.value ? parseInt(e.target.value) : undefined)}
                                    onKeyDown={handleEditKeyDown}
                                />
                            </div>
                            <div className="editor-option">
                                <label>🔁</label>
                                <input
                                    type="number"
                                    placeholder="×"
                                    min="1"
                                    value={editTargetCount ?? ''}
                                    onChange={(e) => setEditTargetCount(e.target.value ? parseInt(e.target.value) : undefined)}
                                    onKeyDown={handleEditKeyDown}
                                />
                            </div>
                            <div className="editor-option">
                                <label>📅</label>
                                <input
                                    type="date"
                                    value={editDueDateISO ?? ''}
                                    onChange={(e) => setEditDueDateISO(e.target.value || undefined)}
                                    onKeyDown={handleEditKeyDown}
                                />
                            </div>
                        </div>

                        {isIdeas && (
                            <div className="editor-actions-row" style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
                                <button
                                    className="delete-btn"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        deleteItem(item.id);
                                    }}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--text-error, #f44336)',
                                        fontSize: '0.8rem',
                                        cursor: 'pointer',
                                        padding: '4px 8px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}
                                >
                                    Delete
                                </button>
                            </div>
                        )}

                    </>
                ) : (
                    <>
                        <div className="task-title" title={item.title}>
                            {item.title}
                        </div>
                        {item.notes && (
                            <div className="task-notes">
                                <RichText content={item.notes} truncate={!isEditing && !isNoteExpanded} />
                            </div>
                        )}

                        <div className="task-meta">
                            {/* Archive specific meta - Date on far left */}
                            {isArchived && item.completedAt && (
                                <span className="archive-item-date" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginRight: '6px' }}>
                                    {formatDate(item.completedAt, 'MMM D')}
                                </span>
                            )}

                            {showScheduleChip && (
                                <span className={`chip schedule ${scheduleChipClass}`}>
                                    {relativeLabel(item.week, presentWeek)}
                                </span>
                            )}

                            {item.originalWeek && (
                                <span className="chip rolled-over" title={`Originally scheduled for ${item.originalWeek}`}>
                                    ↻ {relativeLabel(item.originalWeek, presentWeek)}
                                </span>
                            )}

                            {hasDueDate && (
                                <span className={`chip due-date ${isComplete ? 'completed' : (!isDueDatePast ? 'future' : '')}`}>
                                    Due {formatDynamicDueDate(item.dueDateISO!, presentWeek, currentTime)}
                                </span>
                            )}

                            {routine && !isArchived && (
                                <span className="chip routine">
                                    {routine.cadence}
                                </span>
                            )}

                            {hasTimeProgress && isIncomplete && (
                                <span className={`chip time-progress ${timeProgress >= 1 ? 'complete' : ''}`}>
                                    {currentMinutes}{goalMinutes > 0 ? `/${goalMinutes}` : ''} min
                                </span>
                            )}

                            {/* Completed time */}
                            {isComplete && hasTimeProgress && item.minutes !== undefined && (
                                <span className="chip time-logged">
                                    {item.minutes} min
                                </span>
                            )}

                            {/* Completed occurrences */}
                            {isComplete && isMultiOccurrence && (
                                <span className="chip time-logged">
                                    {item.targetCount}x
                                </span>
                            )}

                            {/* Archive specific meta */}

                        </div>
                    </>
                )}
            </div>

            {/* Right-side action area */}
            <div className="task-actions">

                {/* Time increment buttons - Hide in archive */}
                {hasTimeProgress && !isEditing && !isArchived && (
                    <div className="time-btns" onClick={(e) => e.stopPropagation()}>
                        <button
                            className="time-btn"
                            onClick={() => incrementProgress(item.id, 15)}
                            aria-label="Add 15 minutes"
                        >
                            +15
                        </button>
                        <button
                            className="time-btn"
                            onClick={() => incrementProgress(item.id, 30)}
                            aria-label="Add 30 minutes"
                        >
                            +30
                        </button>
                    </div>
                )}

                {/* Archive Button (Main List) vs Restore Button (Archive List) */}
                {isComplete && !isArchived && (
                    <button
                        className="archive-btn"
                        onClick={(e) => { e.stopPropagation(); archiveItem(item.id); }}
                        aria-label="Archive item"
                    >
                        Archive
                    </button>
                )}

                {isArchived && (
                    <button
                        className="undo-btn archive-btn" // Reuse styling or similar
                        onClick={(e) => { e.stopPropagation(); unarchiveItem(item.id); }}
                        aria-label="Restore item"
                        title="Restore"
                    >
                        <UndoIcon />
                    </button>
                )}

                {/* Multi-occurrence boxes - Read only in archive? Or display state? */}
                {isMultiOccurrence && !isComplete && (
                    // ... (keep existing, but maybe disable interactions if isArchived? Though archived items are usually complete)
                    <div className="occurrence-boxes" onClick={(e) => e.stopPropagation()}>
                        {Array.from({ length: targetCount }).map((_, idx) => {
                            const isBoxCompleted = idx < completedCount;
                            // ...
                            const isNextToComplete = idx === completedCount;
                            const isLastCompleted = idx === completedCount - 1;

                            return (
                                <button
                                    key={idx}
                                    className={`occurrence-box ${isBoxCompleted ? 'completed' : ''}`}
                                    onClick={() => {
                                        if (isArchived) return;
                                        if (isNextToComplete) incrementOccurrence(item.id);
                                        else if (isLastCompleted) decrementOccurrence(item.id);
                                    }}
                                    disabled={(!isNextToComplete && !isLastCompleted) || isArchived}
                                >
                                    {isBoxCompleted && <CheckIcon />}
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Action indicator - Hidden for Ideas */}
                {(!isMultiOccurrence || isComplete) && !isIdeas && (
                    <button
                        className={`action-indicator ${actionIndicatorType} ${isArchived || isIdeas ? 'static' : ''}`} // Add static class if archived or ideas
                        onClick={(e) => { e.stopPropagation(); handleStatusClick(); }}
                        disabled={isArchived || isIdeas} // Disable interaction
                        aria-label={isComplete ? 'Mark as incomplete' : 'Mark as complete'}
                    >
                        {actionIndicatorType === 'complete' && <CheckIcon />}
                        {actionIndicatorType === 'future' && <div className="filled-dot" />}
                        {actionIndicatorType === 'due-progress' && (
                            <ClockProgress
                                progress={timeProgress}
                                size={24}
                            />
                        )}
                        {actionIndicatorType === 'due-empty' && <div className="empty-ring" />}
                    </button>
                )}
            </div>
        </div >
    );
};
