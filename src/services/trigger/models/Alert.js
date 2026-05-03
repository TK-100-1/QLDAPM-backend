import mongoose from 'mongoose';

const conditionSchema = new mongoose.Schema(
    {
        // loại dữ liệu
        metric: {
            type: String,
            enum: ['price', 'funding_rate', 'price_difference'],
            required: true,
        },
        triggerType: {
            type: String,
            enum: ['spot', 'future', 'funding_rate', 'price_difference'],
            required: true,
        },

        // toán tử
        operator: {
            type: String,
            enum: ['=', '>', '<', '>=', '<='],
            default: '>=',
        },

        // mode (event vs state)
        mode: {
            type: String,
            enum: [
                'static', // price > 100
                'cross_above', // cross lên
                'cross_below', // cross xuống
                'change_up', // tăng X%
                'change_down',
            ],
            default: 'static',
        },

        // so sánh với value
        value: {
            type: Number,
        },

        // dùng cho change %
        change_window_seconds: {
            type: Number,
            default: 0,
        },
        message: { type: String, default: '' },
    },
    { _id: false },
);

const conditionTreeSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            enum: ['group', 'condition'],
            required: true,
        },

        logic: {
            type: String,
            enum: ['AND', 'OR'],
        },

        // nếu là group
        children: [
            {
                type: mongoose.Schema.Types.Mixed,
            },
        ],

        // nếu là leaf
        condition_index: Number,
    },
    { _id: false },
);

const alertSchema = new mongoose.Schema(
    {
        user_id: { type: String, required: true },
        symbol: { type: String, required: true },

        // Support both conditionTree and condition_tree (camelCase and snake_case)
        // conditionTree: {
        //     type: conditionTreeSchema,
        //     default: null,
        // },

        // conditionTree: {
        //     type: {
        //         type: String,
        //         enum: ['group', 'condition'],
        //         required: true,
        //     },
        // },

        conditionTree: {
            type: mongoose.Schema.Types.Mixed,
            required: true,
        },

        timeWindow: {
            start: Date,
            end: Date,
            timezone: { type: String, default: 'UTC' },
        },

        execution: {
            cooldown_seconds: { type: Number, default: 30 },
            max_triggers: { type: Number, default: 10 }, // 0 = unlimited
            min_confirmations: { type: Number, default: 1 },
            dedupe_window_seconds: { type: Number, default: 30 },
        },

        notification: {
            method: {
                type: String,
                enum: ['email'],
                required: true,
            },
            message: { type: String, default: '' },
        },

        is_active: { type: Boolean, default: true },

        runtime_state: {
            prev_values: { type: Object, default: {} },
            last_result: { type: Boolean, default: false },
            last_triggered_at: Date,
            trigger_count: { type: Number, default: 0 },
            confirmation_count: { type: Number, default: 0 },
        },
        triggerType: {
            type: String,
            enum: ['spot', 'future', 'funding_rate', 'price_difference'],
            required: true,
        },
        // status: {
        //     type: String,
        //     enum: [
        //         'active',
        //         'scheduled',
        //         'exhausted',
        //         'expired_time',
        //         'disabled',
        //     ],
        //     // bth là active, nhưng nếu time window chưa đến thì là scheduled.
        //     // Nếu đã trigger đủ max_triggers lần thì chuyển sang exhausted.
        //     // Nếu đã hết hạn time window thì chuyển sang expired_time.
        //     // User cũng có thể disable thủ công để chuyển sang disabled
        //     default: 'active',
        // },
    },
    {
        timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
        collection: 'alerts',
        strict: false, // Allow extra fields that aren't in schema
    },
);

export default mongoose.model('Alert', alertSchema);
