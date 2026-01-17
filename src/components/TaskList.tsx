// Imports updated
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
import type { WeekKey, Item } from '../types';

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

// Components
import { SideDrawer } from './SideDrawer';
import { IdeasPanel } from './IdeasPanel';
import { RoutineManager } from './RoutineManager';
import { ArchivePanel } from './ArchivePanel';

interface TaskListProps {
    onPresentWeekVisible?: (visible: boolean, isAbove?: boolean) => void;
    activePanel: 'archive' | 'routines' | 'ideas' | null;
    onTogglePanel: (panel: 'archive' | 'routines' | 'ideas') => void;
    onClosePanel: () => void;
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

export const TaskList: React.FC<TaskListProps> = ({
    onPresentWeekVisible,
    activePanel,
    onTogglePanel,
    onClosePanel
}) => {
    const {
        getVisibleItems,
        getIdeasItems,
        getPresentWeek,
        currentTime,
        routines,
        reorderItem
    } = useTaskStore();

    const [activeId, setActiveId] = useState<string | null>(null);
    const [announcement, setAnnouncement] = useState('');
    const presentWeekRef = useRef<HTMLDivElement>(null);
    const observerRef = useRef<IntersectionObserver | null>(null);

    // Inline editor state: { week, orderIndex } or null
    const [editingAt, setEditingAt] = useState<{ week: WeekKey; orderIndex: number } | null>(null);
    const [hoveringAt, setHoveringAt] = useState<{ week: WeekKey; orderIndex: number } | null>(null);

    // Track original position of dragged item to keep a spacer
    const [dragOrigin, setDragOrigin] = useState<{ week: WeekKey; orderIndex: number; item: Item } | null>(null);

    const visibleItems = getVisibleItems();
    const ideasItems = getIdeasItems();
    // Combine for drag logic lookups
    const allDragItems = [...visibleItems, ...ideasItems];

    const presentWeek = getPresentWeek();
    const routineMap = new Map(routines.map(r => [r.id, r]));

    // Group items by week (only visible timeline items)
    const itemsByWeek = visibleItems.reduce((acc, item) => {
        if (!acc[item.week]) acc[item.week] = [];
        acc[item.week].push(item);
        return acc;
    }, {} as Record<WeekKey, typeof visibleItems>);

    const sortedWeeks = Object.keys(itemsByWeek).sort(compareWeekKeys);

    // Only sync logic if needed, currently unused
    useEffect(() => {
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

        const item = allDragItems.find(i => i.id === id);
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

        const activeId = resolveId(active.id as string);
        const rawOverId = over.id as string;
        const overId = resolveId(rawOverId);

        const activeItem = allDragItems.find(i => i.id === activeId);

        let overWeek: WeekKey | undefined;
        let overItem: typeof activeItem | undefined;

        const maybeItem = allDragItems.find(i => i.id === overId);
        if (maybeItem) {
            overItem = maybeItem;
            if (dragOrigin && overId === dragOrigin.item.id && isSpacerId(rawOverId)) {
                overWeek = dragOrigin.week;
            } else {
                overWeek = maybeItem.week;
            }
        } else {
            if (!isSpacerId(rawOverId)) {
                overWeek = rawOverId as WeekKey;
            }
        }

        if (!activeItem || !overWeek) return;

        if (activeItem.week !== overWeek) {
            let newIndex = 0;
            if (overItem) {
                const weekItems = allDragItems.filter(i => i.week === overWeek).sort((a, b) => a.orderIndex - b.orderIndex);
                newIndex = calculateInsertionIndex({
                    active,
                    over,
                    overItem,
                    weekItems
                });
            } else {
                newIndex = allDragItems.filter(i => i.week === overWeek).length;
            }

            reorderItem(activeId, newIndex, overWeek);
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);
        setDragOrigin(null);

        if (!over) return;

        const activeId = resolveId(active.id as string);
        const rawOverId = over.id as string;
        const overId = resolveId(rawOverId);

        const activeItem = allDragItems.find(i => i.id === activeId);

        // Determine target
        const overItem = allDragItems.find(i => i.id === overId);
        let targetWeek: WeekKey;

        if (overItem) {
            targetWeek = overItem.week;
        } else {
            if (isSpacerId(rawOverId)) {
                return;
            }
            targetWeek = rawOverId as WeekKey;
        }

        if (!activeItem) return;

        const weekItems = allDragItems
            .filter(i => i.week === targetWeek)
            .sort((a, b) => a.orderIndex - b.orderIndex);

        let newIndex = weekItems.length;

        if (overItem) {
            const overIndex = weekItems.findIndex(i => i.id === overItem!.id);
            newIndex = overIndex >= 0 ? overIndex : newIndex;
        }

        if (activeItem.week !== targetWeek || activeId !== overId) {
            reorderItem(activeItem.id, newIndex, targetWeek);
        }

        setAnnouncement(`Moved ${activeItem.title} to ${targetWeek}`);
    };

    const activeItemData = activeId ? allDragItems.find(i => i.id === activeId) : null;
    const activeRoutine = activeItemData?.routineId ? routineMap.get(activeItemData.routineId) : undefined;

    const monthsShown = new Set<string>();

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
                if (action === 'remain' && oldCoords && newCoords) {
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

                        let showHeader = false;
                        const headerLabel = sectionInfo.label;
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
                                            const renderItems = getProjectedItems(weekItems, dragOrigin, week);
                                            return renderItems.map((item) => (
                                                <React.Fragment key={item.id ?? 'spacer-fragment'}>
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

                <SideDrawer
                    isOpen={activePanel !== null}
                    activePanel={activePanel}
                    onToggle={onTogglePanel}
                    onClose={onClosePanel}
                >
                    {activePanel === 'routines' && (
                        <RoutineManager isOpen={true} onClose={() => { }} />
                    )}
                    {activePanel === 'archive' && (
                        <ArchivePanel isOpen={true} onClose={() => { }} />
                    )}
                    {activePanel === 'ideas' && (
                        <IdeasPanel isOpen={true} onClose={onClosePanel} />
                    )}
                </SideDrawer>

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
