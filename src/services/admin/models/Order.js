import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  user_id: { type: String, required: true },
  vip_level: { type: String, required: true },
  amount: { type: Number, required: true },
  order_id: { type: String, required: true },
  orderInfo: { type: String },
  payment_url: { type: String },
  transaction_status: { type: String, default: 'pending' },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  collection: 'OrderMoMo',
});

export default mongoose.model('Order', orderSchema);
