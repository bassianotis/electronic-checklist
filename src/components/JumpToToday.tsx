import React from 'react';

interface JumpToTodayProps {
    visible: boolean;
    onClick: () => void;
    isAbove?: boolean; // true = user is above "this week", false = user is below
}

export const JumpToToday: React.FC<JumpToTodayProps> = ({ visible, onClick, isAbove }) => {
    if (!visible) return null;

    return (
        <button className="jump-to-today" onClick={onClick} aria-label="Jump to this week">
            {isAbove ? '↓' : '↑'} This week
        </button>
    );
};
