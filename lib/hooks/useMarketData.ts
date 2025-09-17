import { useMemo } from 'react';

interface PriceData {
    close?: number;
    rate?: number;
    [key: string]: any;
}

interface SecurityData {
    prices?: PriceData[];
    [key: string]: any;
}

interface CompanyData {
    companyId: string;
    securities?: SecurityData[];
    [key: string]: any;
}

/**
 * Hook to validate and filter company data with securities and prices
 */
export function useValidCompanies(data: CompanyData[]) {
    return useMemo(() => {
        return data.filter((company): company is CompanyData => {
            return Boolean(
                company &&
                company.securities &&
                company.securities.length > 0 &&
                company.securities[0] &&
                company.securities[0].prices &&
                company.securities[0].prices.length > 0
            );
        });
    }, [data]);
}

/**
 * Hook to get the latest price data from a security
 */
export function useLatestPrice(security?: SecurityData) {
    return useMemo(() => {
        if (!security?.prices || security.prices.length === 0) {
            return { close: null, rate: null };
        }

        const latestPrice = security.prices[security.prices.length - 1];
        return {
            close: latestPrice?.close || null,
            rate: latestPrice?.rate || null,
        };
    }, [security]);
}

/**
 * Hook to check if market data is available
 */
export function useMarketDataStatus(data: any[]) {
    return useMemo(() => {
        const hasData = data && data.length > 0;
        const hasValidStructure = hasData &&
            data[0]?.securities?.length > 0 &&
            data[0].securities[0]?.prices?.length > 0;

        return {
            hasData,
            hasValidStructure,
            isEmpty: !hasData,
        };
    }, [data]);
}
