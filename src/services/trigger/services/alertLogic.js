import Alert from '../models/Alert.js';
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

const DEFAULT_EPSILON = 1e-10;

function getExecution(alert) {
    if (alert.execution && typeof alert.execution === 'object') {
        return alert.execution;
    }

    return {
        cooldown_seconds: alert.cooldown_seconds || 30,
        max_triggers: alert.max_repeat_count || 10,
        min_confirmations: alert.min_confirmations || 1,
        dedupe_window_seconds: alert.dedupe_window_seconds || 30,
    };
}

function getRuntimeState(alert) {
    const runtime = alert.runtime_state || {};

    return {
        metrics: runtime.metrics || {},
        last_result: runtime.last_result || false,
        last_triggered_at: runtime.last_triggered_at || null,
        trigger_count: runtime.trigger_count || 0,
        confirmation_count: runtime.confirmation_count || 0,
    };
}

function setRuntimeState(alert, runtimeState) {
    alert.runtime_state = {
        metrics: runtimeState.metrics || {},
        last_result: runtimeState.last_result || false,
        last_triggered_at: runtimeState.last_triggered_at || null,
        trigger_count: runtimeState.trigger_count || 0,
        confirmation_count: runtimeState.confirmation_count || 0,
    };
}

function buildStateKey(alert, conditionEntry) {
    const metric = conditionEntry.metric || 'price';
    const trigger = alert.triggerType || 'spot';
    return `${alert.symbol}:${trigger}:${metric}`;
}

function getConditionOperator(entry) {
    return String(entry.operator || entry.condition || '>=').trim();
}

function getConditionMode(entry) {
    return String(entry.mode || entry.condition_mode || 'static').trim();
}

function getConditionValue(entry) {
    return Number(entry.value ?? entry.threshold ?? 0);
}

function getAlertStatus(alert) {
    const now = new Date();

    // 1. user tắt
    if (!alert.is_active) {
        return 'disabled';
    }

    // 2. snooze (chưa tới start)
    if (alert.timeWindow?.start && now < new Date(alert.timeWindow.start)) {
        return 'scheduled';
    }

    // 3. hết hạn (sau end)
    if (alert.timeWindow?.end && now > new Date(alert.timeWindow.end)) {
        return 'expired_time';
    }

    // 4. hết số lần trigger
    const execution = getExecution(alert);
    const runtime = getRuntimeState(alert);

    if (
        execution.max_triggers > 0 &&
        runtime.trigger_count >= execution.max_triggers
    ) {
        return 'exhausted';
    }

    // 5. đang hoạt động
    return 'active';
}

function compareWithCondition(currentValue, threshold, condition) {
    const cv = Number(currentValue);
    const tv = Number(threshold);

    if (!Number.isFinite(cv) || !Number.isFinite(tv)) return false;

    const op = String(condition || '').trim();

    switch (op) {
        case '=':
        case '==':
            return Math.abs(cv - tv) <= DEFAULT_EPSILON;

        case '>':
            return cv > tv;

        case '<':
            return cv < tv;

        case '>=':
            return cv >= tv;

        case '<=':
            return cv <= tv;

        default:
            return false;
    }
}

function compareWithMode({
    currentValue,
    previousValue,
    threshold,
    condition,
    mode,
}) {
    const normalizedMode = String(mode || 'static').trim();
    if (!Number.isFinite(currentValue)) {
        return false;
    }

    if (normalizedMode === 'cross_above') {
        if (previousValue == null) return false;
        return (
            Number.isFinite(previousValue) &&
            previousValue < threshold &&
            currentValue >= threshold
        );
    }

    if (normalizedMode === 'cross_below') {
        if (previousValue == null) return false;
        return (
            Number.isFinite(previousValue) &&
            previousValue > threshold &&
            currentValue <= threshold
        );
    }

    if (normalizedMode === 'change_up') {
        return (
            Number.isFinite(previousValue) &&
            currentValue - previousValue >= threshold
        );
    }

    if (normalizedMode === 'change_down') {
        return (
            Number.isFinite(previousValue) &&
            previousValue - currentValue >= threshold
        );
    }

    return compareWithCondition(currentValue, threshold, condition);
}

async function getMetricValue(alert, conditionEntry) {
    const metric = String(conditionEntry.metric || 'price').trim();

    switch (metric) {
        case 'funding_rate': {
            const value = await getFundingRate(alert.symbol);
            return {
                value,
                message: `Funding rate ${alert.symbol}: ${value}`,
            };
        }

        case 'price_difference': {
            const value = await getPriceDifference(alert.symbol);
            return {
                value,
                message: `Price diff ${alert.symbol}: ${value}`,
            };
        }

        case 'future': {
            const value = await getFuturePrice(alert.symbol);
            return {
                value,
                message: `Future price ${alert.symbol}: ${value}`,
            };
        }

        case 'spot':
        case 'price':
        default: {
            const value = await getSpotPrice(alert.symbol);
            return {
                value,
                message: `Spot price ${alert.symbol}: ${value}`,
            };
        }
    }
}

async function evaluateSingleCondition(
    alert,
    conditionEntry,
    runtimeState,
    stateKey,
) {
    const raw = await getMetricValue(alert, conditionEntry);
    console.log('evaluateSingleCondition Metric value for', stateKey, ':', raw);
    const currentValue =
        typeof raw === 'object' ? Number(raw.value) : Number(raw);

    const threshold =
        typeof raw === 'object' && raw.threshold !== undefined
            ? Number(raw.threshold)
            : Number(getConditionValue(conditionEntry));

    const prev = runtimeState.metrics[stateKey]?.last;

    const mode = getConditionMode(conditionEntry);

    const matched = compareWithMode({
        currentValue,
        previousValue: prev,
        threshold,
        condition: getConditionOperator(conditionEntry),
        mode,
    });

    // update state
    runtimeState.metrics[stateKey] = {
        last: currentValue,
        updated_at: Date.now(),
    };

    const operator = getConditionOperator(conditionEntry);
    const metric = conditionEntry.metric || 'price';

    // format value (tuỳ metric)
    function formatValue(metric, v, isThreshold = false) {
        if (!Number.isFinite(v)) return 'N/A';

        if (metric === 'funding_rate') {
            if (!isThreshold) {
                // API trả decimal → convert sang %
                return (v * 100).toFixed(6) + '%';
            }

            // threshold user nhập đã là %
            return v.toFixed(4) + '%';
        }

        return v.toFixed(2);
    }
    let message = '';
    if (conditionEntry.metric === 'funding_rate') {
        message = `${raw?.message || metric} (${formatValue(metric, currentValue)} ${operator} ${formatValue(metric, threshold / 100)})`;
    } else {
        message = `${raw?.message || metric} (${formatValue(metric, currentValue)} ${operator} ${formatValue(metric, threshold)})`;
    }
    console.log('Condition check for', message);
    return {
        matched,
        value: currentValue,
        message,
    };
}

async function evaluateConditionTree(
    alert,
    treeNode,
    runtimeState,
    path = 'root',
) {
    if (!treeNode || typeof treeNode !== 'object') {
        return { matched: false, primaryValue: null, message: '' };
    }

    if (treeNode.type === 'condition') {
        const conditionIndex = Number(treeNode.condition_index);
        const conditionEntry =
            Number.isInteger(conditionIndex) &&
            Array.isArray(alert.conditions) &&
            conditionIndex >= 0 &&
            conditionIndex < alert.conditions.length
                ? alert.conditions[conditionIndex]
                : treeNode.condition || {};
        const stateKey = buildStateKey(alert, conditionEntry);
        const result = await evaluateSingleCondition(
            alert,
            conditionEntry,
            runtimeState,
            stateKey,
        );

        return {
            matched: result.matched,
            primaryValue: result.value,
            messages: result.message ? [result.message] : [],
        };
    }

    if (treeNode.type === 'group') {
        const logic = String(treeNode.logic || 'AND').toUpperCase();
        const children = Array.isArray(treeNode.children)
            ? treeNode.children
            : [];
        if (children.length === 0) {
            return { matched: false, primaryValue: null, messages: [] };
        }

        const childResults = [];
        for (let index = 0; index < children.length; index += 1) {
            const child = children[index];
            childResults.push(
                await evaluateConditionTree(
                    alert,
                    child,
                    runtimeState,
                    `${path}.${index}`,
                ),
            );
        }

        const matched =
            logic === 'OR'
                ? childResults.some((item) => item.matched)
                : childResults.every((item) => item.matched);

        const valueSource =
            childResults.find((item) => Number.isFinite(item.primaryValue)) ||
            null;
        const messages = childResults.flatMap((item) => item.messages || []);

        return {
            matched,
            primaryValue: valueSource ? valueSource.primaryValue : null,
            messages,
        };
    }

    return { matched: false, primaryValue: null, messages: [] };
}

function buildFinalMessage(alert, messages) {
    if (!messages || messages.length === 0) {
        return `Alert triggered for ${alert.symbol}`;
    }

    return [
        `🚨 Alert: ${alert.symbol}`,
        ...messages.map((msg) => `• ${msg}`),
        `⏰ ${new Date().toLocaleString()}`,
    ].join('\n');
}

function checkFundingRateInterval(alert) {
    return (async () => {
        if (alert.triggerType !== 'funding_rate_interval') return false;

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

function checkRepeatCount(alert) {
    const execution = getExecution(alert);
    const maxTriggers = Number(execution.max_triggers || 10);
    if (maxTriggers <= 0) {
        return true;
    }

    const runtime = getRuntimeState(alert);
    return Number(runtime.trigger_count || 0) < maxTriggers;
}

async function checkNewListingAndDelisting(alert) {
    try {
        const normalizedSymbol = normalizeBinanceSymbol(alert.symbol);
        const { newSymbols, delistedSymbols } = await fetchSymbolsFromBinance();
        if (alert.triggerType === 'new_listing')
            return newSymbols.includes(normalizedSymbol);
        if (alert.triggerType === 'delisting')
            return delistedSymbols.includes(normalizedSymbol);
    } catch (err) {
        console.error('Error fetching symbol data:', err);
    }
    return false;
}

function checkAlertCooldownAndDedupe(alert, runtimeState) {
    const now = Date.now();

    const lastTriggerAt = runtimeState?.last_triggered_at
        ? new Date(runtimeState.last_triggered_at).getTime()
        : alert.last_trigger_at
          ? new Date(alert.last_trigger_at).getTime()
          : 0;

    if (!lastTriggerAt || !Number.isFinite(lastTriggerAt)) {
        return true;
    }

    const execution = getExecution(alert);

    const cooldownSeconds = Math.max(
        0,
        Number(execution.cooldown_seconds || 30),
    );
    if (cooldownSeconds > 0 && now - lastTriggerAt < cooldownSeconds * 1000) {
        return false;
    }

    const dedupeSeconds = Math.max(
        0,
        Number(execution.dedupe_window_seconds || 0),
    );
    if (dedupeSeconds > 0 && now - lastTriggerAt < dedupeSeconds * 1000) {
        return false;
    }

    return true;
}

function updateAlertAfterTrigger(alert) {
    const now = new Date();
    const runtime = getRuntimeState(alert);
    const execution = getExecution(alert);

    runtime.trigger_count = Number(runtime.trigger_count || 0) + 1;
    runtime.last_triggered_at = now;
    runtime.confirmation_count = 0;
    runtime.last_result = true;
    setRuntimeState(alert, runtime);

    alert.repeat_count = runtime.trigger_count;
    alert.last_trigger_at = now;

    if (
        Number(execution.max_triggers || 10) > 0 &&
        runtime.trigger_count >= Number(execution.max_triggers)
    ) {
        alert.is_active = false;
    }

    return saveAlert(alert);
}

function updateMessageAfterTrigger(alert) {
    const updateNotificationMessage = (msg) => {
        alert.message = msg;
        if (alert.notification && typeof alert.notification === 'object') {
            alert.notification = {
                ...alert.notification,
                message: msg,
            };
        }
    };

    switch (alert.triggerType) {
        case 'spot':
            updateNotificationMessage(
                `Spot price of ${alert.symbol} is now ${alert.price.toFixed(2)}`,
            );
            break;
        case 'future':
            updateNotificationMessage(
                `Future price of ${alert.symbol} is now ${alert.price.toFixed(2)}`,
            );
            break;
        case 'funding_rate':
            updateNotificationMessage(
                `Funding rate of ${alert.symbol} is now ${alert.price.toFixed(2)}`,
            );
            break;
        case 'price_difference':
            updateNotificationMessage(
                `Price difference between Spot and Future for ${alert.symbol} is now ${alert.price.toFixed(2)}`,
            );
            break;
        case 'funding_rate_interval':
            updateNotificationMessage(
                `Funding rate interval of ${alert.symbol} is now ${alert.last_fundingrate_interval}`,
            );
            break;
        case 'new_listing':
            updateNotificationMessage(`${alert.symbol} has been listed`);
            break;
        case 'delisting':
            updateNotificationMessage(`${alert.symbol} has been delisted`);
            break;
        default:
            if (!alert.message) {
                updateNotificationMessage(
                    `Alert triggered for ${alert.symbol}`,
                );
            }
            break;
    }
    return saveAlert(alert);
}

function isInTimeWindow(alert) {
    if (!alert.timeWindow) return true;

    const now = new Date();

    const { start, end } = alert.timeWindow;

    if (!start && !end) return true;

    if (start && now < new Date(start)) return false;
    if (end && now > new Date(end)) return false;

    return true;
}

async function checkAndSendAlerts() {
    try {
        const alerts = await Alert.find({ is_active: 'true' });

        for (const alertDoc of alerts) {
            // alertDoc.status = getAlertStatus(alertDoc);
            // console.log('Checking alert', {
            //     id: alertDoc._id,
            //     symbol: alertDoc.symbol,
            //     triggerType: alertDoc.triggerType,
            //     status: alertDoc.status,
            // });
            // if (alertDoc.is_active !== 'active') continue;
            const alert = alertDoc.toObject({ virtuals: true });
            if (!isInTimeWindow(alert)) continue;
            alert._id = alertDoc._id;

            if (!alert.triggerType) continue;

            console.log('Processing alert:', {
                symbol: alert.symbol,
                alert_id: alert._id,
            });

            let conditionMet = false;

            // const runtimeState = getRuntimeState(alert);

            const runtimeState = structuredClone(getRuntimeState(alert));

            // 1. RULE ENGINE (unified)
            if (
                alert.conditions?.length > 0 ||
                ['spot', 'future', 'funding_rate', 'price_difference'].includes(
                    alert.triggerType,
                )
            ) {
                const result = await evaluateConditionTree(
                    alert,
                    alert.conditionTree || {
                        type: 'group',
                        logic: 'AND',
                        children: [],
                    },
                    runtimeState,
                );
                alert._messages = result.messages || [];

                if (result.matched) {
                    if (runtimeState.last_result === true) {
                        runtimeState.confirmation_count++;
                    } else {
                        runtimeState.confirmation_count = 1;
                    }
                } else {
                    runtimeState.confirmation_count = 0;
                }

                runtimeState.last_result = result.matched;

                const execution = getExecution(alert);

                if (
                    runtimeState.confirmation_count <
                    execution.min_confirmations
                ) {
                    conditionMet = false;
                } else {
                    conditionMet = true;
                }
            }

            // 2. EVENT TYPE alerts
            else if (
                alert.triggerType === 'new_listing' ||
                alert.triggerType === 'delisting'
            ) {
                conditionMet =
                    (await checkNewListingAndDelisting(alert)) === true;
            } else if (alert.triggerType === 'funding_rate_interval') {
                conditionMet = (await checkFundingRateInterval(alert)) === true;
            }

            // if (runtimeState.last_result === true && result.matched === true) {
            //     // đã match từ trước → skip để tránh spam
            //     continue;
            // }

            // 3. REPEAT LIMIT CHECK (AFTER condition)
            if (
                conditionMet &&
                !checkRepeatCount({ ...alert, runtime_state: runtimeState })
            ) {
                conditionMet = false;
            }

            if (!conditionMet) {
                setRuntimeState(alert, runtimeState);
                await saveAlertNonTime(alert);

                console.log('No trigger:', alert._id);
                continue;
            }

            // 4. COOLDOWN + DEDUPE
            if (!checkAlertCooldownAndDedupe(alert, runtimeState)) {
                continue;
            }

            // 5. UPDATE STATE BEFORE TRIGGER (CRITICAL FIX)
            setRuntimeState(alert, runtimeState);
            await saveAlertNonTime(alert);

            // 6. SEND NOTIFICATION
            alert.message = buildFinalMessage(alert, alert._messages);
            try {
                await notifyUserTriggers(alert.user_id, [alert]);
            } catch (e) {
                console.error('Notification error:', e);
            }

            console.log('Triggered:', alert._id, alert.symbol);

            // 7. UPDATE AFTER TRIGGER (COUNTERS, COOLDOWN, etc.)
            await updateAlertAfterTrigger(alert);

            if (!alert.is_active) {
                console.log('Alert expired:', alert._id);
            }
        }
    } catch (err) {
        console.error('Failed to process alerts:', err);
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

export {
    checkAndSendAlerts,
    evaluateConditionTree,
    checkNewListingAndDelisting,
    checkFundingRateInterval,
    updateAlertAfterTrigger,
    updateMessageAfterTrigger,
    getAlertStatus,
};
