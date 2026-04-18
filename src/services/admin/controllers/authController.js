import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import {
    verifyJWT,
    generateToken,
    blacklistedTokens,
} from '../../../middlewares/authMiddleware.js';
import {
    isValidUsername,
    isValidPassword,
    isValidPhoneNumber,
    isValidEmail,
} from '../utils/validation.js';
import { generateOTP, hashString } from '../utils/tokenUtils.js';
import { sendEmail } from '../utils/emailUtils.js';

function newUser(data) {
    data.role = 'VIP-0';
    data.is_active = true;
    if (!data.profile) data.profile = {};
    if (!data.profile.full_name) data.profile.full_name = data.username;
    if (!data.profile.avatar_url) {
        data.profile.avatar_url =
            'https://drive.google.com/file/d/15Ef4yebpGhT8pwgnt__utSESZtJdmA4a/view?usp=sharing';
    }
    return data;
}

async function register(req, res) {
    try {
        const { username, email, password, profile } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Invalid input' });
        }

        if (!isValidEmail(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        if (!isValidUsername(username)) {
            return res.status(400).json({
                error: 'Username only alphanumeric characters and hyphens are allowed.',
            });
        }

        if (!isValidPassword(password)) {
            return res.status(400).json({
                error: 'Password must contain at least 8 characters, including letters, numbers, and special characters.',
            });
        }

        if (profile && profile.phone_number && profile.phone_number !== '') {
            if (!isValidPhoneNumber(profile.phone_number)) {
                return res.status(400).json({ error: 'Invalid phone number.' });
            }
        }

        // Check if username already exists
        const userByName = await User.findOne({ username });
        if (userByName) {
            return res.status(409).json({ error: 'Username already exists' });
        }

        // Check if email already exists
        const userByEmail = await User.findOne({ email });
        if (userByEmail) {
            return res.status(409).json({ error: 'Email already exists' });
        }

        // Check if phone already exists
        if (profile && profile.phone_number && profile.phone_number !== '') {
            const userByPhone = await User.findOne({
                'profile.phone_number': profile.phone_number,
            });
            if (userByPhone) {
                return res
                    .status(409)
                    .json({ error: 'Phone number already exists' });
            }
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const userData = newUser({
            username,
            email,
            password: hashedPassword,
            profile: profile || {},
        });

        await User.create(userData);

        res.status(201).json({ message: 'User registered successfully' });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

async function login(req, res) {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Invalid input' });
        }

        const user = await User.findOne({
            $or: [{ email: username }, { username: username }],
        });

        if (!user) {
            return res
                .status(401)
                .json({ error: 'Username or password is incorrect' });
        }

        if (!user.is_active) {
            return res.status(403).json({
                error: 'Your account has been banned. Please contact support for assistance.',
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res
                .status(401)
                .json({ error: 'Username or password is incorrect' });
        }

        const token = generateToken(user._id.toString(), user.role);

        res.status(200).json({ message: 'Login successful', token });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

async function logout(req, res) {
    try {
        const tokenString = req.headers.authorization;
        if (!tokenString) {
            return res.status(400).json({ error: 'No token provided' });
        }

        try {
            const claims = verifyJWT(tokenString);
            blacklistedTokens.set(tokenString, claims.expiresAt);
        } catch (e) {
            // Token invalid, still return success
        }

        res.status(200).json({ message: 'Logout successful' });
    } catch (err) {
        console.error('Logout error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

async function forgotPassword(req, res) {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Invalid request format' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res
                .status(404)
                .json({ error: 'User not found with this email' });
        }

        const otp = generateOTP(6);
        const hashedOTP = hashString(otp);
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

        await User.updateOne(
            { _id: user._id },
            {
                $set: {
                    reset_password_otp: hashedOTP,
                    reset_password_expires: expiresAt,
                },
            },
        );

        await sendEmail(email, 'Password Reset Request', user.username, otp);

        res.status(200).json({
            message: 'Password reset OTP sent to your email',
        });
    } catch (err) {
        console.error('ForgotPassword error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

async function resetPassword(req, res) {
    try {
        const { otp, new_password } = req.body;
        if (!otp || !new_password) {
            return res.status(400).json({ error: 'Invalid request format' });
        }

        if (!isValidPassword(new_password)) {
            return res.status(400).json({
                error: 'Password must contain at least 8 characters, including letters, numbers, and special characters.',
            });
        }

        const hashedOTP = hashString(otp);

        const user = await User.findOne({
            reset_password_otp: hashedOTP,
            reset_password_expires: { $gt: new Date() },
        });

        if (!user) {
            return res.status(401).json({ error: 'Invalid or expired OTP' });
        }

        const hashedPassword = await bcrypt.hash(new_password, 10);

        await User.updateOne(
            { _id: user._id },
            {
                $set: { password: hashedPassword },
                $unset: { reset_password_otp: '', reset_password_expires: '' },
            },
        );

        res.status(200).json({ message: 'Password changed successfully' });
    } catch (err) {
        console.error('ResetPassword error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

async function refreshToken(req, res) {
    try {
        const tokenString = req.headers.authorization;
        if (!tokenString) {
            return res
                .status(401)
                .json({ error: 'Authorization header required' });
        }

        if (blacklistedTokens.has(tokenString)) {
            return res
                .status(401)
                .json({ error: 'Token has been blacklisted' });
        }

        let tokenClaims;
        try {
            tokenClaims = verifyJWT(tokenString);
        } catch (e) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        const newToken = generateToken(tokenClaims.userID, tokenClaims.role);

        blacklistedTokens.set(tokenString, tokenClaims.expiresAt);

        res.status(200).json({
            message: 'Token refreshed successfully',
            token: newToken,
        });
    } catch (err) {
        console.error('RefreshToken error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

export { register, login, logout, forgotPassword, resetPassword, refreshToken };
