import https from 'https';
import Alert from '../models/Alert.js';
import { verifyJWT } from '../../../middlewares/authMiddleware.js';

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (resp) => {
      let data = '';
      resp.on('data', chunk => { data += chunk; });
      resp.on('end', () => resolve({ statusCode: resp.statusCode, body: data }));
    }).on('error', reject);
  });
}

async function fetchSymbolsFromBinance() {
  const resp = await httpGet('https://api.binance.com/api/v3/exchangeInfo');
  if (resp.statusCode !== 200) {
    throw new Error(`Binance API returned status ${resp.statusCode}`);
  }

  const data = JSON.parse(resp.body);
  const newSymbols = data.symbols.filter(s => s.status === 'TRADING').map(s => s.symbol);
  const delistedSymbols = data.symbols.filter(s => s.status !== 'TRADING').map(s => s.symbol);

  return { newSymbols, delistedSymbols };
}

async function getSpotPrice(symbol) {
  const resp = await httpGet(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
  const result = JSON.parse(resp.body);
  const price = parseFloat(result.price);
  console.log('Spot price', symbol, ':', price);
  return price;
}

async function getFundingRate(symbol) {
  const resp = await httpGet(`https://fapi.binance.com/fapi/v1/fundingRate?symbol=${symbol}&limit=1`);
  const results = JSON.parse(resp.body);
  if (!results.length) throw new Error('no funding rate data available');
  const fundingRate = parseFloat(results[0].fundingRate);
  console.log('Funding rate', symbol, ':', fundingRate);
  return fundingRate;
}

async function getFuturePrice(symbol) {
  const resp = await httpGet(`https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${symbol}`);
  const result = JSON.parse(resp.body);
  const price = parseFloat(result.lastPrice);
  console.log('Future price', symbol, ':', price);
  return price;
}

async function getFundingRateInterval(symbol) {
  const resp = await httpGet(`https://fapi.binance.com/fapi/v1/fundingInfo?symbol=${symbol}`);
  const results = JSON.parse(resp.body);
  const found = results.find(r => r.symbol === symbol);
  if (!found) throw new Error(`symbol ${symbol} not found in funding info response`);
  const hours = found.fundingIntervalHours;
  const interval = `${hours}h0m0s`;
  console.log('Funding rate interval:', interval);
  return interval;
}

async function getPriceDifference(symbol) {
  const spotPrice = await getSpotPrice(symbol);
  const futurePrice = await getFuturePrice(symbol);
  const diff = futurePrice - spotPrice;
  console.log(`Price difference between Spot and Future for ${symbol}: ${diff.toFixed(2)}`);
  return diff;
}

async function getSymbolAlerts(req, res) {
  try {
    const tokenString = req.headers.authorization;
    if (!tokenString) {
      return res.status(401).json({ error: 'Authorization header required' });
    }

    let claims;
    try {
      claims = verifyJWT(tokenString);
    } catch (e) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    if (!claims.userID) {
      return res.status(401).json({ error: 'User ID not found in token' });
    }

    const { newSymbols, delistedSymbols } = await fetchSymbolsFromBinance();

    res.status(200).json({
      new_symbols: newSymbols || [],
      delisted_symbols: delistedSymbols || [],
    });
  } catch (err) {
    console.error('GetSymbolAlerts error:', err);
    res.status(500).json({ error: 'Failed to retrieve symbols' });
  }
}

async function setSymbolAlert(req, res) {
  try {
    const newAlert = new Alert({
      ...req.body,
      is_active: true,
    });

    await newAlert.save();

    res.status(201).json({
      message: 'Alert created successfully',
      alert_id: newAlert._id.toString(),
    });
  } catch (err) {
    console.error('SetSymbolAlert error:', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: 'Invalid request body' });
    }
    res.status(500).json({ error: 'Failed to create alert' });
  }
}

export {
  fetchSymbolsFromBinance,
  getSpotPrice,
  getFundingRate,
  getFuturePrice,
  getFundingRateInterval,
  getPriceDifference,
  getSymbolAlerts,
  setSymbolAlert,
};
