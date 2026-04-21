import https from 'https';
import Alert from '../models/Alert.js';
import { verifyJWT } from '../../../middlewares/authMiddleware.js';

function httpGet(url) {
    return new Promise((resolve, reject) => {
        https
            .get(url, (resp) => {
                let data = '';
                resp.on('data', (chunk) => {
                    data += chunk;
                });
                resp.on('end', () =>
                    resolve({ statusCode: resp.statusCode, body: data }),
                );
            })
            .on('error', reject);
    });
}

function normalizeBinanceSymbol(symbol) {
    const normalized = String(symbol || '')
        .trim()
        .toUpperCase();
    if (!normalized) {
        throw new Error('symbol is required');
    }

    const baseAliases = {
        BITCOIN: 'BTC',
        ETHEREUM: 'ETH',
        RIPPLE: 'XRP',
        TETHER: 'USDT',
        BTC: 'BTC',
        ETH: 'ETH',
        XRP: 'XRP',
        BNB: 'BNB',
    };

    const knownQuotes = ['USDT', 'FDUSD', 'BUSD', 'USDC', 'BTC', 'ETH', 'BNB'];
    const quoteOnlyAssets = ['USDT', 'FDUSD', 'BUSD', 'USDC']; // Assets that cannot be base

    const quote = knownQuotes.find(
        (q) => normalized.endsWith(q) && normalized.length > q.length,
    );

    if (quote) {
        const baseRaw = normalized.slice(0, -quote.length);
        const mappedBase = baseAliases[baseRaw] || baseRaw;
        return `${mappedBase}${quote}`;
    }

    const mapped = baseAliases[normalized] || normalized;
    if (quoteOnlyAssets.includes(mapped)) {
        throw new Error(`Invalid coin symbol without base asset: ${symbol}`);
    }

    return `${mapped}USDT`;
}

function parseFiniteNumber(value, fieldName, symbol) {
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) {
        throw new Error(`Invalid ${fieldName} for ${symbol}: ${value}`);
    }
    return parsed;
}

async function getKlineClosePrices(symbol, interval = '1m', limit = 100) {
    const normalizedSymbol = normalizeBinanceSymbol(symbol);
    const sanitizedLimit = Number.isFinite(limit)
        ? Math.min(Math.max(Math.trunc(limit), 2), 1000)
        : 100;

    const resp = await httpGet(
        `https://api.binance.com/api/v3/klines?symbol=${normalizedSymbol}&interval=${interval}&limit=${sanitizedLimit}`,
    );

    if (resp.statusCode !== 200) {
        throw new Error(
            `Binance kline API returned status ${resp.statusCode} for ${normalizedSymbol}`,
        );
    }

    const rows = JSON.parse(resp.body);
    if (!Array.isArray(rows) || rows.length === 0) {
        throw new Error(`No kline data available for ${normalizedSymbol}`);
    }

    return rows.map((row) =>
        parseFiniteNumber(row[4], 'kline close', normalizedSymbol),
    );
}

async function fetchSymbolsFromBinance() {
    const resp = await httpGet('https://api.binance.com/api/v3/exchangeInfo');
    if (resp.statusCode !== 200) {
        throw new Error(`Binance API returned status ${resp.statusCode}`);
    }

    const data = JSON.parse(resp.body);
    const newSymbols = data.symbols
        .filter((s) => s.status === 'TRADING')
        .map((s) => s.symbol);
    const delistedSymbols = data.symbols
        .filter((s) => s.status !== 'TRADING')
        .map((s) => s.symbol);

    return { newSymbols, delistedSymbols };
}

async function getSpotPrice(symbol) {
    const normalizedSymbol = normalizeBinanceSymbol(symbol);
    const resp = await httpGet(
        `https://api.binance.com/api/v3/ticker/price?symbol=${normalizedSymbol}`,
    );
    if (resp.statusCode !== 200) {
        throw new Error(
            `Binance spot API returned status ${resp.statusCode} for ${normalizedSymbol}`,
        );
    }
    const result = JSON.parse(resp.body);
    const price = parseFiniteNumber(
        result.price,
        'spot price',
        normalizedSymbol,
    );
    console.log('Spot price', normalizedSymbol, ':', price);
    return price;
}

async function getFundingRate(symbol) {
    const normalizedSymbol = normalizeBinanceSymbol(symbol);
    const resp = await httpGet(
        `https://fapi.binance.com/fapi/v1/fundingRate?symbol=${normalizedSymbol}&limit=1`,
    );
    if (resp.statusCode !== 200) {
        throw new Error(
            `Binance funding API returned status ${resp.statusCode} for ${normalizedSymbol}`,
        );
    }
    const results = JSON.parse(resp.body);
    if (!results.length) throw new Error('no funding rate data available');
    const fundingRate = parseFiniteNumber(
        results[0].fundingRate,
        'funding rate',
        normalizedSymbol,
    );
    console.log('Funding rate', normalizedSymbol, ':', fundingRate);
    return fundingRate;
}

async function getFuturePrice(symbol) {
    const normalizedSymbol = normalizeBinanceSymbol(symbol);
    const resp = await httpGet(
        `https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${normalizedSymbol}`,
    );
    if (resp.statusCode !== 200) {
        throw new Error(
            `Binance future API returned status ${resp.statusCode} for ${normalizedSymbol}`,
        );
    }
    const result = JSON.parse(resp.body);
    const price = parseFiniteNumber(
        result.lastPrice,
        'future price',
        normalizedSymbol,
    );
    console.log('Future price', normalizedSymbol, ':', price);
    return price;
}

async function getFundingRateInterval(symbol) {
    const normalizedSymbol = normalizeBinanceSymbol(symbol);
    const resp = await httpGet(
        `https://fapi.binance.com/fapi/v1/fundingInfo?symbol=${normalizedSymbol}`,
    );
    if (resp.statusCode !== 200) {
        throw new Error(
            `Binance funding interval API returned status ${resp.statusCode} for ${normalizedSymbol}`,
        );
    }
    const results = JSON.parse(resp.body);
    const found = results.find((r) => r.symbol === normalizedSymbol);
    if (!found)
        throw new Error(
            `symbol ${normalizedSymbol} not found in funding info response`,
        );
    const hours = found.fundingIntervalHours;
    const interval = `${hours}h0m0s`;
    console.log('Funding rate interval:', interval);
    return interval;
}

async function getPriceDifference(symbol) {
    const spotPrice = await getSpotPrice(symbol);
    const futurePrice = await getFuturePrice(symbol);
    const diff = futurePrice - spotPrice;
    console.log(
        `Price difference between Spot and Future for ${symbol}: ${diff.toFixed(2)}`,
    );
    return diff;
}

async function getSymbolAlerts(req, res) {
    try {
        const tokenString = req.headers.authorization;
        if (!tokenString) {
            return res
                .status(401)
                .json({ error: 'Authorization header required' });
        }

        let claims;
        try {
            claims = verifyJWT(tokenString);
        } catch (e) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        if (!claims.userID) {
            return res
                .status(401)
                .json({ error: 'User ID not found in token' });
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
    normalizeBinanceSymbol,
    fetchSymbolsFromBinance,
    getSpotPrice,
    getFundingRate,
    getFuturePrice,
    getFundingRateInterval,
    getPriceDifference,
    getKlineClosePrices,
    getSymbolAlerts,
    setSymbolAlert,
};
