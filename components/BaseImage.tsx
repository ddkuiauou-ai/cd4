'use client';

import Image from 'next/image';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface BaseImageProps {
    src: string;
    alt: string;
    width?: number;
    height?: number;
    className?: string;
    fill?: boolean;
    priority?: boolean;
    sizes?: string;
    onError?: () => void;
}

/**
 * BaseImage - Optimized image component with error handling
 * Built according to CD3 design philosophy
 */
export default function BaseImage({
    src,
    alt,
    width,
    height,
    className,
    fill = false,
    priority = false,
    sizes,
    onError,
    ...props
}: BaseImageProps) {
    const [hasError, setHasError] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const handleError = () => {
        setHasError(true);
        setIsLoading(false);
        onError?.();
    };

    const handleLoad = () => {
        setIsLoading(false);
    };

    // Fallback image placeholder
    if (hasError) {
        return (
            <div
                className={cn(
                    "bg-muted flex items-center justify-center text-muted-foreground",
                    fill ? "absolute inset-0" : "",
                    className
                )}
                style={!fill ? { width, height } : undefined}
            >
                <span className="text-xs">이미지 없음</span>
            </div>
        );
    }

    return (
        <div className={cn("relative", className)}>
            {isLoading && (
                <div
                    className={cn(
                        "absolute inset-0 bg-muted animate-pulse",
                        fill ? "" : "rounded"
                    )}
                />
            )}
            <Image
                src={src}
                alt={alt}
                width={fill ? undefined : width}
                height={fill ? undefined : height}
                fill={fill}
                priority={priority}
                sizes={sizes}
                onError={handleError}
                onLoad={handleLoad}
                className={cn(
                    "transition-opacity duration-300",
                    isLoading ? "opacity-0" : "opacity-100"
                )}
                {...props}
            />
        </div>
    );
}
