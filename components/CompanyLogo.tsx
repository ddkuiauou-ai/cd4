"use client";
import React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface CompanyLogoProps {
    companyName: string | null;
    logoUrl?: string | null;
    size?: number;
    className?: string;
}

export default function CompanyLogo({
    companyName,
    logoUrl,
    size = 48,
    className,
}: CompanyLogoProps) {
    // 회사 이름의 첫 글자 추출 (한글/영문 모두 지원)
    const getInitial = (name: string | null): string => {
        if (!name) return "?";

        // 공백으로 분리해서 첫번째 단어의 첫 글자
        const firstWord = name.trim().split(/\s+/)[0];
        return firstWord.charAt(0).toUpperCase();
    };

    // 이름 기반 색상 생성 (일관된 색상을 위해 해시 기반)
    const getBackgroundColor = (name: string | null): string => {
        if (!name) return "bg-muted";

        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }

        const colors = [
            "bg-blue-500 dark:bg-blue-600",
            "bg-green-500 dark:bg-green-600",
            "bg-purple-500 dark:bg-purple-600",
            "bg-orange-500 dark:bg-orange-600",
            "bg-pink-500 dark:bg-pink-600",
            "bg-teal-500 dark:bg-teal-600",
            "bg-indigo-500 dark:bg-indigo-600",
            "bg-red-500 dark:bg-red-600",
            "bg-yellow-500 dark:bg-yellow-600",
            "bg-cyan-500 dark:bg-cyan-600",
        ];

        return colors[Math.abs(hash) % colors.length];
    };

    if (logoUrl) {
        return (
            <Image
                src={logoUrl}
                alt={`${companyName || "기업"} 로고`}
                width={size}
                height={size}
                className={cn(
                    "rounded-lg object-cover",
                    className
                )}
                unoptimized
            />
        );
    }

    // 로고가 없는 경우 첫 글자로 아바타 생성
    const initial = getInitial(companyName);
    const bgColor = getBackgroundColor(companyName);

    return (
        <div
            className={cn(
                "flex items-center justify-center rounded-lg text-white dark:text-white font-bold",
                bgColor,
                className
            )}
            style={{
                width: size,
                height: size,
                fontSize: size * 0.4 // 크기에 비례한 폰트 크기
            }}
        >
            {initial}
        </div>
    );
}
