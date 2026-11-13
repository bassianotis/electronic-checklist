import { create } from 'zustand';
import { api } from '../api/client';

const STORAGE_KEY = 'viewAsUserId';

interface ViewAsState {
    activeUserId: number | null; // null = viewing own account
    activeUsername: string | null;
    isReadOnly: boolean;
    viewedData: any | null;
    isLoading: boolean;
    switchToUser: (userId: number | null) => Promise<void>;
    restoreSession: () => Promise<void>;
}

export const useViewAsUser = create<ViewAsState>((set, get) => ({
    activeUserId: null,
    activeUsername: null,
    isReadOnly: false,
    viewedData: null,
    isLoading: false,

    switchToUser: async (userId: number | null) => {
        if (userId === null) {
            localStorage.removeItem(STORAGE_KEY);
            set({
                activeUserId: null,
                activeUsername: null,
                isReadOnly: false,
                viewedData: null,
                isLoading: false
            });
            return;
        }

        set({ isLoading: true });

        try {
            const result = await api.fetchUserData(userId);
            localStorage.setItem(STORAGE_KEY, String(userId));
            set({
                activeUserId: userId,
                activeUsername: result.ownerUsername,
                isReadOnly: true,
                viewedData: result.data,
                isLoading: false
            });
        } catch (err) {
            console.error('Failed to fetch user data:', err);
            localStorage.removeItem(STORAGE_KEY);
            set({
                activeUserId: null,
                activeUsername: null,
                isReadOnly: false,
                viewedData: null,
                isLoading: false
            });
        }
    },

    restoreSession: async () => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) return;
        const userId = parseInt(saved, 10);
        if (isNaN(userId)) return;
        await get().switchToUser(userId);
    }
}));
