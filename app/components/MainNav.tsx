"use client";

import * as React from "react";
import Link from "next/link";

import { siteConfig } from "@/config/site";
import Image from "next/image";

export function MainNav() {
    // Removed unused variable

    return (
        <div className="mr-4 hidden md:flex">
            <Link href="/" className="mr-6 flex items-center space-x-2">
                <Image src="/logo_long.svg" alt="logo" width={334.56} height={56.34} />
                <span className="hidden font-bold">{siteConfig.name}</span>
            </Link>
        </div>
    );
}
