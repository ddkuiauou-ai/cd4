// Market index data (mock) for KOSPI/KOSDAQ/KOSPI200
export async function getMarketIndices(): Promise<any[]> {
  const today = new Date();
  const todayFormatted = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  return [
    { name: 'KOSPI', currentValue: 2745.82, previousClose: 2720.54, change: 25.28, changePercent: 0.93, volume: 573.2, date: todayFormatted },
    { name: 'KOSDAQ', currentValue: 845.76, previousClose: 840.21, change: 5.55, changePercent: 0.66, volume: 982.6, date: todayFormatted },
    { name: 'KOSPI 200', currentValue: 367.92, previousClose: 364.21, change: 3.71, changePercent: 1.02, volume: 254.8, date: todayFormatted },
  ];
}

