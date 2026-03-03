import https from 'https';
import { showError, convertMillisecondsToHHMMSS, convertMillisecondsToTimestamp } from '../utils/showError.js';

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (resp) => {
      let data = '';
      resp.on('data', chunk => { data += chunk; });
      resp.on('end', () => {
        resolve({ statusCode: resp.statusCode, body: data });
      });
    }).on('error', reject);
  });
}

async function getFundingRate(req, res) {
  const symbol = req.query.symbol;
  if (!symbol) {
    return showError(400, 'Missing symbol', res);
  }

  try {
    // Get funding rate first data
    const resp1 = await httpGet(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${encodeURIComponent(symbol)}`);
    if (resp1.statusCode === 400) {
      return showError(400, 'Error information.', res);
    }
    if (resp1.statusCode !== 200) {
      return showError(500, 'Server error.', res);
    }

    const fundingFirst = JSON.parse(resp1.body);

    // Get funding rate second data
    let fundingSecond = {
      symbol,
      adjustedFundingRateCap: 'unknown',
      adjustedFundingRateFloor: 'unknown',
      fundingIntervalHours: -1,
    };

    try {
      const resp2 = await httpGet('https://fapi.binance.com/fapi/v1/fundingInfo');
      if (resp2.statusCode === 200) {
        const fundingInfoList = JSON.parse(resp2.body);
        const found = fundingInfoList.find(item => item.symbol === symbol);
        if (found) {
          fundingSecond = found;
        }
      }
    } catch (e) {
      // Use defaults
    }

    const fCountDown = convertMillisecondsToHHMMSS(fundingFirst.nextFundingTime - fundingFirst.time);
    const eventTime = convertMillisecondsToTimestamp(fundingFirst.time);

    res.status(200).json({
      symbol: fundingFirst.symbol,
      fundingRate: fundingFirst.lastFundingRate,
      fundingCountDown: fCountDown,
      eventTime,
      adjustedFundingRateCap: fundingSecond.adjustedFundingRateCap || 'unknown',
      adjustedFundingRateFloor: fundingSecond.adjustedFundingRateFloor || 'unknown',
      fundingIntervalHours: fundingSecond.fundingIntervalHours || -1,
    });
  } catch (err) {
    showError(500, err.message, res);
  }
}

export { getFundingRate };
