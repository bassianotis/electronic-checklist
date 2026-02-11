import React, { useState, useEffect } from 'react';
import { useTaskStore } from '../store/store';
import { useTheme } from '../context/ThemeContext';
import { useAuthStore } from '../store/authStore';
import { usePermissionsStore } from '../store/permissionsStore';
import { useViewAsUser } from '../hooks/useViewAsUser';
import { formatDate } from '../utils/timeUtils';

interface SettingsPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen: _isOpen, onClose: _onClose }) => {
    const {
        currentTime,
        advanceTime,
        isTimeFrozen,
        toggleTimeFreeze,
        resetTime,
        items,
        routines,
        collections,
        collectionItems,
        weekNotes,
        dataVersion,
        getPresentWeek
    } = useTaskStore();
    const { theme, setTheme } = useTheme();
    const { user, logout } = useAuthStore();
    const { granted, received, fetchPermissions, grantPermission, revokePermission, isLoading: permissionsLoading } = usePermissionsStore();
    const { switchToUser, activeUserId, activeUsername, isReadOnly } = useViewAsUser();
    const presentWeek = getPresentWeek();

    // Compute available accounts from permissions
    const availableAccounts = [
        { userId: user?.id || null, username: user?.username || 'My Account', isOwn: true },
        ...received.map(p => ({ userId: p.ownerUserId!, username: p.ownerUsername!, isOwn: false }))
    ];
    const hasMultipleAccounts = availableAccounts.length > 1;

    const [newViewerUsername, setNewViewerUsername] = useState('');
    const [showGrantForm, setShowGrantForm] = useState(false);

    // Fetch permissions on mount
    useEffect(() => {
        fetchPermissions();
    }, [fetchPermissions]);

    const handleAdvance = (days: number) => {
        if (!isTimeFrozen) toggleTimeFreeze();
        advanceTime(days);
    };

    const handleLogout = async () => {
        if (confirm('Are you sure you want to sign out?')) {
            await logout();
        }
    };

    const handleDownloadBackup = () => {
        const exportData = {
            items,
            routines,
            collections,
            collectionItems,
            weekNotes,
            meta: {
                version: dataVersion,
                exportedAt: new Date().toISOString()
            }
        };
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tasks-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target?.result as string);
                if (data.items && Array.isArray(data.items)) {
                    if (confirm(`Import ${data.items.length} items, ${data.routines?.length || 0} routines, and ${data.collections?.length || 0} collections? This will replace your current data.`)) {
                        useTaskStore.setState({
                            items: data.items,
                            routines: data.routines || [],
                            collections: data.collections || [],
                            collectionItems: data.collectionItems || [],
                            weekNotes: data.weekNotes || [],
                            dataVersion: (data.meta?.version || 0) + 1
                        });
                        useTaskStore.getState().triggerSync();
                        alert('Import successful!');
                    }
                } else {
                    alert('Invalid backup file format.');
                }
            } catch (err) {
                alert('Failed to parse backup file.');
            }
        };
        reader.readAsText(file);
        // Reset input so same file can be selected again
        e.target.value = '';
    };

    const handleClearData = async () => {
        if (confirm('Are you sure you want to delete ALL tasks and routines? This cannot be undone.')) {
            if (confirm('This will permanently delete everything. Are you really sure?')) {
                try {
                    const { api } = await import('../api/client');
                    const result = await api.clearData();

                    if (result.success) {
                        // Update local state to match server
                        useTaskStore.setState({
                            items: [],
                            routines: [],
                            collections: [],
                            collectionItems: [],
                            weekNotes: [],
                            dataVersion: result.newVersion,
                        });
                        alert('All data cleared.');
                    }
                } catch (err) {
                    console.error('Clear failed:', err);
                    alert('Failed to clear data. Please try again.');
                }
            }
        }
    };

    const handleGrantAccess = async () => {
        if (!newViewerUsername.trim()) return;
        const success = await grantPermission(newViewerUsername.trim());
        if (success) {
            setNewViewerUsername('');
            setShowGrantForm(false);
        }
    };

    const handleRevokeAccess = async (permissionId: number) => {
        if (confirm('Are you sure you want to revoke this access?')) {
            await revokePermission(permissionId);
        }
    };

    return (
        <div className="side-panel-container">
            <div className="panel-header">
                <h2>Settings</h2>
            </div>
            <div className="panel-content">

                {/* Account Switcher Section - First/Most Prominent */}
                {hasMultipleAccounts && (
                    <>
                        <div className="settings-section">
                            <h3>Viewing As</h3>
                            <div className="account-switcher">
                                <select
                                    value={activeUserId || 'own'}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        switchToUser(value === 'own' ? null : parseInt(value, 10));
                                    }}
                                    className="account-select"
                                >
                                    {availableAccounts.map(acc => (
                                        <option key={acc.userId || 'own'} value={acc.userId || 'own'}>
                                            {acc.isOwn ? `My Tasks (${acc.username})` : `${acc.username}'s Tasks`}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            {isReadOnly && (
                                <div className="read-only-badge">
                                    🔒 Read-Only Mode
                                </div>
                            )}
                            <p className="settings-help-text">
                                {isReadOnly
                                    ? `You are viewing ${activeUsername}'s tasks. You cannot make changes.`
                                    : 'You are viewing your own tasks.'
                                }
                            </p>
                        </div>
                        <hr className="settings-divider" />
                    </>
                )}

                {/* Sharing Section - Second Section */}
                <div className="settings-section">
                    <h3>Sharing</h3>

                    {/* Grant Access */}
                    <div style={{ marginBottom: '16px' }}>
                        <button
                            className="action-btn backup-btn"
                            onClick={() => setShowGrantForm(!showGrantForm)}
                        >
                            ➕ Grant Access
                        </button>

                        {showGrantForm && (
                            <div className="grant-form">
                                <input
                                    type="text"
                                    placeholder="Enter username"
                                    value={newViewerUsername}
                                    onChange={(e) => setNewViewerUsername(e.target.value)}
                                    className="username-input"
                                    onKeyDown={(e) => e.key === 'Enter' && handleGrantAccess()}
                                />
                                <div className="grant-form-actions">
                                    <button
                                        className="action-btn-sm primary-btn"
                                        onClick={handleGrantAccess}
                                        disabled={permissionsLoading}
                                    >
                                        Grant
                                    </button>
                                    <button
                                        className="action-btn-sm"
                                        onClick={() => {
                                            setShowGrantForm(false);
                                            setNewViewerUsername('');
                                        }}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Granted Permissions List */}
                    {granted.length > 0 && (
                        <div className="permissions-list">
                            <label className="permissions-label">Who can see my tasks:</label>
                            {granted.map(perm => (
                                <div key={perm.id} className="permission-item">
                                    <span className="permission-username">{perm.viewerUsername}</span>
                                    <button
                                        className="revoke-btn"
                                        onClick={() => handleRevokeAccess(perm.id!)}
                                        title="Revoke access"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}


                    {granted.length === 0 && received.length === 0 && (
                        <p className="settings-help-text">
                            No sharing enabled. Grant access to let others view your tasks.
                        </p>
                    )}
                </div>

                <hr className="settings-divider" />

                {/* Time Travel Section */}
                <div className="settings-section">
                    <h3>Time Travel</h3>
                    <div className="settings-info-row">
                        <span className="label">Current Time:</span>
                        <span className="value">{formatDate(currentTime, 'MMM D, h:mm A')}</span>
                    </div>
                    <div className="settings-info-row">
                        <span className="label">Week:</span>
                        <span className="value">{presentWeek}</span>
                    </div>

                    <div className="time-controls">
                        <div className="dev-btns">
                            <button className="dev-btn" onClick={() => handleAdvance(-1)}>-1d</button>
                            <button className="dev-btn" onClick={() => handleAdvance(1)}>+1d</button>
                            <button className="dev-btn" onClick={() => handleAdvance(7)}>+1w</button>
                        </div>
                    </div>

                    {isTimeFrozen ? (
                        <div className="freeze-status frozen">
                            <span>❄️ Time Frozen</span>
                            <button className="reset-btn" onClick={resetTime}>Reset to Now</button>
                        </div>
                    ) : (
                        <div className="freeze-status active">
                            <span>✓ Auto-updating</span>
                        </div>
                    )}
                </div>

                <hr className="settings-divider" />

                {/* Theme Section */}
                <div className="settings-section">
                    <h3>Appearance</h3>
                    <div className="theme-toggle-row">
                        <label>Theme</label>
                        <select
                            value={theme}
                            onChange={(e) => setTheme(e.target.value as 'default' | 'scrapbook')}
                            className="theme-select"
                        >
                            <option value="default">Default (Clean)</option>
                            <option value="scrapbook">Scrapbook</option>
                        </select>
                    </div>
                </div>

                <hr className="settings-divider" />

                {/* Data Section */}
                <div className="settings-section">
                    <h3>Data</h3>

                    <button className="action-btn backup-btn" onClick={handleDownloadBackup}>
                        📤 Export JSON
                    </button>
                    <p className="settings-help-text">
                        Download a full snapshot of your tasks and routines.
                    </p>

                    <div style={{ marginTop: '12px' }}>
                        <label className="action-btn backup-btn" style={{ cursor: 'pointer' }}>
                            📥 Import JSON
                            <input
                                type="file"
                                accept=".json"
                                style={{ display: 'none' }}
                                onChange={handleImportBackup}
                            />
                        </label>
                    </div>
                    <p className="settings-help-text">
                        Restore from a previously exported backup file.
                    </p>

                    <div style={{ marginTop: '16px' }}>
                        <button className="action-btn danger-btn" onClick={handleClearData}>
                            🗑️ Clear All Data
                        </button>
                    </div>
                    <p className="settings-help-text">
                        Delete all tasks and routines. This cannot be undone.
                    </p>
                </div>

                <hr className="settings-divider" />

                {/* Account Section */}
                <div className="settings-section">
                    <h3>Account</h3>
                    <button className="action-btn logout-btn" onClick={handleLogout}>
                        Sign Out
                    </button>
                </div>

            </div>
            <style>{`
                .settings-section {
                    padding: 16px 0;
                }
                .settings-section h3 {
                    font-size: 0.9rem;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: var(--text-muted);
                    margin-bottom: 12px;
                    font-weight: 600;
                }
                .settings-info-row {
                    display: flex;
                    justify-content: space-between;
                    font-size: 0.85rem;
                    margin-bottom: 6px;
                }
                .settings-info-row .label { color: var(--text-secondary); }
                .settings-info-row .value { font-weight: 500; }
                
                .dev-btns {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 8px;
                    margin-top: 12px;
                }
                .dev-btn {
                    padding: 6px;
                    font-size: 0.8rem;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border-medium);
                    border-radius: var(--radius-sm);
                    cursor: pointer;
                }
                .dev-btn:hover { background: var(--bg-hover); }

                .freeze-status {
                    margin-top: 12px;
                    padding: 8px;
                    background: var(--bg-secondary);
                    border-radius: var(--radius-sm);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-size: 0.8rem;
                }
                .freeze-status.frozen span { color: var(--status-overdue); font-weight: 500; }
                .freeze-status.active span { color: var(--status-complete); }
                
                .reset-btn {
                    font-size: 0.75rem;
                    padding: 4px 8px;
                    background: var(--bg-root);
                    border: 1px solid var(--border-medium);
                    border-radius: 4px;
                    cursor: pointer;
                }

                .settings-divider {
                    border: none;
                    border-top: 1px solid var(--border-light);
                    margin: 0;
                }

                .theme-select {
                    width: 100%;
                     padding: 8px;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border-medium);
                    border-radius: var(--radius-sm);
                    color: var(--text-primary);
                }

                .action-btn {
                    width: 100%;
                    padding: 8px;
                    border-radius: var(--radius-sm);
                    font-size: 0.9rem;
                    font-weight: 500;
                    cursor: pointer;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }
                .backup-btn {
                    background: var(--bg-secondary);
                    border: 1px solid var(--border-medium);
                    color: var(--text-primary);
                }
                .backup-btn:hover { background: var(--bg-hover); }
                
                .logout-btn {
                    background: #fef2f2;
                    border: 1px solid #fca5a5;
                    color: #dc2626;
                }
                .logout-btn:hover { background: #fee2e2; }

                .danger-btn {
                    background: #fef2f2;
                    border: 1px solid #fca5a5;
                    color: #dc2626;
                }
                .danger-btn:hover { background: #fee2e2; }

                .settings-help-text {
                    font-size: 0.75rem;
                    color: var(--text-muted);
                    margin-top: 8px;
                    line-height: 1.4;
                }

                /* Account Switcher Styles */
                .account-switcher {
                    margin-bottom: 12px;
                }
                .account-select {
                    width: 100%;
                    padding: 10px;
                    background: var(--bg-secondary);
                    border: 2px solid var(--border-medium);
                    border-radius: var(--radius-sm);
                    color: var(--text-primary);
                    font-size: 0.95rem;
                    font-weight: 500;
                }
                .account-select:focus {
                    outline: none;
                    border-color: #3b82f6;
                }
                .read-only-badge {
                    display: inline-block;
                    padding: 6px 12px;
                    background: #fef3c7;
                    border: 1px solid #fbbf24;
                    border-radius: var(--radius-sm);
                    font-size: 0.8rem;
                    font-weight: 500;
                    color: #92400e;
                    margin-bottom: 8px;
                }

                /* Sharing Styles */
                .grant-form {
                    margin-top: 12px;
                    padding: 12px;
                    background: var(--bg-secondary);
                    border-radius: var(--radius-sm);
                    border: 1px solid var(--border-light);
                }
                .username-input {
                    width: 100%;
                    padding: 8px;
                    border: 1px solid var(--border-medium);
                    border-radius: var(--radius-sm);
                    background: var(--bg-root);
                    color: var(--text-primary);
                    margin-bottom: 8px;
                }
                .grant-form-actions {
                    display: flex;
                    gap: 8px;
                }
                .action-btn-sm {
                    flex: 1;
                    padding: 6px 12px;
                    border-radius: var(--radius-sm);
                    font-size: 0.85rem;
                    cursor: pointer;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border-medium);
                    color: var(--text-primary);
                }
                .action-btn-sm:hover {
                    background: var(--bg-hover);
                }
                .action-btn-sm.primary-btn {
                    background: #3b82f6;
                    color: white;
                    border-color: #2563eb;
                }
                .action-btn-sm.primary-btn:hover {
                    background: #2563eb;
                }
                .action-btn-sm:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                .permissions-list {
                    margin-top: 16px;
                }
                .permissions-label {
                    display: block;
                    font-size: 0.8rem;
                    color: var(--text-secondary);
                    margin-bottom: 8px;
                    font-weight: 500;
                }
                .permission-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 8px 12px;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border-light);
                    border-radius: var(--radius-sm);
                    margin-bottom: 8px;
                }
                .permission-username {
                    font-size: 0.9rem;
                    color: var(--text-primary);
                    font-weight: 500;
                }
                .revoke-btn {
                    padding: 4px 8px;
                    background: #fee2e2;
                    border: 1px solid #fca5a5;
                    color: #dc2626;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 0.85rem;
                }
                .revoke-btn:hover {
                    background: #fecaca;
                }
                .permissions-info {
                    margin-top: 16px;
                    padding: 12px;
                    background: var(--bg-secondary);
                    border-radius: var(--radius-sm);
                    border: 1px solid var(--border-light);
                }
                .permissions-list-simple {
                    list-style: none;
                    padding: 0;
                    margin: 8px 0 0 0;
                }
                .permissions-list-simple li {
                    padding: 4px 0;
                    font-size: 0.9rem;
                    color: var(--text-primary);
                }
                .permissions-list-simple li:before {
                    content: "👤 ";
                    margin-right: 6px;
                }
            `}</style>
        </div >
    );
};
