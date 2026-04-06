import mongoose from 'mongoose';

const indicatorSchema = new mongoose.Schema(
    {
        user_id: { type: String, required: true },
        symbol: { type: String, required: true },
        indicator: {
            type: String,
            enum: ['EMA', 'BollingerBands', 'MA', 'Custom'],
            required: true,
        },
        period: { type: Number, required: true },
        notification_method: {
            type: String,
            enum: ['email', 'telegram', 'push'],
            required: true,
        },
        condition: {
            type: String,
            enum: ['=', '>', '<', '>=', '<='],
            default: '>=',
        },
        threshold: { type: Number, default: 0 },
        is_active: { type: Boolean, default: true },
        message: { type: String, default: '' },
        max_repeat_count: { type: Number, default: 5 },
        repeat_count: { type: Number, default: 0 },
        next_trigger_time: {
            type: Date,
            default: () => new Date(Date.now() + 60000),
        },
    },
    {
        timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
        collection: 'indicators',
    },
);

export default mongoose.model('Indicator', indicatorSchema);
