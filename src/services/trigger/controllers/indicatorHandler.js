import mongoose from 'mongoose';
import Indicator from '../models/Indicator.js';
import User from '../../admin/models/User.js';
import { verifyJWT } from '../../../middlewares/authMiddleware.js';

async function setAdvancedIndicatorAlert(req, res) {
    try {
        const tokenString = req.headers.authorization;
        if (!tokenString) {
            return res
                .status(401)
                .json({ error: 'Authorization header required' });
        }

        let claims;
        try {
            claims = verifyJWT(tokenString);
        } catch (e) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        const currentUserID = claims.userID;
        if (!currentUserID) {
            return res
                .status(401)
                .json({ error: 'User ID not found in token' });
        }

        if (!mongoose.Types.ObjectId.isValid(currentUserID)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        const user = await User.findById(currentUserID);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        console.log('User found:', user);
        // VIP-3 check
        if (user.role !== 'VIP-3') {
            return res.status(403).json({
                error: 'VIP-3 level required to create advanced indicator alerts',
            });
        }

        const {
            symbol,
            indicator,
            period,
            notification_method,
            condition,
            threshold,
        } = req.body;

        if (!symbol || !indicator || !period || !notification_method) {
            return res.status(400).json({
                error: 'Symbol, indicator, period, and notification_method are required',
            });
        }

        if (
            !['EMA', 'BollingerBands', 'BOLL', 'MA', 'Custom'].includes(
                indicator,
            )
        ) {
            return res.status(400).json({ error: 'Invalid indicator type' });
        }

        if (user.indicators && user.indicators.length >= 10) {
            return res
                .status(400)
                .json({ error: 'Maximum indicator alert limit (10) reached' });
        }

        const newIndicator = new Indicator({
            user_id: currentUserID,
            symbol,
            indicator,
            period,
            notification_method,
            condition: condition || '>=',
            threshold: threshold || 0,
            is_active: true,
            max_repeat_count: 5,
            repeat_count: 0,
        });

        await newIndicator.save();

        // Add indicator ID to user's indicators array
        await User.updateOne(
            { _id: currentUserID },
            {
                $push: { indicators: newIndicator._id.toString() },
                $set: { updated_at: new Date() },
            },
        );

        res.status(201).json({
            message: 'Indicator alert created successfully',
            alert_id: newIndicator._id.toString(),
        });
    } catch (err) {
        console.error('SetAdvancedIndicatorAlert error:', err);
        if (err.name === 'ValidationError') {
            return res.status(400).json({ error: 'Invalid request body' });
        }
        res.status(500).json({ error: 'Failed to create indicator alert' });
    }
}

async function getIndicatorAlerts(req, res) {
    try {
        const tokenString = req.headers.authorization;
        if (!tokenString) {
            return res
                .status(401)
                .json({ error: 'Authorization header required' });
        }

        let claims;
        try {
            claims = verifyJWT(tokenString);
        } catch (e) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        const currentUserID = claims.userID;
        if (!currentUserID) {
            return res
                .status(401)
                .json({ error: 'User ID not found in token' });
        }

        const indicators = await Indicator.find({ user_id: currentUserID });
        res.status(200).json(indicators);
    } catch (err) {
        console.error('GetIndicatorAlerts error:', err);
        res.status(500).json({ error: 'Failed to retrieve indicator alerts' });
    }
}

async function getIndicatorAlert(req, res) {
    try {
        const tokenString = req.headers.authorization;
        if (!tokenString) {
            return res
                .status(401)
                .json({ error: 'Authorization header required' });
        }

        let claims;
        try {
            claims = verifyJWT(tokenString);
        } catch (e) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        const currentUserID = claims.userID;
        if (!currentUserID) {
            return res
                .status(401)
                .json({ error: 'User ID not found in token' });
        }

        const id = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid indicator ID' });
        }

        const indicator = await Indicator.findOne({
            _id: id,
            user_id: currentUserID,
        });
        if (!indicator) {
            return res.status(404).json({ error: 'Indicator alert not found' });
        }

        res.status(200).json(indicator);
    } catch (err) {
        console.error('GetIndicatorAlert error:', err);
        res.status(500).json({ error: 'Failed to retrieve indicator alert' });
    }
}

async function updateIndicatorAlert(req, res) {
    try {
        const tokenString = req.headers.authorization;
        if (!tokenString) {
            return res
                .status(401)
                .json({ error: 'Authorization header required' });
        }

        let claims;
        try {
            claims = verifyJWT(tokenString);
        } catch (e) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        const currentUserID = claims.userID;
        if (!currentUserID) {
            return res
                .status(401)
                .json({ error: 'User ID not found in token' });
        }

        const id = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid indicator ID' });
        }

        // Verify indicator belongs to user
        const indicator = await Indicator.findOne({
            _id: id,
            user_id: currentUserID,
        });
        if (!indicator) {
            return res.status(404).json({ error: 'Indicator alert not found' });
        }

        const {
            symbol,
            indicator: indicatorType,
            period,
            notification_method,
            condition,
            threshold,
            is_active,
        } = req.body;

        if (
            indicatorType &&
            !['EMA', 'BollingerBands','BOLL', 'MA', 'Custom'].includes(indicatorType)
        ) {
            return res.status(400).json({ error: 'Invalid indicator type' });
        }

        const updatedIndicator = await Indicator.findByIdAndUpdate(
            id,
            {
                ...(symbol && { symbol }),
                ...(indicatorType && { indicator: indicatorType }),
                ...(period && { period }),
                ...(notification_method && { notification_method }),
                ...(condition && { condition }),
                ...(threshold !== undefined && { threshold }),
                ...(is_active !== undefined && { is_active }),
                updated_at: new Date(),
            },
            { new: true },
        );

        res.status(200).json({
            message: 'Indicator alert updated successfully',
            data: updatedIndicator,
        });
    } catch (err) {
        console.error('UpdateIndicatorAlert error:', err);
        if (err.name === 'ValidationError') {
            return res.status(400).json({ error: 'Invalid request body' });
        }
        res.status(500).json({ error: 'Failed to update indicator alert' });
    }
}

async function deleteIndicatorAlert(req, res) {
    try {
        const tokenString = req.headers.authorization;
        if (!tokenString) {
            return res
                .status(401)
                .json({ error: 'Authorization header required' });
        }

        let claims;
        try {
            claims = verifyJWT(tokenString);
        } catch (e) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        const currentUserID = claims.userID;
        if (!currentUserID) {
            return res
                .status(401)
                .json({ error: 'User ID not found in token' });
        }

        const id = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid indicator ID' });
        }

        // Verify indicator belongs to user
        const indicator = await Indicator.findOne({
            _id: id,
            user_id: currentUserID,
        });
        if (!indicator) {
            return res.status(404).json({ error: 'Indicator alert not found' });
        }

        const result = await Indicator.deleteOne({ _id: id });
        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Indicator alert not found' });
        }

        // Remove indicator ID from user's indicators array
        await User.updateOne(
            { _id: currentUserID },
            { $pull: { indicators: id } },
        );

        res.status(200).json({
            message: 'Indicator alert deleted successfully',
        });
    } catch (err) {
        console.error('DeleteIndicatorAlert error:', err);
        res.status(500).json({ error: 'Failed to delete indicator alert' });
    }
}

export {
    setAdvancedIndicatorAlert,
    getIndicatorAlerts,
    getIndicatorAlert,
    updateIndicatorAlert,
    deleteIndicatorAlert,
};
