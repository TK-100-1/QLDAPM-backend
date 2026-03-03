import mongoose from 'mongoose';

const profileSchema = new mongoose.Schema({
  full_name: { type: String, default: '' },
  phone_number: { type: String, default: '' },
  date_of_birth: { type: String, default: '' },
  avatar_url: { type: String, default: '' },
  bio: { type: String, default: '' },
}, { _id: false });

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String },
  role: { type: String, default: 'VIP-0' },
  is_active: { type: Boolean, default: true },
  profile: { type: profileSchema, default: () => ({}) },
  alerts: { type: [String], default: [] },
  reset_password_otp: { type: String },
  reset_password_expires: { type: Date },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  collection: 'User',
});

export default mongoose.model('User', userSchema);
