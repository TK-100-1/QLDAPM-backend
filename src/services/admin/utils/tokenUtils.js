import crypto from 'crypto';

function generateRandomString(length) {
  if (length <= 0) throw new Error('length must be greater than 0');
  return crypto.randomBytes(length).toString('hex');
}

function hashString(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function generateOTP(length) {
  if (length <= 0) throw new Error('invalid OTP length');
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < length; i++) {
    const index = crypto.randomInt(digits.length);
    otp += digits[index];
  }
  return otp;
}

export {
  generateRandomString,
  hashString,
  generateOTP,
};
