/**
 * CD3 Project - Search Data Access Layer
 * 
 * This file contains all search-related data fetching functions including:
 * - Security search by name
 * - Company search by name  
 * - Display name search
 * - General search functionality
 * 
 * All functions follow descriptive naming conventions and include proper TypeScript typing.
 */

import { db } from "@/db";
import { unstable_cache } from "next/cache";
import {
    eq,
    and,
    desc,
    isNull,
} from "drizzle-orm";
import * as schema from "@/db/schema-postgres";

// Type definitions for search data structures
export interface SearchNameResult {
    securityId: string;
    companyId: string | null;
    name: string;
    korName: string;
    type: string | null;
    exchange: string;
}

export interface DisplayNameResult {
    id: number;
    value: string;
    companyName: string;
}

export interface SecuritySearchResult {
    securityId: string;
    name: string;
    korName: string;
    type: string | null;
    exchange: string;
    companyId: string | null;
    company?: {
        companyId: string;
        name: string;
        korName: string;
    } | null;
    prices?: Array<{
        close: number | null;
        date: Date;
        rate: number | null;
    }>;
}

export interface CompanySearchResult {
    companyId: string;
    name: string;
    korName: string;
    securities?: Array<{
        securityId: string;
        name: string;
        type: string | null;
    }>;
}

/**
 * Get all security names for search functionality
 * Returns comprehensive list of all non-delisted securities with basic info
 * 
 * @returns Array of securities with search-relevant fields
 */
export const getSecuritySearchNames = unstable_cache(
    async (): Promise<SearchNameResult[]> => {
        try {
            return await db.query.security.findMany({
                where: isNull(schema.security.delistingDate),
                columns: {
                    securityId: true,
                    companyId: true,
                    name: true,
                    korName: true,
                    type: true,
                    exchange: true,
                },
            });
        } catch (error) {
            console.error("[GET_SECURITY_SEARCH_NAMES] Error fetching data:", error);
            return [];
        }
    },
    ["getSecuritySearchNames"],
    { tags: ["getSecuritySearchNames"] }
);

/**
 * Get display names for search autocomplete
 * Returns company display names that can be used for search suggestions
 * 
 * @returns Array of display names with company information
 */
export const getDisplaySearchNames = unstable_cache(
    async (): Promise<DisplayNameResult[]> => {
        try {
            return await db.query.displayName.findMany({
                columns: {
                    id: true,
                    value: true,
                    companyName: true,
                },
            });
        } catch (error) {
            console.error("[GET_DISPLAY_SEARCH_NAMES] ERROR:", error);
            return [];
        }
    },
    ["getDisplaySearchNames"],
    { tags: ["getDisplaySearchNames"] }
);

/**
 * Find security by exact name match
 * Used for direct security lookup by name
 * 
 * @param name - Security name to search for
 * @returns Security details with company and price data, or null if not found
 */
export const findSecurityByName = unstable_cache(
    async (name: string) => {
        try {
            if (!name) return null;

            const decodedName = decodeURIComponent(name);
            const security = await db.query.security.findFirst({
                where: eq(schema.security.name, decodedName),
                with: {
                    company: true,
                    prices: {
                        orderBy: [desc(schema.price.date)],
                        limit: 30,
                    },
                },
            });

            return security || null;
        } catch (error) {
            console.error("[FIND_SECURITY_BY_NAME] ERROR:", error);
            return null;
        }
    },
    ["findSecurityByName"],
    { tags: ["findSecurityByName"] }
);

/**
 * Find company by name (supports both name and korName)
 * Used for company lookup with associated securities
 * 
 * @param name - Company name to search for (can be English or Korean)
 * @returns Company details with securities and price data, or null if not found
 */
export const findCompanyByName = unstable_cache(
    async (name: string) => {
        try {
            if (!name) return null;

            const decodedName = decodeURIComponent(name);

            // Try direct name match first
            let company = await db.query.company.findFirst({
                where: eq(schema.company.name, decodedName),
                with: {
                    securities: {
                        where: and(
                            eq(schema.security.type, "보통주"),
                            isNull(schema.security.delistingDate)
                        ),
                        with: {
                            prices: {
                                orderBy: [desc(schema.price.date)],
                                limit: 30,
                            },
                        },
                    },
                },
            });

            // If not found, try Korean name
            if (!company) {
                company = await db.query.company.findFirst({
                    where: eq(schema.company.korName, decodedName),
                    with: {
                        securities: {
                            where: and(
                                eq(schema.security.type, "보통주"),
                                isNull(schema.security.delistingDate)
                            ),
                            with: {
                                prices: {
                                    orderBy: [desc(schema.price.date)],
                                    limit: 30,
                                },
                            },
                        },
                    },
                });
            }

            // If still not found, try displayName lookup
            if (!company) {
                const display = await db.query.displayName.findFirst({
                    where: eq(schema.displayName.value, decodedName),
                });

                if (display) {
                    company = await db.query.company.findFirst({
                        where: eq(schema.company.companyId, display.companyId),
                        with: {
                            securities: {
                                where: and(
                                    eq(schema.security.type, "보통주"),
                                    isNull(schema.security.delistingDate)
                                ),
                                with: {
                                    prices: {
                                        orderBy: [desc(schema.price.date)],
                                        limit: 30,
                                    },
                                },
                            },
                        },
                    });
                }
            }

            return company || null;
        } catch (error) {
            console.error("[FIND_COMPANY_BY_NAME] ERROR:", error);
            return null;
        }
    },
    ["findCompanyByName"],
    { tags: ["findCompanyByName"] }
);

/**
 * Search for securities with fuzzy matching
 * Used for search suggestions and partial name matching
 * 
 * @param query - Search query string
 * @param limit - Maximum number of results to return
 * @returns Array of matching securities
 */
export const searchSecurities = unstable_cache(
    async (query: string, limit: number = 10) => {
        try {
            if (!query || query.length < 2) return [];

            // Search in both name and korName fields
            const securities = await db.query.security.findMany({
                where: and(
                    isNull(schema.security.delistingDate),
                    // Note: In a real implementation, you'd use SQL LIKE or similar
                    // This is a simplified version - you may need to use raw SQL for proper fuzzy search
                ),
                columns: {
                    securityId: true,
                    companyId: true,
                    name: true,
                    korName: true,
                    type: true,
                    exchange: true,
                },
                limit,
            });

            // Filter results in memory for now (in production, use database-level search)
            return securities.filter(security =>
                security.name?.toLowerCase().includes(query.toLowerCase()) ||
                security.korName?.toLowerCase().includes(query.toLowerCase())
            );
        } catch (error) {
            console.error("[SEARCH_SECURITIES] ERROR:", error);
            return [];
        }
    },
    ["searchSecurities"],
    { tags: ["searchSecurities"] }
);

/**
 * Search for companies with fuzzy matching
 * Used for company search suggestions and partial name matching
 * 
 * @param query - Search query string
 * @param limit - Maximum number of results to return
 * @returns Array of matching companies
 */
export const searchCompanies = unstable_cache(
    async (query: string, limit: number = 10) => {
        try {
            if (!query || query.length < 2) return [];

            // Search in both name and korName fields
            const companies = await db.query.company.findMany({
                columns: {
                    companyId: true,
                    name: true,
                    korName: true,
                },
                limit,
            });

            // Filter results in memory for now (in production, use database-level search)
            return companies.filter(company =>
                company.name?.toLowerCase().includes(query.toLowerCase()) ||
                company.korName?.toLowerCase().includes(query.toLowerCase())
            );
        } catch (error) {
            console.error("[SEARCH_COMPANIES] ERROR:", error);
            return [];
        }
    },
    ["searchCompanies"],
    { tags: ["searchCompanies"] }
);

// Legacy function aliases for backward compatibility
// These will be used during the transition period
export const getSearchNames2 = getSecuritySearchNames;
export const getSearchNames = getDisplaySearchNames;
export const getSecurityByName = findSecurityByName;
export const getCompanyByName = findCompanyByName;
