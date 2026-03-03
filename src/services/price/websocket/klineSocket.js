import WebSocket from 'ws';
import { convertMillisecondsToTimestamp, showErrorSocket } from '../utils/showError.js';

function klineSocket(ws, req) {
  const symbol = (req.query.symbol || '').toLowerCase();
  const wsURL = `wss://stream.binance.com/stream?streams=${symbol}@kline_1s`;

  const binanceWs = new WebSocket(wsURL);
  let receivedMessage = false;

  const timeout = setTimeout(() => {
    if (!receivedMessage) {
      binanceWs.close();
      ws.close(1002, 'Symbol error');
    }
  }, 5000);

  binanceWs.on('message', (data) => {
    receivedMessage = true;
    clearTimeout(timeout);

    try {
      const klineResponse = JSON.parse(data);
      const d = klineResponse.data;
      const k = d.k;

      const response = {
        symbol: d.s,
        eventTime: convertMillisecondsToTimestamp(d.E),
        startTime: convertMillisecondsToTimestamp(k.t),
        closeTime: convertMillisecondsToTimestamp(k.T),
        openPrice: k.o,
        highPrice: k.h,
        lowPrice: k.l,
        baseAssetVolume: k.v,
        quoteAssetVolume: k.q,
        takerBuyBaseVolume: k.V,
        takerBuyQuoteVolume: k.Q,
      };
      ws.send(JSON.stringify(response));
    } catch (err) {
      showErrorSocket(ws, `JSON parse error: ${err.message}`);
    }
  });

  binanceWs.on('error', (err) => {
    console.error('Binance WS error:', err.message);
  });

  binanceWs.on('close', () => {
    clearTimeout(timeout);
  });

  ws.on('message', (msg) => {
    if (msg.toString() === 'disconnect') {
      binanceWs.close();
      ws.close();
    }
  });

  ws.on('close', () => {
    clearTimeout(timeout);
    binanceWs.close();
  });
}

export { klineSocket };
