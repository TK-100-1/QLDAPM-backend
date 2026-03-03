import https from 'https';

function verifyGoogleIDToken(idToken) {
  return new Promise((resolve, reject) => {
    const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;

    https.get(url, (resp) => {
      let data = '';
      resp.on('data', (chunk) => { data += chunk; });
      resp.on('end', () => {
        if (resp.statusCode !== 200) {
          return reject(new Error(`invalid token: status ${resp.statusCode}`));
        }
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('failed to decode tokeninfo response'));
        }
      });
    }).on('error', (err) => {
      reject(new Error(`failed to reach tokeninfo endpoint: ${err.message}`));
    });
  });
}

export { verifyGoogleIDToken };
