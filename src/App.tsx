import React, { useState, useCallback, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { TaskList } from './components/TaskList';
import { JumpToToday } from './components/JumpToToday';
import { WeekNav } from './components/WeekNav';
import { RoutineManager } from './components/RoutineManager';
import { ArchivePanel } from './components/ArchivePanel';
import { DevPanel } from './components/DevPanel';
import { SideDrawer } from './components/SideDrawer';
import { useTaskStore } from './store/store';
import { ThemeProvider } from './context/ThemeContext';
import './index.css';



const TasksPage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { getPresentWeek, spawnRoutineTasks, rolloverPastItems } = useTaskStore();
    const [showJumpToToday, setShowJumpToToday] = useState(false);
    const [isAboveWeek, setIsAboveWeek] = useState(false);
    const [currentVisibleWeek, setCurrentVisibleWeek] = useState<string | undefined>(undefined);
    const [showRoutineManager, setShowRoutineManager] = useState(false);
    const [showArchive, setShowArchive] = useState(false);

    // On load: rollover past incomplete items, then spawn routine tasks
    useEffect(() => {
        rolloverPastItems();
        spawnRoutineTasks();
    }, [rolloverPastItems, spawnRoutineTasks]);



    // Handle scroll to week from MonthZoom or WeekNav
    const scrollToWeek = useCallback((weekKey: string) => {
        const container = document.querySelector('.tasks-main');
        const weekElement = document.querySelector(`[data-week="${weekKey}"]`);
        if (container && weekElement) {
            const headerOffset = 10; // No header, minimal offset
            const containerTop = container.getBoundingClientRect().top;
            const elementTop = weekElement.getBoundingClientRect().top;
            const offsetPosition = container.scrollTop + (elementTop - containerTop) - headerOffset;

            container.scrollTo({
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

    // Track visible week as user scrolls within .tasks-main container
    useEffect(() => {
        const container = document.querySelector('.tasks-main');
        if (!container) return;

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
            {
                root: container, // Observe within the scroll container
                threshold: 0.1,
                rootMargin: '-100px 0px -50% 0px'
            }
        );

        // Observe week section elements
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

    const handleToolkitToggle = (panel: 'archive' | 'routines') => {
        if (panel === 'archive') {
            setShowArchive(!showArchive);
            setShowRoutineManager(false);
        } else {
            setShowRoutineManager(!showRoutineManager);
            setShowArchive(false);
        }
    };

    const activePanel = showArchive ? 'archive' : showRoutineManager ? 'routines' : null;

    return (
        <div className={`tasks-layout theme-default ${activePanel ? 'panel-open' : ''}`}>

            <div className="tasks-main">
                <WeekNav onNavigate={scrollToWeek} currentVisibleWeek={currentVisibleWeek} />

                <TaskList onPresentWeekVisible={handlePresentWeekVisible} />

                <JumpToToday visible={showJumpToToday} onClick={handleJumpToToday} isAbove={isAboveWeek} />
            </div>

            <SideDrawer
                isOpen={activePanel !== null}
                activePanel={activePanel}
                onToggle={handleToolkitToggle}
                onClose={() => {
                    setShowRoutineManager(false);
                    setShowArchive(false);
                }}
            >
                {activePanel === 'routines' && (
                    <RoutineManager isOpen={true} onClose={() => { }} />
                )}
                {activePanel === 'archive' && (
                    <ArchivePanel isOpen={true} onClose={() => { }} />
                )}
            </SideDrawer>
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
