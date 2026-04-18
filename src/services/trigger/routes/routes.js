import express from 'express';
import { authMiddleware } from '../../../middlewares/authMiddleware.js';
import * as alertHandler from '../controllers/alertHandler.js';
import * as symbolAlert from '../controllers/symbolAlert.js';
import * as indicatorHandler from '../controllers/indicatorHandler.js';
import * as alertChecker from '../services/alertChecker.js';
import { notifyUser } from '../controllers/userHandler.js';

function setupTriggerRoutes(app) {
    // Alert routes (VIP-2, VIP-3)
    const alertRoutes = express.Router();
    alertRoutes.use(authMiddleware('VIP-2', 'VIP-3'));
    alertRoutes.post('/alerts', alertHandler.createAlert);
    alertRoutes.get('/alerts', alertHandler.getAlerts);
    alertRoutes.get('/alerts/:id', alertHandler.getAlert);
    alertRoutes.put('/alerts/:id', alertHandler.updateAlert);
    alertRoutes.delete('/alerts/:id', alertHandler.deleteAlert);
    alertRoutes.get('/symbol-alerts', symbolAlert.getSymbolAlerts);
    alertRoutes.post('/alerts/symbol', symbolAlert.setSymbolAlert);
    alertRoutes.post('/start-alert-checker', alertChecker.run);
    alertRoutes.post('/stop-alert-checker', alertChecker.stop);
    app.use('/api/v1/vip2', alertRoutes);

    // Indicator routes (VIP-3 only)
    const indicatorRoutes = express.Router();
    indicatorRoutes.use(authMiddleware('VIP-3'));
    indicatorRoutes.post('/', indicatorHandler.setAdvancedIndicatorAlert);
    indicatorRoutes.get('/', indicatorHandler.getIndicatorAlerts);
    indicatorRoutes.get('/:id', indicatorHandler.getIndicatorAlert);
    indicatorRoutes.put('/:id', indicatorHandler.updateIndicatorAlert);
    indicatorRoutes.delete('/:id', indicatorHandler.deleteIndicatorAlert);
    app.use('/api/v1/vip3/indicators', indicatorRoutes);

    // User notification routes (public)
    const userRoutes = express.Router();
    userRoutes.post('/:id/alerts/notify', notifyUser);
    app.use('/api/v1/users', userRoutes);
}

export { setupTriggerRoutes };
