import mongoose from "mongoose";
import dotenv from "dotenv";
import Role from "../services/admin/models/Role.js";

dotenv.config();

const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/coin-tracker";
const DB_NAME = process.env.MONGO_DB_NAME || "coin_price_db";

const initialRoles = [
    {
        name: 'Admin',
        permissions: ['manage_users', 'manage_roles', 'view_payment_history', 'manage_alerts', 'manage_indicators', 'view_vip_kline'],
        price: 0,
        description: 'Administrator role with full access'
    },
    {
        name: 'VIP-0',
        permissions: [],
        price: 0,
        description: 'Basic free tier'
    },
    {
        name: 'VIP-1',
        permissions: ['view_vip_kline'],
        price: 50000,
        description: 'VIP 1: Access to VIP kline data'
    },
    {
        name: 'VIP-2',
        permissions: ['view_vip_kline', 'manage_alerts'],
        price: 100000,
        description: 'VIP 2: Access to VIP kline and alerts'
    },
    {
        name: 'VIP-3',
        permissions: ['view_vip_kline', 'manage_alerts', 'manage_indicators'],
        price: 200000,
        description: 'VIP 3: Full access to all features'
    }
];

async function seedRoles() {
  try {
    await mongoose.connect(MONGO_URI, { dbName: DB_NAME });
    console.log(`Connected to MongoDB (${DB_NAME})`);

    for (const roleData of initialRoles) {
        const existing = await Role.findOne({ name: roleData.name });
        if (!existing) {
            await Role.create(roleData);
            console.log(`Created role: ${roleData.name}`);
        } else {
            console.log(`Role ${roleData.name} already exists. Updating...`);
            Object.assign(existing, roleData);
            await existing.save();
        }
    }

    console.log(`Successfully seeded roles!`);
    process.exit(0);
  } catch (error) {
    console.error("Error seeding roles:", error);
    process.exit(1);
  }
}

seedRoles();
