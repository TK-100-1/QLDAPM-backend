import mongoose from 'mongoose';

const indicatorSchema = new mongoose.Schema({
  symbol: { type: String, required: true },
  indicator: { type: String, required: true },
  period: { type: Number, required: true },
  notification_method: { type: String, required: true },
}, {
  collection: 'indicators',
});

export default mongoose.model('Indicator', indicatorSchema);
