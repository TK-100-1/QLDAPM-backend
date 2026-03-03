import mongoose from 'mongoose';
import Order from '../models/Order.js';
import User from '../models/User.js';
import { verifyJWT, generateToken } from '../../../middlewares/authMiddleware.js';
import { isValidUpgradeCost } from '../utils/upgradeAmount.js';
import { createMoMoPayment, queryPaymentStatus } from '../momo/momoPayment.js';

async function createVIPPayment(req, res) {
  try {
    const tokenString = req.headers.authorization;
    if (!tokenString) {
      return res.status(401).json({ error: 'Authorization header required' });
    }

    let claims;
    try {
      claims = verifyJWT(tokenString);
    } catch (e) {
      return res.status(401).json({ error: e.message });
    }

    const userID = claims.userID;
    const currentVIP = claims.role;
    if (!userID || !currentVIP) {
      return res.status(401).json({ error: 'Invalid token claims' });
    }

    const { amount, vip_level } = req.body;
    if (!amount || amount <= 0 || !vip_level) {
      return res.status(400).json({ error: 'Invalid request data' });
    }

    // Validate VIP level progression
    const vipLevels = { 'VIP-0': 0, 'VIP-1': 1, 'VIP-2': 2, 'VIP-3': 3 };
    const currentVIPLevel = vipLevels[currentVIP];
    const requestedVIPLevel = vipLevels[vip_level];

    if (requestedVIPLevel === undefined || requestedVIPLevel <= currentVIPLevel) {
      return res.status(400).json({ error: 'Invalid target VIP level' });
    }

    const { valid, expectedAmount } = isValidUpgradeCost(currentVIP, vip_level, amount);
    if (!valid) {
      console.log(`Invalid amount for upgrade: expected ${expectedAmount}, got ${amount}`);
      return res.status(400).json({
        error: `Invalid amount. Expected ${expectedAmount} for upgrade from ${currentVIP} to ${vip_level}`,
      });
    }

    const orderInfo = `Upgrade ${vip_level}`;
    const { paymentURL, orderId } = await createMoMoPayment(String(amount), vip_level, orderInfo);

    if (!paymentURL) {
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    await Order.create({
      user_id: userID,
      vip_level: vip_level,
      amount,
      order_id: orderId,
      orderInfo,
      payment_url: paymentURL,
      transaction_status: 'pending',
    });

    res.status(200).json({ payment_url: paymentURL, order_id: orderId });

    // Auto-expire after 100 minutes
    setTimeout(async () => {
      try {
        await Order.updateOne(
          { order_id: orderId },
          { $set: { transaction_status: 'failed' } }
        );
        console.log(`Order ${orderId} status updated to failed due to timeout`);
      } catch (err) {
        console.error(`Error updating order status for orderId ${orderId}:`, err);
      }
    }, 100 * 60 * 1000);
  } catch (err) {
    console.error('CreateVIPPayment error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

async function confirmPaymentHandlerSuccess(res, orderID, role) {
  try {
    const order = await Order.findOne({ order_id: orderID });
    if (!order) {
      return res.status(404).json({ error: 'Invalid order' });
    }

    await Order.updateOne(
      { order_id: orderID },
      { $set: { transaction_status: 'success', updated_at: new Date() } }
    );

    const userID = order.user_id;
    const newVIP = order.vip_level;

    await User.updateOne(
      { _id: userID },
      { $set: { role: newVIP } }
    );

    const token = generateToken(userID, newVIP);

    if (role === 'Admin') {
      return res.status(200).json({
        message: 'Payment confirmed and VIP level upgraded',
        status: '0',
      });
    }

    res.status(200).json({
      message: 'Payment confirmed and VIP level upgraded',
      status: '0',
      token,
    });
  } catch (err) {
    console.error('confirmPaymentHandlerSuccess error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

async function handleQueryPaymentStatus(req, res) {
  try {
    const { orderId, requestId, lang } = req.body;

    if (!orderId || !requestId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const tokenString = req.headers.authorization;
    let userIDFromToken = '';
    let role = '';

    if (tokenString) {
      try {
        const claims = verifyJWT(tokenString);
        userIDFromToken = claims.userID;
        role = claims.role;
      } catch (e) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }
    }

    if (!tokenString && role !== 'Admin') {
      return res.status(401).json({ error: 'Authorization token is required' });
    }

    const order = await Order.findOne({ order_id: orderId });
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // If not admin, check ownership
    if (role !== 'Admin') {
      if (order.user_id !== userIDFromToken) {
        return res.status(403).json({ error: 'You do not have permission to query this order' });
      }
    }

    const result = await queryPaymentStatus(orderId, requestId, lang || 'vi');

    if (result.resultCode === 0) {
      await confirmPaymentHandlerSuccess(res, orderId, role);
    } else {
      res.status(200).json({
        message: 'Transaction is not successful yet',
        status: result.message,
      });
    }
  } catch (err) {
    console.error('HandleQueryPaymentStatus error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

export {
  createVIPPayment,
  handleQueryPaymentStatus,
};
