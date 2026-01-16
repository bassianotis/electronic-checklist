import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent, DragOverEvent } from '@dnd-kit/core';
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
import { useAutoAnimate } from '@formkit/auto-animate/react';
import autoAnimate from '@formkit/auto-animate';
import {
    resolveId,
    isSpacerId,
    calculateInsertionIndex,
    DRAG_ACTIVATION_DISTANCE
} from '../utils/dragUtils';
import { getProjectedItems } from '../utils/dragProjection';
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
    if (week === addWeeks(presentWeek, -1)) {
        return { label: 'Last week', isNewMonth: false };
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
        reorderItem,
        moveToWeek // Need to expose or reuse this for onDragOver
    } = useTaskStore();

    const [activeId, setActiveId] = useState<string | null>(null);
    const [announcement, setAnnouncement] = useState('');
    const presentWeekRef = useRef<HTMLDivElement>(null);
    const observerRef = useRef<IntersectionObserver | null>(null);

    // Inline editor state: { week, orderIndex } or null
    const [editingAt, setEditingAt] = useState<{ week: WeekKey; orderIndex: number } | null>(null);
    const [hoveringAt, setHoveringAt] = useState<{ week: WeekKey; orderIndex: number } | null>(null);

    // Track original position of dragged item to keep a spacer
    const [dragOrigin, setDragOrigin] = useState<{ week: WeekKey; orderIndex: number; item: any } | null>(null);

    const visibleItems = getVisibleItems();
    const presentWeek = getPresentWeek();
    const routineMap = new Map(routines.map(r => [r.id, r]));

    // Group items by week
    const itemsByWeek = visibleItems.reduce((acc, item) => {
        if (!acc[item.week]) acc[item.week] = [];
        acc[item.week].push(item);
        return acc;
    }, {} as Record<WeekKey, typeof visibleItems>);

    const sortedWeeks = Object.keys(itemsByWeek).sort(compareWeekKeys);

    // Ensure the weeks we need to render are stable even if empty during drag
    const [weeks, setWeeks] = useState(sortedWeeks);

    // Sync local weeks with store data, but we might want to be careful during drag
    useEffect(() => {
        // Simple sync for now - refined drag logic doesn't strictly require local week state if updates are fast
    }, [sortedWeeks]);

    const presentWeekItems = itemsByWeek[presentWeek] || [];
    const firstPresentWeekItemId = presentWeekItems[0]?.id;

    // Intersection observer logic...
    useEffect(() => {
        if (!onPresentWeekVisible) return;
        observerRef.current = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        onPresentWeekVisible(true);
                    } else {
                        const rect = entry.boundingClientRect;
                        const isAbove = rect.top > 0;
                        onPresentWeekVisible(false, isAbove);
                    }
                });
            },
            { threshold: 0.5 }
        );
        return () => observerRef.current?.disconnect();
    }, [onPresentWeekVisible]);

    useEffect(() => {
        if (presentWeekRef.current && observerRef.current) {
            observerRef.current.observe(presentWeekRef.current);
        }
        return () => observerRef.current?.disconnect();
    }, [firstPresentWeekItemId]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: DRAG_ACTIVATION_DISTANCE },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragStart = (event: DragStartEvent) => {
        const id = event.active.id as string;
        setActiveId(id);

        const item = visibleItems.find(i => i.id === id);
        if (item) {
            setDragOrigin({
                week: item.week,
                orderIndex: item.orderIndex,
                item: item
            });
        }
    };

    const handleDragOver = (event: DragOverEvent) => {
        const { active, over } = event;
        if (!over) return;

        // Helper to resolve real item ID from potential spacer ID
        // (now imported from utils)

        const activeId = resolveId(active.id as string);
        const rawOverId = over.id as string;
        const overId = resolveId(rawOverId);

        // Find the "week" container of the active item and the over item
        // Note: active.data.current?.sortable?.containerId could be useful but we have week in item
        const activeItem = visibleItems.find(i => i.id === activeId);

        // If over a "container" (empty week placeholder), overId is the week key
        let overWeek: WeekKey | undefined;
        let overItem: typeof activeItem | undefined;

        // Check if overId is a known week key
        // We need a stable way to know if we are over a week container or an item
        // Best way: check if overId matches a week regex or is in our week list
        // OR: check if it's an item

        const maybeItem = visibleItems.find(i => i.id === overId);
        if (maybeItem) {
            overItem = maybeItem;
            // Check if we are hovering over the spacer of the currently dragged item
            // If so, the "PHYSICAL" week is the origin week, irrespective of where the item "IS" in the store.
            if (dragOrigin && overId === dragOrigin.item.id && isSpacerId(rawOverId)) {
                overWeek = dragOrigin.week;
            } else {
                overWeek = maybeItem.week;
            }
        } else {
            // Assume it's a container ID which we will set to the week key
            // Start by assuming rawOverId is the week key (container drop)
            // But if it was a spacer ID that failed resolution, we shouldn't treat it as a week key
            if (!isSpacerId(rawOverId)) {
                overWeek = rawOverId as WeekKey;
            }
        }

        if (!activeItem || !overWeek) return;

        if (activeItem.week !== overWeek) {
            // Moved to a different week!
            // We need to trigger a move in the store to update the UI

            // Find appropriate index in new week
            let newIndex = 0;
            if (overItem) {
                const weekItems = visibleItems.filter(i => i.week === overWeek).sort((a, b) => a.orderIndex - b.orderIndex);

                // Use refined physics calculation from check
                newIndex = calculateInsertionIndex({
                    active,
                    over,
                    overItem,
                    weekItems
                });
            } else {
                newIndex = visibleItems.filter(i => i.week === overWeek).length;
            }

            reorderItem(activeId, newIndex, overWeek);
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);
        setDragOrigin(null);

        if (!over) return;

        // Helper to resolve real item ID from potential spacer ID
        // (now imported)

        const activeId = resolveId(active.id as string);
        const rawOverId = over.id as string;
        const overId = resolveId(rawOverId);

        const activeItem = visibleItems.find(i => i.id === activeId);

        // Determine target
        let overItem = visibleItems.find(i => i.id === overId);
        let targetWeek: WeekKey;

        if (overItem) {
            targetWeek = overItem.week;
        } else {
            // Dropped on a container
            // Start by assuming rawOverId is the week key (container drop)
            // But if it was a spacer ID that failed resolution, we shouldn't treat it as a week key
            if (isSpacerId(rawOverId)) {
                // Should have found item via resolveId, but if not, something is wrong
                // or it's a spacer for an item that is no longer visible?
                // Fallback to activeItem's week or return?? 
                // Actually if overItem is found above, we are good.
                // If not found, and it IS a spacer ID, it means we dropped on a spacer for a hidden item?
                // Safe bet: return
                return;
            }
            targetWeek = rawOverId as WeekKey;
        }

        if (!activeItem) return;

        // Final reorder to ensure exact position
        // If we did our job in dragOver, it might already be close, but dragEnd confirms it.

        const weekItems = visibleItems
            .filter(i => i.week === targetWeek)
            .sort((a, b) => a.orderIndex - b.orderIndex);

        let newIndex = weekItems.length;

        if (overItem) {
            const overIndex = weekItems.findIndex(i => i.id === overItem!.id);
            // logic to decide if before or after... dnd-kit handles this usually via index
            // relying on overIndex is usually safe
            newIndex = overIndex >= 0 ? overIndex : newIndex;
        }

        if (activeItem.week !== targetWeek || activeId !== overId) {
            reorderItem(activeItem.id, newIndex, targetWeek);
        }

        setAnnouncement(`Moved ${activeItem.title} to ${targetWeek}`);
    };

    // Prepare active item for overlay
    const activeItemData = activeId ? visibleItems.find(i => i.id === activeId) : null;
    const activeRoutine = activeItemData?.routineId ? routineMap.get(activeItemData.routineId) : undefined;

    const monthsShown = new Set<string>();

    // Animation refs
    const [parentConf] = useAutoAnimate();

    const animateRef = useCallback((node: HTMLDivElement | null) => {
        if (node) {
            autoAnimate(node, (el, action, oldCoords, newCoords) => {
                let keyframes;
                if (action === 'add') {
                    keyframes = [
                        { transform: 'scale(1)', opacity: 1 },
                        { transform: 'scale(1)', opacity: 1 }
                    ];
                }
                if (action === 'remove') {
                    // Suppress animation if it's the item currently being dragged
                    // OR if it's a spacer (though spacest shouldn't exist now)
                    const isDraggedItem = activeId && el.getAttribute('data-item-id') === activeId;

                    if (el.hasAttribute('data-is-spacer') || isDraggedItem) {
                        keyframes = [
                            { opacity: 0 },
                            { opacity: 0 }
                        ];
                    } else {
                        keyframes = [
                            { transform: 'scale(1)', opacity: 1 },
                            { transform: 'scale(1)', opacity: 0 }
                        ];
                    }
                }
                if (action === 'remain') {
                    const deltaX = oldCoords.left - newCoords.left;
                    const deltaY = oldCoords.top - newCoords.top;
                    const start = { transform: `translate(${deltaX}px, ${deltaY}px)` };
                    const end = { transform: `translate(0, 0)` };
                    keyframes = [start, end];
                }
                return new KeyframeEffect(el, keyframes || [], { duration: 250, easing: 'ease-in-out' });
            });
        }
    }, [activeId]);

    return (
        <div className="task-list">
            <div className="aria-live" role="status" aria-live="polite" aria-atomic="true">
                {announcement}
            </div>

            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
            >
                <div ref={parentConf} className="weeks-wrapper">
                    {sortedWeeks.map((week) => {
                        const weekItems = itemsByWeek[week] || [];
                        const isCurrentWeek = week === presentWeek;
                        const sectionInfo = getSectionLabel(week, presentWeek);

                        // ... Header logic same as before ... 
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
                        const weekSunday = dayjs(getFirstDayOfWeek(week));
                        const showCombinedMonthDate = showHeader && sectionInfo.isNewMonth;
                        const combinedMonthDateLabel = showCombinedMonthDate
                            ? `${weekSunday.format('MMMM')} ${weekSunday.format('D')}`
                            : null;
                        const weekDateLabel = weekSunday.format('MMM D');
                        const diff = compareWeekKeys(week, presentWeek);
                        let relativeClass = '';
                        if (diff === 0) relativeClass = 'header-present';
                        else if (diff > 0) relativeClass = 'header-future';
                        else relativeClass = 'header-past';

                        return (
                            <div key={week} className="week-section" ref={isCurrentWeek ? presentWeekRef : undefined} data-week={week} data-is-present={isCurrentWeek}>
                                {/* Headers */}
                                {showHeader && headerLabel && !sectionInfo.isNewMonth && (
                                    <div className="week-header-row">
                                        <div className={`section-header relative-header ${relativeClass}`}>
                                            {headerLabel}
                                        </div>
                                        <div className="week-date-label">{weekDateLabel}</div>
                                    </div>
                                )}
                                {showCombinedMonthDate && (
                                    <div className="section-header month-header">
                                        {combinedMonthDateLabel}
                                    </div>
                                )}
                                {!showHeader && (
                                    <div className="week-date-label standalone">{weekDateLabel}</div>
                                )}

                                {/* Sortable Context for this Week */}
                                <SortableContext
                                    id={week} // Critical: Container ID is the week key
                                    items={weekItems.map(i => i.id)}
                                    strategy={verticalListSortingStrategy}
                                >
                                    <div className="week-items-container" ref={animateRef}>
                                        {(() => {
                                            // Project items with potential spacer
                                            // We use a helper function here instead of a hook because we are inside a map
                                            // and extracting a full Week component is a larger refactor.
                                            // Ideally we'd move this to a WeekColumn component.

                                            // Helper inline for now or imported if I update the file.
                                            // Let's use the logic I know works, cleaned up.
                                            const renderItems = getProjectedItems(weekItems, dragOrigin, week);

                                            return renderItems.map((item) => (
                                                <React.Fragment key={item.id ?? 'spacer-fragment'}>
                                                    {/* Insertion Point Logic only for real items */}
                                                    {!item.isSpacer && editingAt?.week === week && editingAt?.orderIndex === item.orderIndex ? (
                                                        <InlineTaskEditor
                                                            week={week}
                                                            orderIndex={item.orderIndex}
                                                            onComplete={() => setEditingAt(null)}
                                                            onCancel={() => setEditingAt(null)}
                                                        />
                                                    ) : !item.isSpacer && (
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
                                                        isSpacer={item.isSpacer}
                                                    />
                                                </React.Fragment>
                                            ));
                                        })()}
                                        {/* Trailing Insertion Point */}
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
                                </SortableContext>
                            </div>
                        );
                    })}
                </div>

                <DragOverlay dropAnimation={null}>
                    {activeItemData ? (
                        <TaskCard
                            item={activeItemData}
                            routine={activeRoutine}
                            presentWeek={presentWeek}
                            currentTime={currentTime}
                            isOverlay={true}
                        />
                    ) : null}
                </DragOverlay>
            </DndContext>
        </div>
    );
};
