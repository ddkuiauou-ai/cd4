'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/app/components/ui/badge';
import { Wifi, WifiOff, RefreshCw, AlertCircle } from 'lucide-react';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/app/components/ui/tooltip';

type NetworkStatus = 'connected' | 'disconnected' | 'updating' | 'delayed' | 'error';

interface NetworkStatusProps {
    status: NetworkStatus;
    lastUpdated?: string;
    message?: string;
    className?: string;
}

/**
 * Network Status component for CD3 project
 * Shows real-time connection status of market data
 * Mobile-optimized with clear visual indicators
 */
export default function NetworkStatus({
    status = 'connected',
    lastUpdated,
    message,
    className
}: NetworkStatusProps) {
    // Status configuration
    const statusConfig = {
        connected: {
            icon: Wifi,
            label: '실시간',
            variant: 'outline' as const,
            color: 'text-success',
            pulseAnimation: false,
        },
        disconnected: {
            icon: WifiOff,
            label: '연결 끊김',
            variant: 'destructive' as const,
            color: 'text-danger',
            pulseAnimation: false,
        },
        updating: {
            icon: RefreshCw,
            label: '업데이트 중',
            variant: 'outline' as const,
            color: 'text-primary',
            pulseAnimation: true,
        },
        delayed: {
            icon: AlertCircle,
            label: '지연',
            variant: 'secondary' as const,
            color: 'text-amber-500',
            pulseAnimation: false,
        },
        error: {
            icon: AlertCircle,
            label: '오류',
            variant: 'destructive' as const,
            color: 'text-danger',
            pulseAnimation: false,
        }
    };

    const config = statusConfig[status];
    const StatusIcon = config.icon;

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className={cn("inline-flex items-center gap-1.5", className)}>
                        <Badge variant={config.variant} className="h-6 px-2">
                            <span
                                className={cn(
                                    "mr-1 flex items-center justify-center",
                                    config.pulseAnimation && "animate-spin"
                                )}
                            >
                                <StatusIcon className={cn("h-3 w-3", config.color)} />
                            </span>
                            <span className="text-xs">{config.label}</span>
                        </Badge>
                        {lastUpdated && (
                            <span className="text-xs text-muted-foreground hidden sm:inline-block">
                                {lastUpdated}
                            </span>
                        )}
                    </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="w-64 p-3">
                    <div className="space-y-1.5">
                        <p className="font-medium">{config.label}</p>
                        <p className="text-xs text-muted-foreground">
                            {message || (
                                status === 'connected'
                                    ? '시장 데이터가 실시간으로 업데이트되고 있습니다.'
                                    : status === 'disconnected'
                                        ? '인터넷 연결을 확인하세요.'
                                        : status === 'updating'
                                            ? '최신 시장 데이터를 불러오는 중입니다.'
                                            : status === 'delayed'
                                                ? '시장 데이터가 지연되고 있습니다. 15분 지연된 데이터를 표시합니다.'
                                                : '데이터를 불러오는 중 오류가 발생했습니다.'
                            )}
                        </p>
                        {lastUpdated && (
                            <p className="text-xs font-medium">마지막 업데이트: {lastUpdated}</p>
                        )}
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
