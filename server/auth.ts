import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import 'dotenv/config';

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-do-not-use-in-prod';

export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
}

export function generateToken(user: { id: number; username: string }) {
    return jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, {
        expiresIn: '7d', // Long-lived for ease
    });
}

export function verifyToken(token: string) {
    try {
        return jwt.verify(token, JWT_SECRET) as { id: number; username: string };
    } catch (error) {
        return null;
    }
}
