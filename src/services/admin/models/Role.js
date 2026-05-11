import mongoose from 'mongoose';

const roleSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, unique: true },
        permissions: { type: [String], default: [] },
        price: { type: Number, default: 0 },
        description: { type: String, default: '' },
    },
    {
        timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
        collection: 'Role',
    },
);

export default mongoose.model('Role', roleSchema);
