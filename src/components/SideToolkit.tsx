import React from 'react';

interface SideToolkitProps {
    activePanel: 'archive' | 'routines' | null;
    onToggle: (panel: 'archive' | 'routines') => void;
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

export const SideToolkit: React.FC<SideToolkitProps> = ({ activePanel, onToggle }) => {
    return (
        <div className={`side-toolkit ${activePanel ? 'panel-open' : ''}`}>
           {/* Actions Container */}
            <div className={`toolkit-actions ${activePanel ? 'panel-active' : ''}`}>
                <button 
                    className={`toolkit-btn ${activePanel === 'routines' ? 'active' : ''}`}
                    aria-label="Manage routines" 
                    onClick={() => onToggle('routines')}
                    title="Routines"
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
            </div>
        </div>
    );
};
