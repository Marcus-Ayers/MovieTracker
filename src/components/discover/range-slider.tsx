"use client";

import { useEffect, useRef, useState } from "react";

/** Calls `fn` once the value has stopped changing for `ms`. */
function useDebouncedCommit<T>(value: T, committed: T, fn: (v: T) => void, ms = 450) {
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });
  useEffect(() => {
    if (JSON.stringify(value) === JSON.stringify(committed)) return;
    const t = setTimeout(() => fnRef.current(value), ms);
    return () => clearTimeout(t);
  }, [value, committed, ms]);
}

/** Two-handle slider (e.g. score 6–10). Applies after you stop dragging. */
export function DualRange({
  min,
  max,
  step,
  value,
  onCommit,
  format = String,
}: {
  min: number;
  max: number;
  step: number;
  value: [number, number];
  onCommit: (v: [number, number]) => void;
  format?: (n: number) => string;
}) {
  const [local, setLocal] = useState(value);
  const [synced, setSynced] = useState(value);
  // The URL changed from elsewhere (e.g. "Reset"): follow it.
  if (value[0] !== synced[0] || value[1] !== synced[1]) {
    setSynced(value);
    setLocal(value);
  }
  useDebouncedCommit(local, value, onCommit);

  const pct = (n: number) => ((n - min) / (max - min)) * 100;
  return (
    <div>
      <div className="dual-range relative h-6">
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-surface-3" />
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-accent"
          style={{ left: `${pct(local[0])}%`, right: `${100 - pct(local[1])}%` }}
        />
        <input
          type="range"
          aria-label="Minimum"
          min={min}
          max={max}
          step={step}
          value={local[0]}
          onChange={(e) => setLocal([Math.min(Number(e.target.value), local[1]), local[1]])}
        />
        <input
          type="range"
          aria-label="Maximum"
          min={min}
          max={max}
          step={step}
          value={local[1]}
          onChange={(e) => setLocal([local[0], Math.max(Number(e.target.value), local[0])])}
        />
      </div>
      <div className="mt-1 flex justify-between text-xs tabular-nums text-muted">
        <span>{format(local[0])}</span>
        <span>{format(local[1])}</span>
      </div>
    </div>
  );
}

/** One-handle slider over a fixed list of steps (e.g. minimum votes 0, 25, 50, 100…). */
export function StepSlider({
  steps,
  value,
  onCommit,
  format = (n) => n.toLocaleString(),
}: {
  steps: number[];
  value: number;
  onCommit: (v: number) => void;
  format?: (n: number) => string;
}) {
  const nearest = (v: number) => steps.reduce((best, s, i) => (Math.abs(s - v) < Math.abs(steps[best] - v) ? i : best), 0);
  const [index, setIndex] = useState(nearest(value));
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    setSynced(value);
    setIndex(nearest(value));
  }
  useDebouncedCommit(steps[index], value, onCommit);
  return (
    <div>
      <input
        type="range"
        aria-label="Minimum votes"
        min={0}
        max={steps.length - 1}
        step={1}
        value={index}
        onChange={(e) => setIndex(Number(e.target.value))}
        className="single-range w-full"
      />
      <p className="mt-1 text-xs tabular-nums text-muted">At least {format(steps[index])} votes</p>
    </div>
  );
}
