import https from 'https';
import {
  showError,
  getTimeNow,
  convertMilisecondToTimeFormatedRFC3339,
} from '../utils/showError.js';

async function getKline(req, res) {
  const { symbol, interval, limit = 100 } = req.query;

  if (!symbol || !interval) {
    return showError(400, 'Missing data', res);
  }

  const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=${limit}`;

  const request = https.get(url, resp => {
    let data = '';

    resp.on('data', chunk => (data += chunk));

    resp.on('end', () => {
      try {
        const rawData = JSON.parse(data);

        if (resp.statusCode !== 200) {
          return res.status(resp.statusCode).json(rawData);
        }

        if (!Array.isArray(rawData)) {
          return showError(400, 'Invalid data from Binance', res);
        }

        const klineData = rawData.map(item => ({
          time: convertMilisecondToTimeFormatedRFC3339(item[0]),
          open: Number(item[1]),
          high: Number(item[2]),
          low: Number(item[3]),
          close: Number(item[4]),
          volume: Number(item[5]),
        }));

        res.status(200).json({
          symbol,
          interval,
          eventTime: getTimeNow(),
          kline_data: klineData,
        });
      } catch (e) {
        showError(500, 'Parse error', res);
      }
    });
  });

  request.on('error', () => {
    showError(500, 'Request error', res);
  });

  request.setTimeout(5000, () => {
    request.destroy();
    showError(504, 'Timeout', res);
  });
}

export { getKline };
