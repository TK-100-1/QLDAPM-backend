import { blacklistedTokens } from '../../../middlewares/authMiddleware.js';

function startCleanupRoutine(intervalMs) {
  setInterval(() => {
    const now = new Date();
    for (const [token, expTime] of blacklistedTokens.entries()) {
      if (now > expTime) {
        blacklistedTokens.delete(token);
      }
    }
  }, intervalMs);
}

export { startCleanupRoutine };
