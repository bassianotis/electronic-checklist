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

export const RoutineManager: React.FC<RoutineManagerProps> = ({ isOpen, onClose }) => {
    const { getPresentWeek } = useTaskStore();
    const [isEditing, setIsEditing] = useState(false);

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
    };

    const [draft, setDraft] = useState<DraftRoutine>(defaultRoutine);

    // Mock routines for display
    const mockRoutines = [
        { id: '1', name: 'Sort office', cadence: 'biweekly' as Cadence, taskType: 'simple' as TaskType },
        { id: '2', name: 'Clean bedroom', cadence: 'biweekly' as Cadence, taskType: 'time-tracked' as TaskType },
        { id: '3', name: 'Water outdoor plants', cadence: 'weekly' as Cadence, taskType: 'multi-occurrence' as TaskType },
        { id: '4', name: 'Plan Christmas gifts', cadence: 'annually' as Cadence, taskType: 'simple' as TaskType },
    ];

    const handleNewRoutine = () => {
        setDraft(defaultRoutine);
        setIsEditing(true);
    };

    const handleEditRoutine = (routine: typeof mockRoutines[0]) => {
        setDraft({ ...defaultRoutine, name: routine.name, cadence: routine.cadence, taskType: routine.taskType });
        setIsEditing(true);
    };

    const handleSave = () => {
        // UX only - no actual save
        setIsEditing(false);
    };

    const handleBack = () => {
        setIsEditing(false);
    };

    const updateDraft = (updates: Partial<DraftRoutine>) => {
        setDraft(prev => ({ ...prev, ...updates }));
    };

    return (
        <>
            {/* Overlay */}
            <div
                className={`routine-manager-overlay ${isOpen ? 'open' : ''}`}
                onClick={onClose}
            />

            {/* Panel */}
            <div className={`routine-manager-panel ${isOpen ? 'open' : ''}`}>
                {!isEditing ? (
                    // Routine List View
                    <>
                        <div className="routine-panel-header">
                            <h2>Routines</h2>
                            <button className="panel-close-btn" onClick={onClose} aria-label="Close panel">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="9 18 15 12 9 6" />
                                </svg>
                            </button>
                        </div>

                        <div className="routine-list">
                            {mockRoutines.map(routine => (
                                <button
                                    key={routine.id}
                                    className="routine-list-item"
                                    onClick={() => handleEditRoutine(routine)}
                                >
                                    <span className="routine-name">{routine.name}</span>
                                    <span className={`routine-badge ${routine.cadence}`}>
                                        {routine.cadence}
                                    </span>
                                </button>
                            ))}
                        </div>

                        <button className="add-routine-btn" onClick={handleNewRoutine}>
                            + New Routine
                        </button>
                    </>
                ) : (
                    // Routine Editor View
                    <>
                        <div className="routine-panel-header">
                            <button className="back-btn" onClick={handleBack}>← Back</button>
                            <button className="save-btn" onClick={handleSave}>Save</button>
                        </div>

                        <div className="routine-editor">
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

                            {/* Annual: specific week picker */}
                            {draft.cadence === 'annually' && (
                                <div className="editor-section">
                                    <SeasonalWeekPicker
                                        label="Occurs in"
                                        month={draft.startMonth}
                                        weekInMonth={draft.startWeekInMonth}
                                        onMonthChange={m => updateDraft({ startMonth: m })}
                                        onWeekChange={w => updateDraft({ startWeekInMonth: w })}
                                    />
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </>
    );
};
