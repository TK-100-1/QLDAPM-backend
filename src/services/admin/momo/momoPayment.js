import crypto from 'crypto';
import https from 'https';
import http from 'http';

let partnerCode, accessKey, secretKey, baseURL, redirectURL, ipnURL;

function init() {
    partnerCode = process.env.MOMO_PARTNER_CODE;
    accessKey = process.env.MOMO_ACCESS_KEY;
    secretKey = process.env.MOMO_SECRET_KEY;
    baseURL = process.env.MOMO_BASE_URL;
    redirectURL = process.env.MOMO_REDIRECT_URL;
    ipnURL = process.env.MOMO_IPN_URL;

    const required = {
        MOMO_PARTNER_CODE: partnerCode,
        MOMO_ACCESS_KEY: accessKey,
        MOMO_SECRET_KEY: secretKey,
        MOMO_BASE_URL: baseURL,
        MOMO_REDIRECT_URL: redirectURL,
        MOMO_IPN_URL: ipnURL,
    };
    for (const [key, val] of Object.entries(required)) {
        if (!val) throw new Error(`Environment variable ${key} is not set`);
    }
}

function generateId() {
    return crypto.randomBytes(8).toString('hex');
}

async function createMoMoPayment(amount, vipLevel, orderInfo) {
    const orderId = generateId();
    const requestId = generateId();
    const extraData = '';
    const requestType = 'payWithMethod';

    const rawSignature =
        `accessKey=${accessKey}` +
        `&amount=${amount}` +
        `&extraData=${extraData}` +
        `&ipnUrl=${ipnURL}` +
        `&orderId=${orderId}` +
        `&orderInfo=${orderInfo}` +
        `&partnerCode=${partnerCode}` +
        `&redirectUrl=${redirectURL}` +
        `&requestId=${requestId}` +
        `&requestType=${requestType}`;

    const signature = crypto
        .createHmac('sha256', secretKey)
        .update(rawSignature)
        .digest('hex');

    const payload = {
        partnerCode,
        accessKey,
        requestId,
        amount,
        orderId,
        orderInfo,
        partnerName: 'MoMo Payment',
        storeId: 'Test Store',
        orderGroupId: '',
        autoCapture: true,
        lang: 'vi',
        redirectUrl: redirectURL,
        ipnUrl: ipnURL,
        extraData,
        requestType,
        signature,
    };

    const url = new URL(`${baseURL}/v2/gateway/api/create`);
    const jsonPayload = JSON.stringify(payload);

    return new Promise((resolve, reject) => {
        const transport = url.protocol === 'https:' ? https : http;
        const req = transport.request(
            url,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(jsonPayload),
                },
            },
            (resp) => {
                let data = '';
                resp.on('data', (chunk) => {
                    data += chunk;
                });
                resp.on('end', () => {
                    try {
                        const result = JSON.parse(data);
                        if (!result.payUrl) {
                            console.log(
                                'MoMo payment URL not found or invalid response',
                            );
                            return resolve({ paymentURL: null, orderId });
                        }
                        resolve({ paymentURL: result.payUrl, orderId });
                    } catch (e) {
                        reject(new Error('Error decoding MoMo response'));
                    }
                });
            },
        );

        req.on('error', (err) => reject(err));
        req.write(jsonPayload);
        req.end();
    });
}

function generateQuerySignature(orderId, requestId) {
    const data = `accessKey=${accessKey}&orderId=${orderId}&partnerCode=${partnerCode}&requestId=${requestId}`;
    return crypto.createHmac('sha256', secretKey).update(data).digest('hex');
}

async function queryPaymentStatus(orderId, requestId, lang) {
    const signature = generateQuerySignature(orderId, requestId);

    const payload = {
        partnerCode,
        requestId,
        orderId,
        signature,
        lang: lang || 'vi',
    };

    const url = new URL(`${baseURL}/v2/gateway/api/query`);
    const jsonPayload = JSON.stringify(payload);

    return new Promise((resolve, reject) => {
        const transport = url.protocol === 'https:' ? https : http;
        const req = transport.request(
            url,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(jsonPayload),
                },
            },
            (resp) => {
                let data = '';
                resp.on('data', (chunk) => {
                    data += chunk;
                });
                resp.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(new Error('Error decoding MoMo query response'));
                    }
                });
            },
        );

        req.on('error', (err) => reject(err));
        req.write(jsonPayload);
        req.end();
    });
}

export { init, createMoMoPayment, queryPaymentStatus };
