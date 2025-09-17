'use client';

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

const convertToCSV = (data: any[]) => {
    if (!data || data.length === 0) {
        return "";
    }
    const headers = Object.keys(data[0]);
    const csvRows = [];
    csvRows.push(headers.join(','));

    for (const row of data) {
        const values = headers.map(header => {
            let value = row[header];
            if (value === null || value === undefined) {
                value = '';
            } else {
                const stringValue = String(value);
                if (/[",\n\r]/.test(stringValue)) {
                    value = `"${stringValue.replace(/"/g, '""')}"`;
                } else {
                    value = stringValue;
                }
            }
            return value;
        });
        csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
};


const downloadCSV = (csvString: string, filename: string) => {
    const blob = new Blob(["\uFEFF" + csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

interface CsvDownloadButtonProps {
    data: any[];
    filename?: string;
    className?: string;
}

export function CsvDownloadButton({ data, filename = 'data.csv', className }: CsvDownloadButtonProps) {
    const handleDownload = () => {
        if (!data || data.length === 0) {
            console.warn("No data to download.");
            return;
        }
        const csvData = convertToCSV(data);
        downloadCSV(csvData, filename);
    };

    return (
        <Button onClick={handleDownload} variant="outline" size="sm" className={className}>
            <Download className="mr-2 h-4 w-4" />
            CSV 다운로드
        </Button>
    );
}
