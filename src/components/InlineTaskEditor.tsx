import React, { useState, useRef, useEffect } from 'react';
import type { WeekKey } from '../types';
import { useTaskStore } from '../store/store';

interface InlineTaskEditorProps {
    week: WeekKey;
    orderIndex: number;
    onComplete: () => void;
    onCancel: () => void;
}

export const InlineTaskEditor: React.FC<InlineTaskEditorProps> = ({
    week,
    orderIndex,
    onComplete,
    onCancel,
}) => {
    const { addItem } = useTaskStore();
    const [title, setTitle] = useState('');
    const [showOptions, setShowOptions] = useState(false);
    const [minutesGoal, setMinutesGoal] = useState<number | undefined>(undefined);
    const [targetCount, setTargetCount] = useState<number | undefined>(undefined);
    const [dueDateISO, setDueDateISO] = useState<string | undefined>(undefined);
    const inputRef = useRef<HTMLInputElement>(null);
    const cardRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // Click outside to cancel
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
                onCancel();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onCancel]);

    const handleSubmit = () => {
        if (!title.trim()) {
            onCancel();
            return;
        }

        addItem(title.trim(), week, orderIndex, {
            minutesGoal,
            targetCount,
            dueDateISO,
        });
        onComplete();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        } else if (e.key === 'Escape') {
            onCancel();
        }
    };

    return (
        <div className="task-card editing" ref={cardRef}>
            {/* Drag handle placeholder for alignment */}
            <div className="drag-handle" style={{ visibility: 'hidden' }}>
                <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                    <circle cx="9" cy="6" r="1.5" />
                    <circle cx="15" cy="6" r="1.5" />
                    <circle cx="9" cy="12" r="1.5" />
                    <circle cx="15" cy="12" r="1.5" />
                    <circle cx="9" cy="18" r="1.5" />
                    <circle cx="15" cy="18" r="1.5" />
                </svg>
            </div>

            {/* Content area - no indicator, just the input */}
            <div className="task-content">
                <input
                    ref={inputRef}
                    type="text"
                    className="editor-title-input"
                    placeholder="Task name..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onKeyDown={handleKeyDown}
                />

                {/* Options row - same style as task-meta */}
                {showOptions && (
                    <div className="inline-editor-options">
                        <div className="editor-option">
                            <label>⏱️</label>
                            <input
                                type="number"
                                placeholder="min"
                                min="0"
                                value={minutesGoal ?? ''}
                                onChange={(e) => setMinutesGoal(e.target.value ? parseInt(e.target.value) : undefined)}
                            />
                        </div>
                        <div className="editor-option">
                            <label>🔁</label>
                            <input
                                type="number"
                                placeholder="×"
                                min="1"
                                value={targetCount ?? ''}
                                onChange={(e) => setTargetCount(e.target.value ? parseInt(e.target.value) : undefined)}
                            />
                        </div>
                        <div className="editor-option">
                            <label>📅</label>
                            <input
                                type="date"
                                value={dueDateISO ?? ''}
                                onChange={(e) => setDueDateISO(e.target.value || undefined)}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Right side actions - mimics task actions area */}
            <div className="task-actions">
                <button
                    className="editor-options-toggle"
                    onClick={() => setShowOptions(!showOptions)}
                    type="button"
                    aria-label="Toggle options"
                >
                    ⋯
                </button>
            </div>
        </div>
    );
};
