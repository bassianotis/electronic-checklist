// Imports updated
import React, { useState, useRef, useEffect } from 'react';
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
    sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { TaskCard } from './TaskCard';
import { useTaskStore } from '../store/store';
import { useViewAsUser } from '../hooks/useViewAsUser';
import type { WeekKey, Item, Routine } from '../types';
import { IDEAS_WEEK_KEY } from '../types';

import { compareWeekKeys, addWeeks, getFirstDayOfWeek, getWeekKey } from '../utils/timeUtils';
import { PROPOSALS_CONTAINER_KEY } from '../utils/proposalUtils';
import dayjs from 'dayjs';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import {
    resolveId,
    isSpacerId,
    calculateInsertionIndex,
    DRAG_ACTIVATION_DISTANCE
} from '../utils/dragUtils';

// Components
import { SideDrawer } from './SideDrawer';
import { QueuePanel, ProposalCardVisual } from './QueuePanel';
import { RoutineManager } from './RoutineManager';
import { ArchivePanel } from './ArchivePanel';
import { SettingsPanel } from './SettingsPanel';
import { CollectionsPanel } from './CollectionsPanel';
import { WeekSection } from './WeekSection';

interface TaskListProps {
    onPresentWeekVisible?: (visible: boolean, isAbove?: boolean) => void;
    activePanel: 'archive' | 'routines' | 'queue' | 'settings' | 'collections' | null;
    onTogglePanel: (panel: 'archive' | 'routines' | 'queue' | 'settings' | 'collections') => void;
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
    const store = useTaskStore();
    const { isReadOnly, viewedData, activeUsername } = useViewAsUser();

    // Use viewed data if in read-only mode, otherwise use store data
    const getVisibleItems = () => {
        if (isReadOnly && viewedData) {
            return viewedData.items
                ?.filter((i: any) => i.week !== IDEAS_WEEK_KEY && !i.archived && !i.deletedAt)
                .sort((a: any, b: any) => {
                    const weekCompare = compareWeekKeys(a.week, b.week);
                    if (weekCompare !== 0) return weekCompare;
                    return a.orderIndex - b.orderIndex;
                }) || [];
        }
        return store.getVisibleItems();
    };

    const getIdeasItems = () => {
        if (isReadOnly && viewedData) {
            return viewedData.items
                ?.filter((i: any) => i.week === IDEAS_WEEK_KEY && !i.archived && !i.deletedAt)
                .sort((a: any, b: any) => a.orderIndex - b.orderIndex) || [];
        }
        return store.getIdeasItems();
    };

    const getPresentWeek = () => {
        if (isReadOnly && viewedData) {
            // Use current time from viewed data or store
            const time = viewedData.currentTime || store.currentTime;
            // Generate week key from timestamp using the utility function
            return getWeekKey(time);
        }
        return store.getPresentWeek();
    };

    const currentTime = (isReadOnly && viewedData?.currentTime) || store.currentTime;
    const routines: Routine[] = (isReadOnly && viewedData?.routines) || store.routines;
    const weekNotes = (isReadOnly && viewedData?.weekNotes) || store.weekNotes;
    const reorderItem = store.reorderItem;
    const acceptProposal = store.acceptProposal;
    const deleteItem = store.deleteItem;

    const [activeId, setActiveId] = useState<string | null>(null);
    const [announcement, setAnnouncement] = useState('');
    const presentWeekRef = useRef<HTMLDivElement>(null);
    const observerRef = useRef<IntersectionObserver | null>(null);

    // Inline editor state: { week, orderIndex } or null
    const [editingAt, setEditingAt] = useState<{ week: WeekKey; orderIndex: number } | null>(null);
    const [hoveringAt, setHoveringAt] = useState<{ week: WeekKey; orderIndex: number } | null>(null);

    // Track original position of dragged item to keep a spacer
    const [dragOrigin, setDragOrigin] = useState<{ week: WeekKey; orderIndex: number; item: Item } | null>(null);

    // Task id of a proposal that was promoted to a real task at drag-start.
    // Used to apply the focus-window restriction during drag and to hard-delete
    // the task if the drag is cancelled without a valid drop target.
    const [promotedTaskId, setPromotedTaskId] = useState<string | null>(null);

    // Snapshot of proposal-shaped preview fields so DragOverlay can render a
    // compact ProposalCard-style card during the drag instead of the full
    // TaskCard (which auto-expands for time-tracked / notes / etc.).
    const [proposalPreview, setProposalPreview] = useState<{
        title: string;
        cadence: string;
        lastCompletedAt: string | null;
    } | null>(null);

    const baseVisibleItems: Item[] = getVisibleItems();
    const ideasItems: Item[] = getIdeasItems();
    // Staged proposal drags — not rendered anywhere directly (the ProposalCard
    // in the queue continues to serve as their sortable while they're staged),
    // but must be in allDragItems so handleDragOver can find them and call
    // reorderItem to move them into a timeline week on hover.
    const stagedItems: Item[] = store.items.filter(
        (i) => i.week === PROPOSALS_CONTAINER_KEY && !i.deletedAt
    );
    // Combine for drag logic lookups
    const allDragItems = [...baseVisibleItems, ...ideasItems, ...stagedItems];

    const presentWeek = getPresentWeek();
    const nextWeek = addWeeks(presentWeek, 1);
    const routineMap = new Map<string, Routine>(routines.map((r: Routine) => [r.id, r]));

    // Group items by week (only visible timeline items)
    const itemsByWeek = baseVisibleItems.reduce((acc: Record<WeekKey, Item[]>, item: Item) => {
        if (!acc[item.week]) acc[item.week] = [];
        acc[item.week].push(item);
        return acc;
    }, {} as Record<WeekKey, Item[]>);

    // Generate default "Year View" weeks
    const defaultWeeks = new Set<WeekKey>();
    // Include present week + next 51 weeks (Full Year)
    defaultWeeks.add(presentWeek);
    for (let i = 1; i < 52; i++) {
        defaultWeeks.add(addWeeks(presentWeek, i));
    }

    // Merge with any existing data weeks
    Object.keys(itemsByWeek).forEach(w => defaultWeeks.add(w));

    // Sort all weeks
    const sortedWeeks = Array.from(defaultWeeks).sort(compareWeekKeys);

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
            { threshold: 0 }
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

        const data = event.active.data.current;
        if (data?.type === 'proposal' && data?.routineId) {
            // Unify proposal drag with regular task drag: create the real task
            // now so everything downstream (handleDragOver, handleDragEnd,
            // reorderItem, shift-aside animations) uses the same code path
            // as any other task drag. ProposalCard's useSortable id matches
            // this task id so dnd-kit tracks the draggable across the handoff.
            const routineId = data.routineId as string;
            const targetWeek = (data.presentWeek as WeekKey) ?? presentWeek;
            const taskId = `${routineId}-${targetWeek}`;
            // Stage the task in the sidebar sentinel, not in the target week.
            // The timeline stays unshifted until the cursor reaches a real week,
            // matching how Ideas cards only enter the timeline on hover.
            acceptProposal(routineId, targetWeek, undefined, true);
            setPromotedTaskId(taskId);
            const routine = routineMap.get(routineId);
            const synthetic: Item = {
                id: taskId,
                title: routine?.title ?? '',
                routineId,
                week: PROPOSALS_CONTAINER_KEY,
                status: 'incomplete',
                orderIndex: 0,
                updatedAt: Date.now(),
            };
            setDragOrigin({ week: PROPOSALS_CONTAINER_KEY, orderIndex: 0, item: synthetic });
            setProposalPreview({
                title: (data.title as string) ?? routine?.title ?? '',
                cadence: (data.cadence as string) ?? routine?.cadence ?? '',
                lastCompletedAt: (data.lastCompletedAt as string | null) ?? null,
            });
            return;
        }

        const item = allDragItems.find(i => i.id === id);
        if (item) {
            setDragOrigin({ week: item.week, orderIndex: item.orderIndex, item });
        }
    };

    const handleDragOver = (event: DragOverEvent) => {
        const { active, over } = event;
        if (!over) return;

        const activeIdResolved = resolveId(active.id as string);
        const rawOverId = over.id as string;
        const overId = resolveId(rawOverId);

        const activeItem = allDragItems.find(i => i.id === activeIdResolved);
        if (!activeItem) return;

        let overWeek: WeekKey | undefined;
        let overItem: Item | undefined;

        const maybeItem = allDragItems.find(i => i.id === overId);
        if (maybeItem) {
            overItem = maybeItem;
            if (dragOrigin && overId === dragOrigin.item.id && isSpacerId(rawOverId)) {
                overWeek = dragOrigin.week;
            } else {
                overWeek = maybeItem.week;
            }
        } else if (!isSpacerId(rawOverId) && sortedWeeks.includes(rawOverId)) {
            overWeek = rawOverId as WeekKey;
        }

        if (!overWeek) return;

        // Focus-window restriction for a just-promoted proposal: it can only
        // live in the present or next week. Dragging elsewhere is a no-op
        // until the cursor returns to a valid week.
        if (activeIdResolved === promotedTaskId &&
            overWeek !== presentWeek && overWeek !== nextWeek) {
            return;
        }

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

            reorderItem(activeIdResolved, newIndex, overWeek);
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        const promoted = promotedTaskId;

        setActiveId(null);
        setDragOrigin(null);
        setPromotedTaskId(null);
        setProposalPreview(null);

        const activeIdResolved = resolveId(active.id as string);
        const wasPromoted = promoted !== null && activeIdResolved === promoted;

        if (!over) {
            // Dropped outside any droppable. If this was a just-promoted
            // proposal, tear down the task we speculatively created.
            if (wasPromoted && promoted) deleteItem(promoted);
            return;
        }

        const rawOverId = over.id as string;
        const overId = resolveId(rawOverId);

        const activeItem = allDragItems.find(i => i.id === activeIdResolved);

        const overItem = allDragItems.find(i => i.id === overId);
        let targetWeek: WeekKey;

        if (overItem) {
            targetWeek = overItem.week;
        } else {
            if (isSpacerId(rawOverId)) {
                if (wasPromoted && promoted) deleteItem(promoted);
                return;
            }
            // Only real week targets are valid drop containers. Proposal card
            // ids and the proposals container key are not weeks — treating
            // them as such would write garbage into item.week and crash the
            // timeline on the next render.
            const isValidWeekTarget =
                sortedWeeks.includes(rawOverId) || rawOverId === IDEAS_WEEK_KEY;
            if (!isValidWeekTarget) {
                if (wasPromoted && promoted) deleteItem(promoted);
                return;
            }
            targetWeek = rawOverId as WeekKey;
        }

        if (!activeItem) {
            if (wasPromoted && promoted) deleteItem(promoted);
            return;
        }

        // Promoted proposals can only land in the focus window.
        if (wasPromoted && targetWeek !== presentWeek && targetWeek !== nextWeek) {
            if (promoted) deleteItem(promoted);
            return;
        }

        // Prevent dragging completed items to Ideas
        if (targetWeek === IDEAS_WEEK_KEY && activeItem.status === 'complete') {
            return;
        }

        const weekItems = allDragItems
            .filter(i => i.week === targetWeek)
            .sort((a, b) => a.orderIndex - b.orderIndex);

        let newIndex = weekItems.length;

        if (overItem) {
            const overIndex = weekItems.findIndex(i => i.id === overItem!.id);
            newIndex = overIndex >= 0 ? overIndex : newIndex;
        }

        if (activeItem.week !== targetWeek || activeIdResolved !== overId) {
            reorderItem(activeItem.id, newIndex, targetWeek);
        }

        setAnnouncement(`Moved ${activeItem.title} to ${targetWeek}`);
    };

    const activeItemData = activeId
        ? (allDragItems.find(i => i.id === activeId) ?? dragOrigin?.item ?? null)
        : null;
    const activeRoutine = activeItemData?.routineId ? routineMap.get(activeItemData.routineId) : undefined;

    const monthsShown = new Set<string>();

    const [parentConf] = useAutoAnimate();

    // animateRef was moved to WeekSection

    return (
        <div className="task-list">
            {/* Read-Only Banner */}
            {isReadOnly && (
                <div className="read-only-banner">
                    <span className="read-only-icon">🔒</span>
                    <span className="read-only-text">
                        Viewing {activeUsername}'s tasks (Read-Only)
                    </span>
                </div>
            )}

            <div className="aria-live" role="status" aria-live="polite" aria-atomic="true">
                {announcement}
            </div>

            <DndContext
                sensors={isReadOnly ? [] : sensors}
                collisionDetection={closestCenter}
                onDragStart={isReadOnly ? undefined : handleDragStart}
                onDragOver={isReadOnly ? undefined : handleDragOver}
                onDragEnd={isReadOnly ? undefined : handleDragEnd}
            >
                <div ref={parentConf} className="weeks-wrapper">
                    {sortedWeeks.map((week) => {
                        const allWeekItems = itemsByWeek[week] || [];
                        const weekItems = compareWeekKeys(week, nextWeek) <= 0
                            ? allWeekItems
                            : allWeekItems.filter(item => !item.routineId);
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
                            <WeekSection
                                key={week}
                                week={week}
                                weekItems={weekItems}
                                isPresentWeek={isCurrentWeek}
                                sectionInfo={sectionInfo}
                                monthsShown={monthsShown}
                                dragOrigin={dragOrigin}
                                editingAt={editingAt}
                                hoveringAt={hoveringAt}
                                activeId={activeId}
                                routineMap={routineMap}
                                presentWeek={presentWeek}
                                isReadOnly={isReadOnly}
                                weekNotes={weekNotes}
                                currentTime={currentTime}
                                onSetEditingAt={setEditingAt}
                                onSetHoveringAt={setHoveringAt}
                                presentWeekRef={presentWeekRef}
                                weekDateLabel={weekDateLabel}
                                combinedMonthDateLabel={combinedMonthDateLabel}
                                relativeClass={relativeClass}
                                showHeader={showHeader}
                                showCombinedMonthDate={showCombinedMonthDate}
                                headerLabel={headerLabel || ''}
                            />
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
                    {activePanel === 'queue' && (
                        <QueuePanel />
                    )}
                    {activePanel === 'settings' && (
                        <SettingsPanel isOpen={true} onClose={onClosePanel} />
                    )}
                    {activePanel === 'collections' && (
                        <CollectionsPanel isOpen={true} onClose={onClosePanel} />
                    )}
                </SideDrawer>

                <DragOverlay dropAnimation={null}>
                    {proposalPreview ? (
                        <ProposalCardVisual
                            title={proposalPreview.title}
                            cadence={proposalPreview.cadence}
                            lastCompletedAt={proposalPreview.lastCompletedAt}
                        />
                    ) : activeItemData ? (
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
