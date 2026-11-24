"use client";

import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { ChevronRight, Pause, Play } from "lucide-react";
import styles from "./dashboard-arena.module.css";

export const arenaScenes = ["today", "past", "overall", "closing"] as const;
export type ArenaScene = typeof arenaScenes[number];
const labels: Record<ArenaScene, string> = { today: "오늘의 장", past: "1년 전 1위", overall: "가치·배당 종합", closing: "장 마감" };
const easeOut = "cubic-bezier(.16,1,.3,1)";
const readingTime = 8000;
const motionQuery = "(prefers-reduced-motion: reduce)";

function subscribeToMotion(change: () => void) {
  const query = matchMedia(motionQuery);
  query.addEventListener("change", change);
  return () => query.removeEventListener("change", change);
}

function animate(element: HTMLElement, frames: Keyframe[], options: KeyframeAnimationOptions, signal: AbortSignal) {
  if (signal.aborted || !element.animate) return Promise.resolve();
  const animation = element.animate(frames, { ...options, fill: "both" });
  const interrupt = () => animation.cancel();
  signal.addEventListener("abort", interrupt, { once: true });
  return animation.finished.catch(() => undefined).finally(() => {
    signal.removeEventListener("abort", interrupt);
    animation.cancel();
  });
}

export function DashboardArenaPlayer({ children, captions, footnotes }: {
  children: Record<ArenaScene, ReactNode>; captions: Partial<Record<ArenaScene, string>>; footnotes: Record<ArenaScene, string>;
}) {
  const root = useRef<HTMLElement>(null);
  const menu = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const rotationControl = useRef<HTMLButtonElement>(null);
  const lastScroll = useRef(0);
  const current = useRef<ArenaScene>("today");
  const playback = useRef<{ controller: AbortController; automatic: boolean } | null>(null);
  const turns = useRef(new WeakMap<HTMLElement, AbortSignal>());
  const [scene, setScene] = useState<ArenaScene>("today");
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [announcement, announce] = useState("");
  const [picker, setPicker] = useState<"hover" | "click" | null>(null);
  const reducedMotion = useSyncExternalStore(subscribeToMotion, () => matchMedia(motionQuery).matches, () => false);

  useEffect(() => {
    let onScreen = typeof IntersectionObserver === "undefined";
    const updateVisibility = () => {
      setVisible(onScreen && !document.hidden);
      if (!onScreen || document.hidden) playback.current?.controller.abort();
    };
    const observer = onScreen ? null : new IntersectionObserver(([entry]) => {
      onScreen = entry.intersectionRatio >= 0.5;
      updateVisibility();
    }, { threshold: 0.5 });
    if (menu.current) observer?.observe(menu.current);
    document.addEventListener("visibilitychange", updateVisibility);
    updateVisibility();
    return () => {
      observer?.disconnect();
      playback.current?.controller.abort();
      playback.current = null;
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, []);

  useEffect(() => {
    if (reducedMotion) playback.current?.controller.abort();
  }, [reducedMotion]);

  useEffect(() => {
    if (!picker) return;
    const outside = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node)) setPicker(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      setPicker(null);
      if (menu.current?.contains(document.activeElement)) trigger.current?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [picker]);

  const advance = useEffectEvent(() => {
    if (picker || paused || hovered || focused || document.hidden) return;
    const next = (arenaScenes.indexOf(current.current) + 1) % arenaScenes.length;
    start(arenaScenes[next], true);
  });

  useEffect(() => {
    if (picker || !visible || paused || hovered || focused || transitioning || reducedMotion) return;
    let timer = window.setTimeout(nextAfterReading, readingTime);
    function nextAfterReading() {
      const remaining = readingTime - (performance.now() - lastScroll.current);
      if (remaining > 0) timer = window.setTimeout(nextAfterReading, remaining);
      else advance();
    }
    return () => window.clearTimeout(timer);
  }, [scene, picker, visible, paused, hovered, focused, transitioning, reducedMotion]);

  function show(next: ArenaScene) {
    current.current = next;
    flushSync(() => setScene(next));
    const panel = root.current?.querySelector<HTMLElement>(`[data-arena-scene="${next}"]`);
    if (panel) panel.scrollTop = 0;
  }

  async function showScene(next: ArenaScene, signal: AbortSignal) {
    const stage = root.current;
    if (!stage || signal.aborted || current.current === next) return;
    if (reducedMotion) { show(next); return; }
    const nodes = (selector: string) => [...stage.querySelectorAll<HTMLElement>(selector)];
    const panel = (key: ArenaScene) => stage.querySelector<HTMLElement>(`[data-arena-scene="${key}"]`)!;
    const wipe = next === "past" && current.current === "today";
    const curtain = stage.querySelector<HTMLElement>("[data-arena-wipe]")!;
    if (wipe) {
      await animate(curtain, [{ transform: "translateX(-110%)" }, { transform: "translateX(0)" }], { duration: 270, easing: "ease-in" }, signal);
    } else {
      await animate(panel(current.current), [{ opacity: 1 }, { opacity: 0 }], { duration: 150, easing: "ease-in" }, signal);
    }
    if (signal.aborted) return;
    show(next);
    const fade = (node: HTMLElement, delay: number) => animate(node, [{ opacity: 0 }, { opacity: 1 }], { duration: 160, delay, easing: easeOut }, signal);
    const reveal = (node: HTMLElement, delay: number, duration: number, from: string) => animate(node,
      [{ clipPath: from }, { clipPath: "inset(0% 0% 0% 0%)" }], { duration, delay, easing: easeOut }, signal);

    if (next === "today") {
      await Promise.all(nodes("[data-arena-rotor]").map(async (node, index) => {
        turns.current.set(node, signal);
        node.dataset.turning = "true";
        await animate(node, [{ transform: "rotateX(0deg)" }, { transform: "rotateX(-180deg)" }],
          { duration: 250, delay: index * 250, easing: "ease-in-out" }, signal);
        if (turns.current.get(node) === signal) { turns.current.delete(node); delete node.dataset.turning; }
      }));
    } else if (next === "past") {
      await Promise.all([
        ...(wipe ? [animate(curtain, [{ transform: "translateX(0)" }, { transform: "translateX(110%)" }], { duration: 400, easing: easeOut }, signal)] : []),
        ...nodes("[data-arena-past-row]").map((node, index) => reveal(node, (wipe ? 150 : 0) + index * 38, 200, "inset(0% 0% 100% 0%)")),
      ]);
    } else if (next === "overall") {
      const places = [...new Set(nodes("[data-arena-place]").map(node => node.dataset.arenaPlace))];
      await Promise.all([
        ...nodes("[data-arena-winner]").map(node => reveal(node, 0, 480, "inset(0% 100% 0% 0%)")),
        ...nodes("[data-arena-place]").map(node => fade(node, 170 + places.indexOf(node.dataset.arenaPlace) * 76)),
      ]);
    } else {
      await Promise.all(nodes("[data-arena-market-group]").flatMap((column, index) =>
        [...column.querySelectorAll<HTMLElement>("h3,li")].map((node, row) => reveal(node, index * 448 + Math.max(0, row - 1) * 34, 100, "inset(0% 0% 100% 0%)"))));
    }
  }

  function start(next: ArenaScene, automatic = false) {
    playback.current?.controller.abort();
    const controller = new AbortController();
    playback.current = { controller, automatic };
    setTransitioning(true);
    void showScene(next, controller.signal).finally(() => {
      if (playback.current?.controller !== controller) return;
      playback.current = null;
      setTransitioning(false);
      if (!automatic && !controller.signal.aborted) announce(labels[next]);
    });
  }

  function stopAutomaticTransition() {
    if (playback.current?.automatic) playback.current.controller.abort();
  }

  const rotationLabel = paused ? "장면 자동 순환 재개" : "장면 자동 순환 일시 정지";
  return <section ref={root} className={styles.arena} aria-label="대회장 전광판"
    onFocusCapture={event => {
      const reading = event.target !== rotationControl.current &&
        (event.target.matches(":focus-visible") || Boolean(event.target.closest("[data-arena-scene]")));
      setFocused(reading);
      if (reading) stopAutomaticTransition();
    }}
    onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
    <header className={styles.controls}>
      <nav ref={menu} className={styles.sceneMenu} aria-label="대회장 장면"
        onPointerEnter={event => {
          if (event.pointerType !== "mouse") return;
          stopAutomaticTransition();
          setPicker(mode => mode ?? "hover");
        }}
        onPointerLeave={event => {
          if (event.pointerType === "mouse" && !event.currentTarget.querySelector(":focus-visible")) setPicker(null);
        }}
        onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setPicker(null); }}>
        <h2 id="arena-scene-title"><button ref={trigger} className={styles.sceneTrigger} type="button" aria-expanded={picker !== null} aria-controls="arena-scene-options" onClick={() => {
          stopAutomaticTransition();
          setPicker(mode => mode === "click" ? null : "click");
        }}>{labels[scene]}<ChevronRight size={17} aria-hidden="true" /></button></h2>
        <ul id="arena-scene-options" className={styles.sceneOptions} hidden={picker === null}>
          {arenaScenes.filter(key => key !== scene).map(key => <li key={key}><button type="button" aria-controls={`arena-panel-${key}`} onClick={() => {
            trigger.current?.focus({ preventScroll: true });
            setPicker(null);
            start(key);
          }}>{labels[key]}</button></li>)}
        </ul>
      </nav>
      <p className={styles.sceneCaption}>{captions[scene]}</p>
      <button ref={rotationControl} className={styles.rotationControl} type="button" hidden={reducedMotion} title={rotationLabel} aria-label={rotationLabel} onClick={() => {
        setPaused(!paused);
        if (!paused) stopAutomaticTransition();
      }}>{paused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}</button>
    </header>
    <div className={styles.frame}
      onPointerEnter={event => {
        if (event.pointerType !== "mouse") return;
        setHovered(true);
        stopAutomaticTransition();
      }}
      onPointerLeave={() => setHovered(false)}>
      <div className={styles.stage}>
        {arenaScenes.map(key => <section key={key} id={`arena-panel-${key}`} hidden={key !== scene} tabIndex={0} className={styles.scene} data-arena-scene={key} aria-labelledby="arena-scene-title"
          onScrollCapture={() => { lastScroll.current = performance.now(); }}>{children[key]}</section>)}
        <div className={styles.wipe} data-arena-wipe aria-hidden="true" />
      </div>
      <div className={styles.arenaFoot}>{arenaScenes.map(key => <p key={key} aria-hidden={key !== scene}>{footnotes[key]}</p>)}</div>
    </div>
    <p role="status" className="sr-only">{announcement}</p>
  </section>;
}
