import https from 'https';
import {
    showError,
    getTimeNow,
    convertMilisecondToTimeFormatedRFC3339,
} from '../utils/showError.js';

async function getKline(req, res) {
    const symbol = req.query.symbol;
    const interval = req.query.interval;

    if (!symbol || !interval) {
        return showError(400, 'Missing data', res);
    }

    const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}`;

    https
        .get(url, (resp) => {
            let data = '';
            resp.on('data', (chunk) => {
                data += chunk;
            });
            resp.on('end', () => {
                if (resp.statusCode !== 200) {
                    return showError(500, 'Internal server error', res);
                }

                try {
                    const rawData = JSON.parse(data);

                    const klineData = rawData.map((item) => ({
                        time: convertMilisecondToTimeFormatedRFC3339(item[0]),
                        open: parseFloat(item[1]) || 0,
                        high: parseFloat(item[2]) || 0,
                        low: parseFloat(item[3]) || 0,
                        close: parseFloat(item[4]) || 0,
                        volume: parseFloat(item[5]) || 0,
                    }));

                    res.status(200).json({
                        symbol,
                        interval,
                        eventTime: getTimeNow(),
                        kline_data: klineData,
                    });
                } catch (e) {
                    showError(500, 'Internal server error', res);
                }
            });
        })
        .on('error', () => {
            showError(500, 'Internal server error', res);
        });
}

export { getKline };
