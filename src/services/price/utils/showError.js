function showError(statusCode, message, res) {
  res.status(statusCode).json({ message });
}

function showErrorSocket(ws, message) {
  ws.send(JSON.stringify({ message }));
}

function convertMillisecondsToTimestamp(ms) {
  return new Date(ms).toISOString().replace('T', ' ').substring(0, 19);
}

function convertMillisecondsToHHMMSS(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

function convertMilisecondToTimeFormatedRFC3339(ms) {
  return new Date(ms).toISOString();
}

function getTimeNow() {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

export {
  showError,
  showErrorSocket,
  convertMillisecondsToTimestamp,
  convertMillisecondsToHHMMSS,
  convertMilisecondToTimeFormatedRFC3339,
  getTimeNow,
};
