import { Globe, BarChart, Target, DollarSign } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

function RankHeader({
  rank,
  marketcap,
  price,
  exchange,
  isCompanyLevel = false,
  name, // Adding name prop for legacy usage
}: {
  rank: number;
  marketcap?: number;
  price?: number;
  exchange?: string;
  isCompanyLevel?: boolean;
  name?: string; // Optional name prop
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* 순위 카드 */}
      <Card className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-900/50 border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-slate-700 dark:bg-slate-600 text-white">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{rank}위</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {isCompanyLevel ? "기업 시가총액 랭킹" : "시가총액 랭킹"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 시가총액 카드 */}
      {marketcap != null && (
        <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950/30 dark:to-red-900/30 border-red-200 dark:border-red-800 hover:shadow-lg transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-red-600 dark:bg-red-600 text-white">
                <DollarSign className="h-5 w-5" />
              </div>
              <div>
                <p className="text-lg font-bold text-red-900 dark:text-red-100 leading-tight">
                  {formatNumber(marketcap)}원
                </p>
                <p className="text-sm text-red-700 dark:text-red-300 font-medium">
                  {isCompanyLevel ? "기업 총 시가총액" : "시가총액"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 주가 카드 */}
      {price != null && (
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/30 border-blue-200 dark:border-blue-800 hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-600 dark:bg-blue-600 text-white">
                <BarChart className="h-5 w-5" />
              </div>
              <div>
                <p className="text-lg font-bold text-blue-900 dark:text-blue-100">
                  {price.toLocaleString()}원
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  {isCompanyLevel ? "대표 종목 주가" : "주가"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 시장 카드 */}
      {exchange && (
        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/30 dark:to-amber-900/30 border-amber-200 dark:border-amber-800 hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-600 dark:bg-amber-600 text-white">
                <Globe className="h-5 w-5" />
              </div>
              <div>
                <p className="text-lg font-bold text-amber-900 dark:text-amber-100">{exchange}</p>
                <p className="text-sm text-amber-700 dark:text-amber-300">거래소</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default RankHeader;
