import User from '../../admin/models/User.js';
import Alert from '../models/Alert.js';
import { sendAlertEmail } from '../utils/alertEmail.js';

async function getUserAlerts(userID) {
    const user = await User.findById(userID);
    if (!user) return [];

    if (!user.alerts || user.alerts.length === 0) return [];

    const alerts = await Alert.find({ _id: { $in: user.alerts } });
    return alerts;
}

async function notifyUserTriggers(userID, triggeredAlerts = null) {
    const user = await User.findById(userID);
    if (!user) throw new Error('user not found');
    if (!user.email) throw new Error('user email is missing');

    const alerts =
        Array.isArray(triggeredAlerts) && triggeredAlerts.length > 0
            ? triggeredAlerts
            : await getUserAlerts(userID);

    if (!alerts.length) return;

    // ✅ chỉ lấy alert gửi email
    const emailAlerts = alerts.filter((a) => a.notification_method === 'email');

    if (!emailAlerts.length) return;

    const subject = '🚨 Your Trigger Alerts';

    let htmlBody = `<h2>🚨 Trigger Alerts</h2><ul>`;

    for (const alert of emailAlerts) {
        const triggerType = alert.type || alert.trigger_type || 'unknown';
        const conditionText = alert.condition
            ? `${alert.condition} ${alert.threshold}`
            : '';

        const message = alert.message || 'No message available';

        htmlBody += `
            <li>
                <b>${alert.symbol}</b> (${triggerType})<br/>
                ${message}<br/>
                ${conditionText ? `Condition: ${conditionText}` : ''}
            </li>
        `;
    }

    htmlBody += '</ul>';

    try {
        await sendAlertEmail(user.email, subject, htmlBody);
        console.log(`Alert email sent to ${user.email}`);
    } catch (err) {
        console.error('Send mail failed:', err);
    }
}

async function notifyUser(req, res) {
    try {
        const userID = req.params.id;
        await notifyUserTriggers(userID);
        res.status(200).json({ status: 'Notification sent' });
    } catch (err) {
        console.error('NotifyUser error:', err);
        res.status(500).json({ error: err.message });
    }
}

export { getUserAlerts, notifyUserTriggers, notifyUser };
