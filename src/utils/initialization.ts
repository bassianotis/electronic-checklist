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
    // For now, return empty state.
    // Zustand persist middleware handles the "if persisted" check, 
    // so this is only used for the default state on first load.

    return {
        items: [],
        routines: []
    };
};
