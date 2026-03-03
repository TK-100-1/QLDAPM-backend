import { checkAndSendAlerts } from './snooze.js';

let intervalId = null;
let isRunning = false;

function startRunning() {
  if (isRunning) {
    console.log('Alert checker is already running.');
    return;
  }

  isRunning = true;
  intervalId = setInterval(() => {
    checkAndSendAlerts();
  }, 1000);
}

function stopRunning() {
  if (!isRunning) return;

  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  isRunning = false;
}

function run(req, res) {
  startRunning();
  res.status(200).json({ status: 'Alert checker started' });
}

function stop(req, res) {
  stopRunning();
  res.status(200).json({ status: 'Alert checker stopped' });
}

export { run, stop, startRunning, stopRunning };
