import React from 'react';

interface SideToolkitProps {
    activePanel: 'archive' | 'routines' | 'queue' | 'settings' | 'collections' | null;
    onToggle: (panel: 'archive' | 'routines' | 'queue' | 'settings' | 'collections') => void;
}

const CheckListIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
);

const RoutineIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
        <path d="M17 1l4 4-4 4" />
        <path d="M3 11V9a4 4 0 0 1 4-4h14" />
        <path d="M7 23l-4-4 4-4" />
        <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
);

const LayersIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
    </svg>
);

const SettingsIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
);

const CollectionsIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
);

export const SideToolkit: React.FC<SideToolkitProps> = ({ activePanel, onToggle }) => {
    return (
        <div className={`side-toolkit ${activePanel ? 'panel-open' : ''}`}>
            {/* Actions Container */}
            <div className={`toolkit-actions ${activePanel ? 'panel-active' : ''}`}>
                <button
                    className={`toolkit-btn ${activePanel === 'queue' ? 'active' : ''}`}
                    aria-label="Queue"
                    onClick={() => onToggle('queue')}
                    title="Queue"
                >
                    <LayersIcon />
                </button>
                <button
                    className={`toolkit-btn ${activePanel === 'routines' ? 'active' : ''}`}
                    aria-label="Manage routines"
                    onClick={() => onToggle('routines')}
                    title="Manage routines"
                >
                    <RoutineIcon />
                </button>
                <button
                    className={`toolkit-btn ${activePanel === 'archive' ? 'active' : ''}`}
                    aria-label="Archive"
                    onClick={() => onToggle('archive')}
                    title="Archive"
                >
                    <CheckListIcon />
                </button>
                <button
                    className={`toolkit-btn ${activePanel === 'collections' ? 'active' : ''}`}
                    aria-label="Calendars"
                    onClick={() => onToggle('collections')}
                    title="Calendars"
                    style={{ marginTop: 'auto' }}
                >
                    <CollectionsIcon />
                </button>
                <button
                    className={`toolkit-btn ${activePanel === 'settings' ? 'active' : ''}`}
                    aria-label="Settings"
                    onClick={() => onToggle('settings')}
                    title="Settings"
                >
                    <SettingsIcon />
                </button>
            </div>
        </div>
    );
};
