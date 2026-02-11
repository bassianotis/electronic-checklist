import type { AppState } from '../types';

const API_BASE = '/api';

export interface AuthResponse {
    success: boolean;
    user?: { id: number; username: string };
    error?: string;
}

export interface SyncResponse {
    success: boolean;
    version?: number;
    data?: AppState;
    status: number;
    headers?: Headers;
    serverVersion?: number;
    serverData?: AppState;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const config = {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
        credentials: 'include' as RequestCredentials, // Important for cookies
    };

    const response = await fetch(`${API_BASE}${endpoint}`, config);

    // Handle 401 specially?
    if (response.status === 401) {
        // Let caller handle or redirect
        throw { status: 401, error: 'Unauthorized' };
    }

    // Handle 304
    if (response.status === 304) {
        return { status: 304 } as any;
    }

    // Handle 204
    if (response.status === 204) {
        return { status: 204, headers: response.headers } as any;
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw { status: response.status, ...data };
    }
    return { ...data, status: response.status, headers: response.headers };
}

export const api = {
    login: (username: string, password: string) =>
        request<AuthResponse>('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        }),

    register: (username: string, password: string, inviteCode: string) =>
        request<AuthResponse>('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ username, password, inviteCode })
        }),

    logout: () => request('/auth/logout', { method: 'POST' }),

    getMe: () => request<{ user?: { id: number; username: string } }>('/auth/me'),

    fetchData: (currentVersion?: number) => {
        const headers: Record<string, string> = {};
        if (currentVersion !== undefined) {
            headers['If-None-Match'] = `"${currentVersion}"`;
        }
        return request<SyncResponse>('/data', { headers });
    },

    syncData: (data: AppState, baseVersion: number) =>
        request<SyncResponse>('/data', {
            method: 'POST',
            headers: {
                'If-Match': `"${baseVersion}"`
            },
            body: JSON.stringify(data)
        }),

    clearData: () =>
        request<{ success: boolean; newVersion: number }>('/data', {
            method: 'DELETE'
        }),

    // Permission endpoints
    grantPermission: (viewerUsername: string) =>
        request<{ success: boolean; permission: any }>('/permissions', {
            method: 'POST',
            body: JSON.stringify({ viewerUsername, permissionLevel: 'read' })
        }),

    getGrantedPermissions: () =>
        request<{ permissions: any[] }>('/permissions/granted'),

    getReceivedPermissions: () =>
        request<{ permissions: any[] }>('/permissions/received'),

    revokePermission: (permissionId: number) =>
        request<{ success: boolean }>(`/permissions/${permissionId}`, {
            method: 'DELETE'
        }),

    fetchUserData: (userId: number) =>
        request<{ data: any; version: number; ownerUsername: string }>(`/data/${userId}`)
};
