import React, { useState, useRef, useEffect } from 'react';
import dayjs from 'dayjs';
import type { WeekNote as WeekNoteType } from '../types';
import { useTaskStore } from '../store/store';

interface WeekNoteCardProps {
    note: WeekNoteType;
}

export const WeekNoteCard: React.FC<WeekNoteCardProps> = ({ note }) => {
    const updateWeekNote = useTaskStore((s) => s.updateWeekNote);
    const deleteWeekNote = useTaskStore((s) => s.deleteWeekNote);
    const updateCollectionItem = useTaskStore((s) => s.updateCollectionItem);
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(note.title);
    const [editDate, setEditDate] = useState(note.dateISO || '');
    const [editNotes, setEditNotes] = useState(note.notes || '');
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const titleRef = useRef<HTMLInputElement>(null);
    const cardRef = useRef<HTMLDivElement>(null);

    // Auto-resize textarea
    const adjustTextareaHeight = () => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    };

    // Sync state when note changes or editing starts
    useEffect(() => {
        if (!isEditing) {
            setEditTitle(note.title);
            setEditDate(note.dateISO || '');
            setEditNotes(note.notes || '');
        }
    }, [note, isEditing]);

    useEffect(() => {
        if (isEditing) {
            adjustTextareaHeight();
            // Focus title by default for full editing
            // titleRef.current?.focus(); 
            // Actually, if they clicked the card, maybe they wanted to edit notes?
            // But user asked to "modify title and date".
            // Let's focus title to be safe, or just render.
            titleRef.current?.focus();
        }
    }, [isEditing]);

    // Adjust textarea when notes change
    useEffect(() => {
        if (isEditing) adjustTextareaHeight();
    }, [editNotes, isEditing]);

    const handleSave = () => {
        const trimmedTitle = editTitle.trim();
        const trimmedDate = editDate || undefined;
        const trimmedNotes = editNotes.trim() || undefined;

        // Check if notes changed and this is a collection item
        if (note.collectionItemId && trimmedNotes !== note.notes) {
            if (window.confirm('This event is part of a calendar.\n\nClick OK to apply this note change to ALL events in the calendar.\nClick Cancel to save changes to THIS event only.')) {
                // Update the collection item (propagates to all week notes)
                updateCollectionItem(note.collectionItemId, { notes: trimmedNotes }, true);
                setIsEditing(false);
                return;
            }
        }

        updateWeekNote(note.id, {
            title: trimmedTitle,
            dateISO: trimmedDate,
            notes: trimmedNotes
        });
        setIsEditing(false);
    };

    const handleCancel = () => {
        setEditTitle(note.title);
        setEditDate(note.dateISO || '');
        setEditNotes(note.notes || '');
        setIsEditing(false);
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();

        const message = note.collectionItemId
            ? 'This event is part of a calendar. Delete this specific occurrence?'
            : 'Delete this event?';

        if (window.confirm(message)) {
            deleteWeekNote(note.id);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSave();
        } else if (e.key === 'Escape') {
            handleCancel();
        }
    };

    // Click outside to save
    useEffect(() => {
        if (!isEditing) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
                handleSave();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isEditing, editNotes]);

    const formattedDate = note.dateISO ? dayjs(note.dateISO).format('ddd, MMM D') : null;

    return (
        <div
            ref={cardRef}
            className={`week-note-card ${isEditing ? 'editing' : ''}`}
            onClick={() => !isEditing && setIsEditing(true)}
            style={{ position: 'relative' }} // For absolute positioning of delete button
        >
            <div className="week-note-content">
                {isEditing ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 'var(--spacing-sm)', width: '100%' }}>
                        <input
                            ref={titleRef}
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onKeyDown={handleKeyDown}
                            style={{
                                flex: 1,
                                minWidth: '120px',
                                background: 'transparent',
                                border: 'none',
                                outline: 'none',
                                fontSize: '0.85rem',
                                fontWeight: 500,
                                color: 'var(--text-secondary)',
                                padding: 0,
                                margin: 0,
                                fontFamily: 'inherit'
                            }}
                        />
                        <input
                            type="date"
                            value={editDate}
                            onChange={(e) => setEditDate(e.target.value)}
                            onKeyDown={handleKeyDown}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                outline: 'none',
                                fontSize: '0.75rem',
                                color: 'var(--text-muted)',
                                padding: 0,
                                margin: 0,
                                fontFamily: 'inherit',
                                width: 'auto'
                            }}
                        />
                    </div>

                ) : (
                    <>
                        <span className="week-note-title">{note.title}</span>
                        {formattedDate && <span className="week-note-date">{formattedDate}</span>}
                    </>
                )}

                {isEditing ? (
                    <textarea
                        ref={textareaRef}
                        className="week-note-editor"
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)} // Remove adjustTextareaHeight here call, relies on useEffect
                        onKeyDown={handleKeyDown}
                        placeholder="Add notes..."
                        rows={1}
                    />
                ) : note.notes ? (
                    <div className="week-note-notes">{note.notes}</div>
                ) : null}
            </div>

            {
                isEditing && (
                    <button
                        onClick={handleDelete}
                        type="button"
                        style={{
                            position: 'absolute',
                            bottom: '2px', // Slight offset from bottom edge
                            right: '0',
                            cursor: 'pointer',
                            color: 'var(--text-muted)',
                            background: 'transparent',
                            border: 'none',
                            padding: '4px',
                            opacity: 0.5,
                            transition: 'opacity 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 10
                        }}
                        title="Delete event"
                        onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                        onMouseLeave={e => e.currentTarget.style.opacity = '0.5'}
                    >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                )
            }
        </div >
    );
};
