import { generateDummyData, DEFAULT_NOW } from '../data/dummyData';
import type { Item, Routine } from '../types';

interface InitialData {
    items: Item[];
    routines: Routine[];
}

/**
 * Loads the initial state for the application.
 * Currently returns mock data. In the future, this can be swapped
 * for an empty state or a database loader.
 */
export const getInitialData = (): InitialData => {
    // For now, ALWAYS generate fresh dummy data on reload if not persisted.
    // Zustand persist middleware handles the "if persisted" check, 
    // so this is only used for the default state.

    // Toggle this to false to start with a clean slate
    const USE_MOCK_DATA = true;

    if (USE_MOCK_DATA) {
        return generateDummyData(DEFAULT_NOW);
    }

    return {
        items: [],
        routines: []
    };
};
