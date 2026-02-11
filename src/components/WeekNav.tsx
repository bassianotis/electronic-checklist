import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useTaskStore } from '../store/store';
import { getWeekKey, getFirstDayOfWeek } from '../utils/timeUtils';
import dayjs from 'dayjs';

interface WeekNavProps {
    onNavigate: (weekKey: string) => void;
    currentVisibleWeek?: string;
}

export const WeekNav: React.FC<WeekNavProps> = ({ onNavigate, currentVisibleWeek }) => {
    const { getPresentWeek } = useTaskStore();
    const presentWeek = getPresentWeek();

    const [isExpanded, setIsExpanded] = useState(false);
    const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
    const [targetWeek, setTargetWeek] = useState<string | null>(null); // Overrides during scroll
    const [mobileVisible, setMobileVisible] = useState(false);
    const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Mobile auto-show on scroll, auto-hide after 2s idle
    useEffect(() => {
        const isMobile = window.matchMedia('(max-width: 768px)').matches;
        if (!isMobile) return;

        const container = document.querySelector('.tasks-main');
        if (!container) return;

        const showTemporarily = () => {
            setMobileVisible(true);
            if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
            hideTimerRef.current = setTimeout(() => setMobileVisible(false), 2000);
        };

        container.addEventListener('scroll', showTemporarily, { passive: true });
        container.addEventListener('touchstart', showTemporarily, { passive: true });

        return () => {
            container.removeEventListener('scroll', showTemporarily);
            container.removeEventListener('touchstart', showTemporarily);
            if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        };
    }, []);


    // Generate months from present to 12 months out
    const months = useMemo(() => {
        const result: { key: string; label: string; weeks: { key: string; label: string }[] }[] = [];
        const startDate = dayjs(getFirstDayOfWeek(presentWeek));

        for (let m = 0; m < 12; m++) {
            const monthDate = startDate.add(m, 'month');
            const monthKey = monthDate.format('YYYY-MM');
            const monthLabel = monthDate.format('MMM');

            // Get weeks in this month (Sundays)
            const weeks: { key: string; label: string }[] = [];
            let weekDate = monthDate.startOf('month').day(0); // First Sunday on or before month start

            // If that Sunday is before the month, move to next Sunday
            if (weekDate.month() !== monthDate.month() && weekDate.date() > 7) {
                weekDate = weekDate.add(7, 'day');
            }

            while (weekDate.month() === monthDate.month() || weekDate.isBefore(monthDate.endOf('month'))) {
                if (weekDate.month() === monthDate.month()) {
                    const weekKey = getWeekKey(weekDate.toISOString());
                    weeks.push({
                        key: weekKey,
                        label: weekDate.format('MMM D'),
                    });
                }
                weekDate = weekDate.add(7, 'day');
                if (weekDate.isAfter(monthDate.endOf('month'))) break;
            }

            if (weeks.length > 0) {
                result.push({ key: monthKey, label: monthLabel, weeks });
            }
        }

        return result;
    }, [presentWeek]);

    const handleMonthClick = (monthKey: string, firstWeekKey: string) => {
        // Always expand/toggle the month
        if (expandedMonth === monthKey) {
            setExpandedMonth(null);
        } else {
            setExpandedMonth(monthKey);
        }
        // Immediately highlight target, then navigate
        setTargetWeek(firstWeekKey);
        onNavigate(firstWeekKey);
    };

    const handleWeekClick = (weekKey: string) => {
        // Immediately highlight target, then navigate
        setTargetWeek(weekKey);
        onNavigate(weekKey);
    };

    // Clear targetWeek when currentVisibleWeek catches up to it
    React.useEffect(() => {
        if (targetWeek && currentVisibleWeek === targetWeek) {
            setTargetWeek(null);
        }
    }, [currentVisibleWeek, targetWeek]);

    // Use targetWeek if set (during animation), otherwise use currentVisibleWeek
    const displayedWeek = targetWeek || currentVisibleWeek;

    // Determine which month is currently visible
    const currentMonth = displayedWeek
        ? dayjs(getFirstDayOfWeek(displayedWeek)).format('YYYY-MM')
        : null;

    // Auto-expand the current month when panel is open and scrolling
    React.useEffect(() => {
        if (isExpanded && currentMonth && !targetWeek) {
            setExpandedMonth(currentMonth);
        }
    }, [isExpanded, currentMonth, targetWeek]);

    // Close panel when clicking outside
    const handleClickOutside = useCallback((e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (!target.closest('.week-nav')) {
            setIsExpanded(false);
            setExpandedMonth(null);
        }
    }, []);

    // Add/remove click outside listener
    React.useEffect(() => {
        if (isExpanded) {
            document.addEventListener('click', handleClickOutside);
        }
        return () => document.removeEventListener('click', handleClickOutside);
    }, [isExpanded, handleClickOutside]);

    const togglePanel = () => {
        setIsExpanded(!isExpanded);
        if (isExpanded) {
            setExpandedMonth(null);
        }
    };

    return (
        <div className={`week-nav ${isExpanded ? 'expanded' : ''} ${mobileVisible ? 'visible' : ''}`}>
            {/* Subtle lines (always visible) - click to toggle */}
            <div className="week-nav-lines" onClick={togglePanel}>
                {months.map((month) => (
                    <div
                        key={month.key}
                        className={`nav-line ${currentMonth === month.key ? 'active' : ''}`}
                    />
                ))}
            </div>

            {/* Panel with animation - always rendered */}
            <div className={`week-nav-panel ${isExpanded ? 'open' : ''}`}>
                {months.map((month) => (
                    <div key={month.key} className="nav-month">
                        <button
                            className={`nav-month-btn ${currentMonth === month.key ? 'active' : ''}`}
                            onClick={() => handleMonthClick(month.key, month.weeks[0]?.key)}
                        >
                            {month.label}
                        </button>

                        {expandedMonth === month.key && (
                            <div className="nav-weeks">
                                {month.weeks.map((week) => (
                                    <button
                                        key={week.key}
                                        className={`nav-week-btn ${displayedWeek === week.key ? 'active' : ''}`}
                                        onClick={() => handleWeekClick(week.key)}
                                    >
                                        {week.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};
