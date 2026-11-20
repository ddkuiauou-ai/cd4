import { isStaticBuild, getStaticSearchIdentities } from './static-build/server';
import { db } from "@/db";
import * as schema from "@/db/schema-postgres";
import { asc, eq, ilike, or } from "drizzle-orm";
import { getSecurityByCode } from "./data/security";
import { businessDate, toDataDTO } from "./data/dto";
import { listedSecurityPeriods } from "./data/listed-security-periods";
import { readPublication, readSnapshot, SECURITY_PUBLICATION_KEY } from "./data/publication";
import { companyRouteCodes, securityRouteCodes } from './entity-paths';

export interface SearchNameResult {
  securityId: string; ticker: string; companyId: string | null;
  name: string; korName: string; type: string | null; exchange: string;
  routeCode?: string | null; companyRouteCode?: string | null;
}

export async function getSecuritySearchNames(): Promise<SearchNameResult[]> {
  if (isStaticBuild()) {
    return getStaticSearchIdentities().toSorted((a, b) => a.korName.localeCompare(b.korName) || a.securityId.localeCompare(b.securityId));
  }
  return readSnapshot(async tx => {
    const [rows, periods, publication] = await Promise.all([
      tx.query.security.findMany({
        columns: { securityId: true, ticker: true, companyId: true, name: true, korName: true, type: true,
          exchange: true, listingDate: true, delistingDate: true },
        orderBy: [asc(schema.security.korName), asc(schema.security.securityId)],
      }),
      tx.query.securityListingPeriod.findMany(),
      readPublication(tx, SECURITY_PUBLICATION_KEY),
    ]);
    const listed = listedSecurityPeriods(rows, periods, businessDate(publication?.asOf));
    const securities = securityRouteCodes(rows), companies = companyRouteCodes(rows);
    return rows.filter(row => listed.has(row.securityId)).map(row => ({
      ...row,
      routeCode: securities.get(row.securityId) ?? null,
      companyRouteCode: row.companyId ? companies.get(row.companyId) ?? null : null,
    }));
  });
}
export const findSecurityByName = getSecurityByCode;

export async function findCompanyByName(name: string) {
  if (!name) return null;
  const decoded = decodeURIComponent(name);
  const rows = await db.query.company.findMany({
    where: or(eq(schema.company.companyId, decoded), eq(schema.company.name, decoded), eq(schema.company.korName, decoded)),
    columns: { companyId: true, name: true, korName: true, logo: true }, limit: 2,
  });
  return rows.length === 1 ? toDataDTO(rows[0]) : null;
}

export async function searchSecurities(query: string, limit = 10) {
  if (query.length < 2) return [];
  return db.query.security.findMany({
    where: or(ilike(schema.security.name, `%${query}%`), ilike(schema.security.korName, `%${query}%`), ilike(schema.security.ticker, `%${query}%`)),
    columns: { securityId: true, companyId: true, name: true, korName: true, ticker: true, type: true, exchange: true },
    orderBy: [asc(schema.security.korName), asc(schema.security.securityId)], limit: Math.max(1, Math.min(100, limit)),
  });
}
export async function searchCompanies(query: string, limit = 10) {
  if (query.length < 2) return [];
  return db.query.company.findMany({
    where: or(ilike(schema.company.name, `%${query}%`), ilike(schema.company.korName, `%${query}%`)),
    columns: { companyId: true, name: true, korName: true }, orderBy: [asc(schema.company.korName)], limit: Math.max(1, Math.min(100, limit)),
  });
}
export const getSearchNames2 = getSecuritySearchNames;
export const getSecurityByName = findSecurityByName;
export const getCompanyByName = findCompanyByName;
