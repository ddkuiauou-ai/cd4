import { VercelLogoIcon } from "@radix-ui/react-icons";
import { cn } from "@/lib/utils";

export type Props = {
    rate: number;
};

function Rate({ rate }: Props) {
    const isPositive = rate > 0;
    const isNegative = rate < 0;
    const isZero = rate === 0;

    return (
        <div className="flex">
            <div
                className={cn(
                    "flex items-center",
                    isZero && "text-gray-500",
                    isPositive && "text-red-500",
                    isNegative && "text-blue-500"
                )}
            >
                <VercelLogoIcon
                    className={cn(
                        isPositive ? "" :
                            isNegative ? "rotate-180" :
                                "hidden"
                    )}
                />
                <div>
                    {isPositive ? (
                        "+" + rate.toFixed(2) + "%"
                    ) : isNegative ? (
                        rate.toFixed(2) + "%"
                    ) : (
                        <span style={{ whiteSpace: "pre" }}>{"0.00%"}</span>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Rate;
