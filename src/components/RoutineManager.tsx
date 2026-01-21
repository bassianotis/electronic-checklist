import React, { useState, useMemo } from 'react';
import dayjs from 'dayjs';
import { getWeekKey, getFirstDayOfWeek } from '../utils/timeUtils';
import { useTaskStore } from '../store/store';

interface RoutineManagerProps {
    isOpen: boolean;
    onClose: () => void;
}

type TaskType = 'simple' | 'multi-occurrence' | 'time-tracked';
type Cadence = 'weekly' | 'biweekly' | 'monthly' | 'annually';

interface DraftRoutine {
    name: string;
    taskType: TaskType;
    targetCount: number;
    minutesGoal: number;
    cadence: Cadence;
    isYearRound: boolean;
    // For year-round: specific anchor week (e.g., "2025-W02")
    anchorWeek: string;
    // For seasonal: ambiguous month+week that spans years
    startMonth: number;
    startWeekInMonth: number;
    endMonth: number;
    endWeekInMonth: number;
    notes: string;
}

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Calendar week picker - picks a specific week on the calendar (e.g., "Jan 5, 2025")
const CalendarWeekPicker: React.FC<{
    label: string;
    weekKey: string;
    onWeekChange: (weekKey: string) => void;
}> = ({ label, weekKey, onWeekChange }) => {
    const [showPicker, setShowPicker] = useState(false);
    const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
    const { getPresentWeek } = useTaskStore();

    // Generate next 12 months of weeks from present
    const monthsData = useMemo(() => {
        const presentWeek = getPresentWeek();
        const result: { key: string; label: string; weeks: { key: string; label: string }[] }[] = [];
        const startDate = dayjs(getFirstDayOfWeek(presentWeek));

        for (let m = 0; m < 12; m++) {
            const monthDate = startDate.add(m, 'month');
            const monthKey = monthDate.format('YYYY-MM');
            const monthLabel = monthDate.format('MMM YYYY');
            const weeks: { key: string; label: string }[] = [];

            // Find weeks that start in this month
            let checkDate = monthDate.startOf('month');
            const monthEnd = monthDate.endOf('month');

            while (checkDate.isBefore(monthEnd) || checkDate.isSame(monthEnd, 'day')) {
                // Find the Sunday of this week
                const sunday = checkDate.day() === 0 ? checkDate : checkDate.subtract(checkDate.day(), 'day');
                const wKey = getWeekKey(sunday.toISOString());

                // Only add if we haven't already and it's in this month
                if (!weeks.find(w => w.key === wKey) && sunday.month() === monthDate.month()) {
                    weeks.push({
                        key: wKey,
                        label: sunday.format('MMM D'),
                    });
                }
                checkDate = checkDate.add(7, 'day');
            }

            if (weeks.length > 0) {
                result.push({ key: monthKey, label: monthLabel, weeks });
            }
        }
        return result;
    }, [getPresentWeek]);

    // Find current selection label
    const selectedWeekDate = dayjs(getFirstDayOfWeek(weekKey));
    const selectedLabel = selectedWeekDate.format('MMM D, YYYY');

    return (
        <div className="week-picker">
            <label className="week-picker-label">{label}</label>
            <button
                className="week-picker-trigger"
                onClick={() => setShowPicker(!showPicker)}
            >
                {selectedLabel}
                <span className="chevron">▾</span>
            </button>

            {showPicker && (
                <div className="week-picker-dropdown">
                    {monthsData.map((month) => (
                        <div key={month.key} className="week-picker-month">
                            <button
                                className={`week-picker-month-btn ${expandedMonth === month.key ? 'active' : ''}`}
                                onClick={() => {
                                    setExpandedMonth(expandedMonth === month.key ? null : month.key);
                                }}
                            >
                                {month.label}
                            </button>
                            {expandedMonth === month.key && (
                                <div className="week-picker-weeks">
                                    {month.weeks.map(w => (
                                        <button
                                            key={w.key}
                                            className={`week-picker-week-btn ${weekKey === w.key ? 'active' : ''}`}
                                            onClick={() => {
                                                onWeekChange(w.key);
                                                setShowPicker(false);
                                                setExpandedMonth(null);
                                            }}
                                        >
                                            {w.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// Ambiguous week picker - picks a month+week that spans years (e.g., "May Week 1")
const SeasonalWeekPicker: React.FC<{
    label: string;
    month: number;
    weekInMonth: number;
    onMonthChange: (m: number) => void;
    onWeekChange: (w: number) => void;
}> = ({ label, month, weekInMonth, onMonthChange, onWeekChange }) => {
    const [showPicker, setShowPicker] = useState(false);
    const [expandedMonth, setExpandedMonth] = useState<number | null>(null);

    const selectedLabel = `${months[month - 1]} Week ${weekInMonth}`;

    return (
        <div className="week-picker">
            <label className="week-picker-label">{label}</label>
            <button
                className="week-picker-trigger"
                onClick={() => setShowPicker(!showPicker)}
            >
                {selectedLabel}
                <span className="chevron">▾</span>
            </button>

            {showPicker && (
                <div className="week-picker-dropdown">
                    {months.map((m, idx) => (
                        <div key={m} className="week-picker-month">
                            <button
                                className={`week-picker-month-btn ${month === idx + 1 ? 'active' : ''}`}
                                onClick={() => {
                                    setExpandedMonth(expandedMonth === idx + 1 ? null : idx + 1);
                                }}
                            >
                                {m}
                            </button>
                            {expandedMonth === idx + 1 && (
                                <div className="week-picker-weeks">
                                    {[1, 2, 3, 4, 5].map(w => (
                                        <button
                                            key={w}
                                            className={`week-picker-week-btn ${month === idx + 1 && weekInMonth === w ? 'active' : ''}`}
                                            onClick={() => {
                                                onMonthChange(idx + 1);
                                                onWeekChange(w);
                                                setShowPicker(false);
                                                setExpandedMonth(null);
                                            }}
                                        >
                                            Week {w}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export const RoutineManager: React.FC<RoutineManagerProps> = ({ isOpen: _isOpen, onClose: _onClose }) => {
    const { getPresentWeek, routines, items, deleteRoutine, addRoutine, updateRoutine } = useTaskStore();
    const [isEditing, setIsEditing] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<{ routineId: string; routineName: string } | null>(null);
    const [notesOverwriteConfirm, setNotesOverwriteConfirm] = useState<{
        routineId: string;
        routineData: any;
        modifiedCount: number;
    } | null>(null);

    const defaultRoutine: DraftRoutine = {
        name: '',
        taskType: 'simple',
        targetCount: 3,
        minutesGoal: 30,
        cadence: 'weekly',
        isYearRound: true,
        anchorWeek: getPresentWeek(),
        startMonth: 5,
        startWeekInMonth: 1,
        endMonth: 9,
        endWeekInMonth: 4,
        notes: '',
    };

    const [draft, setDraft] = useState<DraftRoutine>(defaultRoutine);
    const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null);

    const handleNewRoutine = () => {
        setEditingRoutineId(null);
        setDraft(defaultRoutine);
        setIsEditing(true);
    };

    const handleEditRoutine = (routine: typeof routines[0]) => {
        setEditingRoutineId(routine.id);
        setDraft({
            name: routine.title,
            taskType: routine.taskType || 'simple',
            targetCount: routine.targetCount || 3,
            minutesGoal: routine.minutesGoal || 30,
            cadence: routine.cadence as Cadence || 'weekly',
            isYearRound: routine.isYearRound ?? true,
            anchorWeek: routine.anchorWeek || getPresentWeek(),
            startMonth: routine.startMonth || 5,
            startWeekInMonth: routine.startWeekInMonth || 1,
            endMonth: routine.endMonth || 9,
            endWeekInMonth: routine.endWeekInMonth || 4,
            notes: routine.notes || '',
        });
        setIsEditing(true);
    };



    const handleDeleteConfirm = (removeRelatedTasks: boolean) => {
        if (deleteConfirm) {
            deleteRoutine(deleteConfirm.routineId, removeRelatedTasks);
            setDeleteConfirm(null);
            setIsEditing(false);
            setEditingRoutineId(null);
        }
    };

    const handleSave = () => {
        if (!draft.name.trim()) {
            return; // Don't save empty routines
        }

        const routineData = {
            title: draft.name.trim(),
            cadence: draft.cadence,
            taskType: draft.taskType,
            targetCount: draft.taskType === 'multi-occurrence' ? draft.targetCount : undefined,
            minutesGoal: draft.taskType === 'time-tracked' ? draft.minutesGoal : undefined,
            isYearRound: draft.isYearRound,
            anchorWeek: draft.anchorWeek,
            startMonth: !draft.isYearRound ? draft.startMonth : undefined,
            startWeekInMonth: !draft.isYearRound ? draft.startWeekInMonth : undefined,
            endMonth: !draft.isYearRound ? draft.endMonth : undefined,
            endWeekInMonth: !draft.isYearRound ? draft.endWeekInMonth : undefined,
            notes: draft.notes.trim() || undefined,
        };

        // If editing an existing routine, check if notes changed and if any tasks have modified notes
        if (editingRoutineId) {
            const existingRoutine = routines.find(r => r.id === editingRoutineId);
            const notesChanged = (routineData.notes || '') !== (existingRoutine?.notes || '');

            if (notesChanged) {
                // Count tasks with manually modified notes
                const relatedTasks = items.filter(item =>
                    item.routineId === editingRoutineId &&
                    !item.deletedAt &&
                    item.status === 'incomplete'
                );
                const modifiedCount = relatedTasks.filter(item =>
                    item.notes !== item.inheritedNotes &&
                    !(item.notes === undefined && item.inheritedNotes === undefined)
                ).length;

                if (modifiedCount > 0) {
                    // Show confirmation dialog
                    setNotesOverwriteConfirm({
                        routineId: editingRoutineId,
                        routineData,
                        modifiedCount,
                    });
                    return;
                }
            }

            updateRoutine(editingRoutineId, routineData);
        } else {
            addRoutine(routineData as Omit<typeof routineData & { id: string }, 'id'>);
        }

        setIsEditing(false);
        setEditingRoutineId(null);
    };

    const handleNotesOverwriteConfirm = (overwrite: boolean) => {
        if (!notesOverwriteConfirm) return;

        const { routineId, routineData } = notesOverwriteConfirm;

        // Update routine with overwrite flag
        updateRoutine(routineId, routineData, overwrite);

        setNotesOverwriteConfirm(null);
        setIsEditing(false);
        setEditingRoutineId(null);
    };


    const handleBack = () => {
        setIsEditing(false);
    };

    const updateDraft = (updates: Partial<DraftRoutine>) => {
        setDraft(prev => ({ ...prev, ...updates }));
    };

    return (
        <div className="side-panel-container">
            {!isEditing ? (
                // Routine List View
                <>
                    <div className="panel-header">
                        <h2>Routines</h2>
                    </div>

                    <div className="panel-content">
                        {routines.filter(r => !r.deletedAt).length === 0 ? (
                            <div className="panel-empty-state">No routines yet</div>
                        ) : (
                            <div className="routine-list">
                                {routines.filter(r => !r.deletedAt).map(routine => (
                                    <button
                                        key={routine.id}
                                        className={`side-panel-card routine-card ${routine.cadence}`} // Remove task-card, add cadence class for border styling
                                        onClick={() => handleEditRoutine(routine)}
                                        style={{
                                            width: '100%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            textAlign: 'left',
                                            cursor: 'pointer',
                                            padding: 'var(--spacing-sm) var(--spacing-md)',
                                            margin: 0,
                                            gap: 'var(--spacing-md)'
                                        }}
                                    >


                                        <div className="task-content">
                                            <div className="task-title" style={{ fontSize: '0.95rem', fontWeight: 600 }}>{routine.title}</div>
                                            <div className="task-meta">
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                                                    {routine.cadence} • {routine.taskType === 'simple' ? 'Check' : routine.taskType === 'multi-occurrence' ? `${routine.targetCount}x` : `${routine.minutesGoal}m`}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Chevron for indication */}
                                        <span style={{ color: 'var(--text-muted)', fontSize: '1.2rem', marginLeft: 'auto' }}>›</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <button className="add-routine-btn" onClick={handleNewRoutine}>
                        + New Routine
                    </button>
                </>
            ) : (
                // Routine Editor View
                <>
                    {/* Delete Confirmation Dialog */}
                    {deleteConfirm && (
                        <div className="delete-confirm-dialog">
                            <div className="delete-confirm-content">
                                <h3>Delete "{deleteConfirm.routineName}"</h3>
                                <p className="delete-confirm-subtitle">Would you also like to remove upcoming non-started tasks?</p>
                                <div className="delete-confirm-actions">
                                    <button className="btn-delete-keep" onClick={() => handleDeleteConfirm(false)}>
                                        Keep Tasks
                                    </button>
                                    <button className="btn-delete-remove" onClick={() => handleDeleteConfirm(true)}>
                                        Remove Tasks
                                    </button>
                                </div>
                                <button className="btn-cancel-link" onClick={() => setDeleteConfirm(null)}>
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Notes Overwrite Confirmation Dialog */}
                    {notesOverwriteConfirm && (
                        <div className="delete-confirm-dialog">
                            <div className="delete-confirm-content">
                                <h3>Update Notes</h3>
                                <p className="delete-confirm-subtitle">
                                    {notesOverwriteConfirm.modifiedCount} task{notesOverwriteConfirm.modifiedCount > 1 ? 's have' : ' has'} custom notes that will be overwritten.
                                </p>
                                <div className="delete-confirm-actions notes-overwrite-actions">
                                    <button className="btn-delete-remove" onClick={() => handleNotesOverwriteConfirm(true)}>
                                        Overwrite All
                                    </button>
                                    <button className="btn-delete-keep" onClick={() => handleNotesOverwriteConfirm(false)}>
                                        Keep Custom Notes
                                    </button>
                                </div>
                                <button className="btn-cancel-link" onClick={() => setNotesOverwriteConfirm(null)}>
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="panel-header">
                        <button className="back-btn" onClick={handleBack}>← Back</button>
                        <button className="save-btn" onClick={handleSave}>Save</button>
                    </div>

                    <div className="panel-content">
                        {/* Task Type Selection (First) */}
                        <div className="editor-section">
                            <label className="editor-label">Task Type</label>
                            <div className="task-type-options">
                                <button
                                    className={`task-type-btn ${draft.taskType === 'simple' ? 'active' : ''}`}
                                    onClick={() => updateDraft({ taskType: 'simple' })}
                                >
                                    <span className="task-type-icon">☐</span>
                                    <span className="task-type-name">Simple</span>
                                    <span className="task-type-desc">One checkbox</span>
                                </button>
                                <button
                                    className={`task-type-btn ${draft.taskType === 'multi-occurrence' ? 'active' : ''}`}
                                    onClick={() => updateDraft({ taskType: 'multi-occurrence' })}
                                >
                                    <span className="task-type-icon">☐☐☐</span>
                                    <span className="task-type-name">Multi</span>
                                    <span className="task-type-desc">Multiple times</span>
                                </button>
                                <button
                                    className={`task-type-btn ${draft.taskType === 'time-tracked' ? 'active' : ''}`}
                                    onClick={() => updateDraft({ taskType: 'time-tracked' })}
                                >
                                    <span className="task-type-icon">◔</span>
                                    <span className="task-type-name">Timed</span>
                                    <span className="task-type-desc">Track minutes</span>
                                </button>
                            </div>
                        </div>

                        {/* Multi-occurrence count */}
                        {draft.taskType === 'multi-occurrence' && (
                            <div className="editor-section">
                                <label className="editor-label">Times per week</label>
                                <div className="count-stepper">
                                    <button onClick={() => updateDraft({ targetCount: Math.max(2, draft.targetCount - 1) })}>−</button>
                                    <span>{draft.targetCount}</span>
                                    <button onClick={() => updateDraft({ targetCount: draft.targetCount + 1 })}>+</button>
                                </div>
                            </div>
                        )}

                        {/* Time goal */}
                        {draft.taskType === 'time-tracked' && (
                            <div className="editor-section">
                                <label className="editor-label">Minutes goal</label>
                                <div className="count-stepper">
                                    <button onClick={() => updateDraft({ minutesGoal: Math.max(15, draft.minutesGoal - 15) })}>−</button>
                                    <span>{draft.minutesGoal} min</span>
                                    <button onClick={() => updateDraft({ minutesGoal: draft.minutesGoal + 15 })}>+</button>
                                </div>
                            </div>
                        )}

                        {/* Name */}
                        <div className="editor-section">
                            <label className="editor-label">Name</label>
                            <input
                                type="text"
                                className="editor-input"
                                value={draft.name}
                                onChange={e => updateDraft({ name: e.target.value })}
                                placeholder="e.g., Clean kitchen"
                            />
                        </div>

                        {/* Notes */}
                        <div className="editor-section">
                            <label className="editor-label">Notes (optional)</label>
                            <textarea
                                className="editor-input editor-textarea"
                                value={draft.notes}
                                onChange={e => updateDraft({ notes: e.target.value })}
                                placeholder="Instructions, tips, or reminders for this routine..."
                                maxLength={1200}
                                rows={3}
                            />
                            <div className="char-count">{draft.notes.length}/1200</div>
                        </div>

                        {/* Cadence */}
                        <div className="editor-section">
                            <label className="editor-label">Frequency</label>
                            <div className="cadence-options">
                                {(['weekly', 'biweekly', 'monthly', 'annually'] as Cadence[]).map(c => (
                                    <button
                                        key={c}
                                        className={`cadence-btn ${draft.cadence === c ? 'active' : ''}`}
                                        onClick={() => updateDraft({ cadence: c })}
                                    >
                                        {c === 'biweekly' ? 'Every other week' : c}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Year-round / Seasonal selector (not for annual tasks) */}
                        {draft.cadence !== 'annually' && (
                            <div className="editor-section">
                                <label className="editor-label">Timeframe</label>
                                <div className="timeframe-options">
                                    <button
                                        className={`timeframe-btn ${draft.isYearRound ? 'active' : ''}`}
                                        onClick={() => updateDraft({ isYearRound: true })}
                                    >
                                        Year-round
                                    </button>
                                    <button
                                        className={`timeframe-btn ${!draft.isYearRound ? 'active' : ''}`}
                                        onClick={() => updateDraft({ isYearRound: false })}
                                    >
                                        Seasonal
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Start week for year-round routines (specific calendar week) */}
                        {draft.isYearRound && draft.cadence !== 'annually' && (
                            <div className="editor-section">
                                <CalendarWeekPicker
                                    label="Start week"
                                    weekKey={draft.anchorWeek}
                                    onWeekChange={w => updateDraft({ anchorWeek: w })}
                                />
                            </div>
                        )}

                        {/* Season pickers for non-year-round routines */}
                        {!draft.isYearRound && draft.cadence !== 'annually' && (
                            <div className="editor-section">
                                <div className="week-picker-row">
                                    <SeasonalWeekPicker
                                        label="Start"
                                        month={draft.startMonth}
                                        weekInMonth={draft.startWeekInMonth}
                                        onMonthChange={m => updateDraft({ startMonth: m })}
                                        onWeekChange={w => updateDraft({ startWeekInMonth: w })}
                                    />
                                    <SeasonalWeekPicker
                                        label="End"
                                        month={draft.endMonth}
                                        weekInMonth={draft.endWeekInMonth}
                                        onMonthChange={m => updateDraft({ endMonth: m })}
                                        onWeekChange={w => updateDraft({ endWeekInMonth: w })}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Annual: specific week picker - uses CalendarWeekPicker like other cadences */}
                        {draft.cadence === 'annually' && (
                            <div className="editor-section">
                                <CalendarWeekPicker
                                    label="Occurs in"
                                    weekKey={draft.anchorWeek}
                                    onWeekChange={w => updateDraft({ anchorWeek: w })}
                                />
                            </div>
                        )}

                        {/* Delete button - only show when editing existing routine */}
                        {editingRoutineId && (
                            <div className="editor-section delete-section">
                                <button
                                    className="delete-routine-btn"
                                    onClick={() => {
                                        const routine = routines.find(r => r.id === editingRoutineId);
                                        if (routine) {
                                            setDeleteConfirm({ routineId: routine.id, routineName: routine.title });
                                        }
                                    }}
                                >
                                    Delete Routine
                                </button>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};
