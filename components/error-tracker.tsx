'use client';

import { useEffect, useState } from 'react';

export function ErrorTracker() {
    const [errors, setErrors] = useState<string[]>([]);

    useEffect(() => {
        // Override console.error to catch ResponsiveContainer errors
        const originalError = console.error;

        console.error = (...args) => {
            const message = args.join(' ');
            if (message.includes('ResponsiveContainer') || message.includes('width(0)') || message.includes('height(0)')) {
                console.log('🚨 FOUND RESPONSIVE CONTAINER ERROR:', message);
                setErrors(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
            }
            originalError.apply(console, args);
        };

        return () => {
            console.error = originalError;
        };
    }, []);

    if (errors.length === 0) return null;

    return (
        <div className="fixed top-0 left-0 right-0 z-50 bg-red-100 border-b-2 border-red-500 p-2">
            <div className="text-red-800 text-sm font-medium">
                🚨 ResponsiveContainer Errors Detected:
            </div>
            {errors.map((error, index) => (
                <div key={index} className="text-red-700 text-xs mt-1">
                    {error}
                </div>
            ))}
        </div>
    );
}
