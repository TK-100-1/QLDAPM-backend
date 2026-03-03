import https from 'https';

function processMarketCapSocket(urlMarketCap, ws) {
  return new Promise((resolve) => {
    const fullUrl = `${urlMarketCap}?localization=false&tickers=false&community_data=false`;

    https.get(fullUrl, (resp) => {
      let data = '';
      resp.on('data', chunk => { data += chunk; });
      resp.on('end', () => {
        if (resp.statusCode === 429) {
          ws.close(1000, 'Rate limit, please wait.');
          return resolve(false);
        }
        if (resp.statusCode !== 200) {
          ws.close(1000, 'Symbol missing or invalid');
          return resolve(false);
        }

        try {
          const marketCapResponse = JSON.parse(data);
          const response = {
            symbol: marketCapResponse.symbol,
            market_cap: marketCapResponse.market_data?.market_cap?.usd || 0,
            '24h_volume': marketCapResponse.market_data?.total_volume?.usd || 0,
          };
          ws.send(JSON.stringify(response));
          resolve(true);
        } catch (err) {
          console.error('Error parsing market cap response:', err.message);
          resolve(true);
        }
      });
    }).on('error', (err) => {
      console.error('Error http request:', err.message);
      resolve(true);
    });
  });
}

function marketCapSocket(ws, req) {
  const symbol = (req.query.symbol || '').toLowerCase();
  const urlMarketCap = `https://api.coingecko.com/api/v3/coins/${symbol}`;

  let stopped = false;
  let intervalId = null;

  async function fetchAndSend() {
    if (stopped) return;
    const shouldContinue = await processMarketCapSocket(urlMarketCap, ws);
    if (!shouldContinue) {
      stopped = true;
      if (intervalId) clearInterval(intervalId);
    }
  }

  // Initial fetch
  fetchAndSend();

  // Poll every 15 minutes
  intervalId = setInterval(fetchAndSend, 15 * 60 * 1000);

  ws.on('message', (msg) => {
    if (msg.toString() === 'disconnect') {
      stopped = true;
      if (intervalId) clearInterval(intervalId);
      ws.close();
    }
  });

  ws.on('close', () => {
    stopped = true;
    if (intervalId) clearInterval(intervalId);
  });
}

export { marketCapSocket };
