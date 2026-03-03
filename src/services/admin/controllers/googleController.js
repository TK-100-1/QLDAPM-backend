import { v4 as uuidv4 } from 'uuid';
import User from '../models/User.js';
import { generateToken } from '../../../middlewares/authMiddleware.js';
import { verifyGoogleIDToken } from '../utils/googleVerify.js';

function generateUniqueUsername() {
  return 'user-' + uuidv4();
}

async function googleLogin(req, res) {
  try {
    const idToken = req.body.id_token;

    let userInfo;
    try {
      userInfo = await verifyGoogleIDToken(idToken);
    } catch (e) {
      return res.status(401).json({ error: 'Invalid Google ID token' });
    }

    const email = userInfo.email;

    let user = await User.findOne({ email });

    if (!user) {
      // Create new user
      user = await User.create({
        username: generateUniqueUsername(),
        email,
        role: 'VIP-0',
        is_active: true,
        profile: {
          full_name: userInfo.name || '',
          avatar_url: userInfo.picture || 'https://drive.google.com/file/d/15Ef4yebpGhT8pwgnt__utSESZtJdmA4a/view?usp=sharing',
        },
      });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Your account is banned' });
    }

    const token = generateToken(user._id.toString(), user.role);

    res.status(200).json({ message: 'Login successful', token });
  } catch (err) {
    console.error('GoogleLogin error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

export { googleLogin };
