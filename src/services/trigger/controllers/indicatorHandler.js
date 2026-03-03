import Indicator from '../models/Indicator.js';

async function setAdvancedIndicatorAlert(req, res) {
  try {
    const { symbol, indicator, period, notification_method } = req.body;

    if (!symbol || !indicator || !period || !notification_method) {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    if (!['EMA', 'BollingerBands', 'Custom'].includes(indicator)) {
      return res.status(400).json({ error: 'Invalid indicator type' });
    }

    const newIndicator = await Indicator.create({
      symbol,
      indicator,
      period,
      notification_method,
    });

    res.status(201).json({
      message: 'Indicator created successfully',
      alert_id: newIndicator._id.toString(),
    });
  } catch (err) {
    console.error('SetAdvancedIndicatorAlert error:', err);
    res.status(500).json({ error: 'Failed to create indicator alert' });
  }
}

export { setAdvancedIndicatorAlert };
