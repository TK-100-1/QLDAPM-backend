import mongoose from 'mongoose';

const alertSchema = new mongoose.Schema({
  user_id: { type: String, required: true },
  symbol: { type: String },
  price: { type: Number, default: 0 },
  condition: { type: String },
  threshold: { type: Number, default: 0 },
  is_active: { type: Boolean, default: true },
  notification_method: { type: String },
  type: { type: String },
  frequency: { type: String },
  snooze_condition: { type: String },
  max_repeat_count: { type: Number, default: 5 },
  next_trigger_time: { type: Date, default: () => new Date(Date.now() + 60000) },
  repeat_count: { type: Number, default: 0 },
  message: { type: String, default: '' },
  last_fundingrate_interval: { type: String, default: '' },
  min_range: { type: Number, default: 0 },
  max_range: { type: Number, default: 0 },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  collection: 'alerts',
});

export default mongoose.model('Alert', alertSchema);
