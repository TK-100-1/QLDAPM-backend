const upgradeCosts = {
  'VIP-0': { 'VIP-1': 79000, 'VIP-2': 129000, 'VIP-3': 149000 },
  'VIP-1': { 'VIP-2': 79000, 'VIP-3': 99000 },
  'VIP-2': { 'VIP-3': 79000 },
};

function isValidUpgradeCost(currentVIP, targetVIP, amount) {
  const costs = upgradeCosts[currentVIP];
  if (costs) {
    const expectedAmount = costs[targetVIP];
    if (expectedAmount !== undefined) {
      return { valid: amount === expectedAmount, expectedAmount };
    }
  }
  return { valid: false, expectedAmount: 0 };
}

export { isValidUpgradeCost };
