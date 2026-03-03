import WebSocket from 'ws';
import { convertMillisecondsToTimestamp, showErrorSocket } from '../utils/showError.js';

function spotPriceSocket(ws, req) {
  const symbol = (req.query.symbol || '').toLowerCase();
  const wsURL = `wss://stream.binance.com/ws/${symbol}@ticker`;

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
      const tickerResponse = JSON.parse(data);
      const response = {
        symbol: tickerResponse.s,
        price: tickerResponse.c,
        eventTime: convertMillisecondsToTimestamp(tickerResponse.E),
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

export { spotPriceSocket };
