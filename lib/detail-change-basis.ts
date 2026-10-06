import type { DetailMarketcapObservation } from './detail-marketcap-history';

type MarketcapSnapshot = {
    value: number | null | undefined;
    date: Date | string | null | undefined;
};

function observationDate(date: MarketcapSnapshot['date']) {
    if (date == null) return null;
    const parsed = new Date(date);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

/** Compare the displayed snapshot only with its own earlier dated observation. */
export function getSnapshotHistoryComparison(snapshot: MarketcapSnapshot, history: readonly DetailMarketcapObservation[]) {
    const currentDate = observationDate(snapshot.date);
    if (snapshot.value == null || !Number.isFinite(snapshot.value) || !currentDate) return null;

    const observations = history.flatMap(item => {
        const date = observationDate(item.date);
        return date && item.value != null && Number.isFinite(item.value) ? [{ date, value: item.value }] : [];
    });
    if (!observations.some(item => item.date === currentDate && item.value === snapshot.value)) return null;

    const previous = observations.filter(item => item.date < currentDate)
        .sort((a, b) => b.date.localeCompare(a.date))[0];
    if (!previous) return null;

    return {
        current: snapshot.value,
        previous: previous.value,
        currentDate,
        previousDate: previous.date,
    };
}
