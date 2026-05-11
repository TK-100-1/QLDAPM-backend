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

    // chỉ lấy alert gửi email
    const emailAlerts = alerts.filter((a) => {
        const method =
            a.notification?.method || a.notification_method || 'email';
        return method === 'email';
    });

    if (!emailAlerts.length) return;

    const subject = '🚨 Crypto Alert Triggered';

    let htmlBody = `
        <div style="font-family: Arial, sans-serif; background:#f4f6f8; padding:20px;">
            <h2 style="color:#d32f2f;">🚨 Alert Notification</h2>
    `;

    for (const alert of emailAlerts) {
        const message =
            alert.message ||
            alert.notification?.message ||
            'No message available';

        // convert xuống dòng cho HTML
        const formattedMessage = message.replace(/\n/g, '<br/>');

        htmlBody += `
            <div style="
                background:white;
                border-radius:10px;
                padding:15px;
                margin-bottom:15px;
                box-shadow:0 2px 6px rgba(0,0,0,0.1);
            ">
                <div style="font-size:18px; font-weight:bold; margin-bottom:8px;">
                    📊 ${alert.symbol}
                </div>

                <div style="
                    font-size:14px;
                    color:#333;
                    line-height:1.6;
                    margin-bottom:10px;
                ">
                    ${formattedMessage}
                </div>

                <div style="font-size:12px; color:#888;">
                    Trigger count: ${alert.runtime_state?.trigger_count || 0} |
                    Time: ${new Date().toLocaleString()}
                </div>
            </div>
        `;
    }

    htmlBody += `
            <hr style="margin-top:20px;"/>
            <div style="font-size:12px; color:#999;">
                This is an automated message from your alert system.
            </div>
        </div>
    `;

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
