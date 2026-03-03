import Alert from '../models/Alert.js';
import { getSpotPrice, getFundingRate, getFuturePrice, getPriceDifference, getFundingRateInterval, fetchSymbolsFromBinance } from '../controllers/symbolAlert.js';
import { notifyUserTriggers } from '../controllers/userHandler.js';

function checkFundingRateInterval(alert) {
  return (async () => {
    if (alert.type !== 'funding_rate_interval') return false;

    try {
      const currentInterval = await getFundingRateInterval(alert.symbol);
      console.log('Current funding rate interval:', currentInterval);

      if (!alert.last_fundingrate_interval) {
        alert.last_fundingrate_interval = currentInterval;
        await saveAlert(alert);
        return false;
      }

      if (currentInterval !== alert.last_fundingrate_interval) {
        console.log(`Funding rate interval changed from ${alert.last_fundingrate_interval} to ${currentInterval}`);
        alert.last_fundingrate_interval = currentInterval;
        return true;
      }
    } catch (err) {
      console.error('Error fetching funding rate interval:', err);
    }
    return false;
  })();
}

async function checkPriceCondition(alert) {
  let price = 0;

  try {
    if (alert.type === 'spot') price = await getSpotPrice(alert.symbol);
    else if (alert.type === 'future') price = await getFuturePrice(alert.symbol);
    else if (alert.type === 'funding_rate') price = await getFundingRate(alert.symbol);
    else if (alert.type === 'price_difference') price = await getPriceDifference(alert.symbol);
  } catch (err) {
    console.error('Error fetching price:', err);
    return false;
  }

  alert.price = price;
  await saveAlertNonTime(alert);

  // Range check
  if (alert.min_range !== 0 && alert.max_range !== 0) {
    if (alert.min_range > alert.max_range) {
      console.log(`Invalid range: min(${alert.min_range}) > max(${alert.max_range})`);
      return false;
    }
    if (alert.condition === '>=' && (price < alert.min_range || price > alert.max_range)) return true;
    if (alert.condition === '<=' && price >= alert.min_range && price <= alert.max_range) return true;
  }

  if (alert.condition === '==' && alert.threshold === price) return true;
  if (alert.condition === '>=' && alert.threshold <= price) return true;
  if (alert.condition === '<=' && alert.threshold >= price) return true;

  return false;
}

function checkRepeatCount(alert) {
  return !(alert.max_repeat_count > 0 && alert.repeat_count >= alert.max_repeat_count);
}

async function checkNewListingAndDelisting(alert) {
  try {
    const { newSymbols, delistedSymbols } = await fetchSymbolsFromBinance();
    if (alert.type === 'new_listing') return newSymbols.includes(alert.symbol);
    if (alert.type === 'delisting') return delistedSymbols.includes(alert.symbol);
  } catch (err) {
    console.error('Error fetching symbol data:', err);
  }
  return false;
}

function checkSnoozeCondition(alert) {
  const now = new Date();
  const updatedAt = alert.updated_at ? new Date(alert.updated_at) : new Date(0);

  switch (alert.snooze_condition) {
    case 'Only once':
      if (alert.repeat_count > 0) {
        alert.is_active = false;
        return false;
      }
      break;
    case 'Once a day':
      if (now - updatedAt < 24 * 60 * 60 * 1000) return false;
      break;
    case 'Once per 10 seconds':
      if (now - updatedAt < 10 * 1000) return false;
      break;
    case 'Once per 5 minutes':
      if (now - updatedAt < 5 * 60 * 1000) return false;
      break;
    case 'At Specific Time':
      if (alert.next_trigger_time && now < new Date(alert.next_trigger_time)) return false;
      break;
    case 'Forever':
      return true;
  }
  return true;
}

function updateAlertAfterTrigger(alert) {
  const now = new Date();
  alert.repeat_count++;

  if (alert.max_repeat_count > 0 && alert.repeat_count >= alert.max_repeat_count) {
    alert.is_active = false;
  }

  switch (alert.snooze_condition) {
    case 'Only once':
      alert.is_active = false;
      break;
    case 'Once a day':
      alert.next_trigger_time = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      break;
    case 'Once per 10 seconds':
      alert.next_trigger_time = new Date(now.getTime() + 10 * 1000);
      break;
    case 'Once per 5 minutes':
      alert.next_trigger_time = new Date(now.getTime() + 5 * 60 * 1000);
      break;
    case 'At Specific Time':
      alert.is_active = false;
      break;
    case 'Forever':
      break;
  }

  return saveAlert(alert);
}

function updateMessageAfterTrigger(alert) {
  switch (alert.type) {
    case 'spot':
      alert.message = `Spot price of ${alert.symbol} is now ${alert.price.toFixed(2)}`;
      break;
    case 'future':
      alert.message = `Future price of ${alert.symbol} is now ${alert.price.toFixed(2)}`;
      break;
    case 'funding_rate':
      alert.message = `Funding rate of ${alert.symbol} is now ${alert.price.toFixed(2)}`;
      break;
    case 'price_difference':
      alert.message = `Price difference between Spot and Future for ${alert.symbol} is now ${alert.price.toFixed(2)}`;
      break;
    case 'funding_rate_interval':
      alert.message = `Funding rate interval of ${alert.symbol} is now ${alert.last_fundingrate_interval}`;
      break;
    case 'new_listing':
      alert.message = `${alert.symbol} has been listed`;
      break;
    case 'delisting':
      alert.message = `${alert.symbol} has been delisted`;
      break;
  }
  return saveAlert(alert);
}

async function checkAndSendAlerts() {
  try {
    const alerts = await Alert.find({ is_active: true });

    for (const alertDoc of alerts) {
      const alert = alertDoc.toObject();
      alert._id = alertDoc._id;

      let conditionMet = false;

      if (['spot', 'future', 'funding_rate', 'price_difference'].includes(alert.type)) {
        if (await checkPriceCondition(alert) && checkRepeatCount(alert)) conditionMet = true;
      } else if (['new_listing', 'delisting'].includes(alert.type)) {
        if (await checkNewListingAndDelisting(alert) && checkRepeatCount(alert)) conditionMet = true;
      } else if (alert.type === 'funding_rate_interval') {
        if (await checkFundingRateInterval(alert) && checkRepeatCount(alert)) conditionMet = true;
      }

      if (conditionMet) {
        if (checkSnoozeCondition(alert)) {
          await updateMessageAfterTrigger(alert);
          try {
            await notifyUserTriggers(alert.user_id);
          } catch (e) {
            console.error('Error notifying user:', e);
          }
          console.log('Alert triggered:', alert._id, alert.type, alert.symbol);
          await updateAlertAfterTrigger(alert);

          if (!alert.is_active) {
            console.log('Alert expired:', alert._id);
          }
        }
      } else {
        console.log('Alert condition not met:', alert._id, alert.type, alert.symbol);
      }
    }
  } catch (err) {
    console.error('Failed to fetch alerts:', err);
  }
}

async function saveAlert(alert) {
  const update = { ...alert };
  delete update._id;
  update.updated_at = new Date();

  await Alert.updateOne({ _id: alert._id }, { $set: update }, { upsert: true });
}

async function saveAlertNonTime(alert) {
  const update = { ...alert };
  delete update._id;

  await Alert.updateOne({ _id: alert._id }, { $set: update }, { upsert: true });
}

export {
  checkAndSendAlerts,
  checkPriceCondition,
  checkSnoozeCondition,
  checkNewListingAndDelisting,
  checkFundingRateInterval,
  updateAlertAfterTrigger,
  updateMessageAfterTrigger,
};
