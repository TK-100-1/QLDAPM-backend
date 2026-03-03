import Mailjet from 'node-mailjet';

async function sendAlertEmail(to, subject, htmlBody) {
  const apiKey = process.env.MAILJET_API_KEY;
  const secretKey = process.env.MAILJET_SECRET_KEY;
  const senderEmail = process.env.EMAIL_SENDER;

  if (!apiKey || !secretKey) throw new Error('Mailjet API keys are not set in environment variables');
  if (!senderEmail) throw new Error('EMAIL_SENDER not set in environment variables');

  const mailjet = Mailjet.apiConnect(apiKey, secretKey);

  const result = await mailjet.post('send', { version: 'v3.1' }).request({
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

  console.log('Email sent successfully:', JSON.stringify(result.body));
}

export { sendAlertEmail };
