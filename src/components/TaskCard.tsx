import React, { useState, useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Item, Routine, WeekKey } from '../types';
import {
    relativeLabel,
    formatDate,
    isFutureWeek
} from '../utils/timeUtils';
import { useTaskStore } from '../store/store';
import dayjs from 'dayjs';

interface TaskCardProps {
    item: Item;
    routine?: Routine;
    presentWeek: WeekKey;
    currentTime: string;
    showScheduleChip?: boolean; // Show "This week"/"Next week" etc. chip (default: false)
    isOverlay?: boolean; // Rendered in DragOverlay
    isSpacer?: boolean; // Rendered as an invisible spacer to hold layout
}

// Icons
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

export const TaskCard: React.FC<TaskCardProps> = ({
    item,
    routine,
    presentWeek,
    currentTime,
    showScheduleChip = false,
    isOverlay = false,
    isSpacer = false,
}) => {
    const { completeItem, uncompleteItem, incrementProgress, incrementOccurrence, decrementOccurrence, archiveItem, updateItem } = useTaskStore();
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(item.title);
    const [showEditOptions, setShowEditOptions] = useState(false);
    const [editMinutesGoal, setEditMinutesGoal] = useState<number | undefined>(item.minutesGoal);
    const [editTargetCount, setEditTargetCount] = useState<number | undefined>(item.targetCount);
    const [editDueDateISO, setEditDueDateISO] = useState<string | undefined>(item.dueDateISO);
    const [editNotes, setEditNotes] = useState<string>(item.notes || '');
    const editInputRef = useRef<HTMLInputElement>(null);
    const cardRef = useRef<HTMLDivElement>(null);

    const isComplete = item.status === 'complete';
    const isIncomplete = item.status === 'incomplete';
    const isFuture = isFutureWeek(item.week, presentWeek);
    const isPresent = item.week === presentWeek;
    const canDrag = true; // All items can be dragged

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
        disabled: !canDrag || isOverlay || isSpacer, // Disable sortable logic if in overlay or spacer
    });

    const style: React.CSSProperties = {
        transform: isOverlay ? undefined : CSS.Transform.toString(transform),
        transition,
        opacity: isDragging || isSpacer ? 0 : 1, // Hide if dragging OR if it's a spacer
        pointerEvents: isSpacer ? 'none' : undefined, // Spacer shouldn't be interactive
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
    const isDueDatePast = hasDueDate && dayjs(item.dueDateISO).isBefore(dayjs(currentTime));
    const isDueDateSoon = hasDueDate && !isDueDatePast &&
        dayjs(item.dueDateISO).diff(dayjs(currentTime), 'day') <= 3;

    // Progress logic for time-based items - only show if there's a goal
    const hasTimeProgress = item.minutesGoal !== undefined && item.minutesGoal > 0;
    const currentMinutes = item.minutes ?? 0;
    const goalMinutes = item.minutesGoal ?? 0;
    // Only calculate progress if there's a goal, otherwise 0
    const timeProgress = hasTimeProgress ? Math.min(1, currentMinutes / goalMinutes) : 0;
    // Can only complete time-based tasks if goal is met
    const timeGoalMet = !hasTimeProgress || currentMinutes >= goalMinutes;

    // Always allow un-complete for completed items
    const canUncomplete = isComplete;

    const handleStatusClick = () => {
        if (isIncomplete && timeGoalMet) {
            completeItem(item.id);
        } else if (canUncomplete) {
            uncompleteItem(item.id);
        }
    };

    // Edit mode handlers - clicking card opens editor
    const handleCardClick = (e: React.MouseEvent) => {
        // Don't open editor if already editing
        if (isEditing) return;

        setIsEditing(true);
        setEditTitle(item.title);
        setEditMinutesGoal(item.minutesGoal);
        setEditTargetCount(item.targetCount);
        // Convert ISO to YYYY-MM-DD for date input
        setEditDueDateISO(item.dueDateISO ? item.dueDateISO.split('T')[0] : undefined);
        setEditNotes(item.notes || '');
        setTimeout(() => editInputRef.current?.focus(), 0);
    };

    const handleEditSave = () => {
        if (editTitle.trim()) {
            updateItem(item.id, {
                title: editTitle.trim(),
                minutesGoal: editMinutesGoal ?? 0, // Empty field = 0 to clear time goal
                targetCount: editTargetCount,
                dueDateISO: editDueDateISO,
                notes: editNotes,
            });
        }
        setIsEditing(false);
        setShowEditOptions(false);
    };

    const handleEditCancel = () => {
        setIsEditing(false);
        setShowEditOptions(false);
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

    // Click outside to save
    useEffect(() => {
        if (!isEditing) return;

        const handleClickOutside = (e: MouseEvent) => {
            if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
                handleEditSave();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isEditing, editTitle]);

    // Determine action indicator state
    // Complete: green check
    // Future: blue filled circle (not needing action)
    // Present with no progress: yellow empty circle
    // Present with progress (including 100%): yellow filled/partial
    let actionIndicatorType: 'complete' | 'future' | 'due-empty' | 'due-progress' = 'due-empty';

    if (isComplete) {
        actionIndicatorType = 'complete';
    } else if (isFuture) {
        actionIndicatorType = 'future';
    } else if (timeProgress > 0) {
        // Show progress indicator for any progress (including 100%)
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
            className={`task-card ${isComplete ? 'completed' : ''} ${isDragging ? 'dragging' : ''} ${isEditing ? 'editing' : ''}`}
            data-is-spacer={isSpacer ? 'true' : undefined}
            data-item-id={item.id}
            data-week={item.week}
            onClick={handleCardClick}
        >
            {/* Drag handle - stops propagation to prevent opening editor */}
            <div
                className={`drag-handle ${!canDrag ? 'disabled' : ''}`}
                {...(canDrag ? { ...attributes, ...listeners } : {})}
                aria-label={canDrag ? 'Drag to reorder' : 'Cannot reorder completed items'}
                onClick={(e) => e.stopPropagation()}
            >
                <GripIcon />
            </div>

            {/* Content */}
            <div className="task-content">
                {isEditing ? (
                    <>
                        <input
                            ref={editInputRef}
                            type="text"
                            className="editor-title-input"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onKeyDown={handleEditKeyDown}
                        />
                        {/* Notes input - positioned where notes display */}
                        <input
                            type="text"
                            className="editor-notes-input"
                            placeholder="Add notes (140 chars max)"
                            maxLength={140}
                            value={editNotes}
                            onChange={(e) => setEditNotes(e.target.value)}
                            onKeyDown={handleEditKeyDown}
                        />
                        {/* Edit options shown directly when editing */}
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
                    </>
                ) : (
                    <>
                        <div className="task-title" title={item.title}>
                            {item.title}
                        </div>
                        {item.notes && (
                            <div className="task-notes">{item.notes}</div>
                        )}

                        <div className="task-meta">
                            {/* Schedule chip - only shown if prop is true (e.g., in archive) */}
                            {showScheduleChip && (
                                <span className={`chip schedule ${scheduleChipClass}`}>
                                    {relativeLabel(item.week, presentWeek)}
                                </span>
                            )}

                            {/* Original week indicator - shows if task was rolled over */}
                            {item.originalWeek && (
                                <span className="chip rolled-over" title={`Originally scheduled for ${item.originalWeek}`}>
                                    ↻ {relativeLabel(item.originalWeek, presentWeek)}
                                </span>
                            )}

                            {/* Due date chip */}
                            {hasDueDate && (
                                <span className={`chip due-date ${!isDueDatePast && !isDueDateSoon ? 'future' : ''}`}>
                                    Due {formatDate(item.dueDateISO!, 'MMM D')}
                                </span>
                            )}

                            {/* Routine chip */}
                            {routine && (
                                <span className="chip routine">
                                    {routine.cadence}
                                </span>
                            )}

                            {/* Time progress display */}
                            {hasTimeProgress && isIncomplete && (
                                <span className={`chip time-progress ${timeProgress >= 1 ? 'complete' : ''}`}>
                                    {currentMinutes}{goalMinutes > 0 ? `/${goalMinutes}` : ''} min
                                </span>
                            )}

                            {/* Completed time - only show if there was a goal */}
                            {isComplete && hasTimeProgress && item.minutes !== undefined && (
                                <span className="chip time-logged">
                                    {item.minutes} min
                                </span>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* Right-side action area */}
            <div className="task-actions">


                {/* Time increment buttons - show for all items with time tracking (not when editing) */}
                {hasTimeProgress && !isEditing && (
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

                {/* Archive button for completed items - before indicator for consistent layout */}
                {isComplete && (
                    <button
                        className="archive-btn"
                        onClick={(e) => { e.stopPropagation(); archiveItem(item.id); }}
                        aria-label="Archive item"
                    >
                        Archive
                    </button>
                )}

                {/* Multi-occurrence: show multiple boxes */}
                {isMultiOccurrence && !isComplete && (
                    <div className="occurrence-boxes" onClick={(e) => e.stopPropagation()}>
                        {Array.from({ length: targetCount }).map((_, idx) => {
                            const isBoxCompleted = idx < completedCount;
                            const isNextToComplete = idx === completedCount;
                            const isLastCompleted = idx === completedCount - 1;

                            return (
                                <button
                                    key={idx}
                                    className={`occurrence-box ${isBoxCompleted ? 'completed' : ''}`}
                                    onClick={() => {
                                        if (isNextToComplete) {
                                            incrementOccurrence(item.id);
                                        } else if (isLastCompleted) {
                                            decrementOccurrence(item.id);
                                        }
                                    }}
                                    disabled={!isNextToComplete && !isLastCompleted}
                                    aria-label={`Occurrence ${idx + 1} of ${targetCount}`}
                                >
                                    {isBoxCompleted && <CheckIcon />}
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Action indicator / complete button - for non-multi-occurrence or completed items */}
                {(!isMultiOccurrence || isComplete) && (
                    <button
                        className={`action-indicator ${actionIndicatorType}`}
                        onClick={(e) => { e.stopPropagation(); handleStatusClick(); }}
                        disabled={false}
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
