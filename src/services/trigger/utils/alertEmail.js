import Mailjet from 'node-mailjet';

async function sendAlertEmail(to, subject, htmlBody) {
    const apiKey = process.env.MAILJET_API_KEY;
    const secretKey = process.env.MAILJET_SECRET_KEY;
    const senderEmail = process.env.EMAIL_SENDER;

    if (!apiKey || !secretKey) throw new Error('Missing Mailjet API keys');
    if (!senderEmail) throw new Error('Missing sender email');

    const mailjet = Mailjet.apiConnect(apiKey, secretKey);

    const result = await mailjet.post('send', { version: 'v3.1' }).request({
        Messages: [
            {
                From: {
                    Email: senderEmail,
                    Name: 'Coin Alert System',
                },
                To: [{ Email: to }],
                Subject: subject,
                TextPart: 'Coin alert triggered',
                HTMLPart: htmlBody,
            },
        ],
    });

    console.log('MAIL RESPONSE:', JSON.stringify(result.body, null, 2));
}

export { sendAlertEmail };
