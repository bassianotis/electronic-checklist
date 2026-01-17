import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { TaskCard } from './TaskCard';
import { InlineTaskEditor } from './InlineTaskEditor';
import type { WeekKey, Item, Routine } from '../types';
import { getProjectedItems } from '../utils/dragProjection';

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
                id={week}
                items={weekItems.map(i => i.id)}
                strategy={verticalListSortingStrategy}
            >
                <div className="week-items-container" ref={setNodeRef}>
                    <div>
                        {projectedItems.map((item) => (
                            <React.Fragment key={item.id ?? 'spacer-fragment'}>
                                {!item.isSpacer && editingAt?.week === week && editingAt?.orderIndex === item.orderIndex ? (
                                    <InlineTaskEditor
                                        week={week}
                                        orderIndex={item.orderIndex}
                                        onComplete={() => onSetEditingAt(null)}
                                        onCancel={() => onSetEditingAt(null)}
                                    />
                                ) : !item.isSpacer && (
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
                                />
                            </React.Fragment>
                        ))}

                        {editingAt?.week === week && editingAt?.orderIndex === weekItems.length && !weekItems.some(i => i.orderIndex === editingAt?.orderIndex) ? (
                            <InlineTaskEditor
                                week={week}
                                orderIndex={weekItems.length}
                                onComplete={() => onSetEditingAt(null)}
                                onCancel={() => onSetEditingAt(null)}
                            />
                        ) : (
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
                        )}
                    </div>
                </div>
            </SortableContext>
        </div>
    );
};
