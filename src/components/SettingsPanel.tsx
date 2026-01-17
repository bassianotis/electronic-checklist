import React from 'react';
import { useTaskStore } from '../store/store';
import { useTheme } from '../context/ThemeContext';
import { useAuthStore } from '../store/authStore';
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
        dataVersion,
        getPresentWeek
    } = useTaskStore();
    const { theme, setTheme } = useTheme();
    const { logout } = useAuthStore();
    const presentWeek = getPresentWeek();

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

    return (
        <div className="side-panel-container">
            <div className="panel-header">
                <h2>Settings</h2>
            </div>
            <div className="panel-content">

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
                        Download JSON Backup
                    </button>
                    <p className="settings-help-text">
                        Download a full snapshot of your tasks and routines.
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

                .settings-help-text {
                    font-size: 0.75rem;
                    color: var(--text-muted);
                    margin-top: 8px;
                    line-height: 1.4;
                }
            `}</style>
        </div >
    );
};
