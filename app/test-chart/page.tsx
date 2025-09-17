// Test page to check ResponsiveContainer errors
'use client';

import React, { useState, useEffect } from 'react';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis } from 'recharts';

const testData = [
    { date: '2024-01', value: 100 },
    { date: '2024-02', value: 150 },
    { date: '2024-03', value: 120 },
];

export default function TestChartPage() {
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    if (!isClient) {
        return <div>Loading...</div>;
    }

    return (
        <div className="p-8">
            <h1 className="text-2xl font-bold mb-4">ResponsiveContainer Test</h1>

            {/* Test with fixed height */}
            <div className="mb-8">
                <h2 className="text-lg font-semibold mb-2">Fixed Height (300px)</h2>
                <div className="w-full h-[300px] min-h-[300px] border border-gray-300">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={testData}>
                            <XAxis dataKey="date" />
                            <YAxis />
                            <Line type="monotone" dataKey="value" stroke="#8884d8" />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Test with aspect ratio */}
            <div className="mb-8">
                <h2 className="text-lg font-semibold mb-2">Aspect Ratio (2:1) with min-height</h2>
                <div className="w-full min-h-[200px] border border-gray-300">
                    <ResponsiveContainer width="100%" aspect={2}>
                        <LineChart data={testData}>
                            <XAxis dataKey="date" />
                            <YAxis />
                            <Line type="monotone" dataKey="value" stroke="#82ca9d" />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Test with aspect ratio WITHOUT min-height (should cause error) */}
            <div className="mb-8">
                <h2 className="text-lg font-semibold mb-2">Aspect Ratio WITHOUT min-height (should error)</h2>
                <div className="w-full border border-red-300">
                    <ResponsiveContainer width="100%" aspect={2}>
                        <LineChart data={testData}>
                            <XAxis dataKey="date" />
                            <YAxis />
                            <Line type="monotone" dataKey="value" stroke="#ff7300" />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}
