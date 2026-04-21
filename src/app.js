import 'dotenv/config';

import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import url from 'url';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import jwt from 'jsonwebtoken';

import {
    connectDatabaseWithRetry,
    disconnectDatabase,
} from './config/database.js';
import { startCleanupRoutine } from './services/admin/utils/cleanupUtils.js';
import { init as initMomo } from './services/admin/momo/momoPayment.js';
import { setupAdminRoutes } from './services/admin/routes/routes.js';
import { setupPriceRoutes, wsRoutes } from './services/price/routes/routes.js';
import { setupTriggerRoutes } from './services/trigger/routes/routes.js';
import {
    startRunning as startAlertChecker,
    stopRunning,
} from './services/trigger/services/alertChecker.js';
import { authMiddleware } from './middlewares/authMiddleware.js';
import { checkAndSendAlerts } from './services/trigger/services/snooze.js';

const app = express();
const server = http.createServer(app);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static('uploads'));

// Swagger setup
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Coin-Price',
            version: '1.0',
            description: 'This is a sample server.',
        },
        servers: [{ url: 'http://localhost:8080' }],
    },
    apis: [],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// WebSocket server
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
    const pathname = url.parse(request.url).pathname;
    const query = url.parse(request.url, true).query;

    // Check if this is a VIP-1 kline websocket (requires auth)
    if (pathname === '/api/v1/vip1/kline/websocket') {
        const token = query.token || request.headers.authorization;
        if (!token) {
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
            return;
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            if (!['VIP-1', 'VIP-2', 'VIP-3'].includes(decoded.role)) {
                socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
                socket.destroy();
                return;
            }
        } catch (e) {
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
            return;
        }
    }

    // Check if the path has a WS handler
    if (wsRoutes[pathname]) {
        wss.handleUpgrade(request, socket, head, (ws) => {
            // Attach query to request for handler access
            request.query = query;
            wsRoutes[pathname](ws, request);
        });
    } else {
        socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
        socket.destroy();
    }
});

async function main() {
    try {
        // Connect to MongoDB with retry
        console.log('Price routes------------------------');
        setupPriceRoutes(app);

        console.log('Trigger routes------------------------');
        setupTriggerRoutes(app);

        console.log('Admin routes------------------------');
        const maxRetries = 3;
        const retryDelay = 5000;
        await connectDatabaseWithRetry(maxRetries, retryDelay);

        // Start token cleanup routine (every 10 minutes)
        startCleanupRoutine(10 * 60 * 1000);

        setupAdminRoutes(app);

        // Initialize MoMo payment
        initMomo();

        // Start alert checker automatically on server startup
        startAlertChecker();
        // stopRunning();

        // await checkAndSendAlerts();

        // Start server
        const PORT = 8080;
        server.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });

        // Graceful shutdown
        const shutdown = async () => {
            console.log('Shutting down server...');
            server.close();
            await disconnectDatabase();
            console.log('Server gracefully stopped.');
            process.exit(0);
        };

        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
}

main();
