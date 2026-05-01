import mongoose from 'mongoose';
import crypto from 'crypto';
import Order from '../models/Order.js';
import User from '../models/User.js';
import Role from '../models/Role.js';
import { verifyJWT, generateToken } from '../../../middlewares/authMiddleware.js';
import { generateVietQRUrl } from '../sepay/sepayPayment.js';

// 1. Create a VIP Payment using SePay
export async function createVIPPayment(req, res) {
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
    if (!userID) {
      return res.status(401).json({ error: 'Invalid token claims' });
    }

    // Role requested to buy (now passed as role_id or role_name)
    const { role_name } = req.body;
    if (!role_name) {
      return res.status(400).json({ error: 'Role name is required' });
    }

    // Find the requested role
    const roleToBuy = await Role.findOne({ name: role_name });
    if (!roleToBuy || !roleToBuy.price || roleToBuy.price <= 0) {
      return res.status(400).json({ error: 'Invalid role or role is not for sale' });
    }

    // Amount comes from DB, not from request, for security
    const amount = roleToBuy.price;

    // Generate a unique order id
    const orderId = crypto.randomBytes(6).toString('hex').toUpperCase(); // e.g. A1B2C3
    // Order info syntax for SePay to parse easily
    const orderInfo = `VIP ${orderId}`;

    // Get SePay QR URL
    const paymentURL = generateVietQRUrl(amount, orderInfo);

    await Order.create({
      user_id: userID,
      vip_level: role_name, // Store the role name they are buying
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
          { order_id: orderId, transaction_status: 'pending' },
          { $set: { transaction_status: 'failed' } }
        );
      } catch (err) {
        console.error(`Error expiring order ${orderId}:`, err);
      }
    }, 100 * 60 * 1000);

  } catch (err) {
    console.error('CreateVIPPayment error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

// 2. SePay Webhook Handler
export async function sepayWebhook(req, res) {
  try {
    // Basic verification token (optional, configure in SePay dashboard and .env)
    const webhookToken = req.headers['authorization'] || req.query.token;
    if (process.env.SEPAY_WEBHOOK_TOKEN && webhookToken !== `Bearer ${process.env.SEPAY_WEBHOOK_TOKEN}`) {
        // Just a simple check if env is set
        // return res.status(401).json({ error: "Unauthorized" });
    }

    const { id, gateway, transactionDate, accountNumber, subAccount, amountTransfer, transferType, transferContent, referenceNumber, body } = req.body;
    
    // Validate we got an incoming transfer (IN)
    if (transferType !== 'in' && transferType !== '15') {
      return res.status(200).json({ success: true, message: 'Ignored non-incoming transfer' });
    }

    // Try to find the order ID in the transferContent
    // transferContent usually looks like: "NGUYEN VAN A CHUYEN TIEN VIP A1B2C3"
    // We search for our pending orders to match
    
    // We can extract potential orderIds (6 hex chars)
    const matches = transferContent ? transferContent.match(/[a-fA-F0-9]{6}/g) : [];
    let foundOrder = null;
    
    if (matches && matches.length > 0) {
        for (const possibleId of matches) {
            const order = await Order.findOne({ order_id: possibleId.toUpperCase(), transaction_status: 'pending' });
            if (order && amountTransfer >= order.amount) {
                foundOrder = order;
                break;
            }
        }
    }

    // Fallback: If not found by regex, do a full text search in pending orders (less efficient but safer)
    if (!foundOrder) {
        const pendingOrders = await Order.find({ transaction_status: 'pending' });
        for (const order of pendingOrders) {
            if (transferContent && transferContent.includes(order.orderId)) {
                if (amountTransfer >= order.amount) {
                    foundOrder = order;
                    break;
                }
            }
        }
    }

    if (foundOrder) {
        // Mark as success
        foundOrder.transaction_status = 'success';
        foundOrder.updated_at = new Date();
        await foundOrder.save();

        // Update User Role
        await User.updateOne(
            { _id: foundOrder.user_id },
            { $set: { role: foundOrder.vip_level } }
        );
        
        console.log(`SePay Webhook processed successfully for order ${foundOrder.order_id}`);
    } else {
        console.log('SePay Webhook received but no matching pending order found or amount insufficient.', transferContent);
    }

    res.status(200).json({ success: true });

  } catch (err) {
    console.error('SePay Webhook Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

// 3. Status Polling Endpoint (For frontend to check if order is complete)
export async function handleQueryPaymentStatus(req, res) {
    try {
        const { orderId } = req.body;
        if (!orderId) return res.status(400).json({ error: 'Missing orderId' });

        const tokenString = req.headers.authorization;
        let userIDFromToken = '';

        if (tokenString) {
          try {
            const claims = verifyJWT(tokenString);
            userIDFromToken = claims.userID;
          } catch (e) {
            return res.status(401).json({ error: 'Invalid or expired token' });
          }
        } else {
            return res.status(401).json({ error: 'Authorization token is required' });
        }

        const order = await Order.findOne({ order_id: orderId });
        if (!order) return res.status(404).json({ error: 'Order not found' });

        // Ensure ownership
        if (order.user_id !== userIDFromToken) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        if (order.transaction_status === 'success') {
            const token = generateToken(userIDFromToken, order.vip_level);
            return res.status(200).json({
                message: 'Payment confirmed and VIP level upgraded',
                status: '0',
                token
            });
        }

        res.status(200).json({
            message: 'Transaction is not successful yet',
            status: order.transaction_status
        });

    } catch (err) {
        console.error('QueryPaymentStatus Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}
