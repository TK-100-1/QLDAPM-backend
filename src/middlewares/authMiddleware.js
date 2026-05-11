import jwt from "jsonwebtoken";
import Role from "../services/admin/models/Role.js";

// Token blacklist: Map<tokenString, expiresAt Date>
const blacklistedTokens = new Map();

function authMiddleware(...allowedPermissions) {
  return async (req, res, next) => {
    const tokenString = req.headers.authorization;

        if (!tokenString) {
            return res
                .status(401)
                .json({ error: 'Authorization header required' });
        }

        // Check if token is blacklisted
        if (blacklistedTokens.has(tokenString)) {
            const expTime = blacklistedTokens.get(tokenString);
            if (new Date() > expTime) {
                blacklistedTokens.delete(tokenString);
            } else {
                return res
                    .status(401)
                    .json({ error: 'Token has been revoked' });
            }
        }

        try {
            const decoded = jwt.verify(tokenString, process.env.JWT_SECRET);

      const userRoleName = decoded.role;

      let hasAccess = false;
      if (allowedPermissions.length === 0) {
        hasAccess = true;
      } else if (userRoleName === "Admin") {
        hasAccess = true; // Admin bypasses all checks
      } else {
        const role = await Role.findOne({ name: userRoleName }).lean();
        if (role && role.permissions) {
            hasAccess = allowedPermissions.some(p => role.permissions.includes(p));
        }
      }

      if (!hasAccess) {
        return res
          .status(403)
          .json({ error: "Access forbidden: insufficient role permissions" });
      }

            req.user = { user_id: decoded.user_id, role: userRole };
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
            role: normalizeRole(decoded.role),
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
        role: normalizeRole(role),
    };

    return jwt.sign(payload, tokenSecret, { expiresIn: ttlSeconds });
}

export { authMiddleware, verifyJWT, generateToken, blacklistedTokens };
