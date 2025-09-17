"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRouter, useSearchParams } from "next/navigation";

export function DashboardTabs({ currentTab }: { currentTab: string }) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const handleTabChange = (value: string) => {
        const params = new URLSearchParams(searchParams);
        if (value === "dashboard1") {
            params.delete("view");
        } else {
            params.set("view", "dashboard2");
        }

        const queryString = params.toString();
        const newUrl = queryString ? `/dashboard?${queryString}` : "/dashboard";
        router.push(newUrl);
    };

    return (
        <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full sm:w-[400px]">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="dashboard1">
                    랭킹
                </TabsTrigger>
                <TabsTrigger value="dashboard2">
                    실시간
                </TabsTrigger>
            </TabsList>
        </Tabs>
    );
}
