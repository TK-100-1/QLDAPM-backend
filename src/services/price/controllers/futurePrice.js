import https from 'https';

async function getFuturePrice(req, res) {
  const symbol = req.query.symbol;
  if (!symbol) {
    return res.status(400).json({ error: 'symbol cannot be empty' });
  }

  const url = `https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${encodeURIComponent(symbol)}`;

  https.get(url, (resp) => {
    let data = '';
    resp.on('data', chunk => { data += chunk; });
    resp.on('end', () => {
      if (resp.statusCode !== 200) {
        return res.status(500).json({ error: `API returned status code: ${resp.statusCode}` });
      }
      try {
        const binanceResp = JSON.parse(data);
        const eventTime = new Date(binanceResp.time).toISOString().replace('T', ' ').substring(0, 19);
        res.status(200).json({
          symbol: binanceResp.symbol,
          price: binanceResp.markPrice,
          eventTime,
        });
      } catch (e) {
        res.status(500).json({ error: `failed to decode response: ${e.message}` });
      }
    });
  }).on('error', (err) => {
    res.status(500).json({ error: `failed to fetch future price: ${err.message}` });
  });
}

export { getFuturePrice };
