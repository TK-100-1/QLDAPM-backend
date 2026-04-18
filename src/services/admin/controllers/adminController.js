import mongoose from "mongoose";
import User from "../models/User.js";
import Order from "../models/Order.js";
import bcrypt from "bcryptjs";

async function getAllUsers(req, res) {
  try {
    const users = await User.find({});

    const result = users.map((user) => ({
      user_id: user._id.toString(),
      username: user.username,
      email: user.email,
      vip_level: user.role,
      status: user.is_active,
      full_name: user.profile?.full_name || user.username,
      avatar_url:
        user.profile?.avatar_url ||
        "https://drive.google.com/file/d/15Ef4yebpGhT8pwgnt__utSESZtJdmA4a/view?usp=sharing",
      created_at: user.created_at || new Date(),
    }));

    res.status(200).json(result);
  } catch (err) {
    console.error("GetAllUsers error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

async function getUserByAdmin(req, res) {
  try {
    const userId = req.params.user_id;
    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const user = await User.findById(userId).select("-password");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json({
      user_id: user._id.toString(),
      username: user.username,
      profile: user.profile,
      email: user.email,
      vip_level: user.role,
      is_active: user.is_active,
      created_at: user.created_at,
      updated_at: user.updated_at,
    });
  } catch (err) {
    console.error("GetUserByAdmin error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

async function deleteUserByAdmin(req, res) {
  try {
    const userId = req.params.user_id;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const result = await User.deleteOne({ _id: userId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json({ message: "User deleted successfully" });
  } catch (err) {
    console.error("DeleteUserByAdmin error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

async function getPaymentHistoryForAdmin(req, res) {
  try {
    const payments = await Order.find({});

    if (payments.length === 0) {
      return res.status(200).json({ message: "No payment history found" });
    }

    const paymentHistory = payments.map((payment) => ({
      order_id: payment.order_id,
      user_id: payment.user_id,
      orderInfo: payment.orderInfo,
      transaction_status: payment.transaction_status,
      amount: payment.amount,
    }));

    res.status(200).json({ payment_history: paymentHistory });
  } catch (err) {
    console.error("GetPaymentHistoryForAdmin error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

async function getPaymentHistoryOfAUserByAdmin(req, res) {
  try {
    const userId = req.params.user_id;
    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const payments = await Order.find({ user_id: userId });

    if (payments.length === 0) {
      return res
        .status(200)
        .json({ message: "No payment history found for this user" });
    }

    const paymentHistory = payments.map((payment) => ({
      order_id: payment.order_id,
      orderInfo: payment.orderInfo,
      transaction_status: payment.transaction_status,
      amount: payment.amount,
      vip_level: payment.vip_level,
      payment_url: payment.payment_url,
      created_at: payment.created_at,
      updated_at: payment.updated_at,
    }));

    res.status(200).json({ payment_history: paymentHistory });
  } catch (err) {
    console.error("GetPaymentHistoryOfAUserByAdmin error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

async function banAccount(req, res) {
  try {
    const userId = req.params.user_id;
    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const result = await User.updateOne(
      { _id: userId },
      { $set: { is_active: false, updated_at: new Date() } },
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json({ message: "Account has been banned successfully" });
  } catch (err) {
    console.error("BanAccount error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

async function activeAccount(req, res) {
  try {
    const userId = req.params.user_id;
    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const result = await User.updateOne(
      { _id: userId },
      { $set: { is_active: true, updated_at: new Date() } },
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json({ message: "Account has been active successfully" });
  } catch (err) {
    console.error("ActiveAccount error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

async function createUserByAdmin(req, res) {
  try {
    const { username, email, full_name, password, role, is_active } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const userExists = await User.findOne({ $or: [{ email }, { username }] });
    if (userExists) {
      return res
        .status(409)
        .json({ error: "Username or email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // We recreate new user object since newUser in authController isn't exposed
    const userData = {
      username,
      email,
      password: hashedPassword,
      role: role || "VIP-0",
      is_active: is_active !== undefined ? is_active : true,
      profile: {
        full_name: full_name || username,
        avatar_url:
          "https://drive.google.com/file/d/15Ef4yebpGhT8pwgnt__utSESZtJdmA4a/view?usp=sharing",
      },
    };

    const newUser = await User.create(userData);
    res
      .status(201)
      .json({ message: "User created successfully", user_id: newUser._id });
  } catch (err) {
    console.error("CreateUserByAdmin error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

async function changeUserRoleByAdmin(req, res) {
  try {
    const userId = req.params.user_id;
    const { role } = req.body;

    if (!userId || !role) {
      return res.status(400).json({ error: "User ID and Role are required" });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const result = await User.updateOne(
      { _id: userId },
      { $set: { role: role, updated_at: new Date() } },
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json({ message: "User role updated successfully" });
  } catch (err) {
    console.error("ChangeUserRoleByAdmin error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

export {
  getAllUsers,
  getUserByAdmin,
  deleteUserByAdmin,
  getPaymentHistoryForAdmin,
  getPaymentHistoryOfAUserByAdmin,
  banAccount,
  activeAccount,
  createUserByAdmin,
  changeUserRoleByAdmin,
};
