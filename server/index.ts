import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import compression from 'compression';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import db from './db';
import 'dotenv/config';

import router from './routes';

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({
    contentSecurityPolicy: false, // For development/simplicity with local scripts
}));
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: '10mb' })); // Large limit for state blobs

// CORS setup (Restrict to local dev ports if needed, but mostly same-origin)
app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? false : ['http://localhost:5173'],
    credentials: true
}));

// API Routes
app.use('/api', router);

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
    const DIST = path.join(__dirname, '../dist');
    app.use(express.static(DIST));
    app.get(/(.*)/, (req, res) => {
        if (req.path.startsWith('/api')) {
            return res.status(404).json({ error: 'Not found' });
        }
        res.sendFile(path.join(DIST, 'index.html'));
    });
}

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
