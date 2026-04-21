import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../services/admin/models/User.js";

dotenv.config();

const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/coin-tracker";
const DB_NAME = process.env.MONGO_DB_NAME || "coin_price_db";

async function makeAdmin() {
  const email = process.argv[2];
  if (!email) {
    console.error(
      "Please provide an email. Example: node makeAdmin.js user@example.com",
    );
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGO_URI, { dbName: DB_NAME });
    console.log(`Connected to MongoDB (${DB_NAME})`);

    const result = await User.updateOne(
      { email: email },
      { $set: { role: "Admin" } },
    );

    if (result.matchedCount === 0) {
      console.log(`User with email [${email}] not found.`);
    } else {
      console.log(`Successfully updated user [${email}] to Admin role!`);
    }

    process.exit(0);
  } catch (error) {
    console.error("Error updating user:", error);
    process.exit(1);
  }
}

makeAdmin();
