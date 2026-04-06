import express from 'express';
import { authMiddleware } from '../../../middlewares/authMiddleware.js';
import { getSpotPrice } from '../controllers/spotPrice.js';
import { getFuturePrice } from '../controllers/futurePrice.js';
import { getFundingRate } from '../controllers/fundingRate.js';
import { getKline } from '../controllers/kline.js';
import { spotPriceSocket } from '../websocket/spotPriceSocket.js';
import { futurePriceSocket } from '../websocket/futurePriceSocket.js';
import { fundingRateSocket } from '../websocket/fundingRateSocket.js';
import { klineSocket } from '../websocket/klineSocket.js';
import { marketCapSocket } from '../websocket/marketCapSocket.js';

function setupPriceRoutes(app) {
  const router = express.Router();

  // REST endpoints
  router.get('/v1/funding-rate', getFundingRate);
  router.get('/v1/spot-price', getSpotPrice);
  router.get('/v1/future-price', getFuturePrice);

  // VIP-1+ kline
  // router.get('/v1/vip1/kline', authMiddleware('VIP-1', 'VIP-2', 'VIP-3'), getKline);
  router.get('/v1/vip1/kline', getKline);

  app.use('/api', router);
}

// WebSocket route handler map
const wsRoutes = {
  '/api/v1/funding-rate/websocket': fundingRateSocket,
  '/api/v1/spot-price/websocket': spotPriceSocket,
  '/api/v1/future-price/websocket': futurePriceSocket,
  '/api/v1/market-stats': marketCapSocket,
  '/api/v1/vip1/kline/websocket': klineSocket,
};

export { setupPriceRoutes, wsRoutes };
