import Alert from '../models/Alert.js';
import Indicator from '../models/Indicator.js';
import {
    getSpotPrice,
    getFundingRate,
    getFuturePrice,
    getPriceDifference,
    getFundingRateInterval,
    fetchSymbolsFromBinance,
    getKlineClosePrices,
    normalizeBinanceSymbol,
} from '../controllers/symbolAlert.js';
import { notifyUserTriggers } from '../controllers/userHandler.js';

function resolveAlertType(alert) {
    const normalizedType = String(alert.type || '').trim();
    if (normalizedType) {
        return normalizedType;
    }

    const triggerType = String(alert.trigger_type || '').trim();
    switch (triggerType) {
        case 'price-difference':
        case 'price_difference':
            return 'price_difference';
        case 'funding-rate':
        case 'funding_rate':
            return 'funding_rate';
        case 'interval':
        case 'funding_rate_interval':
            return 'funding_rate_interval';
        case 'listing':
        case 'new_listing':
            return 'new_listing';
        case 'spot':
        case 'future':
        case 'delisting':
            return triggerType;
        default:
            return '';
    }
}

function compareWithCondition(currentValue, threshold, condition) {
    const epsilon = 1e-10;
    const normalizedCondition =
        condition === '==' ? '=' : (condition || '').trim();

    switch (normalizedCondition) {
        case '=':
            return Math.abs(currentValue - threshold) <= epsilon;
        case '>':
            return currentValue > threshold;
        case '<':
            return currentValue < threshold;
        case '>=':
            return currentValue >= threshold;
        case '<=':
            return currentValue <= threshold;
        default:
            return false;
    }
}

function calculateSMA(values, period) {
    if (!Array.isArray(values) || values.length < period || period <= 0) {
        return null;
    }

    const recent = values.slice(-period);
    const sum = recent.reduce((acc, v) => acc + v, 0);
    return sum / period;
}

function calculateEMA(values, period) {
    if (!Array.isArray(values) || values.length < period || period <= 0) {
        return null;
    }

    const multiplier = 2 / (period + 1);
    let ema = values.slice(0, period).reduce((acc, v) => acc + v, 0) / period;

    for (let i = period; i < values.length; i += 1) {
        ema = (values[i] - ema) * multiplier + ema;
    }

    return ema;
}

function calculateBollingerMiddle(values, period) {
    return calculateSMA(values, period);
}

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
                console.log(
                    `Funding rate interval changed from ${alert.last_fundingrate_interval} to ${currentInterval}`,
                );
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
        else if (alert.type === 'future')
            price = await getFuturePrice(alert.symbol);
        else if (alert.type === 'funding_rate')
            price = await getFundingRate(alert.symbol);
        else if (alert.type === 'price_difference')
            price = await getPriceDifference(alert.symbol);
    } catch (err) {
        console.error('Error fetching price:', err);

        if (String(err?.message || '').includes('status 400')) {
            alert.is_active = false;
            alert.message = `Alert disabled: invalid symbol ${alert.symbol}`;
            await saveAlert(alert);
        }

        return false;
    }

    if (!Number.isFinite(price)) {
        console.error(
            `Invalid price value for alert ${alert._id} (${alert.symbol}):`,
            price,
        );
        return false;
    }

    if (!Number.isFinite(alert.threshold)) {
        console.error(
            `Invalid threshold for alert ${alert._id} (${alert.symbol}):`,
            alert.threshold,
        );
        return false;
    }

    alert.price = price;
    await saveAlertNonTime(alert);

    // Range check
    if (alert.min_range !== 0 && alert.max_range !== 0) {
        if (alert.min_range > alert.max_range) {
            console.log(
                `Invalid range: min(${alert.min_range}) > max(${alert.max_range})`,
            );
            return false;
        }
        if (
            alert.condition === '>=' &&
            (price < alert.min_range || price > alert.max_range)
        )
            return true;
        if (
            alert.condition === '<=' &&
            price >= alert.min_range &&
            price <= alert.max_range
        )
            return true;
    }

    const conditionResult = compareWithCondition(
        price,
        alert.threshold,
        alert.condition,
    );
    console.log(
        `Debug: price=${price}, threshold=${alert.threshold}, condition=${alert.condition}, result=${conditionResult}`,
    );
    return conditionResult;
}

async function checkIndicatorCondition(indicatorAlert) {
    const period = Number(indicatorAlert.period);
    if (!Number.isFinite(period) || period <= 0) {
        console.error(
            `Invalid indicator period for ${indicatorAlert._id}:`,
            indicatorAlert.period,
        );
        return false;
    }

    if (!Number.isFinite(indicatorAlert.threshold)) {
        console.error(
            `Invalid indicator threshold for ${indicatorAlert._id}:`,
            indicatorAlert.threshold,
        );
        return false;
    }

    let indicatorValue = null;
    let normalizedName = String(indicatorAlert.indicator || '')
        .trim()
        .toUpperCase();

    try {
        if (normalizedName === 'CUSTOM') {
            indicatorValue = await getSpotPrice(indicatorAlert.symbol);
        } else {
            const lookback = Math.max(period * 3, period + 5, 30);
            const closes = await getKlineClosePrices(
                indicatorAlert.symbol,
                '1m',
                lookback,
            );

            switch (normalizedName) {
                case 'EMA':
                    indicatorValue = calculateEMA(closes, period);
                    break;
                case 'MA':
                    indicatorValue = calculateSMA(closes, period);
                    break;
                case 'BOLL':
                case 'BOLLINGERBANDS':
                    indicatorValue = calculateBollingerMiddle(closes, period);
                    break;
                default:
                    console.error(
                        `Unsupported indicator type for ${indicatorAlert._id}:`,
                        indicatorAlert.indicator,
                    );
                    return false;
            }
        }
    } catch (err) {
        console.error('Error fetching indicator data:', err);

        if (String(err?.message || '').includes('status 400')) {
            indicatorAlert.is_active = false;
            indicatorAlert.message = `Indicator alert disabled: invalid symbol ${indicatorAlert.symbol}`;
            await saveIndicator(indicatorAlert);
        }

        return false;
    }

    if (!Number.isFinite(indicatorValue)) {
        console.error(
            `Invalid computed indicator value for ${indicatorAlert._id}:`,
            indicatorValue,
        );
        return false;
    }

    indicatorAlert.message = `${normalizedName}(${period}) of ${indicatorAlert.symbol} is ${indicatorValue.toFixed(6)}`;
    indicatorAlert.current_value = indicatorValue;

    return compareWithCondition(
        indicatorValue,
        indicatorAlert.threshold,
        indicatorAlert.condition,
    );
}

function checkIndicatorCooldown(indicatorAlert) {
    if (!indicatorAlert.next_trigger_time) {
        return true;
    }

    return new Date() >= new Date(indicatorAlert.next_trigger_time);
}

function updateIndicatorAfterTrigger(indicatorAlert) {
    indicatorAlert.repeat_count = (indicatorAlert.repeat_count || 0) + 1;

    if (
        indicatorAlert.max_repeat_count > 0 &&
        indicatorAlert.repeat_count >= indicatorAlert.max_repeat_count
    ) {
        indicatorAlert.is_active = false;
    }

    if (indicatorAlert.is_active) {
        indicatorAlert.next_trigger_time = new Date(Date.now() + 60 * 1000);
    }

    return saveIndicator(indicatorAlert);
}

function checkRepeatCount(alert) {
    return !(
        alert.max_repeat_count > 0 &&
        alert.repeat_count >= alert.max_repeat_count
    );
}

async function checkNewListingAndDelisting(alert) {
    try {
        const normalizedSymbol = normalizeBinanceSymbol(alert.symbol);
        const { newSymbols, delistedSymbols } = await fetchSymbolsFromBinance();
        if (alert.type === 'new_listing')
            return newSymbols.includes(normalizedSymbol);
        if (alert.type === 'delisting')
            return delistedSymbols.includes(normalizedSymbol);
    } catch (err) {
        console.error('Error fetching symbol data:', err);
    }
    return false;
}

function checkSnoozeCondition(alert) {
    const now = new Date();
    const updatedAt = alert.updated_at
        ? new Date(alert.updated_at)
        : new Date(0);

    if (alert.start_time && now < new Date(alert.start_time)) {
        return false;
    }

    if (alert.end_time && now > new Date(alert.end_time)) {
        alert.is_active = false;
        saveAlert(alert).catch((err) => {
            console.error('Failed to deactivate expired snooze alert:', err);
        });
        return false;
    }

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
            if (
                alert.next_trigger_time &&
                now < new Date(alert.next_trigger_time)
            )
                return false;
            break;
        case 'Forever':
            return true;
    }
    return true;
}

function updateAlertAfterTrigger(alert) {
    const now = new Date();
    alert.repeat_count++;

    if (
        alert.max_repeat_count > 0 &&
        alert.repeat_count >= alert.max_repeat_count
    ) {
        alert.is_active = false;
    }

    switch (alert.snooze_condition) {
        case 'Only once':
            alert.is_active = false;
            break;
        case 'Once a day':
            alert.next_trigger_time = new Date(
                now.getTime() + 24 * 60 * 60 * 1000,
            );
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
        console.log('ALERTS', alerts);

        for (const alertDoc of alerts) {
            const alert = alertDoc.toObject();
            alert._id = alertDoc._id;
            alert.type = resolveAlertType(alert);

            console.log({
                symbol: alert.symbol,
                type: alert.type,
                price: alert.price,
                threshold: alert.threshold,
                condition: alert.condition,
            });

            if (!alert.type) {
                console.log(
                    'Alert skipped due to unknown type:',
                    alert._id,
                    alert.trigger_type,
                    alert.symbol,
                );
                continue;
            }

            let conditionMet = false;

            if (
                ['spot', 'future', 'funding_rate', 'price_difference'].includes(
                    alert.type,
                )
            ) {
                if (
                    (await checkPriceCondition(alert)) &&
                    checkRepeatCount(alert)
                )
                    conditionMet = true;
            } else if (['new_listing', 'delisting'].includes(alert.type)) {
                if (
                    (await checkNewListingAndDelisting(alert)) &&
                    checkRepeatCount(alert)
                )
                    conditionMet = true;
            } else if (alert.type === 'funding_rate_interval') {
                if (
                    (await checkFundingRateInterval(alert)) &&
                    checkRepeatCount(alert)
                )
                    conditionMet = true;
            }

            if (conditionMet) {
                if (checkSnoozeCondition(alert)) {
                    await updateMessageAfterTrigger(alert);
                    try {
                        await notifyUserTriggers(alert.user_id, [alert]);
                    } catch (e) {
                        console.error('Error notifying user:', e);
                    }
                    console.log(
                        'Alert triggered:',
                        alert._id,
                        alert.type,
                        alert.symbol,
                    );
                    await updateAlertAfterTrigger(alert);

                    if (!alert.is_active) {
                        console.log('Alert expired:', alert._id);
                    }
                }
            } else {
                console.log(
                    'Alert condition not met:',
                    alert._id,
                    alert.type,
                    alert.symbol,
                );
            }
        }

        const indicators = await Indicator.find({ is_active: true });
        console.log(`Found ${indicators.length} active indicator alerts`);

        for (const indicatorDoc of indicators) {
            const indicatorAlert = indicatorDoc.toObject();
            indicatorAlert._id = indicatorDoc._id;

            const canTrigger =
                checkRepeatCount(indicatorAlert) &&
                checkIndicatorCooldown(indicatorAlert);

            if (!canTrigger) {
                continue;
            }

            const conditionMet = await checkIndicatorCondition(indicatorAlert);

            if (!conditionMet) {
                console.log(
                    `Indicator condition not met: ${indicatorAlert._id} ${indicatorAlert.indicator} ${indicatorAlert.symbol}`,
                );
                continue;
            }

            await saveIndicator(indicatorAlert);

            try {
                await notifyUserTriggers(indicatorAlert.user_id, [
                    {
                        ...indicatorAlert,
                        trigger_type: 'indicator',
                        type: 'indicator',
                    },
                ]);
            } catch (e) {
                console.error('Error notifying indicator user:', e);
            }

            console.log(
                'Indicator alert triggered:',
                indicatorAlert._id,
                indicatorAlert.indicator,
                indicatorAlert.symbol,
            );

            await updateIndicatorAfterTrigger(indicatorAlert);
        }
    } catch (err) {
        console.error('Failed to fetch alerts:', err);
    }
}

async function saveAlert(alert) {
    const update = { ...alert };
    delete update._id;
    update.updated_at = new Date();

    await Alert.updateOne(
        { _id: alert._id },
        { $set: update },
        { upsert: true },
    );
}

async function saveAlertNonTime(alert) {
    const update = { ...alert };
    delete update._id;

    await Alert.updateOne(
        { _id: alert._id },
        { $set: update },
        { upsert: true },
    );
}

async function saveIndicator(indicatorAlert) {
    const update = { ...indicatorAlert };
    delete update._id;
    update.updated_at = new Date();

    await Indicator.updateOne(
        { _id: indicatorAlert._id },
        { $set: update },
        { upsert: true },
    );
}

export {
    checkAndSendAlerts,
    checkPriceCondition,
    checkSnoozeCondition,
    checkNewListingAndDelisting,
    checkFundingRateInterval,
    updateAlertAfterTrigger,
    updateMessageAfterTrigger,
    checkIndicatorCondition,
};
