import { getSecuritySearchNames } from "@/lib/getSearch";

export const dynamic = "force-static";
// Server requests can trigger revalidation after five minutes. Static
// export writes one JSON snapshot; its next build supplies the next snapshot.
export const revalidate = 300;

export async function GET() {
  const securities = await getSecuritySearchNames();
  const data = securities.map(({ securityId, companyId, korName, type, exchange, ticker, routeCode, companyRouteCode }) => ({
    securityId, companyId, korName, type, exchange, ticker, routeCode, companyRouteCode,
  }));
  return Response.json(data);
}
