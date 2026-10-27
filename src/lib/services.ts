// Streaming services, by TMDB watch-provider id (US). TMDB's own ordering puts store fronts and add-on
// channels ahead of the big services, so Settings leads with these instead.

export const FEATURED_SERVICES = [
  8, // Netflix
  9, // Amazon Prime Video
  1899, // HBO Max
  337, // Disney Plus
  15, // Hulu
  350, // Apple TV+
  386, // Peacock Premium
  2303, // Paramount Plus Premium
  2616, // Paramount Plus Essential
  283, // Crunchyroll
  43, // Starz
  34, // MGM Plus
  526, // AMC+
  99, // Shudder
  11, // MUBI
  151, // BritBox
  87, // Acorn TV
  1768, // ESPN Plus
  2528, // YouTube TV
  188, // YouTube Premium
  257, // fuboTV
  2383, // Philo
  73, // Tubi TV
  300, // Pluto TV
  191, // Kanopy
  212, // Hoopla
  538, // Plex
];

// Plans of the same service that TMDB lists separately. Paying for one means a title on any of them counts.
const FAMILIES = [
  [8, 1796, 175], // Netflix, Netflix Standard with Ads, Netflix Kids
  [9, 2100], // Amazon Prime Video, … with Ads
  [1899, 384], // HBO Max, older HBO Max id
  [386, 387], // Peacock Premium, Peacock Premium Plus
  [2303, 2616, 531], // Paramount Plus Premium / Essential / older id
];

/** One id per service, so "Netflix" and "Netflix Standard with Ads" count as the same thing. */
export function serviceKey(id: number) {
  return FAMILIES.find((family) => family.includes(id))?.[0] ?? id;
}

/** Your services plus their sibling plans, for matching against where a title streams. */
export function expandServices(ids: number[]): Set<number> {
  const out = new Set(ids);
  for (const family of FAMILIES) if (family.some((id) => out.has(id))) family.forEach((id) => out.add(id));
  return out;
}
