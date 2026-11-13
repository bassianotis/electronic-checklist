import { create } from 'zustand';
import { api } from '../api/client';

export interface Permission {
    id?: number;
    viewerUsername?: string;
    ownerUsername?: string;
    ownerUserId?: number;
    permissionLevel: 'read';
    createdAt: number;
}

interface PermissionsStore {
    granted: Permission[];
    received: Permission[];
    isLoading: boolean;
    error: string | null;

    fetchPermissions: () => Promise<void>;
    grantPermission: (viewerUsername: string) => Promise<boolean>;
    revokePermission: (permissionId: number) => Promise<boolean>;
}

export const usePermissionsStore = create<PermissionsStore>((set) => ({
    granted: [],
    received: [],
    isLoading: false,
    error: null,

    fetchPermissions: async () => {
        set({ isLoading: true, error: null });
        try {
            const [grantedRes, receivedRes] = await Promise.all([
                api.getGrantedPermissions(),
                api.getReceivedPermissions()
            ]);

            set({
                granted: grantedRes.permissions || [],
                received: receivedRes.permissions || [],
                isLoading: false
            });
        } catch (err: any) {
            set({ error: err.error || 'Failed to fetch permissions', isLoading: false });
        }
    },

    grantPermission: async (viewerUsername: string) => {
        set({ isLoading: true, error: null });
        try {
            const result = await api.grantPermission(viewerUsername);
            if (result.success) {
                // Refresh permissions list
                await usePermissionsStore.getState().fetchPermissions();
                return true;
            }
            set({ error: 'Failed to grant permission', isLoading: false });
            return false;
        } catch (err: any) {
            set({ error: err.error || 'Failed to grant permission', isLoading: false });
            return false;
        }
    },

    revokePermission: async (permissionId: number) => {
        set({ isLoading: true, error: null });
        try {
            const result = await api.revokePermission(permissionId);
            if (result.success) {
                // Refresh permissions list
                await usePermissionsStore.getState().fetchPermissions();
                return true;
            }
            set({ error: 'Failed to revoke permission', isLoading: false });
            return false;
        } catch (err: any) {
            set({ error: err.error || 'Failed to revoke permission', isLoading: false });
            return false;
        }
    }
}));
