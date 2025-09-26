"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { AnimateIcon } from "@/components/animate-ui/icons/icon";
import { Link as AnimatedLink } from "@/components/animate-ui/icons/link";
import { Copy as AnimatedCopy } from "@/components/animate-ui/icons/copy";
import { Check as AnimatedCheck } from "@/components/animate-ui/icons/check";
import { COMPANY_HEADER_PIN_EVENT } from "@/components/share-events";

type SharePayload = {
    title?: string;
    text?: string;
    url?: string;
};

export interface ShareButtonProps extends SharePayload {
    className?: string;
    variant?: ButtonProps["variant"];
    size?: ButtonProps["size"];
    copyVariant?: ButtonProps["variant"];
    copySize?: ButtonProps["size"];
}

type ButtonMode = "default" | "compact";

export function ShareButton({
    title,
    text,
    url,
    variant = "outline",
    size = "sm",
    copyVariant,
    copySize,
    className,
}: ShareButtonProps) {
    const { toast } = useToast();
    const [isSharing, setIsSharing] = useState(false);
    const [isCopying, setIsCopying] = useState(false);
    const [canNativeShare, setCanNativeShare] = useState(false);
    const [isPinned, setIsPinned] = useState(false);
    const [mode, setMode] = useState<ButtonMode>("default");
    const [isSmallViewport, setIsSmallViewport] = useState(false);
    const [copyState, setCopyState] = useState<"idle" | "success">("idle");
    const [animateKey, setAnimateKey] = useState(0);

    useEffect(() => {
        if (typeof navigator === "undefined") {
            setCanNativeShare(false);
            return;
        }

        setCanNativeShare(typeof navigator.share === "function");
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        const handlePinChange = (event: Event) => {
            const customEvent = event as CustomEvent<{ pinned: boolean }>;
            setIsPinned(Boolean(customEvent.detail?.pinned));
        };

        window.addEventListener(COMPANY_HEADER_PIN_EVENT, handlePinChange);

        return () => {
            window.removeEventListener(COMPANY_HEADER_PIN_EVENT, handlePinChange);
        };
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") {
            setIsSmallViewport(false);
            setMode("default");
            return;
        }

        const query = window.matchMedia("(max-width: 639px)");
        const handleChange = () => {
            setIsSmallViewport(query.matches);
            setMode(query.matches && isPinned ? "compact" : "default");
        };

        handleChange();

        if (typeof query.addEventListener === "function") {
            query.addEventListener("change", handleChange);
            return () => query.removeEventListener("change", handleChange);
        }

        query.addListener(handleChange);
        return () => query.removeListener(handleChange);
    }, [isPinned]);

    const resolvedPayload = useMemo<SharePayload>(() => {
        if (typeof window === "undefined") {
            return { title, text, url };
        }

        const currentUrl = window.location.href;
        return {
            title: title ?? document.title,
            text,
            url: url ?? currentUrl,
        };
    }, [title, text, url]);

    const handleCopy = useCallback(async () => {
        if (isCopying) return;

        setIsCopying(true);
        setCopyState("idle");

        try {
            const target = resolvedPayload.url ?? window.location.href;

            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(target);
            } else {
                const textarea = document.createElement("textarea");
                textarea.value = target;
                textarea.style.position = "fixed";
                textarea.style.opacity = "0";
                document.body.appendChild(textarea);
                textarea.focus();
                textarea.select();
                document.execCommand("copy");
                document.body.removeChild(textarea);
            }

            toast({ description: "페이지 링크가 복사되었습니다." });
            setCopyState("success");
            setAnimateKey((key) => key + 1);
            setTimeout(() => {
                setCopyState("idle");
            }, 1600);
        } catch (error) {
            console.error("[ShareButton] Failed to copy", error);
            toast({
                title: "링크를 복사하지 못했습니다",
                description: "다시 시도해 주세요.",
                variant: "destructive",
            });
        } finally {
            setIsCopying(false);
        }
    }, [isCopying, resolvedPayload.url, toast]);

    const handleShare = useCallback(async () => {
        if (isSharing) return;

        if (!canNativeShare) {
            await handleCopy();
            return;
        }

        setIsSharing(true);

        try {
            await navigator.share({
                title: resolvedPayload.title,
                text: resolvedPayload.text,
                url: resolvedPayload.url,
            });
        } catch (error) {
            const isAbortError =
                error instanceof DOMException &&
                (error.name === "AbortError" ||
                    error.message?.toLowerCase().includes("canceled"));

            if (isAbortError) {
                toast({ description: "공유를 취소했습니다." });
                return;
            }

            console.error("[ShareButton] Failed to share", error);
            toast({
                title: "공유에 실패했습니다",
                description: "다시 시도해 주세요.",
                variant: "destructive",
            });
        } finally {
            setIsSharing(false);
        }
    }, [canNativeShare, handleCopy, isSharing, resolvedPayload.text, resolvedPayload.title, resolvedPayload.url, toast]);

    const resolvedCopyVariant = copyVariant ?? (canNativeShare ? "ghost" : variant);
    const resolvedCopySize = copySize ?? size;

    if (mode === "compact") {
        return (
            <div
                className={cn(
                    "fixed inset-x-0 bottom-0 z-50 bg-background/95 px-4 py-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80",
                    className,
                )}
            >
                <div className="flex flex-nowrap gap-2">
                    <Button
                        type="button"
                        variant="secondary"
                        size="default"
                        className="min-w-0 flex-1 gap-1.5 px-2 py-2 text-xs"
                        disabled={isCopying}
                        onClick={() => void handleCopy()}
                    >
                        <AnimateIcon
                            key={copyState === "success" ? `copy-success-${animateKey}` : "copy-idle"}
                            animate={copyState === "success" ? "default" : false}
                            animateOnHover
                            className="inline-flex items-center gap-1"
                        >
                            {copyState === "success" ? <AnimatedCheck size={18} animateOnHover /> : <AnimatedLink size={18} />}
                            <span className="text-xs font-medium">{copyState === "success" ? "복사 완료" : "링크 복사"}</span>
                        </AnimateIcon>
                    </Button>
                    <Button
                        type="button"
                        variant="default"
                        size="default"
                        className="min-w-0 flex-1 gap-1.5 px-2 py-2 text-xs"
                        disabled={isSharing}
                        onClick={() => (canNativeShare ? void handleShare() : void handleCopy())}
                    >
                        <AnimateIcon animateOnHover className="inline-flex items-center gap-1">
                            <AnimatedCopy size={18} />
                            <span className="text-xs font-medium">
                                {canNativeShare ? "공유하기" : "링크 복사"}
                            </span>
                        </AnimateIcon>
                    </Button>
                </div>
            </div>
        );
    }

    if (isSmallViewport) {
        return (
            <div className={cn("flex w-full flex-nowrap gap-2", className)}>
                <Button
                    type="button"
                    variant={resolvedCopyVariant}
                    size={resolvedCopySize}
                    className="min-w-0 flex-1 gap-1.5 px-2 py-2 text-xs"
                    disabled={isCopying}
                    onClick={() => void handleCopy()}
                >
                    <AnimateIcon
                        key={copyState === "success" ? `copy-success-${animateKey}` : "copy-idle"}
                        animate={copyState === "success" ? "default" : false}
                        animateOnHover
                        className="inline-flex items-center gap-1"
                    >
                        {copyState === "success" ? <AnimatedCheck size={18} animateOnHover /> : <AnimatedLink size={18} />}
                        <span className="text-xs font-medium">
                            {copyState === "success" ? "복사 완료" : "링크 복사"}
                        </span>
                    </AnimateIcon>
                </Button>
                <Button
                    type="button"
                    variant={variant}
                    size={size}
                    className="min-w-0 flex-1 gap-1.5 px-2 py-2 text-xs"
                    disabled={isSharing}
                    onClick={() => (canNativeShare ? void handleShare() : void handleCopy())}
                >
                    <AnimateIcon animateOnHover className="inline-flex items-center gap-1">
                        <AnimatedCopy size={18} />
                        <span className="text-xs font-medium">
                            {canNativeShare ? "공유하기" : "링크 복사"}
                        </span>
                    </AnimateIcon>
                </Button>
            </div>
        );
    }

    return (
        <div
            className={cn(
                "flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center",
                className,
            )}
        >
            <Button
                type="button"
                variant={resolvedCopyVariant}
                size={resolvedCopySize}
                className="w-full gap-1.5 sm:w-auto"
                disabled={isCopying}
                onClick={() => void handleCopy()}
            >
                <AnimateIcon
                    key={copyState === "success" ? `copy-success-${animateKey}` : "copy-idle"}
                    animate={copyState === "success" ? "default" : false}
                    animateOnHover
                    className="inline-flex items-center gap-1.5"
                >
                    {copyState === "success" ? <AnimatedCheck size={18} animateOnHover /> : <AnimatedLink size={18} />}
                    <span className="text-xs font-medium sm:text-sm">
                        {copyState === "success" ? "복사 완료" : "링크 복사"}
                    </span>
                </AnimateIcon>
            </Button>
            <Button
                type="button"
                variant={variant}
                size={size}
                className="w-full gap-1.5 sm:w-auto"
                disabled={isSharing}
                onClick={() => (canNativeShare ? void handleShare() : void handleCopy())}
            >
                <AnimateIcon animateOnHover className="inline-flex items-center gap-1.5">
                    <AnimatedCopy size={18} />
                    <span className="text-xs font-medium sm:text-sm">
                        {canNativeShare ? "공유하기" : "링크 복사"}
                    </span>
                </AnimateIcon>
            </Button>
        </div>
    );
}

export default ShareButton;
