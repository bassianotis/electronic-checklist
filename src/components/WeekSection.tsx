import React, { useMemo, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { TaskCard } from './TaskCard';
import { InlineTaskEditor } from './InlineTaskEditor';
import { WeekNoteCard } from './WeekNoteCard';
import type { WeekKey, Item, Routine } from '../types';
import { getProjectedItems } from '../utils/dragProjection';
import { useTaskStore } from '../store/store';
import { getFirstDayOfWeek } from '../utils/timeUtils';
import dayjs from 'dayjs';

interface WeekSectionProps {
    week: WeekKey;
    weekItems: Item[];
    isPresentWeek: boolean;
    sectionInfo: { label: string; isNewMonth: boolean; monthLabel?: string };
    monthsShown: Set<string>;
    dragOrigin: { week: WeekKey; orderIndex: number; item: Item } | null;
    editingAt: { week: WeekKey; orderIndex: number } | null;
    hoveringAt: { week: WeekKey; orderIndex: number } | null;
    activeId: string | null;
    routineMap: Map<string, Routine>;
    presentWeek: WeekKey;
    currentTime: string;
    isReadOnly?: boolean;
    weekNotes: any[];
    onSetEditingAt: (val: { week: WeekKey; orderIndex: number } | null) => void;
    onSetHoveringAt: (val: { week: WeekKey; orderIndex: number } | null) => void;
    presentWeekRef: React.RefObject<HTMLDivElement | null>;
    weekDateLabel: string;
    combinedMonthDateLabel: string | null;
    relativeClass: string;
    showHeader: boolean;
    showCombinedMonthDate: boolean;
    headerLabel: string;
}

export const WeekSection: React.FC<WeekSectionProps> = ({
    week,
    weekItems,
    isPresentWeek,
    sectionInfo,
    // monthsShown unused in render
    dragOrigin,
    editingAt,
    hoveringAt,
    routineMap,
    presentWeek,
    currentTime,
    isReadOnly = false,
    weekNotes: passedWeekNotes,
    onSetEditingAt,
    onSetHoveringAt,
    presentWeekRef,
    weekDateLabel,
    combinedMonthDateLabel,
    relativeClass,
    showHeader,
    showCombinedMonthDate,
    headerLabel
}) => {
    // Make the week itself a droppable container so we can drop into it even if empty
    const { setNodeRef } = useDroppable({
        id: week
    });

    // Get week notes for this week - use passed weekNotes or get from store
    const storeWeekNotes = useTaskStore((s) => s.weekNotes);
    const allWeekNotes = passedWeekNotes || storeWeekNotes;
    const weekNotes = useMemo(() =>
        allWeekNotes
            .filter((note) => note.week === week && !note.deletedAt)
            .sort((a, b) => {
                if (a.dateISO && b.dateISO) {
                    return a.dateISO.localeCompare(b.dateISO);
                }
                return a.title.localeCompare(b.title);
            }),
        [allWeekNotes, week]
    );

    // Inline event creation state
    const addWeekNote = useTaskStore((s) => s.addWeekNote);
    const [isCreatingEvent, setIsCreatingEvent] = useState(false);
    const [newEventTitle, setNewEventTitle] = useState('');
    const [newEventDate, setNewEventDate] = useState('');

    // Handlers for inline event creation
    // Calculate week bounds for date picker
    const weekStart = useMemo(() => dayjs(getFirstDayOfWeek(week)), [week]);
    const weekEnd = useMemo(() => weekStart.add(6, 'day'), [weekStart]);
    const minDate = weekStart.format('YYYY-MM-DD');
    const maxDate = weekEnd.format('YYYY-MM-DD');

    const handleStartCreating = () => {
        if (isReadOnly) return; // Disable in read-only mode
        // Default to today if within week, otherwise start of week
        const today = dayjs();
        let defaultDate = minDate;

        // Check if today is within week range (inclusive)
        if ((today.isSame(weekStart, 'day') || today.isAfter(weekStart, 'day')) &&
            (today.isSame(weekEnd, 'day') || today.isBefore(weekEnd, 'day'))) {
            defaultDate = today.format('YYYY-MM-DD');
        }

        setNewEventDate(defaultDate);
        setNewEventTitle('');
        setIsCreatingEvent(true);
    };

    const handleSaveEvent = () => {
        if (!newEventTitle.trim() || !newEventDate) return;
        addWeekNote({
            week,
            title: newEventTitle.trim(),
            dateISO: newEventDate,
        });
        setIsCreatingEvent(false);
        setNewEventTitle('');
        setNewEventDate('');
    };

    const handleCancelCreating = () => {
        setIsCreatingEvent(false);
        setNewEventTitle('');
        setNewEventDate('');
    };

    const projectedItems = getProjectedItems(weekItems, dragOrigin, week);

    return (
        <div
            ref={isPresentWeek ? presentWeekRef : undefined}
            className="week-section"
            data-week={week}
            data-is-present={isPresentWeek}
        >
            {/* Headers */}
            {showHeader && headerLabel && !sectionInfo.isNewMonth && (
                <div className="week-header-row">
                    <div className={`section-header relative-header ${relativeClass}`}>
                        {headerLabel}
                    </div>
                    <div
                        className="week-date-label clickable"
                        onClick={isReadOnly ? undefined : handleStartCreating}
                        style={{ cursor: isReadOnly ? 'default' : 'pointer' }}
                        title={isReadOnly ? '' : 'Click to add event'}
                    >
                        {weekDateLabel}
                    </div>
                </div>
            )}
            {showCombinedMonthDate && (
                <div
                    className="section-header month-header clickable"
                    onClick={isReadOnly ? undefined : handleStartCreating}
                    style={{ cursor: isReadOnly ? 'default' : 'pointer' }}
                    title={isReadOnly ? '' : 'Click to add event'}
                >
                    {combinedMonthDateLabel}
                </div>
            )}
            {!showHeader && (
                <div
                    className="week-date-label standalone clickable"
                    onClick={isReadOnly ? undefined : handleStartCreating}
                    style={{ cursor: isReadOnly ? 'default' : 'pointer' }}
                    title={isReadOnly ? '' : 'Click to add event'}
                >
                    {weekDateLabel}
                </div>
            )}

            {/* Week Notes Section */}
            <div className="week-notes-container">
                {/* Inline Event Creator - only show if not read-only */}
                {!isReadOnly && isCreatingEvent && (
                    <div
                        className="week-note-card inline-event-creator"
                        style={{
                            padding: 'var(--spacing-xs) 0',
                            marginBottom: weekNotes.length > 0 ? 'var(--spacing-xs)' : 0
                        }}
                        onBlur={(e) => {
                            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                                if (newEventTitle.trim() && newEventDate) {
                                    handleSaveEvent();
                                } else {
                                    handleCancelCreating();
                                }
                            }
                        }}
                    >
                        <div className="week-note-content" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 'var(--spacing-sm)' }}>
                            <input
                                type="text"
                                placeholder="Event name"
                                autoFocus
                                value={newEventTitle}
                                onChange={(e) => setNewEventTitle(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveEvent();
                                    if (e.key === 'Escape') handleCancelCreating();
                                }}
                                style={{
                                    flex: 1, // Take available space? Or auto?
                                    // Week Note title is just a span. 
                                    // Let's give it a min-width to Type.
                                    minWidth: '120px',
                                    background: 'transparent',
                                    border: 'none',
                                    outline: 'none',
                                    fontSize: '0.85rem',
                                    fontWeight: 500,
                                    color: 'var(--text-secondary)',
                                    padding: 0,
                                    margin: 0,
                                    fontFamily: 'inherit'
                                }}
                            />
                            <input
                                type="date"
                                value={newEventDate}
                                onChange={(e) => setNewEventDate(e.target.value)}
                                min={minDate}
                                max={maxDate}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveEvent();
                                    if (e.key === 'Escape') handleCancelCreating();
                                }}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    outline: 'none',
                                    fontSize: '0.75rem',
                                    color: 'var(--text-muted)',
                                    padding: 0,
                                    margin: 0,
                                    fontFamily: 'inherit',
                                    width: 'auto'
                                }}
                            />
                        </div>
                    </div>
                )}

                {weekNotes.map((note) => (
                    <WeekNoteCard key={note.id} note={note} isReadOnly={isReadOnly} />
                ))}
            </div>

            {/* Sortable Context for this Week */}
            <SortableContext
                id={week}
                items={weekItems.map(i => i.id)}
                strategy={verticalListSortingStrategy}
            >
                <div className="week-items-container" ref={setNodeRef}>
                    <div>
                        {projectedItems.map((item) => (
                            <React.Fragment key={item.id ?? 'spacer-fragment'}>
                                {!isReadOnly && !item.isSpacer && editingAt?.week === week && editingAt?.orderIndex === item.orderIndex ? (
                                    <InlineTaskEditor
                                        week={week}
                                        orderIndex={item.orderIndex}
                                        onComplete={() => onSetEditingAt(null)}
                                        onCancel={() => onSetEditingAt(null)}
                                    />
                                ) : !isReadOnly && !item.isSpacer && (
                                    <div
                                        className={`insertion-point ${hoveringAt?.week === week && hoveringAt?.orderIndex === item.orderIndex ? 'visible' : ''}`}
                                        onMouseEnter={() => onSetHoveringAt({ week, orderIndex: item.orderIndex })}
                                        onMouseLeave={() => onSetHoveringAt(null)}
                                        onClick={() => onSetEditingAt({ week, orderIndex: item.orderIndex })}
                                    >
                                        <span className="insertion-plus">+</span>
                                    </div>
                                )}

                                <TaskCard
                                    item={item}
                                    routine={item.routineId ? routineMap.get(item.routineId) : undefined}
                                    presentWeek={presentWeek}
                                    currentTime={currentTime}
                                    isSpacer={item.isSpacer}
                                    isReadOnly={isReadOnly}
                                />
                            </React.Fragment>
                        ))}

                        {!isReadOnly && editingAt?.week === week && editingAt?.orderIndex === weekItems.length && !weekItems.some(i => i.orderIndex === editingAt?.orderIndex) ? (
                            <InlineTaskEditor
                                week={week}
                                orderIndex={weekItems.length}
                                onComplete={() => onSetEditingAt(null)}
                                onCancel={() => onSetEditingAt(null)}
                            />
                        ) : !isReadOnly ? (
                            weekItems.length === 0 ? (
                                <button
                                    className="empty-week-add-btn"
                                    onClick={() => onSetEditingAt({ week, orderIndex: 0 })}
                                >
                                    + Add Task
                                </button>
                            ) : (
                                <div
                                    className={`insertion-point ${hoveringAt?.week === week && hoveringAt?.orderIndex === weekItems.length ? 'visible' : ''}`}
                                    onMouseEnter={() => onSetHoveringAt({ week, orderIndex: weekItems.length })}
                                    onMouseLeave={() => onSetHoveringAt(null)}
                                    onClick={() => onSetEditingAt({ week, orderIndex: weekItems.length })}
                                >
                                    <span className="insertion-plus">+</span>
                                </div>
                            )
                        ) : null}
                    </div>
                </div>
            </SortableContext>
        </div>
    );
};
