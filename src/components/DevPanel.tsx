import React, { useState } from 'react';
import { useTaskStore } from '../store/store';
import { formatDate } from '../utils/timeUtils';

export const DevPanel: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const {
        currentTime,
        allowUncomplete,
        advanceTime,
        executeRollover,
        toggleAllowUncomplete,
        resetData,
        getPresentWeek,
    } = useTaskStore();

    const presentWeek = getPresentWeek();

    const handleAdvance = (days: number) => advanceTime(days);
    const handleRollover = () => executeRollover();
    const handleReset = () => {
        if (confirm('Reset all data to initial dummy state?')) {
            resetData();
        }
    };

    if (!isOpen) {
        return (
            <div className="dev-panel">
                <button className="dev-panel-toggle" onClick={() => setIsOpen(true)}>
                    🛠 Dev
                </button>
            </div>
        );
    }

    return (
        <div className="dev-panel">
            <div className="dev-panel-content">
                <div className="dev-panel-header">
                    <h3>Developer Panel</h3>
                    <button className="close-btn" onClick={() => setIsOpen(false)}>✕</button>
                </div>

                <div className="dev-time">
                    <strong>Simulated Time:</strong><br />
                    {formatDate(currentTime, 'ddd, MMM D, YYYY h:mm A')}<br />
                    <strong>Present Week:</strong> {presentWeek}
                </div>

                <div className="dev-section">
                    <label>Advance Time</label>
                    <div className="dev-btns">
                        <button className="dev-btn" onClick={() => handleAdvance(1)}>+1 day</button>
                        <button className="dev-btn" onClick={() => handleAdvance(3)}>+3 days</button>
                        <button className="dev-btn" onClick={() => handleAdvance(7)}>+7 days</button>
                        <button className="dev-btn" onClick={() => handleAdvance(-1)}>-1 day</button>
                    </div>
                </div>

                <div className="dev-section">
                    <label>Sunday Rollover</label>
                    <div className="dev-btns">
                        <button className="dev-btn primary" onClick={handleRollover}>
                            Simulate Rollover
                        </button>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        Advances to next Sunday and executes weekly rollover logic
                    </div>
                </div>

                <div className="dev-section">
                    <label className="dev-toggle">
                        <input
                            type="checkbox"
                            checked={allowUncomplete}
                            onChange={toggleAllowUncomplete}
                        />
                        Allow uncomplete (within 7 days)
                    </label>
                </div>

                <div className="dev-section">
                    <label>Data</label>
                    <div className="dev-btns">
                        <button className="dev-btn danger" onClick={handleReset}>
                            Reseed Dummy Data
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
