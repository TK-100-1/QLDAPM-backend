import mongoose from 'mongoose';

const alertSchema = new mongoose.Schema(
    {
        user_id: { type: String, required: true },
        symbol: { type: String, required: true },
        // Trigger Alert Fields
        trigger_type: {
            type: String,
            enum: [
                'spot',
                'future',
                'price-difference',
                'funding-rate',
                'listing',
            ],
            default: 'spot',
        },
        spot_price_threshold: { type: Number, default: 0 },
        condition: {
            type: String,
            enum: ['=', '>', '<', '>=', '<='],
            required: true,
        },
        price: { type: Number, default: 0 },
        threshold: { type: Number, default: 0 },
        is_active: { type: Boolean, default: true },
        notification_method: {
            type: String,
            enum: ['email', 'telegram', 'push'],
            required: true,
        },
        type: { type: String },
        frequency: { type: String },
        snooze_condition: { type: String },
        max_repeat_count: { type: Number, default: 5 },
        next_trigger_time: {
            type: Date,
            default: () => new Date(Date.now() + 60000),
        },
        repeat_count: { type: Number, default: 0 },
        message: { type: String, default: '' },
        last_fundingrate_interval: { type: String, default: '' },
        min_range: { type: Number, default: 0 },
        max_range: { type: Number, default: 0 },
        fundingRate: { type: String, default: '' },
    },
    {
        timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
        collection: 'alerts',
    },
);

export default mongoose.model('Alert', alertSchema);
