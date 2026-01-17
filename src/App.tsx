import React, { useState, useCallback, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { TaskList } from './components/TaskList';
import { JumpToToday } from './components/JumpToToday';
import { WeekNav } from './components/WeekNav';
import { SyncIndicator } from './components/SyncIndicator';
import { AuthScreen } from './components/AuthScreen';
import { useTaskStore } from './store/store';
import { useAuthStore } from './store/authStore';
import { ThemeProvider } from './context/ThemeContext';
import './index.css';

const TasksPage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { getPresentWeek, spawnRoutineTasks, rolloverPastItems } = useTaskStore();

    // State
    const [activePanel, setActivePanel] = useState<'archive' | 'routines' | 'ideas' | 'settings' | null>(null);
    const [showJumpToToday, setShowJumpToToday] = useState(false);
    const [isAboveWeek, setIsAboveWeek] = useState(false);
    const [currentVisibleWeek, setCurrentVisibleWeek] = useState<string | undefined>(undefined);

    // On load: rollover past incomplete items, then spawn routine tasks
    useEffect(() => {
        rolloverPastItems();
        spawnRoutineTasks();
    }, [rolloverPastItems, spawnRoutineTasks]);

    // Handle scroll to week logic
    const scrollToWeek = useCallback((weekKey: string) => {
        const container = document.querySelector('.tasks-main');
        const weekElement = document.querySelector(`[data-week="${weekKey}"]`);
        if (container && weekElement) {
            const headerOffset = 10;
            const containerTop = container.getBoundingClientRect().top;
            const elementTop = weekElement.getBoundingClientRect().top;
            const offsetPosition = container.scrollTop + (elementTop - containerTop) - headerOffset;
            container.scrollTo({ top: offsetPosition, behavior: 'smooth' });
        }
    }, []);

    useEffect(() => {
        const state = location.state as { scrollToWeek?: string } | null;
        if (state?.scrollToWeek) {
            setTimeout(() => scrollToWeek(state.scrollToWeek!), 100);
            navigate('/tasks', { replace: true, state: {} });
        }
    }, [location.state, navigate, scrollToWeek]);

    useEffect(() => {
        const container = document.querySelector('.tasks-main');
        if (!container) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const visibleEntries = entries.filter(e => e.isIntersecting);
                if (visibleEntries.length > 0) {
                    const topEntry = visibleEntries.reduce((a, b) =>
                        a.boundingClientRect.top < b.boundingClientRect.top ? a : b
                    );
                    const weekKey = topEntry.target.getAttribute('data-week');
                    if (weekKey) {
                        setCurrentVisibleWeek(weekKey);
                    }
                }
            },
            { root: container, threshold: 0.1, rootMargin: '-100px 0px -50% 0px' }
        );

        const weekElements = container.querySelectorAll('.week-section[data-week]');
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

    const handleTogglePanel = (panel: 'archive' | 'routines' | 'ideas' | 'settings') => {
        setActivePanel(prev => prev === panel ? null : panel);
    };

    return (
        <div className={`tasks-layout theme-default ${activePanel ? 'panel-open' : ''}`}>
            <SyncIndicator />

            <div className="tasks-main">
                <WeekNav onNavigate={scrollToWeek} currentVisibleWeek={currentVisibleWeek} />

                <TaskList
                    onPresentWeekVisible={handlePresentWeekVisible}
                    activePanel={activePanel}
                    onTogglePanel={handleTogglePanel}
                    onClosePanel={() => setActivePanel(null)}
                />

                <JumpToToday visible={showJumpToToday} onClick={handleJumpToToday} isAbove={isAboveWeek} />
            </div>
        </div>
    );
};

const App: React.FC = () => {
    const { isAuthenticated, isLoading, checkAuth } = useAuthStore();
    const { hydrateFromApi, setTime } = useTaskStore();

    useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    // Time Automation: Reset on mount & tick every minute
    useEffect(() => {
        // Always wake up to real time on load
        setTime(new Date().toISOString());

        // Keep time fresh
        const timeInterval = setInterval(() => {
            if (!useTaskStore.getState().isTimeFrozen) {
                setTime(new Date().toISOString());
            }
        }, 60000); // 1 minute

        return () => clearInterval(timeInterval);
    }, [setTime]);

    useEffect(() => {
        if (isAuthenticated) {
            // Initial hydrate
            hydrateFromApi();

            // Poll for data updates every 30 seconds
            const interval = setInterval(() => {
                hydrateFromApi();
            }, 30000);
            return () => clearInterval(interval);
        }
    }, [isAuthenticated, hydrateFromApi]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-neutral-50 text-neutral-500">
                Loading...
            </div>
        );
    }

    if (!isAuthenticated) {
        return <AuthScreen />;
    }

    return (
        <ThemeProvider>
            <BrowserRouter>
                <div className="app">
                    <Routes>
                        <Route path="/" element={<TasksPage />} />
                    </Routes>
                </div>
            </BrowserRouter>
        </ThemeProvider>
    );
};

export default App;
