import mongoose from 'mongoose';
import Alert from '../models/Alert.js';
import User from '../../admin/models/User.js';
import { verifyJWT } from '../../../middlewares/authMiddleware.js';
import { getAlertStatus } from '../services/alertLogic.js';

function normalizeAlert(body) {
    return {
        ...body,

        execution: {
            cooldown_seconds: body.cooldownSeconds || 30,
            max_triggers: body.maxTriggers || 10,
            min_confirmations: body.minConfirmations || 1,
            dedupe_window_seconds: body.dedupeWindowSeconds || 30,
        },

        conditionTree: body.conditionTree,

        conditions: body.conditions || [],
    };
}

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

        // const normalizedPayload = normalizeAlertPayload(req.body || {});
        const payloads = Array.isArray(req.body) ? req.body : [req.body];
        const body = payloads[0] || {};
        console.log(' payload:', body);
        console.log('RAW:', JSON.stringify(req.body, null, 2));
        console.log('BODY:', JSON.stringify(body, null, 2));

        // Handle optional timeWindow with safe property access
        if (body.timeWindow) {
            body.timeWindow.start = body.timeWindow?.start
                ? new Date(body.timeWindow.start)
                : null;
            body.timeWindow.end = body.timeWindow?.end
                ? new Date(body.timeWindow.end)
                : null;
        }

        console.log('CreateAlert payload:', body);

        const normalized = normalizeAlert(body);

        const newAlert = new Alert({
            ...normalized,
            user_id: currentUserID,
            is_active: true,
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

// async function getAlerts(req, res) {
//     try {
//         const tokenString = req.headers.authorization;
//         if (!tokenString) {
//             return res
//                 .status(401)
//                 .json({ error: 'Authorization header required' });
//         }

//         let claims;
//         try {
//             claims = verifyJWT(tokenString);
//         } catch (e) {
//             console.error('JWT verification error:', e);
//             return res.status(401).json({ error: 'Invalid token' });
//         }

//         const currentUserID = claims.userID;
//         if (!currentUserID) {
//             return res
//                 .status(401)
//                 .json({ error: 'User ID not found in token' });
//         }

//         const filter = { user_id: currentUserID };
//         const alertType = req.query.type;
//         if (alertType) {
//             filter.type = alertType;
//         }

//         const results = await Alert.find(filter);
//         res.status(200).json(results);
//     } catch (err) {
//         console.error('GetAlerts error:', err);
//         res.status(500).json({
//             error: 'Failed to retrieve alerts',
//             details: err.message,
//         });
//     }
// }

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
            console.error('JWT verification error:', e);
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

        //  inject status
        const enrichedResults = results.map((alertDoc) => {
            const alert = alertDoc.toObject({ virtuals: true });

            const status = getAlertStatus(alert);
            console.log(`Alert ID: ${alert._id}, Status: ${status}`); // Debug log

            return {
                ...alert,
                status,
            };
        });

        res.status(200).json(enrichedResults);
    } catch (err) {
        console.error('GetAlerts error:', err);
        res.status(500).json({
            error: 'Failed to retrieve alerts',
            details: err.message,
        });
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

        const alertDoc = await Alert.findOne({
            _id: id,
            user_id: currentUserID,
        });

        if (!alertDoc) {
            return res.status(404).json({ error: 'Alert not found' });
        }

        const alert = alertDoc.toObject({ virtuals: true });

        //  inject status
        const { status, reason } = getAlertStatus(alert);

        res.status(200).json({
            ...alert,
            status,
            status_reason: reason,
        });
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

async function updateAlert(req, res) {
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

        // Update alert with new data
        // const normalizedPayload = normalizeAlertPayload(req.body || {});

        const updateData = {
            ...req.body,
            updated_at: new Date(),
        };

        const updatedAlert = await Alert.findByIdAndUpdate(id, updateData, {
            new: true,
            runValidators: true,
        });

        if (!updatedAlert) {
            return res
                .status(404)
                .json({ error: 'Alert not found after update' });
        }

        res.status(200).json({
            message: 'Alert updated successfully',
            alert: updatedAlert,
        });
    } catch (err) {
        console.error('UpdateAlert error:', err);
        res.status(500).json({ error: 'Failed to update alert' });
    }
}

export { createAlert, getAlerts, getAlert, updateAlert, deleteAlert };
