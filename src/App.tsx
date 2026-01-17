import React, { useState, useCallback, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { TaskList } from './components/TaskList';
import { JumpToToday } from './components/JumpToToday';
import { WeekNav } from './components/WeekNav';
import { DevPanel } from './components/DevPanel';
import { useTaskStore } from './store/store';
import { ThemeProvider } from './context/ThemeContext';
import './index.css';



const TasksPage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { getPresentWeek, spawnRoutineTasks, rolloverPastItems } = useTaskStore();

    // State
    const [activePanel, setActivePanel] = useState<'archive' | 'routines' | 'ideas' | null>(null);
    const [showJumpToToday, setShowJumpToToday] = useState(false);
    const [isAboveWeek, setIsAboveWeek] = useState(false);
    const [currentVisibleWeek, setCurrentVisibleWeek] = useState<string | undefined>(undefined);

    // On load: rollover past incomplete items, then spawn routine tasks
    useEffect(() => {
        rolloverPastItems();
        spawnRoutineTasks();
    }, [rolloverPastItems, spawnRoutineTasks]);

    // Handle scroll to week... (omitted code remains same, referencing it by block if possible or just leaving it alone? The user wants me to edit. I will effectively replace the component body)

    // ... helper functions for scroll ...
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

    const handleTogglePanel = (panel: 'archive' | 'routines' | 'ideas') => {
        setActivePanel(prev => prev === panel ? null : panel);
    };

    return (
        <div className={`tasks-layout theme-default ${activePanel ? 'panel-open' : ''}`}>
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
    return (
        <ThemeProvider>
            <BrowserRouter>
                <div className="app">
                    <Routes>
                        <Route path="/" element={<TasksPage />} />
                        <Route path="/tasks" element={<TasksPage />} />
                    </Routes>
                    <DevPanel />
                </div>
            </BrowserRouter>
        </ThemeProvider>
    );
};

export default App;
