import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    CardFooter,
} from "@/components/ui/card";
import { Security } from "@/typings";
import { Separator } from "@/components/ui/separator";

function MarketcapCardDetail({ securities }: { securities: Security[] }) {
    const marketcapDate = securities[0]?.marketcapDate
        ? new Date(securities[0]?.marketcapDate).toISOString().split("T")[0]
        : "";
    const updatedAt = securities[0]?.updatedAt
        ? new Date(securities[0].updatedAt).setHours(
            new Date(securities[0].updatedAt).getHours() + 9
        )
        : "";
    const sum = securities
        .map((security) => security.marketcap)
        .reduce((a, b) => a + b, 0);

    const updatedISOString = updatedAt
        ? new Date(updatedAt).toISOString().replace(/:\d{2}\.\d{3}Z$/, "")
        : "";

    return (
        <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-start bg-muted/50">
                <div className="grid gap-0.5">
                    <CardTitle className="group flex items-center gap-2 text-lg">
                        시가총액
                    </CardTitle>
                    <CardDescription>{`기준일자: ${marketcapDate}`}</CardDescription>
                </div>
                <div className="ml-auto flex items-center gap-1"></div>
            </CardHeader>
            <CardContent className="p-6 text-sm">
                <div className="grid gap-3">
                    <div className="font-semibold">증권</div>
                    <ul className="grid gap-3">
                        {securities?.map((security) => {
                            return (
                                <li
                                    key={security.securityId}
                                    className="flex items-center justify-between"
                                >
                                    <span className="text-muted-foreground">
                                        {security.type} <span></span>
                                    </span>
                                    <span>
                                        {security.marketcap.toLocaleString()}원
                                        <span>
                                            {" "}
                                            {sum !== 0
                                                ? `(${((security.marketcap / sum) * 100).toFixed(1)}%)`
                                                : "(0%)"}
                                        </span>
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                    <Separator className="my-2" />
                    <ul className="grid gap-3">
                        <li className="flex items-center justify-between font-semibold">
                            <span className="text-muted-foreground">합계</span>
                            <span>
                                {sum.toLocaleString()}원<span> (100%)</span>
                            </span>
                        </li>
                    </ul>
                </div>
            </CardContent>
            <CardFooter className="flex flex-row items-center border-t bg-muted/50 px-6 py-3">
                <div className="text-xs text-muted-foreground">
                    업데이트: <time dateTime={updatedISOString}>{updatedISOString}</time>
                </div>
            </CardFooter>
        </Card>
    );
}

export default MarketcapCardDetail;
