import React, { useState, useMemo } from 'react';
import dayjs from 'dayjs';
import { useTaskStore } from '../store/store';
import type { CollectionItem, DateDefinition, WeekKey } from '../types';
import { getWeekKey, getFirstDayOfWeek } from '../utils/timeUtils';

interface CollectionsPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const shortWeekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ordinals = [
    { value: 1, label: '1st' },
    { value: 2, label: '2nd' },
    { value: 3, label: '3rd' },
    { value: 4, label: '4th' },
    { value: 'last', label: 'Last' },
];

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

interface DraftCollectionItem {
    title: string;
    cadence: 'weekly' | 'biweekly' | 'monthly' | 'annually';
    // For weekly/biweekly
    dayOfWeek: number;
    anchorWeek: WeekKey;
    // For monthly/annually
    dateType: 'fixed' | 'relative';
    month: number;
    day?: number;
    weekday: number;
    ordinal: number | 'last';
    // Bounds
    isYearRound: boolean;
    recurAnnually: boolean; // New UI state to support one-time seasonal items
    startYear: number;
    endYear?: number;
    startMonth: number;
    startWeekInMonth: number;
    endMonth: number;
    endWeekInMonth: number;
    // Notes
    notes: string;
}

const getDefaultDraft = (currentTime: string): DraftCollectionItem => ({
    title: '',
    cadence: 'annually',
    dayOfWeek: 1, // Monday
    anchorWeek: getWeekKey(currentTime),
    dateType: 'fixed',
    month: dayjs(currentTime).month() + 1,
    day: 1,
    weekday: 0,
    ordinal: 1,
    isYearRound: true,
    recurAnnually: true,
    startYear: dayjs(currentTime).year(),
    // endYear: dayjs(currentTime).year() + 5, // Remove default end year
    startMonth: 1,
    startWeekInMonth: 1,
    endMonth: 12,
    endWeekInMonth: 5,
    notes: '',
});

export const CollectionsPanel: React.FC<CollectionsPanelProps> = ({ isOpen: _isOpen, onClose: _onClose }) => {
    // Select raw arrays from store (stable references)
    const allCollections = useTaskStore((s) => s.collections);
    const collectionItems = useTaskStore((s) => s.collectionItems);
    const weekNotes = useTaskStore((s) => s.weekNotes);
    const currentTime = useTaskStore((s) => s.currentTime);
    const addCollection = useTaskStore((s) => s.addCollection);
    const updateCollection = useTaskStore((s) => s.updateCollection);
    const deleteCollection = useTaskStore((s) => s.deleteCollection);
    const addCollectionItem = useTaskStore((s) => s.addCollectionItem);
    const updateCollectionItem = useTaskStore((s) => s.updateCollectionItem);
    const deleteCollectionItem = useTaskStore((s) => s.deleteCollectionItem);

    // View states: 'list' | 'collection' | 'item-form'
    const [view, setView] = useState<'list' | 'collection' | 'item-form'>('list');
    const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [newCollectionName, setNewCollectionName] = useState('');
    const [showNewCollectionInput, setShowNewCollectionInput] = useState(false);
    const [draft, setDraft] = useState<DraftCollectionItem>(getDefaultDraft(dayjs().toISOString()));
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editTitleName, setEditTitleName] = useState('');
    const [confirmDelete, setConfirmDelete] = useState<{ type: 'collection' | 'item'; id: string } | null>(null);
    const [notesOverwriteConfirm, setNotesOverwriteConfirm] = useState<{
        itemId: string;
        itemData: { title: string; dateDefinition: DateDefinition; notes?: string };
        modifiedCount: number;
    } | null>(null);

    // Filter out deleted collections using useMemo
    const collections = useMemo(
        () => allCollections.filter((c) => !c.deletedAt),
        [allCollections]
    );

    const selectedCollection = useMemo(
        () => collections.find((c) => c.id === selectedCollectionId) || null,
        [collections, selectedCollectionId]
    );

    const selectedCollectionItems = useMemo(
        () => collectionItems.filter((i) => i.collectionId === selectedCollectionId && !i.deletedAt),
        [collectionItems, selectedCollectionId]
    );

    const handleCreateCollection = () => {
        if (!newCollectionName.trim()) return;
        addCollection(newCollectionName.trim());
        setNewCollectionName('');
        setShowNewCollectionInput(false);
    };

    const handleOpenCollection = (id: string) => {
        setSelectedCollectionId(id);
        setView('collection');
    };

    const handleBack = () => {
        if (view === 'item-form') {
            setView('collection');
            setEditingItemId(null);
            setDraft(getDefaultDraft(currentTime));
        } else if (view === 'collection') {
            setView('list');
            setSelectedCollectionId(null);
        }
    };

    const handleNewItem = () => {
        setDraft(getDefaultDraft(currentTime));
        setEditingItemId(null);
        setView('item-form');
    };

    const handleEditItem = (item: CollectionItem) => {
        const def = item.dateDefinition;

        // Default values for fields that might not exist on old items
        setDraft({
            title: item.title,
            cadence: item.cadence || 'annually', // items from before migration
            dayOfWeek: item.dayOfWeek ?? 1,
            anchorWeek: item.anchorWeek || getWeekKey(currentTime),
            // Monthly/Annually fields
            dateType: def?.type || 'fixed',
            month: def?.month || 1,
            day: (def?.type === 'fixed' && def.day) ? def.day : 1,
            weekday: (def?.type === 'relative' ? def.weekday : 0),
            ordinal: (def?.type === 'relative' ? def.ordinal : 1),
            // Bounds
            isYearRound: item.isYearRound ?? true,
            recurAnnually: !item.startYear, // If startYear exists for non-annual, it's NOT recurring annually (one-time)
            startYear: item.startYear || dayjs(currentTime).year(),
            endYear: item.endYear ?? dayjs(currentTime).year(), // Default end year to same as start if missing
            startMonth: item.startMonth ?? 1,
            startWeekInMonth: item.startWeekInMonth ?? 1,
            endMonth: item.endMonth ?? 12,
            endWeekInMonth: item.endWeekInMonth ?? 5,
            notes: item.notes || '',
        });
        setEditingItemId(item.id);
        setView('item-form');
    };

    const handleSaveItem = () => {
        if (!draft.title.trim() || !selectedCollectionId) return;

        // Construct DateDefinition only if needed (monthly/annually)
        let dateDefinition: DateDefinition | undefined;
        if (draft.cadence === 'monthly' || draft.cadence === 'annually') {
            dateDefinition = draft.dateType === 'fixed'
                ? { type: 'fixed', month: draft.month, day: draft.day || 1 }
                : { type: 'relative', month: draft.month, weekday: draft.weekday, ordinal: draft.ordinal };
        }

        const itemData: any = {
            title: draft.title.trim(),
            cadence: draft.cadence,
            isYearRound: draft.isYearRound,
            notes: draft.notes || undefined,
        };

        // Add conditional fields
        if (draft.cadence === 'weekly' || draft.cadence === 'biweekly') {
            itemData.dayOfWeek = draft.dayOfWeek;
            itemData.anchorWeek = draft.anchorWeek;
        }

        if (draft.cadence === 'monthly' || draft.cadence === 'annually') {
            itemData.dateDefinition = dateDefinition;
        }

        if (draft.cadence === 'annually') {
            itemData.startYear = draft.startYear;
            itemData.endYear = draft.endYear;
        } else {
            // For Monthly items, startMonth acts as an anchor/start point even if "Year Round"
            if (draft.cadence === 'monthly') {
                itemData.startMonth = draft.startMonth;
                itemData.startWeekInMonth = 1;
                itemData.startYear = draft.startYear;
            }

            if (!draft.isYearRound) {
                // Seasonal bounds
                itemData.startMonth = draft.startMonth;

                // For monthly, we don't pick weeks, so default to full month coverage
                if (draft.cadence === 'monthly') {
                    itemData.startWeekInMonth = 1;
                    itemData.endWeekInMonth = 5; // Cover until end
                } else {
                    itemData.startWeekInMonth = draft.startWeekInMonth;
                    itemData.endWeekInMonth = draft.endWeekInMonth;
                }

                itemData.endMonth = draft.endMonth;

                // Allow one-time seasonal items
                if (!draft.recurAnnually) {
                    itemData.startYear = draft.startYear;
                    itemData.endYear = draft.endYear;
                } else {
                    // Ensure undefined so logic sees it as recurring
                    itemData.startYear = undefined;
                    itemData.endYear = undefined;
                }
            }

        }

        if (editingItemId) {
            // Check if notes changed and if any WeekNotes have modified notes
            const existingItem = collectionItems.find((i) => i.id === editingItemId);
            const notesChanged = (itemData.notes || '') !== (existingItem?.notes || '');

            if (notesChanged) {
                // Count WeekNotes with manually modified notes
                const relatedNotes = weekNotes.filter(
                    (note) => note.collectionItemId === editingItemId && !note.deletedAt
                );
                const modifiedCount = relatedNotes.filter(
                    (note) => note.notes !== note.inheritedNotes &&
                        !(note.notes === undefined && note.inheritedNotes === undefined)
                ).length;

                if (modifiedCount > 0) {
                    // Show confirmation dialog
                    setNotesOverwriteConfirm({
                        itemId: editingItemId,
                        itemData,
                        modifiedCount,
                    });
                    return;
                }
            }

            updateCollectionItem(editingItemId, itemData);
        } else {
            addCollectionItem(selectedCollectionId, itemData);
        }
        handleBack();
    };

    const handleNotesOverwriteConfirm = (overwrite: boolean) => {
        if (!notesOverwriteConfirm) return;

        const { itemId, itemData } = notesOverwriteConfirm;
        updateCollectionItem(itemId, itemData, overwrite);

        setNotesOverwriteConfirm(null);
        setEditingItemId(null);
        setDraft(getDefaultDraft(currentTime));
        setView('collection');
    };

    const updateDraft = (updates: Partial<DraftCollectionItem>) => {
        setDraft((prev) => ({ ...prev, ...updates }));
    };

    const handleDeleteConfirm = () => {
        if (!confirmDelete) return;
        if (confirmDelete.type === 'collection') {
            deleteCollection(confirmDelete.id);
            setView('list');
            setSelectedCollectionId(null);
        } else {
            deleteCollectionItem(confirmDelete.id);
            setView('collection');
            setEditingItemId(null);
            setDraft(getDefaultDraft(currentTime));
        }
        setConfirmDelete(null);
    };

    const formatItemRecurrence = (item: CollectionItem): string => {
        if (item.cadence === 'weekly') {
            return `Weekly on ${item.dayOfWeek !== undefined ? weekdays[item.dayOfWeek] : '?'}`;
        }
        if (item.cadence === 'biweekly') {
            return `Biweekly on ${item.dayOfWeek !== undefined ? weekdays[item.dayOfWeek] : '?'}`;
        }

        // Monthly / Annually
        const def = item.dateDefinition;
        if (!def) return item.cadence === 'annually' ? 'Annually' : 'Monthly';

        let dateStr = '';
        if (def.type === 'fixed') {
            dateStr = item.cadence === 'annually'
                ? `${months[def.month - 1]} ${def.day}`
                : `Day ${def.day}`;
        } else {
            const ordLabel = ordinals.find((o) => o.value === def.ordinal)?.label || '';
            dateStr = `${ordLabel} ${weekdays[def.weekday]}`;
            if (item.cadence === 'annually') dateStr += ` of ${months[def.month - 1]}`;
        }

        return dateStr;
    };

    // Helper to calculate WeekInMonth (copied from spawner/logic to ensure potential synchronization)
    const getWeekInMonth = (date: dayjs.Dayjs): number => {
        const firstOfMonth = date.startOf('month');
        const firstSunday = firstOfMonth.day() === 0
            ? firstOfMonth
            : firstOfMonth.add(7 - firstOfMonth.day(), 'day');

        if (date.isBefore(firstSunday)) {
            return 1;
        }

        const weekNum = Math.floor(date.diff(firstSunday, 'day') / 7) + (firstOfMonth.day() === 0 ? 1 : 2);
        return weekNum;
    };

    // Helper to reconstruct a WeekKey from stored seasonal bounds
    const getWeekKeyFromSeasonal = (year: number, month: number, weekInMonth: number): string => {
        // Find the Sunday that corresponds to this Month+WeekInMonth
        const firstOfMonth = dayjs().year(year).month(month - 1).startOf('month');
        // Logic must match getWeekInMonth reverse
        // Actually, let's reverse the "getWeekInMonth" logic:
        // Find first Sunday of month:
        const firstSunday = firstOfMonth.day() === 0
            ? firstOfMonth
            : firstOfMonth.add(7 - firstOfMonth.day(), 'day');

        let targetSunday;
        if (weekInMonth === 1 && firstOfMonth.day() !== 0) {
            // If first day is not sunday, Week 1 starts before the 1st sunday?
            // Week 1 is the partial week at start. 
            // If 1st is Tuesday, Week 1 is that week (Starting prev Sunday).
            targetSunday = firstOfMonth.day(0); // This goes to prev Sunday
        } else {
            // If weekInMonth is 2, it's the week starting "First Sunday"
            // If weekInMonth is 1 and 1st IS Sunday, it is First Sunday.
            const weeksToAdd = (firstOfMonth.day() === 0) ? (weekInMonth - 1) : (weekInMonth - 2);
            targetSunday = firstSunday.add(weeksToAdd, 'week');
        }

        return getWeekKey(targetSunday.toISOString());
    };

    // ==================== Render ====================

    // ... (rest of render logic)


    // Notes Overwrite Confirmation Dialog
    if (notesOverwriteConfirm) {
        return (
            <div className="side-panel-container">
                <div className="panel-header">
                    <h2>Update Notes</h2>
                </div>
                <div className="panel-content">
                    <div className="delete-confirm-content" style={{ textAlign: 'center', padding: 'var(--spacing-lg)' }}>
                        <p style={{ marginBottom: 'var(--spacing-lg)', color: 'var(--text-secondary)' }}>
                            {notesOverwriteConfirm.modifiedCount} date{notesOverwriteConfirm.modifiedCount > 1 ? 's have' : ' has'} custom notes that will be overwritten.
                        </p>
                        <div className="delete-confirm-actions notes-overwrite-actions" style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'center', flexDirection: 'column' }}>
                            <button className="btn-delete-remove" onClick={() => handleNotesOverwriteConfirm(true)} style={{ background: 'var(--status-overdue)', color: 'white', padding: '8px 16px', borderRadius: 'var(--radius-sm)' }}>
                                Overwrite All
                            </button>
                            <button className="btn-delete-keep" onClick={() => handleNotesOverwriteConfirm(false)} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', padding: '8px 16px', borderRadius: 'var(--radius-sm)' }}>
                                Keep Custom Notes
                            </button>
                        </div>
                        <button className="btn-cancel-link" onClick={() => setNotesOverwriteConfirm(null)} style={{ marginTop: 'var(--spacing-md)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Confirmation Dialog


    // Item Form View
    if (view === 'item-form') {
        const isWeeklyOrBiweekly = draft.cadence === 'weekly' || draft.cadence === 'biweekly';
        const isMonthlyOrAnnually = draft.cadence === 'monthly' || draft.cadence === 'annually';

        return (
            <div className="side-panel-container">
                <div className="panel-header">
                    <button className="back-btn" onClick={handleBack}>← Back</button>
                    <button className="save-btn" onClick={handleSaveItem} disabled={!draft.title.trim()}>Save</button>
                </div>

                <div className="panel-content">
                    {/* Title */}
                    <div className="editor-section">
                        <label className="editor-label">Title</label>
                        <input
                            type="text"
                            className="editor-input"
                            value={draft.title}
                            onChange={(e) => updateDraft({ title: e.target.value })}
                            placeholder="e.g., Team Sync, Rent Due"
                            autoFocus
                        />
                    </div>

                    {/* Cadence Selection */}
                    <div className="editor-section">
                        <label className="editor-label">Frequency</label>
                        <div className="timeframe-options" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-sm)' }}>
                            {['weekly', 'biweekly', 'monthly', 'annually'].map((c) => {
                                const labels: Record<string, string> = {
                                    weekly: 'Weekly',
                                    biweekly: 'Biweekly',
                                    monthly: 'Monthly',
                                    annually: 'Annually'
                                };
                                return (
                                    <button
                                        key={c}
                                        className={`timeframe-btn ${draft.cadence === c ? 'active' : ''}`}
                                        onClick={() => updateDraft({ cadence: c as any })}
                                    >
                                        {labels[c]}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Weekly/Biweekly Settings */}
                    {isWeeklyOrBiweekly && (
                        <div className="editor-section">
                            <label className="editor-label">Day of Week</label>
                            <div className="timeframe-options">
                                {shortWeekdays.map((day, idx) => (
                                    <button
                                        key={day}
                                        className={`timeframe-btn ${draft.dayOfWeek === idx ? 'active' : ''}`}
                                        onClick={() => updateDraft({ dayOfWeek: idx })}
                                    >
                                        {day}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Anchor Week for Biweekly - REMOVED per user request (handled by timeframe bounds) */}

                    {/* Monthly/Annually Date Logic */}
                    {isMonthlyOrAnnually && (
                        <>
                            <div className="editor-section">
                                <label className="editor-label">Date Type</label>
                                <div className="timeframe-options">
                                    <button
                                        className={`timeframe-btn ${draft.dateType === 'fixed' ? 'active' : ''}`}
                                        onClick={() => updateDraft({ dateType: 'fixed' })}
                                    >
                                        Fixed Date
                                    </button>
                                    <button
                                        className={`timeframe-btn ${draft.dateType === 'relative' ? 'active' : ''}`}
                                        onClick={() => updateDraft({ dateType: 'relative' })}
                                    >
                                        Relative Date
                                    </button>
                                </div>
                            </div>

                            {draft.cadence === 'annually' && (
                                <div className="editor-section">
                                    <label className="editor-label">Month</label>
                                    <select
                                        className="editor-input"
                                        value={draft.month}
                                        onChange={(e) => updateDraft({ month: parseInt(e.target.value, 10) })}
                                    >
                                        {months.map((m, i) => (
                                            <option key={m} value={i + 1}>{m}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {draft.dateType === 'fixed' ? (
                                <div className="editor-section">
                                    <label className="editor-label">Day of Month</label>
                                    <input
                                        type="number"
                                        className="editor-input"
                                        min={1}
                                        max={31}
                                        value={draft.day ?? ''}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value, 10);
                                            updateDraft({ day: isNaN(val) ? undefined : val });
                                        }}
                                    />
                                </div>
                            ) : (
                                <>
                                    <div className="editor-section">
                                        <label className="editor-label">Occurrence</label>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                            <select
                                                className="editor-input"
                                                value={String(draft.ordinal)}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    updateDraft({ ordinal: val === 'last' ? 'last' : parseInt(val, 10) });
                                                }}
                                            >
                                                {ordinals.map((o) => (
                                                    <option key={o.label} value={String(o.value)}>{o.label}</option>
                                                ))}
                                            </select>
                                            <select
                                                className="editor-input"
                                                value={draft.weekday}
                                                onChange={(e) => updateDraft({ weekday: parseInt(e.target.value, 10) })}
                                            >
                                                {weekdays.map((w, i) => (
                                                    <option key={w} value={i}>{w}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </>
                            )}
                        </>
                    )}


                    {/* Bounds / Seasonality */}
                    <div className="editor-section" style={{ borderTop: '1px solid var(--border-light)', paddingTop: '16px', marginTop: '16px' }}>


                        {draft.cadence === 'annually' ? (
                            // Annual: Start/End Years (End Optional)
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label className="editor-label" style={{ fontSize: '0.8rem' }}>Start Year</label>
                                    <input
                                        type="number"
                                        className="editor-input"
                                        value={draft.startYear}
                                        onChange={(e) => updateDraft({ startYear: parseInt(e.target.value, 10) })}
                                    />
                                </div>
                                <div>
                                    <label className="editor-label" style={{ fontSize: '0.8rem' }}>End Year</label>
                                    <input
                                        type="number"
                                        className="editor-input"
                                        value={draft.endYear || ''} // Handle undefined
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            updateDraft({ endYear: val ? parseInt(val, 10) : undefined });
                                        }}
                                        placeholder="Forever"
                                    />
                                </div>
                            </div>
                        ) : (
                            <>
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

                                {draft.isYearRound ? (
                                    <div className="editor-section">
                                        {draft.cadence === 'monthly' ? (
                                            // Monthly Year-Round: Just Start Month selector
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                <label className="editor-label" style={{ fontSize: '0.8rem' }}>Start Month</label>
                                                <select
                                                    className="editor-input"
                                                    value={draft.startMonth}
                                                    onChange={(e) => updateDraft({ startMonth: parseInt(e.target.value, 10) })}
                                                >
                                                    {months.map((m, i) => (
                                                        <option key={m} value={i + 1}>{m}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        ) : (
                                            <CalendarWeekPicker
                                                label="Start week"
                                                weekKey={draft.anchorWeek}
                                                onWeekChange={w => updateDraft({ anchorWeek: w })}
                                            />
                                        )}
                                    </div>
                                ) : (
                                    <div className="editor-section">
                                        <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <input
                                                type="checkbox"
                                                id="recurAnnually"
                                                checked={draft.recurAnnually}
                                                onChange={(e) => updateDraft({ recurAnnually: e.target.checked })}
                                                style={{ width: '16px', height: '16px' }}
                                            />
                                            <label htmlFor="recurAnnually" style={{ fontSize: '0.9rem', userSelect: 'none' }}>Recur every year</label>
                                        </div>

                                        {draft.recurAnnually ? (
                                            <div className="week-picker-row">
                                                {draft.cadence === 'monthly' ? (
                                                    // Monthly Seasonal (Recurring): Start Month / End Month selectors
                                                    <>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                                                            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Start Month</label>
                                                            <select
                                                                className="editor-input"
                                                                value={draft.startMonth}
                                                                onChange={(e) => updateDraft({ startMonth: parseInt(e.target.value, 10) })}
                                                            >
                                                                {months.map((m, i) => (
                                                                    <option key={m} value={i + 1}>{m}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                                                            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>End Month</label>
                                                            <select
                                                                className="editor-input"
                                                                value={draft.endMonth}
                                                                onChange={(e) => updateDraft({ endMonth: parseInt(e.target.value, 10) })}
                                                            >
                                                                {months.map((m, i) => (
                                                                    <option key={m} value={i + 1}>{m}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
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
                                                    </>
                                                )}
                                            </div>
                                        ) : (
                                            // One-time seasonal
                                            draft.cadence === 'monthly' ? (
                                                // Monthly One-Time: Start Month/Year / End Month/Year
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                        <label className="editor-label" style={{ fontSize: '0.8rem' }}>Start</label>
                                                        <select
                                                            className="editor-input"
                                                            value={draft.startMonth}
                                                            onChange={(e) => updateDraft({ startMonth: parseInt(e.target.value, 10) })}
                                                        >
                                                            {months.map((m, i) => (
                                                                <option key={m} value={i + 1}>{m}</option>
                                                            ))}
                                                        </select>
                                                        <input
                                                            type="number"
                                                            className="editor-input"
                                                            placeholder="Year"
                                                            value={draft.startYear}
                                                            onChange={(e) => updateDraft({ startYear: parseInt(e.target.value, 10) })}
                                                        />
                                                    </div>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                        <label className="editor-label" style={{ fontSize: '0.8rem' }}>End</label>
                                                        <select
                                                            className="editor-input"
                                                            value={draft.endMonth}
                                                            onChange={(e) => updateDraft({ endMonth: parseInt(e.target.value, 10) })}
                                                        >
                                                            {months.map((m, i) => (
                                                                <option key={m} value={i + 1}>{m}</option>
                                                            ))}
                                                        </select>
                                                        <input
                                                            type="number"
                                                            className="editor-input"
                                                            placeholder="Year"
                                                            value={draft.endYear}
                                                            onChange={(e) => updateDraft({ endYear: parseInt(e.target.value, 10) })}
                                                        />
                                                    </div>
                                                </div>
                                            ) : (
                                                // Weekly/Biweekly One-time: Use Calendar Pickers
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                                                    <CalendarWeekPicker
                                                        label="Start Week"
                                                        weekKey={getWeekKeyFromSeasonal(draft.startYear, draft.startMonth, draft.startWeekInMonth)}
                                                        onWeekChange={(wKey) => {
                                                            const d = dayjs(getFirstDayOfWeek(wKey));
                                                            updateDraft({
                                                                startYear: d.year(),
                                                                startMonth: d.month() + 1,
                                                                startWeekInMonth: getWeekInMonth(d)
                                                            });
                                                        }}
                                                    />
                                                    <CalendarWeekPicker
                                                        label="End Week"
                                                        weekKey={getWeekKeyFromSeasonal(draft.endYear || dayjs().year(), draft.endMonth, draft.endWeekInMonth)}
                                                        onWeekChange={(wKey) => {
                                                            const d = dayjs(getFirstDayOfWeek(wKey));
                                                            updateDraft({
                                                                endYear: d.year(),
                                                                endMonth: d.month() + 1,
                                                                endWeekInMonth: getWeekInMonth(d)
                                                            });
                                                        }}
                                                    />
                                                </div>
                                            )
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Notes */}
                    <div className="editor-section">
                        <label className="editor-label">Notes (optional)</label>
                        <textarea
                            className="editor-input editor-textarea"
                            value={draft.notes}
                            onChange={(e) => updateDraft({ notes: e.target.value })}
                            placeholder="Notes that will appear on spawned week notes..."
                            rows={3}
                        />
                    </div>

                    {editingItemId && (
                        <div className="editor-section delete-section" style={{ marginTop: '32px', borderTop: '1px solid var(--border-light)', paddingTop: '24px' }}>
                            <button
                                className="delete-routine-btn"
                                onClick={() => setConfirmDelete({ type: 'item', id: editingItemId })}
                            >
                                Delete Item
                            </button>
                        </div>
                    )}
                    {confirmDelete && (
                        <div className="delete-confirm-dialog">
                            <div className="delete-confirm-content">
                                <h3>
                                    {confirmDelete.type === 'collection' ? 'Delete Calendar' : 'Delete Item'}
                                </h3>
                                <p className="delete-confirm-subtitle" style={{ marginBottom: '16px' }}>
                                    {confirmDelete.type === 'collection'
                                        ? 'Delete this calendar and all its items? This will also remove associated week notes.'
                                        : `Delete "${collectionItems.find(i => i.id === confirmDelete.id)?.title}"? Associated week notes will also be removed.`}
                                </p>
                                <div className="delete-confirm-actions">
                                    <button className="btn-delete-remove" onClick={() => handleDeleteConfirm()}>
                                        Delete
                                    </button>
                                    <button className="btn-cancel-link" onClick={() => setConfirmDelete(null)}>
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div >
        );
    }

    // Collection Detail View
    if (view === 'collection' && selectedCollection) {
        return (
            <div className="side-panel-container">
                <div className="panel-header">
                    <button className="back-btn" onClick={handleBack}>← Back</button>
                </div>

                <div className="panel-content">
                    {isEditingTitle ? (
                        <input
                            type="text"
                            value={editTitleName}
                            onChange={(e) => setEditTitleName(e.target.value)}
                            onBlur={() => {
                                if (editTitleName.trim() && selectedCollection) {
                                    updateCollection(selectedCollection.id, { name: editTitleName.trim() });
                                }
                                setIsEditingTitle(false);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    if (editTitleName.trim() && selectedCollection) {
                                        updateCollection(selectedCollection.id, { name: editTitleName.trim() });
                                    }
                                    setIsEditingTitle(false);
                                }
                                if (e.key === 'Escape') {
                                    setEditTitleName(selectedCollection?.name || '');
                                    setIsEditingTitle(false);
                                }
                            }}
                            autoFocus
                            style={{
                                marginBottom: 'var(--spacing-md)',
                                fontSize: '1.125rem',
                                fontWeight: 600,
                                background: 'transparent',
                                border: 'none',
                                borderBottom: '1px solid var(--accent-primary)',
                                outline: 'none',
                                width: '100%',
                                padding: 0,
                                color: 'var(--text-primary)',
                                fontFamily: 'inherit'
                            }}
                        />
                    ) : (
                        <h2
                            style={{ marginBottom: 'var(--spacing-md)', fontSize: '1.125rem', fontWeight: 600, cursor: 'pointer' }}
                            onClick={() => {
                                setEditTitleName(selectedCollection.name);
                                setIsEditingTitle(true);
                            }}
                            title="Click to rename"
                        >
                            {selectedCollection.name}
                        </h2>
                    )}

                    {selectedCollectionItems.length === 0 ? (
                        <div className="panel-empty-state">No dates in this calendar yet.</div>
                    ) : (
                        selectedCollectionItems.map((item) => (
                            <button
                                key={item.id}
                                className={`side-panel-card routine-card ${item.cadence}`}
                                onClick={() => handleEditItem(item)}
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
                                    <div className="task-title" style={{ fontSize: '0.95rem', fontWeight: 600 }}>{item.title}</div>
                                    <div className="task-meta">
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            {formatItemRecurrence(item)}
                                        </span>
                                    </div>
                                </div>
                                <span style={{ color: 'var(--text-muted)', fontSize: '1.2rem', marginLeft: 'auto' }}>›</span>
                            </button>
                        ))
                    )}

                    <button className="add-routine-btn" onClick={handleNewItem}>
                        + Add Date
                    </button>

                    <div className="editor-section delete-section" style={{ marginTop: 'auto', paddingTop: 'var(--spacing-lg)' }}>
                        <button
                            className="delete-routine-btn"
                            onClick={() => setConfirmDelete({ type: 'collection', id: selectedCollection.id })}
                        >
                            Delete Calendar
                        </button>
                    </div>
                    {confirmDelete && (
                        <div className="delete-confirm-dialog">
                            <div className="delete-confirm-content">
                                <h3>
                                    {confirmDelete.type === 'collection' ? 'Delete Calendar' : 'Delete Item'}
                                </h3>
                                <p className="delete-confirm-subtitle" style={{ marginBottom: '16px' }}>
                                    {confirmDelete.type === 'collection'
                                        ? 'Delete this calendar and all its items? This will also remove associated week notes.'
                                        : `Delete "${collectionItems.find(i => i.id === confirmDelete.id)?.title}"? Associated week notes will also be removed.`}
                                </p>
                                <div className="delete-confirm-actions">
                                    <button className="btn-delete-remove" onClick={() => handleDeleteConfirm()}>
                                        Delete
                                    </button>
                                    <button className="btn-cancel-link" onClick={() => setConfirmDelete(null)}>
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Collection List View (Default)
    return (
        <div className="side-panel-container">
            <div className="panel-header">
                <h2>Calendars</h2>
            </div>

            <div className="panel-content">
                {collections.length === 0 && !showNewCollectionInput ? (
                    <div className="panel-empty-state">No calendars yet</div>
                ) : (
                    <>
                        {collections.map((col) => (
                            <button
                                key={col.id}
                                className="side-panel-card routine-card"
                                onClick={() => handleOpenCollection(col.id)}
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
                                    <div className="task-title" style={{ fontSize: '0.95rem', fontWeight: 600 }}>{col.name}</div>
                                    <div className="task-meta">
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            {collectionItems.filter((i) => i.collectionId === col.id && !i.deletedAt).length} dates
                                        </span>
                                    </div>
                                </div>
                                <span style={{ color: 'var(--text-muted)', fontSize: '1.2rem', marginLeft: 'auto' }}>›</span>
                            </button>
                        ))}

                        {showNewCollectionInput && (
                            <div
                                className="side-panel-card routine-card"
                                style={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: 'var(--spacing-sm) var(--spacing-md)',
                                    margin: 0,
                                    gap: 'var(--spacing-md)',
                                    cursor: 'text'
                                }}
                            >
                                <div className="task-content" style={{ flex: 1 }}>
                                    <div className="task-title" style={{ fontSize: '0.95rem', fontWeight: 600 }}>
                                        <input
                                            type="text"
                                            className="editor-input"
                                            style={{ margin: 0, border: 'none', background: 'transparent', padding: 0, width: '100%', color: 'inherit', font: 'inherit', outline: 'none' }}
                                            value={newCollectionName}
                                            onChange={(e) => setNewCollectionName(e.target.value)}
                                            placeholder="Calendar name"
                                            autoFocus
                                            onBlur={() => {
                                                setShowNewCollectionInput(false);
                                                setNewCollectionName('');
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    handleCreateCollection();
                                                }
                                                if (e.key === 'Escape') {
                                                    setShowNewCollectionInput(false);
                                                    setNewCollectionName('');
                                                }
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {!showNewCollectionInput && (
                <button className="add-routine-btn" onClick={() => setShowNewCollectionInput(true)}>
                    + New Calendar
                </button>
            )}
        </div>
    );
};
