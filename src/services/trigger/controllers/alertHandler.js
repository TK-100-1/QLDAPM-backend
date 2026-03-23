import mongoose from 'mongoose';
import Alert from '../models/Alert.js';
import User from '../../admin/models/User.js';
import { verifyJWT } from '../../../middlewares/authMiddleware.js';

async function createAlert(req, res) {
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

        if (user.alerts && user.alerts.length >= 5) {
            return res
                .status(400)
                .json({ error: 'Maximum alert limit reached' });
        }

        const newAlert = new Alert({
            ...req.body,
            user_id: currentUserID,
            is_active: true,
            max_repeat_count: req.body.max_repeat_count || 5,
            repeat_count: 0,
        });

        await newAlert.save();

        // Add alert ID to user's alerts array
        await User.updateOne(
            { _id: currentUserID },
            {
                $push: { alerts: newAlert._id.toString() },
                $set: { updated_at: new Date() },
            },
        );

        res.status(201).json({
            message: 'Alert created successfully',
            alert_id: newAlert._id.toString(),
        });
    } catch (err) {
        console.error('CreateAlert error:', err);
        if (err.name === 'ValidationError') {
            return res.status(400).json({ error: 'Invalid request body' });
        }
        res.status(500).json({ error: 'Failed to create alert' });
    }
}

async function getAlerts(req, res) {
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

        const filter = { user_id: currentUserID };
        const alertType = req.query.type;
        if (alertType) {
            filter.type = alertType;
        }

        const results = await Alert.find(filter);
        res.status(200).json(results);
    } catch (err) {
        console.error('GetAlerts error:', err);
        res.status(500).json({ error: 'Failed to retrieve alerts' });
    }
}

async function getAlert(req, res) {
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
            return res.status(400).json({ error: 'Invalid alert ID' });
        }

        const alert = await Alert.findOne({ _id: id, user_id: currentUserID });
        if (!alert) {
            return res.status(404).json({ error: 'Alert not found' });
        }

        res.status(200).json(alert);
    } catch (err) {
        console.error('GetAlert error:', err);
        res.status(500).json({ error: 'Failed to retrieve alert' });
    }
}

async function deleteAlert(req, res) {
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
            return res.status(400).json({ error: 'Invalid alert ID' });
        }

        // Verify alert belongs to user
        const alert = await Alert.findOne({ _id: id, user_id: currentUserID });
        if (!alert) {
            return res.status(404).json({ error: 'Alert not found' });
        }

        const result = await Alert.deleteOne({ _id: id });
        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Alert not found' });
        }

        // Remove alert ID from user's alerts array
        await User.updateOne({ _id: currentUserID }, { $pull: { alerts: id } });

        res.status(200).json({ message: 'Alert deleted successfully' });
    } catch (err) {
        console.error('DeleteAlert error:', err);
        res.status(500).json({ error: 'Failed to delete alert' });
    }
}

export { createAlert, getAlerts, getAlert, deleteAlert };
