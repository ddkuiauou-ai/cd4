"use client";

import { Info } from "lucide-react";
import { type ReactNode, useCallback, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./detail-record-info.module.css";

type OpenMode = "preview" | "pinned";

let activeInfo: { owner: (mode: OpenMode | null) => void; mode: OpenMode; close: () => void } | undefined;

export function DetailRecordInfo({
  label,
  text,
  children,
}: {
  label: string;
  text: string;
  children?: ReactNode;
}) {
  const descriptionId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const noteRef = useRef<HTMLSpanElement>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [mode, setMode] = useState<OpenMode | null>(null);
  const hasValue = children != null;

  const cancelLeave = useCallback(() => {
    clearTimeout(leaveTimer.current);
  }, []);

  const close = useCallback(() => {
    cancelLeave();
    setMode(null);
    if (activeInfo?.owner === setMode) activeInfo = undefined;
  }, [cancelLeave]);

  function show(nextMode: OpenMode) {
    cancelLeave();
    if (activeInfo && activeInfo.owner !== setMode) activeInfo.close();
    activeInfo = { owner: setMode, mode: nextMode, close };
    setMode(nextMode);
  }

  function leave() {
    cancelLeave();
    if (mode === "preview") {
      leaveTimer.current = setTimeout(() => {
        if (!triggerRef.current?.matches(":focus-visible")) close();
      }, 140);
    }
  }

  useLayoutEffect(() => {
    const trigger = triggerRef.current;
    const note = noteRef.current;
    if (!mode || !trigger || !note) return;

    const viewport = window.visualViewport;

    const position = () => {
      const margin = 12;
      const gap = 6;
      const left = viewport?.offsetLeft ?? 0;
      const top = viewport?.offsetTop ?? 0;
      const width = viewport?.width ?? document.documentElement.clientWidth;
      const height = viewport?.height ?? document.documentElement.clientHeight;
      const anchor = trigger.getBoundingClientRect();
      note.style.maxWidth = `${Math.min(280, width - 2 * margin)}px`;
      note.style.maxHeight = `${height - 2 * margin}px`;
      const { width: noteWidth, height: noteHeight } = note.getBoundingClientRect();
      const preferredLeft = (anchor.left + anchor.right - noteWidth) / 2;
      const below = anchor.bottom + gap;
      const above = anchor.top - gap - noteHeight;
      const preferredTop = below + noteHeight <= top + height - margin ? below : above;
      note.style.left = `${Math.max(left + margin, Math.min(preferredLeft, left + width - noteWidth - margin))}px`;
      note.style.top = `${Math.max(top + margin, Math.min(preferredTop, top + height - noteHeight - margin))}px`;
    };

    function onPointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !trigger?.contains(event.target) && !note?.contains(event.target)) close();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }

    position();
    activeInfo = { owner: setMode, mode, close };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", position, { capture: true, passive: true });
    window.addEventListener("resize", position);
    viewport?.addEventListener("scroll", position);
    viewport?.addEventListener("resize", position);
    return () => {
      cancelLeave();
      if (activeInfo?.owner === setMode) activeInfo = undefined;
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", position, true);
      window.removeEventListener("resize", position);
      viewport?.removeEventListener("scroll", position);
      viewport?.removeEventListener("resize", position);
    };
  }, [cancelLeave, close, mode, text]);

  return (
    <>
      <button
        ref={triggerRef}
        className={hasValue ? `${styles.trigger} ${styles.withValue}` : styles.trigger}
        type="button"
        aria-label={label}
        aria-describedby={descriptionId}
        aria-expanded={mode !== null}
        onPointerEnter={(event) => {
          cancelLeave();
          if (event.pointerType !== "touch" && activeInfo?.mode !== "pinned" && mode === null) show("preview");
        }}
        onPointerLeave={leave}
        onFocus={(event) => {
          if (event.currentTarget.matches(":focus-visible") && mode === null) show("preview");
        }}
        onBlur={close}
        onClick={() => {
          if (mode === "pinned") close();
          else show("pinned");
        }}
      >
        {children}
        <Info aria-hidden="true" />
      </button>
      <span id={descriptionId} hidden>{text}</span>
      {mode !== null && createPortal(
        <span
          ref={noteRef}
          className={styles.note}
          aria-hidden="true"
          onPointerEnter={cancelLeave}
          onPointerLeave={leave}
        >
          {text}
        </span>,
        document.body,
      )}
    </>
  );
}
