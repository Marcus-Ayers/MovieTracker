import type { Tier } from "@/db/schema";

/** Classic tier-list colors, top to bottom. Tiers added later cycle through them. */
export const TIER_COLORS = ["#ff7f7f", "#ffbf7f", "#ffdf7f", "#ffff7f", "#bfff7f", "#7fbfff", "#bf7fff", "#ff7fdf"];

export const DEFAULT_TIERS: Tier[] = ["S", "A", "B", "C", "D", "F"].map((label, i) => ({ id: label.toLowerCase(), label, color: TIER_COLORS[i] }));
