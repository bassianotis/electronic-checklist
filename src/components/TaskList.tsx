import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { TaskCard } from './TaskCard';
import { InlineTaskEditor } from './InlineTaskEditor';
import { useTaskStore } from '../store/store';
import type { WeekKey } from '../types';
import { compareWeekKeys, addWeeks, getFirstDayOfWeek } from '../utils/timeUtils';
import dayjs from 'dayjs';

interface TaskListProps {
    onPresentWeekVisible?: (visible: boolean, isAbove?: boolean) => void;
}

// Get section label for a week
function getSectionLabel(week: WeekKey, presentWeek: WeekKey): { label: string; isNewMonth: boolean; monthLabel?: string } {
    const weekDate = dayjs(getFirstDayOfWeek(week));
    const presentDate = dayjs(getFirstDayOfWeek(presentWeek));

    // Calculate week difference
    const weekDiff = weekDate.diff(presentDate, 'week');

    if (week === presentWeek) {
        return { label: 'This week', isNewMonth: false };
    }
    if (week === addWeeks(presentWeek, 1)) {
        return { label: 'Next week', isNewMonth: false };
    }

    // For weeks in the current month (beyond next week), check if it's a new month boundary
    const presentMonth = presentDate.month();
    const weekMonth = weekDate.month();

    // If it's in the current month but after "next week"
    if (weekMonth === presentMonth && weekDiff >= 2) {
        return { label: '', isNewMonth: false }; // No header for remaining current month weeks
    }

    // For future months, show month name on first week of each month
    return {
        label: weekDate.format('MMMM'),
        isNewMonth: true,
        monthLabel: weekDate.format('MMM YYYY')
    };
}

export const TaskList: React.FC<TaskListProps> = ({ onPresentWeekVisible }) => {
    const {
        getVisibleItems,
        getPresentWeek,
        currentTime,
        routines,
        reorderItem
    } = useTaskStore();

    const [announcement, setAnnouncement] = useState('');
    const presentWeekRef = useRef<HTMLDivElement>(null);
    const observerRef = useRef<IntersectionObserver | null>(null);

    // Inline editor state: { week, orderIndex } or null
    const [editingAt, setEditingAt] = useState<{ week: WeekKey; orderIndex: number } | null>(null);
    const [hoveringAt, setHoveringAt] = useState<{ week: WeekKey; orderIndex: number } | null>(null);

    const visibleItems = getVisibleItems();
    const presentWeek = getPresentWeek();
    const routineMap = new Map(routines.map(r => [r.id, r]));

    // Group items by week, maintaining order
    const itemsByWeek = visibleItems.reduce((acc, item) => {
        if (!acc[item.week]) acc[item.week] = [];
        acc[item.week].push(item);
        return acc;
    }, {} as Record<WeekKey, typeof visibleItems>);

    const sortedWeeks = Object.keys(itemsByWeek).sort(compareWeekKeys);
    const presentWeekItems = itemsByWeek[presentWeek] || [];
    const firstPresentWeekItemId = presentWeekItems[0]?.id;

    // Intersection observer for present week visibility
    useEffect(() => {
        if (!onPresentWeekVisible) return;

        observerRef.current = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        onPresentWeekVisible(true);
                    } else {
                        // Check if we're above or below the present week
                        const rect = entry.boundingClientRect;
                        const isAbove = rect.top > 0; // Element is below viewport = user scrolled above
                        onPresentWeekVisible(false, isAbove);
                    }
                });
            },
            { threshold: 0.5 } // Show button when half the week is hidden
        );

        return () => {
            observerRef.current?.disconnect();
        };
    }, [onPresentWeekVisible]);

    useEffect(() => {
        if (presentWeekRef.current && observerRef.current) {
            observerRef.current.observe(presentWeekRef.current);
        }
        return () => {
            observerRef.current?.disconnect();
        };
    }, [firstPresentWeekItemId]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 3 }, // Start drag faster
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event;

        if (!over || active.id === over.id) return;

        const activeItem = visibleItems.find(i => i.id === active.id);
        const overItem = visibleItems.find(i => i.id === over.id);

        if (!activeItem || !overItem) return;

        const targetWeek = overItem.week;

        // Get all items in the target week in their current order
        const weekItems = visibleItems
            .filter(i => i.week === targetWeek)
            .sort((a, b) => a.orderIndex - b.orderIndex);

        const overIndex = weekItems.findIndex(i => i.id === over.id);
        const newOrderIndex = overIndex >= 0 ? overIndex : weekItems.length;

        reorderItem(activeItem.id, newOrderIndex, targetWeek);
        setAnnouncement(`Moved ${activeItem.title} to position ${newOrderIndex + 1} `);
    }, [visibleItems, reorderItem]);

    if (visibleItems.length === 0) {
        return (
            <div className="task-list">
                <div className="task-list-empty">No tasks yet. Add some tasks to get started!</div>
            </div>
        );
    }

    // IMPORTANT: Include ALL visible items in sortable context for consistent animations
    const sortableIds = visibleItems.map(i => i.id);

    // Track shown months for section headers
    const monthsShown = new Set<string>();

    return (
        <div className="task-list">
            <div className="aria-live" role="status" aria-live="polite" aria-atomic="true">
                {announcement}
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                    {sortedWeeks.map((week) => {
                        const weekItems = itemsByWeek[week];
                        const isCurrentWeek = week === presentWeek;
                        const sectionInfo = getSectionLabel(week, presentWeek);

                        // For month labels, only show first occurrence
                        let showHeader = false;
                        let headerLabel = sectionInfo.label;

                        if (sectionInfo.isNewMonth) {
                            const monthKey = dayjs(getFirstDayOfWeek(week)).format('YYYY-MM');
                            if (!monthsShown.has(monthKey)) {
                                monthsShown.add(monthKey);
                                showHeader = true;
                            }
                        } else if (sectionInfo.label) {
                            showHeader = true;
                        }

                        // Get the Sunday date for this week
                        const weekSunday = dayjs(getFirstDayOfWeek(week));
                        const weekDateLabel = weekSunday.format('MMM D');

                        return (
                            <div key={week} className="week-section" ref={isCurrentWeek ? presentWeekRef : undefined} data-week={week}>
                                {showHeader && headerLabel && (
                                    <div className="section-header">
                                        {headerLabel}
                                    </div>
                                )}
                                <div className="week-date-label">{weekDateLabel}</div>
                                {weekItems.map((item, index) => (
                                    <React.Fragment key={item.id}>
                                        {/* Insertion point before each item */}
                                        {editingAt?.week === week && editingAt?.orderIndex === item.orderIndex ? (
                                            <InlineTaskEditor
                                                week={week}
                                                orderIndex={item.orderIndex}
                                                onComplete={() => setEditingAt(null)}
                                                onCancel={() => setEditingAt(null)}
                                            />
                                        ) : (
                                            <div
                                                className={`insertion-point ${hoveringAt?.week === week && hoveringAt?.orderIndex === item.orderIndex ? 'visible' : ''}`}
                                                onMouseEnter={() => setHoveringAt({ week, orderIndex: item.orderIndex })}
                                                onMouseLeave={() => setHoveringAt(null)}
                                                onClick={() => setEditingAt({ week, orderIndex: item.orderIndex })}
                                            >
                                                <span className="insertion-plus">+</span>
                                            </div>
                                        )}
                                        <TaskCard
                                            item={item}
                                            routine={item.routineId ? routineMap.get(item.routineId) : undefined}
                                            presentWeek={presentWeek}
                                            currentTime={currentTime}
                                        />
                                    </React.Fragment>
                                ))}
                                {/* Insertion point at end of week */}
                                {editingAt?.week === week && editingAt?.orderIndex === weekItems.length ? (
                                    <InlineTaskEditor
                                        week={week}
                                        orderIndex={weekItems.length}
                                        onComplete={() => setEditingAt(null)}
                                        onCancel={() => setEditingAt(null)}
                                    />
                                ) : (
                                    <div
                                        className={`insertion-point ${hoveringAt?.week === week && hoveringAt?.orderIndex === weekItems.length ? 'visible' : ''}`}
                                        onMouseEnter={() => setHoveringAt({ week, orderIndex: weekItems.length })}
                                        onMouseLeave={() => setHoveringAt(null)}
                                        onClick={() => setEditingAt({ week, orderIndex: weekItems.length })}
                                    >
                                        <span className="insertion-plus">+</span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </SortableContext>
            </DndContext>
        </div>
    );
};
