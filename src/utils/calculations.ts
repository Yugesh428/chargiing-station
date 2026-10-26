export const calculateChargingMetrics = (
  arrivalSoc: number,
  departureSoc: number,
  ratePerPercent: number,
  electricityRate: number,
  batteryCapacity: number = 17 // Default battery capacity in kWh per %
) => {
  const chargedPercent = departureSoc - arrivalSoc;
  const chargeAmount = chargedPercent * ratePerPercent;
  const usedKwh = (chargedPercent * batteryCapacity) / 100;
  const electricityCost = usedKwh * electricityRate;
  const netContribution = chargeAmount - electricityCost;

  return {
    chargedPercent,
    chargeAmount,
    usedKwh,
    electricityCost,
    netContribution,
  };
};

export const calculateOutstanding = (
  chargeAmount: number,
  creditPaid: number = 0
): number => {
  return chargeAmount - creditPaid;
};
