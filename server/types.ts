import { Request } from 'express';

export interface UserSession {
    id: number;
    username: string;
}

export interface AuthenticatedRequest extends Request {
    user?: UserSession;
}
