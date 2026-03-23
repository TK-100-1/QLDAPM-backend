import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Order from '../models/Order.js';
import { verifyJWT } from '../../../middlewares/authMiddleware.js';
import {
    isValidUsername,
    isValidPassword,
    isValidPhoneNumber,
} from '../utils/validation.js';

async function getCurrentUserInfo(req, res) {
    try {
        const tokenString = req.headers.authorization;
        if (!tokenString) {
            return res
                .status(401)
                .json({ error: 'Authorization header required' });
        }

        let claims;
        try {
            claims = verifyJWT(tokenString);
        } catch (e) {
            return res.status(401).json({ error: 'invalid token' });
        }

        const currentUserID = claims.userID;
        if (!currentUserID) {
            return res
                .status(401)
                .json({ error: 'User ID not found in token' });
        }

        if (!mongoose.Types.ObjectId.isValid(currentUserID)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        const user = await User.findById(currentUserID);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.status(200).json({
            name: user.profile.full_name,
            username: user.username,
            email: user.email,
            phone_number: user.profile.phone_number,
            avatar: user.profile.avatar_url,
            bio: user.profile.bio,
            date_of_birth: user.profile.date_of_birth,
            vip_level: user.role,
        });
    } catch (err) {
        console.error('GetCurrentUserInfo error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

async function updateUserProfile(req, res) {
    try {
        const { name, username, phone, avatar, bio, dateOfBirth } = req.body;

        if (username && !isValidUsername(username)) {
            return res.status(400).json({ error: 'Invalid username' });
        }
        if (phone && !isValidPhoneNumber(phone)) {
            return res.status(400).json({ error: 'Invalid phone number' });
        }

        const tokenString = req.headers.authorization;
        if (!tokenString) {
            return res
                .status(401)
                .json({ error: 'Authorization header required' });
        }

        let claims;
        try {
            claims = verifyJWT(tokenString);
        } catch (e) {
            return res.status(401).json({ error: e.message });
        }

        const currentUserID = claims.userID;
        if (!currentUserID) {
            return res
                .status(401)
                .json({ error: 'User ID not found in token' });
        }

        if (!mongoose.Types.ObjectId.isValid(currentUserID)) {
            return res.status(400).json({ error: 'Invalid user ID format' });
        }

        // Check for duplicate username or phone
        const orConditions = [];
        if (username) orConditions.push({ username });
        if (phone) orConditions.push({ 'profile.phone_number': phone });

        if (orConditions.length > 0) {
            const existingUsers = await User.find({
                $or: orConditions,
                _id: { $ne: currentUserID },
            });

            for (const existingUser of existingUsers) {
                if (username && username === existingUser.username) {
                    return res
                        .status(409)
                        .json({ error: 'Username already in use' });
                }
                if (phone && phone === existingUser.profile.phone_number) {
                    return res
                        .status(409)
                        .json({ error: 'Phone number already in use' });
                }
            }
        }

        const updateFields = { updated_at: new Date() };
        if (name) updateFields['profile.full_name'] = name;
        if (username) updateFields.username = username;
        if (phone) updateFields['profile.phone_number'] = phone;
        if (avatar) updateFields['profile.avatar_url'] = avatar;
        if (bio) updateFields['profile.bio'] = bio;
        if (dateOfBirth) updateFields['profile.date_of_birth'] = dateOfBirth;

        const result = await User.updateOne(
            { _id: currentUserID },
            { $set: updateFields },
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.status(200).json({
            message: 'User information updated successfully',
        });
    } catch (err) {
        console.error('UpdateUserProfile error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

async function changePassword(req, res) {
    try {
        const { current_password, new_password } = req.body;

        if (!current_password || !new_password) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (!isValidPassword(new_password)) {
            return res.status(400).json({
                error: 'Password must contain at least 8 characters, including letters, numbers, and special characters.',
            });
        }

        const tokenString = req.headers.authorization;
        if (!tokenString) {
            return res
                .status(401)
                .json({ error: 'Authorization header required' });
        }

        let claims;
        try {
            claims = verifyJWT(tokenString);
        } catch (e) {
            return res.status(401).json({ error: e.message });
        }

        const currentUserID = claims.userID;
        if (!currentUserID) {
            return res
                .status(401)
                .json({ error: 'User ID not found in token' });
        }

        if (!mongoose.Types.ObjectId.isValid(currentUserID)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        const user = await User.findById(currentUserID);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const isMatch = await bcrypt.compare(current_password, user.password);
        if (!isMatch) {
            return res
                .status(401)
                .json({ error: 'Current password is incorrect' });
        }

        const hashedPassword = await bcrypt.hash(new_password, 10);

        const result = await User.updateOne(
            { _id: currentUserID },
            { $set: { password: hashedPassword, updated_at: new Date() } },
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.status(200).json({ message: 'Password updated successfully' });
    } catch (err) {
        console.error('ChangePassword error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

async function changeEmail(req, res) {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        const tokenString = req.headers.authorization;
        if (!tokenString) {
            return res
                .status(401)
                .json({ error: 'Authorization header required' });
        }

        let claims;
        try {
            claims = verifyJWT(tokenString);
        } catch (e) {
            return res.status(401).json({ error: e.message });
        }

        const currentUserID = claims.userID;
        if (!currentUserID) {
            return res
                .status(401)
                .json({ error: 'User ID not found in token' });
        }

        if (!mongoose.Types.ObjectId.isValid(currentUserID)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        // Check if email already exists (excluding current user)
        const existingUser = await User.findOne({
            email,
            _id: { $ne: currentUserID },
        });

        if (existingUser) {
            return res.status(409).json({ error: 'Email already exists.' });
        }

        const result = await User.updateOne(
            { _id: currentUserID },
            { $set: { email, updated_at: new Date() } },
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.status(200).json({ message: 'Email updated successfully' });
    } catch (err) {
        console.error('ChangeEmail error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

async function deleteCurrentUser(req, res) {
    try {
        const tokenString = req.headers.authorization;
        if (!tokenString) {
            return res
                .status(401)
                .json({ error: 'Authorization header required' });
        }

        let claims;
        try {
            claims = verifyJWT(tokenString);
        } catch (e) {
            return res.status(401).json({ error: e.message });
        }

        const currentUserID = claims.userID;
        if (!currentUserID) {
            return res
                .status(401)
                .json({ error: 'User ID not found in token' });
        }

        if (!mongoose.Types.ObjectId.isValid(currentUserID)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        const result = await User.deleteOne({ _id: currentUserID });
        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.status(200).json({ message: 'User account deleted successfully' });
    } catch (err) {
        console.error('DeleteCurrentUser error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

async function getPaymentHistory(req, res) {
    try {
        const tokenString = req.headers.authorization;
        if (!tokenString) {
            return res
                .status(401)
                .json({ error: 'Authorization header required' });
        }

        let claims;
        try {
            claims = verifyJWT(tokenString);
        } catch (e) {
            return res.status(401).json({ error: e.message });
        }

        const userID = claims.userID;
        if (!userID) {
            return res.status(401).json({ error: 'Invalid token claims' });
        }

        const payments = await Order.find({ user_id: userID });

        if (payments.length === 0) {
            return res
                .status(200)
                .json({ message: 'No payment history found' });
        }

        const paymentHistory = payments.map((payment) => ({
            OrderInfo: payment.orderInfo,
            TransactionStatus: payment.transaction_status,
            Amount: payment.amount,
            CreatedAt: payment.created_at,
            UpdatedAt: payment.updated_at,
        }));

        res.status(200).json({ payment_history: paymentHistory });
    } catch (err) {
        console.error('GetPaymentHistory error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

async function uploadAvatar(req, res) {
    try {
        const tokenString = req.headers.authorization;
        if (!tokenString) {
            return res
                .status(401)
                .json({ error: 'Authorization header required' });
        }

        let claims;
        try {
            claims = verifyJWT(tokenString);
        } catch (e) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        const userID = claims.userID;

        if (!mongoose.Types.ObjectId.isValid(userID)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        // check file
        if (!req.file) {
            return res.status(400).json({
                message: 'No file uploaded',
            });
        }

        const avatarPath = req.file.path.replace(/\\/g, '/');

        // 👉 chỉ lưu path (khuyến nghị)
        const avatarUrl = `/${avatarPath}`;

        await User.updateOne(
            { _id: userID },
            {
                $set: {
                    'profile.avatar_url': avatarUrl,
                    updated_at: new Date(),
                },
            },
        );

        return res.json({
            message: 'Upload avatar successfully',
            avatar: avatarUrl,
        });
    } catch (err) {
        console.error('UploadAvatar error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

export {
    getCurrentUserInfo,
    updateUserProfile,
    changePassword,
    changeEmail,
    deleteCurrentUser,
    getPaymentHistory,
    uploadAvatar,
};
