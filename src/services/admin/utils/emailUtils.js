import Mailjet from 'node-mailjet';

function generatePasswordResetEmailBody(name, otp) {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
      .container { width: 100%; max-width: 600px; margin: 0 auto; background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
      .header { text-align: center; color: #6a1b9a; font-size: 24px; font-weight: bold; }
      .otp-container { text-align: center; background-color: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0; }
      .otp { font-size: 32px; font-weight: bold; color: #388e3c; padding: 10px 20px; border-radius: 8px; background-color: #e8f5e9; display: inline-block; }
      .message { text-align: center; font-size: 16px; color: #555; margin-top: 20px; }
      .footer { text-align: center; font-size: 12px; color: #888; margin-top: 30px; }
      .footer a { color: #888; text-decoration: none; }
    </style>
  </head>
  <body>
  <div class="container">
    <div class="header">Password Reset Request</div>
    <p>Dear ${name},</p>
    <p>You have requested to reset your password. Please use the following OTP to complete the process:</p>
    <div class="otp-container"><span class="otp">${otp}</span></div>
    <p class="message">This OTP is valid until 5 minutes. Do not share this OTP with anyone.</p>
    <p class="footer">If you did not request a password reset, please ignore this email or contact support.</p>
    <p class="footer"><a href="#">Privacy Policy</a> | <a href="#">Terms of Service</a></p>
  </div>
  </body>
  </html>`;
}

async function sendEmail(to, subject, name, otp) {
  if (!to) throw new Error('recipient email is required');

  const apiKey = process.env.MAILJET_API_KEY;
  const secretKey = process.env.MAILJET_SECRET_KEY;
  const senderEmail = process.env.EMAIL_SENDER;

  if (!apiKey || !secretKey) throw new Error('Mailjet API keys are not set in environment variables');
  if (!senderEmail) throw new Error('EMAIL_SENDER not set in environment variables');

  const htmlBody = generatePasswordResetEmailBody(name, otp);

  const mailjet = Mailjet.apiConnect(apiKey, secretKey);

  await mailjet.post('send', { version: 'v3.1' }).request({
    Messages: [
      {
        From: { Email: senderEmail, Name: 'Coin-Price' },
        To: [{ Email: to, Name: '' }],
        Subject: subject,
        HTMLPart: htmlBody,
      },
    ],
    SandboxMode: false,
  });
}

export { sendEmail };
