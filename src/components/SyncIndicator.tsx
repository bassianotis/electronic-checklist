import React from 'react';
import { useTaskStore } from '../store/store';

export const SyncIndicator: React.FC = () => {
    const { syncStatus } = useTaskStore();

    if (syncStatus === 'idle') return null;

    return (
        <div className={`sync-indicator ${syncStatus}`}>
            {syncStatus === 'syncing' && (
                <>
                    <span className="sync-icon">↻</span>
                    <span className="sync-text">Syncing...</span>
                </>
            )}
            {syncStatus === 'error' && (
                <>
                    <span className="sync-icon">⚠</span>
                    <span className="sync-text">Sync Error</span>
                </>
            )}
            {syncStatus === 'offline' && (
                <>
                    <span className="sync-icon">⚡</span>
                    <span className="sync-text">Offline</span>
                </>
            )}
        </div>
    );
};
