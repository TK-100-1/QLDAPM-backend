import crypto from 'crypto';

function calculateSignature(rawSignature, secretKey) {
  return crypto.createHmac('sha256', secretKey).update(rawSignature).digest('hex');
}

function momoCallback(req, res) {
  const callbackData = req.body;

  if (!callbackData || !callbackData.signature) {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }

  const signature = callbackData.signature;
  const accessKey = process.env.MOMO_ACCESS_KEY;
  const secretKey = process.env.MOMO_SECRET_KEY;
  const partnerCode = process.env.MOMO_PARTNER_CODE;

  const params = {
    amount: String(Math.floor(callbackData.amount)),
    extraData: String(callbackData.extraData),
    message: String(callbackData.message),
    orderId: String(callbackData.orderId),
    orderInfo: String(callbackData.orderInfo),
    orderType: String(callbackData.orderType),
    partnerCode: String(callbackData.partnerCode),
    payType: String(callbackData.payType),
    requestId: String(callbackData.requestId),
    responseTime: String(Math.floor(callbackData.responseTime)),
    resultCode: String(Math.floor(callbackData.resultCode)),
    transId: String(Math.floor(callbackData.transId)),
  };

  // Build raw signature for verification (alphabetical order)
  const rawSignature =
    `accessKey=${accessKey}` +
    `&amount=${params.amount}` +
    `&extraData=${params.extraData}` +
    `&message=${params.message}` +
    `&orderId=${params.orderId}` +
    `&orderInfo=${params.orderInfo}` +
    `&orderType=${params.orderType}` +
    `&partnerCode=${params.partnerCode}` +
    `&payType=${params.payType}` +
    `&requestId=${params.requestId}` +
    `&responseTime=${params.responseTime}` +
    `&resultCode=${params.resultCode}` +
    `&transId=${params.transId}`;

  const calculatedSignature = calculateSignature(rawSignature, secretKey);

  if (calculatedSignature !== signature) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Build response signature
  const rawSignatureResponse =
    `accessKey=${accessKey}` +
    `&extraData=${params.extraData}` +
    `&message=${params.message}` +
    `&orderId=${params.orderId}` +
    `&orderInfo=${params.partnerCode}` +
    `&payType=${params.requestId}` +
    `&responseTime=${params.responseTime}` +
    `&resultCode=${params.resultCode}`;

  const calculatedSignatureResponse = calculateSignature(rawSignatureResponse, secretKey);

  res.status(200).json({
    partnerCode,
    requestId: params.requestId,
    orderId: params.orderId,
    resultCode: params.resultCode,
    message: params.message,
    responseTime: params.responseTime,
    extraData: params.extraData,
    signature: calculatedSignatureResponse,
  });
}

export { momoCallback };
