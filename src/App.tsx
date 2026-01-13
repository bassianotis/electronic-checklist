import React, { useState, useCallback, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { TaskList } from './components/TaskList';
import { CompletedList } from './components/CompletedList';
import { JumpToToday } from './components/JumpToToday';
import { WeekNav } from './components/WeekNav';
import { RoutineManager } from './components/RoutineManager';
import { DevPanel } from './components/DevPanel';
import { useTaskStore } from './store/store';
import './index.css';

const CheckListIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
);

const RoutineIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
        <path d="M17 1l4 4-4 4" />
        <path d="M3 11V9a4 4 0 0 1 4-4h14" />
        <path d="M7 23l-4-4 4-4" />
        <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
);

const TasksPage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { getPresentWeek } = useTaskStore();
    const [showJumpToToday, setShowJumpToToday] = useState(false);
    const [isAboveWeek, setIsAboveWeek] = useState(false);
    const [currentVisibleWeek, setCurrentVisibleWeek] = useState<string | undefined>(undefined);
    const [showRoutineManager, setShowRoutineManager] = useState(false);

    // Handle scroll to week from MonthZoom or WeekNav
    const scrollToWeek = useCallback((weekKey: string) => {
        const weekElement = document.querySelector(`[data-week="${weekKey}"]`);
        if (weekElement) {
            const headerOffset = 70; // Fixed header height + padding
            const elementPosition = weekElement.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.scrollY - headerOffset;

            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
    }, []);

    useEffect(() => {
        const state = location.state as { scrollToWeek?: string } | null;
        if (state?.scrollToWeek) {
            setTimeout(() => scrollToWeek(state.scrollToWeek!), 100);
            navigate('/tasks', { replace: true, state: {} });
        }
    }, [location.state, navigate, scrollToWeek]);

    // Track visible week as user scrolls
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                // Find the most visible week element
                const visibleEntries = entries.filter(e => e.isIntersecting);
                if (visibleEntries.length > 0) {
                    // Get the one closest to the top
                    const topEntry = visibleEntries.reduce((a, b) =>
                        a.boundingClientRect.top < b.boundingClientRect.top ? a : b
                    );
                    const weekKey = topEntry.target.getAttribute('data-week');
                    if (weekKey) {
                        setCurrentVisibleWeek(weekKey);
                    }
                }
            },
            { threshold: 0.1, rootMargin: '-100px 0px -50% 0px' }
        );

        // Observe all week sections
        const weekElements = document.querySelectorAll('[data-week]');
        weekElements.forEach(el => observer.observe(el));

        return () => observer.disconnect();
    }, []);

    const handlePresentWeekVisible = useCallback((visible: boolean, isAbove?: boolean) => {
        setShowJumpToToday(!visible);
        if (!visible && isAbove !== undefined) {
            setIsAboveWeek(isAbove);
        }
    }, []);

    const handleJumpToToday = useCallback(() => {
        scrollToWeek(getPresentWeek());
    }, [getPresentWeek, scrollToWeek]);

    return (
        <div className={`tasks-layout ${showRoutineManager ? 'panel-open' : ''}`}>
            <header className="app-header">
                <h1>Tasks</h1>
                <div className="header-actions">
                    <Link to="/completed" className="header-btn" aria-label="Archive">
                        <CheckListIcon />
                    </Link>
                    <button className="header-btn" aria-label="Manage routines" onClick={() => setShowRoutineManager(!showRoutineManager)}>
                        <RoutineIcon />
                    </button>
                </div>
            </header>

            <div className="tasks-main">
                <WeekNav onNavigate={scrollToWeek} currentVisibleWeek={currentVisibleWeek} />

                <TaskList onPresentWeekVisible={handlePresentWeekVisible} />

                <JumpToToday visible={showJumpToToday} onClick={handleJumpToToday} isAbove={isAboveWeek} />
            </div>

            <RoutineManager isOpen={showRoutineManager} onClose={() => setShowRoutineManager(false)} />
        </div>
    );
};

const App: React.FC = () => {
    return (
        <BrowserRouter>
            <div className="app">
                <Routes>
                    <Route path="/" element={<TasksPage />} />
                    <Route path="/tasks" element={<TasksPage />} />
                    <Route path="/completed" element={<CompletedList />} />
                </Routes>
                <DevPanel />
            </div>
        </BrowserRouter>
    );
};

export default App;
