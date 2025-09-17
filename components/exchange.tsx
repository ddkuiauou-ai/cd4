import { Badge } from "@/components/ui/badge";

function Exchange({ exchange }: { exchange: string }) {
  return (
    <>
      {exchange === "KOSPI" ? (
        <Badge variant="outline">
          코스피
        </Badge>
      ) : exchange === "KOSDAQ" ? (
        <Badge variant="outline">
          코스닥
        </Badge>
      ) : exchange === "KONEX" ? (
        <Badge variant="outline">
          코넥스
        </Badge>
      ) : (
        <Badge variant="outline">
          기타
        </Badge>
      )}
    </>
  );
}

export default Exchange;
