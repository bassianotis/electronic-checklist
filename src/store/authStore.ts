import { create } from 'zustand';
import { api } from '../api/client';

interface User {
    id: number;
    username: string;
}

interface AuthStore {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;

    checkAuth: () => Promise<boolean>;
    login: (username: string, password: string) => Promise<boolean>;
    register: (username: string, password: string, inviteCode: string) => Promise<boolean>;
    logout: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,

    checkAuth: async () => {
        set({ isLoading: true });
        try {
            const res = await api.getMe();
            if (res.user) {
                set({ user: res.user, isAuthenticated: true, isLoading: false, error: null });
                return true;
            }
        } catch (err) {
            // Not authenticated
        }
        set({ user: null, isAuthenticated: false, isLoading: false });
        return false;
    },

    login: async (username, password) => {
        set({ isLoading: true, error: null });
        try {
            const res = await api.login(username, password);
            if (res.success && res.user) {
                set({ user: res.user, isAuthenticated: true, isLoading: false });
                return true;
            }
            set({ error: res.error || 'Login failed', isLoading: false });
            return false;
        } catch (err: any) {
            set({ error: err.error || 'Login failed', isLoading: false });
            return false;
        }
    },

    register: async (username, password, inviteCode) => {
        set({ isLoading: true, error: null });
        try {
            const res = await api.register(username, password, inviteCode);
            if (res.success && res.user) {
                set({ user: res.user, isAuthenticated: true, isLoading: false });
                return true;
            }
            set({ error: res.error || 'Registration failed', isLoading: false });
            return false;
        } catch (err: any) {
            set({ error: err.error || 'Registration failed', isLoading: false });
            return false;
        }
    },

    logout: async () => {
        set({ isLoading: true });
        try {
            await api.logout();
        } catch (err) {
            console.error('Logout failed', err);
        }
        set({ user: null, isAuthenticated: false, isLoading: false });
    }
}));
