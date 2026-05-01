// SePay Helper Functions
// Generates a VietQR URL for payment

export function generateVietQRUrl(amount, orderInfo) {
    // These should ideally be in .env, using generic defaults for now.
    // The format of VietQR: https://qr.sepay.vn/img?acc=<ACCOUNT_NO>&bank=<BANK_NAME>&amount=<AMOUNT>&des=<ORDER_INFO>
    const bank = process.env.SEPAY_BANK_ID || 'MB';
    const acc = process.env.SEPAY_ACCOUNT_NO || '0000000000';
    
    // Sanitize orderInfo to remove spaces or special chars if needed, though VietQR handles url encoding
    const des = encodeURIComponent(orderInfo);
    
    return `https://qr.sepay.vn/img?acc=${acc}&bank=${bank}&amount=${amount}&des=${des}`;
}
