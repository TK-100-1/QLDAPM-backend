import express from 'express';
import { authMiddleware } from '../../../middlewares/authMiddleware.js';
import * as authController from '../controllers/authController.js';
import { googleLogin } from '../controllers/googleController.js';
import * as adminController from '../controllers/adminController.js';
import * as userController from '../controllers/userController.js';
import * as paymentController from '../controllers/paymentController.js';
import { momoCallback } from '../momo/momoCallback.js';

import uploadAvatar from '../../../middlewares/upload.js';

function setupAdminRoutes(app) {
    // User Management Routes
    const userRoutes = express.Router();
    userRoutes.use(authMiddleware('VIP-0', 'VIP-1', 'VIP-2', 'VIP-3', 'Admin'));
    userRoutes.get('/me', userController.getCurrentUserInfo);
    userRoutes.put('/me', userController.updateUserProfile);
    userRoutes.delete('/me', userController.deleteCurrentUser);
    userRoutes.put('/me/change_password', userController.changePassword);
    userRoutes.put('/me/change_email', userController.changeEmail);
    userRoutes.get('/me/payment-history', userController.getPaymentHistory);
    userRoutes.post(
        '/me/avatar',
        uploadAvatar.single('avatar'),
        userController.uploadAvatar,
    );
    app.use('/api/v1/user', userRoutes);

    // Auth Routes
    const authRoutes = express.Router();
    authRoutes.post('/login', authController.login);
    authRoutes.post('/google-login', googleLogin);
    authRoutes.post('/register', authController.register);
    authRoutes.post('/forgot-password', authController.forgotPassword);
    authRoutes.post('/reset-password', authController.resetPassword);
    authRoutes.post('/refresh-token', authController.refreshToken);
    authRoutes.post(
        '/logout',
        authMiddleware('VIP-0', 'VIP-1', 'VIP-2', 'VIP-3', 'Admin'),
        authController.logout,
    );
    app.use('/api/v1/auth', authRoutes);

    // Admin
    const adminRoutes = express.Router();
    adminRoutes.use(authMiddleware('Admin'));
    adminRoutes.get('/users', adminController.getAllUsers);
    adminRoutes.get('/user/:user_id', adminController.getUserByAdmin);
    adminRoutes.delete('/user/:user_id', adminController.deleteUserByAdmin);
    adminRoutes.put('/user/:user_id/ban', adminController.banAccount);
    adminRoutes.put('/user/:user_id/active', adminController.activeAccount);
    adminRoutes.get(
        '/payment-history',
        adminController.getPaymentHistoryForAdmin,
    );
    adminRoutes.get(
        '/payment-history/:user_id',
        adminController.getPaymentHistoryOfAUserByAdmin,
    );
    app.use('/api/v1/admin', adminRoutes);

    // Payment Routes
    const paymentRoutes = express.Router();
    paymentRoutes.post(
        '/vip-upgrade',
        authMiddleware('VIP-0', 'VIP-1', 'VIP-2'),
        paymentController.createVIPPayment,
    );
    paymentRoutes.post('/status', paymentController.handleQueryPaymentStatus);
    paymentRoutes.post('/momo-callback', momoCallback);
    app.use('/api/v1/payment', paymentRoutes);
}

export { setupAdminRoutes };
