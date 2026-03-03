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

async function notifyUserTriggers(userID) {
  const user = await User.findById(userID);
  if (!user) throw new Error('user not found');
  if (!user.email) throw new Error('user email is missing');

  const alerts = await getUserAlerts(userID);
  console.log('Email sent successfully');

  const subject = 'Your Trigger Alerts';
  let htmlBody = '<h1>Trigger Alerts</h1><ul>';
  for (const alert of alerts) {
    htmlBody += `<li><strong>${alert.symbol}:</strong> ${alert.message}</li>`;
  }
  htmlBody += '</ul>';

  await sendAlertEmail(user.email, subject, htmlBody);
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

export {
  getUserAlerts,
  notifyUserTriggers,
  notifyUser,
};
