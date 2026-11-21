"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, Link } from "lucide-react";

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
    compactActions?: boolean;
}

export function ShareButton({
    title,
    text,
    url,
    variant = "outline",
    size = "sm",
    copyVariant,
    copySize,
    compactActions = false,
    className,
}: ShareButtonProps) {
    const { toast } = useToast();
    const [isSharing, setIsSharing] = useState(false);
    const [isCopying, setIsCopying] = useState(false);
    const [canNativeShare, setCanNativeShare] = useState(false);
    const [isPinned, setIsPinned] = useState(false);
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
                const copied = document.execCommand("copy");
                document.body.removeChild(textarea);
                if (!copied) throw new Error("브라우저가 링크 복사를 허용하지 않았습니다.");
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

    const resolvedCopyVariant = copyVariant ?? (compactActions || canNativeShare ? "ghost" : variant);
    const actionClass = compactActions ? "relative size-11 shrink-0" : "min-h-10 gap-1.5";
    const iconClass = compactActions
        ? "absolute inset-0 flex items-center justify-center motion-reduce:hidden"
        : "inline-flex items-center gap-1.5";
    const isCopied = copyState === "success";
    const copyLabel = isCopied ? "복사 완료" : "링크 복사";
    const shareLabel = compactActions && !canNativeShare ? "공유하기 (링크 복사)" : "공유하기";
    const StaticCopyIcon = isCopied ? Check : Link;

    return (
        <div data-share-actions data-pinned={isPinned} className={cn("flex items-center gap-2", className)}>
            <Button
                type="button"
                variant={resolvedCopyVariant}
                size={compactActions ? "icon" : copySize ?? size}
                className={actionClass}
                disabled={isCopying}
                onClick={() => void handleCopy()}
                aria-label={copyLabel}
                title={compactActions ? copyLabel : undefined}
            >
                <AnimateIcon
                    key={isCopied ? `copy-success-${animateKey}` : "copy-idle"}
                    animate={isCopied ? "default" : false}
                    animateOnHover
                    className={iconClass}
                >
                    {isCopied ? <AnimatedCheck size={18} aria-hidden="true" animateOnHover={compactActions ? undefined : true} /> : <AnimatedLink size={18} aria-hidden="true" />}
                    {!compactActions && <span data-share-label className="text-xs font-medium">{copyLabel}</span>}
                </AnimateIcon>
                {compactActions && <StaticCopyIcon size={18} aria-hidden="true" className="hidden motion-reduce:block" />}
            </Button>
            {(compactActions || canNativeShare) && <Button
                type="button"
                variant={variant}
                size={compactActions ? "icon" : size}
                className={actionClass}
                disabled={isSharing || (!canNativeShare && isCopying)}
                onClick={() => void handleShare()}
                aria-label={shareLabel}
                title={compactActions ? shareLabel : undefined}
            >
                <AnimateIcon animateOnHover className={iconClass}>
                    <AnimatedCopy size={18} aria-hidden="true" />
                    {!compactActions && <span data-share-label className="text-xs font-medium">공유하기</span>}
                </AnimateIcon>
                {compactActions && <Copy size={18} aria-hidden="true" className="hidden motion-reduce:block" />}
            </Button>}
        </div>
    );
}

export default ShareButton;
