import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import React from "react";
import Rate from "@/components/rate";

interface Props {
  data: Item[];
}

interface Item {
  date: string;
  value: number;
  changeRate?: number;
}

function getLatestDecemberDates(data: Item[]): string[] {
  const lastDecDates: Record<string, string> = {};
  data.forEach(({ date }) => {
    const [year, month] = date.split("-");
    if (month === "12") {
      if (!lastDecDates[year] || date > lastDecDates[year]) {
        lastDecDates[year] = date;
      }
    }
  });
  return Object.values(lastDecDates);
}

const calculateChangeRates = (data: Item[], lastDatesOfDec: string[]) => {
  return data
    .filter((data) => lastDatesOfDec.includes(data.date))
    .map((data, index, array) => {
      const nextMarketcap = array[index + 1];
      return {
        ...data,
        changeRate: nextMarketcap
          ? data.value === 0 || nextMarketcap.value === 0
            ? 0
            : ((data.value - nextMarketcap.value) / nextMarketcap.value) * 100
          : undefined,
      };
    });
};

function ListPER({ data }: Props) {
  const lastDatesOfDec = React.useMemo(
    () => getLatestDecemberDates(data),
    [data]
  );
  const valueWithRate = React.useMemo(
    () => calculateChangeRates(data, lastDatesOfDec),
    [data, lastDatesOfDec]
  );

  const minRate = Math.min(
    ...valueWithRate.map((m) => m.changeRate || Infinity)
  );
  const maxRate = Math.max(
    ...valueWithRate.map((m) => m.changeRate || -Infinity)
  );

  return (
    <Card>
      <CardHeader className="px-7">
        <CardTitle>연간 주가순자산비율</CardTitle>
        <CardDescription>연말 기준 주가순자산비율 리스트</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <div className="hidden sm:inline-block">날짜</div>
                <div className="sm:hidden">연도</div>
              </TableHead>
              <TableHead className="text-center">등락율</TableHead>
              <TableHead className="text-center">주가순자산비율</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {valueWithRate.map(({ date, value, changeRate }) => (
              <TableRow
                key={date}
                className={
                  changeRate === minRate ||
                    changeRate === maxRate ||
                    value === 0
                    ? "bg-accent"
                    : ""
                }
              >
                <TableCell>
                  <div className="hidden sm:inline-block font-medium">
                    {date}
                  </div>
                  <div className="font-medium sm:hidden">
                    {date.slice(0, 4)}
                  </div>
                </TableCell>
                <TableCell className="font-semibold">
                  <div className="flex justify-end">
                    {changeRate === 0 || changeRate === undefined ? (
                      "-"
                    ) : (
                      <Rate rate={changeRate} />
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  {value.toLocaleString()}배
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default ListPER;
