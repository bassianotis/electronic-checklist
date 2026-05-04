import React, { useMemo, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { TaskCard } from './TaskCard';
import { InlineTaskEditor } from './InlineTaskEditor';
import { useTaskStore } from '../store/store';
import { computeProposals, PROPOSALS_CONTAINER_KEY } from '../utils/proposalUtils';
import { getWeekKey } from '../utils/timeUtils';
import { IDEAS_WEEK_KEY } from '../types';
import type { RoutineProposal, WeekKey } from '../types';

dayjs.extend(relativeTime);

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

// Presentational proposal card — used by the sortable ProposalCard below and
// also by TaskList's DragOverlay so the dragged preview keeps the same
// compact shape as the card in the side panel.
export const ProposalCardVisual: React.FC<{
    title: string;
    cadence: string;
    lastCompletedAt: string | null;
}> = ({ title, cadence, lastCompletedAt }) => {
    const lastCompletedLabel = lastCompletedAt
        ? `Last ${dayjs(lastCompletedAt).fromNow()}`
        : 'Never done';
    return (
        <div className="task-card proposal-card">
            <div className="drag-handle" aria-hidden="true">
                <GripIcon />
            </div>
            <div className="task-content">
                <div className="task-title" title={title}>{title}</div>
                <div className="task-meta">
                    <span className="chip routine">{cadence}</span>
                    <span className="proposal-last-completed">{lastCompletedLabel}</span>
                </div>
            </div>
        </div>
    );
};

// ProposalCard's sortable id is the deterministic task id the proposal would
// have if accepted in the present week. When the user starts dragging, we
// immediately call acceptProposal — the proposal unmounts from the queue and
// a TaskCard with this same id mounts in the present week. dnd-kit tracks the
// id across the handoff, so the drag continues uninterrupted with the real
// task using the same code path as any other task drag.
const ProposalCard: React.FC<{
    proposal: RoutineProposal;
    presentWeek: WeekKey;
    onDismiss: () => void;
}> = ({ proposal, presentWeek, onDismiss }) => {
    const { routine, lastCompletedAt } = proposal;
    const futureTaskId = `${routine.id}-${presentWeek}`;

    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: futureTaskId,
        data: {
            type: 'proposal',
            routineId: routine.id,
            presentWeek,
            cadence: routine.cadence,
            title: routine.title,
            lastCompletedAt,
        },
    });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        // Match TaskCard — fully hide the source slot during drag so the
        // reserved space looks empty, same as "Other" cards.
        opacity: isDragging ? 0 : 1,
    };

    const lastCompletedLabel = lastCompletedAt
        ? `Last ${dayjs(lastCompletedAt).fromNow()}`
        : 'Never done';

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="task-card proposal-card"
            data-item-id={routine.id}
        >
            <div
                className="drag-handle"
                {...attributes}
                {...listeners}
                aria-label="Drag to schedule"
                onClick={(e) => e.stopPropagation()}
            >
                <GripIcon />
            </div>

            <div className="task-content">
                <div className="task-title" title={routine.title}>
                    {routine.title}
                </div>
                <div className="task-meta">
                    <span className="chip routine">{routine.cadence}</span>
                    <span className="proposal-last-completed">{lastCompletedLabel}</span>
                </div>
            </div>

            <div className="task-actions">
                <button
                    className="proposal-dismiss-btn"
                    onClick={(e) => { e.stopPropagation(); onDismiss(); }}
                    title="Dismiss until next week"
                    aria-label="Dismiss"
                >
                    ✕
                </button>
            </div>
        </div>
    );
};

export const QueuePanel: React.FC = () => {
    const { routines, items, currentTime, dismissProposal, clearDismissals, getIdeasItems } = useTaskStore();
    const [isAdding, setIsAdding] = useState(false);

    const presentWeek = getWeekKey(currentTime);

    const proposals = useMemo(
        () => computeProposals(routines, items, currentTime),
        [routines, items, currentTime]
    );

    const hasDismissedThisWeek = useMemo(() => {
        return routines.some(r => !r.deletedAt && r.dismissedAt && getWeekKey(r.dismissedAt) === presentWeek);
    }, [routines, presentWeek]);

    const ideasItems = getIdeasItems();

    const { setNodeRef: setProposalsRef } = useDroppable({
        id: PROPOSALS_CONTAINER_KEY,
        data: { type: 'container', week: PROPOSALS_CONTAINER_KEY },
    });

    const { setNodeRef: setIdeasRef } = useDroppable({
        id: IDEAS_WEEK_KEY,
        data: { type: 'container', week: IDEAS_WEEK_KEY },
    });

    const proposalIds = proposals.map(p => `${p.routine.id}-${presentWeek}`);

    return (
        <div className="side-panel-container queue-panel">
            <div className="panel-header">
                <h2>Queue</h2>
            </div>

            <div className="panel-content">
                <section className="queue-section">
                    <div className="queue-section__header">
                        <h3>Routines</h3>
                        <button
                            className="queue-section__refill"
                            onClick={clearDismissals}
                            disabled={!hasDismissedThisWeek}
                            title={
                                hasDismissedThisWeek
                                    ? 'Bring dismissed routines back to the queue'
                                    : 'Nothing dismissed this week'
                            }
                        >
                            ↻ Refill
                        </button>
                    </div>
                    <div ref={setProposalsRef} className="queue-section__body">
                        <SortableContext items={proposalIds} strategy={verticalListSortingStrategy}>
                            {proposals.length === 0 ? (
                                <div className="queue-section__empty">
                                    {hasDismissedThisWeek
                                        ? 'No more routines this week. Tap Refill to see dismissed ones.'
                                        : 'All routines are up to date.'}
                                </div>
                            ) : (
                                proposals.map(proposal => (
                                    <ProposalCard
                                        key={proposal.routine.id}
                                        proposal={proposal}
                                        presentWeek={presentWeek}
                                        onDismiss={() => dismissProposal(proposal.routine.id)}
                                    />
                                ))
                            )}
                        </SortableContext>
                    </div>
                </section>

                <section className="queue-section">
                    <div className="queue-section__header">
                        <h3>Other</h3>
                        <button
                            className="queue-section__add"
                            onClick={() => setIsAdding(true)}
                            style={{ display: isAdding ? 'none' : 'inline-block' }}
                        >
                            + Add
                        </button>
                    </div>
                    <div ref={setIdeasRef} className="queue-section__body">
                        {isAdding && (
                            <div className="inline-task-editor-wrapper">
                                <InlineTaskEditor
                                    week={IDEAS_WEEK_KEY}
                                    orderIndex={0}
                                    onComplete={() => setIsAdding(false)}
                                    onCancel={() => setIsAdding(false)}
                                />
                            </div>
                        )}

                        <div className="ideas-list">
                            <SortableContext
                                items={ideasItems.map(i => i.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                {ideasItems.length === 0 && !isAdding ? (
                                    <div className="queue-section__empty">
                                        Bank your ideas here for later.
                                    </div>
                                ) : (
                                    ideasItems.map(item => (
                                        <TaskCard
                                            key={item.id}
                                            item={item}
                                            presentWeek={presentWeek}
                                            currentTime={currentTime}
                                            isSpacer={item.isSpacer}
                                        />
                                    ))
                                )}
                            </SortableContext>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};
