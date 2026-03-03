import WebSocket from 'ws';
import { convertMillisecondsToTimestamp, convertMillisecondsToHHMMSS, showErrorSocket } from '../utils/showError.js';

function fundingRateSocket(ws, req) {
  const symbol = (req.query.symbol || '').toLowerCase();
  const wsURL = `wss://fstream.binance.com/stream?streams=${symbol}@markPrice@1s`;

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
      const fundingResponse = JSON.parse(data);
      const d = fundingResponse.data;
      const response = {
        symbol: d.s,
        eventTime: convertMillisecondsToTimestamp(d.E),
        fundingRate: d.r,
        fundingCountDown: convertMillisecondsToHHMMSS(d.T - d.E),
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

export { fundingRateSocket };
