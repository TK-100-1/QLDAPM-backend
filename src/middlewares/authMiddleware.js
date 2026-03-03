import jwt from 'jsonwebtoken';

// Token blacklist: Map<tokenString, expiresAt Date>
const blacklistedTokens = new Map();

function authMiddleware(...allowedRoles) {
  return (req, res, next) => {
    const tokenString = req.headers.authorization;

    if (!tokenString) {
      return res.status(401).json({ error: 'Authorization header required' });
    }

    // Check if token is blacklisted
    if (blacklistedTokens.has(tokenString)) {
      const expTime = blacklistedTokens.get(tokenString);
      if (new Date() > expTime) {
        blacklistedTokens.delete(tokenString);
      } else {
        return res.status(401).json({ error: 'Token has been revoked' });
      }
    }

    try {
      const decoded = jwt.verify(tokenString, process.env.JWT_SECRET);

      const userRole = decoded.role;
      const hasAccess = allowedRoles.includes(userRole);

      if (!hasAccess) {
        return res.status(403).json({ error: 'Access forbidden: insufficient role' });
      }

      req.user = { user_id: decoded.user_id, role: decoded.role };
      next();
    } catch (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };
}

function verifyJWT(tokenString) {
  const jwtKey = process.env.JWT_SECRET;

  try {
    const decoded = jwt.verify(tokenString, jwtKey);
    return {
      userID: decoded.user_id,
      role: decoded.role,
      expiresAt: new Date(decoded.exp * 1000),
    };
  } catch (err) {
    throw new Error('invalid token');
  }
}

function generateToken(userID, role) {
  const tokenSecret = process.env.JWT_SECRET;
  const tokenTTL = process.env.JWT_TOKEN_TTL;

  if (!tokenTTL) {
    throw new Error('Environment variable JWT_TOKEN_TTL is not set');
  }

  const ttlSeconds = parseInt(tokenTTL, 10);
  if (isNaN(ttlSeconds)) {
    throw new Error('Invalid JWT_TOKEN_TTL format');
  }

  const payload = {
    user_id: userID,
    role: role,
  };

  return jwt.sign(payload, tokenSecret, { expiresIn: ttlSeconds });
}

export {
  authMiddleware,
  verifyJWT,
  generateToken,
  blacklistedTokens,
};
