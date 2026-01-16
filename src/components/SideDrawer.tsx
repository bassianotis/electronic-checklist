import React from 'react';
import { SideToolkit } from './SideToolkit';

interface SideDrawerProps {
    isOpen: boolean;
    activePanel: 'archive' | 'routines' | null;
    onToggle: (panel: 'archive' | 'routines') => void;
    onClose: () => void;
    children: React.ReactNode;
}

export const SideDrawer: React.FC<SideDrawerProps> = ({ isOpen, activePanel, onToggle, onClose, children }) => {
    return (
        /* Main Drawer Container */
        <div className={`side-drawer ${isOpen ? 'open' : ''}`}>

            {/* Tabs - Attached to the left side */}
            <div className="drawer-tabs">
                <SideToolkit activePanel={activePanel} onToggle={onToggle} />
            </div>

            {/* Content Area */}
            <div className="drawer-content">
                {children}
            </div>
        </div>
    );
};
