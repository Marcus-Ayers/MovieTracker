"use server";

import { and, eq, max, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb, listItems, lists, titles, type DB } from "@/db";
import { requireUser } from "./auth";
import { getCurated } from "./curated";
import type { MediaType } from "./format";
import { loadCuratedTitles, toItemView, type ListItemView } from "./lists";
import { DEFAULT_TIERS } from "./tiers";
import { ensureTitle } from "./title-cache";

export type ListActionResult = { ok: boolean; error?: string };

const MAX_ITEMS = 500;
const nameSchema = z.string().trim().min(1, "Give it a name.").max(100);
const descriptionSchema = z.string().trim().max(1000);
const idSchema = z.number().int().positive();
const mediaSchema = z.enum(["movie", "tv"]);
const tiersSchema = z
  .array(z.object({ id: z.string().regex(/^[a-z0-9-]{1,20}$/), label: z.string().trim().min(1).max(20), color: z.string().regex(/^#[0-9a-f]{6}$/i) }))
  .min(1)
  .max(12);

/** The list, if it's yours. */
async function ownList(db: DB, listId: number, userId: number) {
  const [list] = await db.select().from(lists).where(and(eq(lists.id, idSchema.parse(listId)), eq(lists.userId, userId)));
  if (!list) throw new Error("That list isn't yours.");
  return list;
}

const touch = (db: DB, listId: number) => db.update(lists).set({ updatedAt: new Date() }).where(eq(lists.id, listId));

export async function createList(input: { kind: "list" | "tier"; name: string; description?: string; ranked?: boolean }) {
  const user = await requireUser("/lists");
  const name = nameSchema.safeParse(input.name);
  if (!name.success) return { ok: false, error: name.error.issues[0].message } as const;
  const db = await getDb();
  const [row] = await db
    .insert(lists)
    .values({
      userId: user.id,
      kind: z.enum(["list", "tier"]).parse(input.kind),
      name: name.data,
      description: descriptionSchema.parse(input.description ?? "") || null,
      ranked: Boolean(input.ranked),
      tiers: input.kind === "tier" ? DEFAULT_TIERS : [],
    })
    .returning({ id: lists.id });
  revalidatePath("/lists");
  return { ok: true, id: row.id } as const;
}

/** "Make it mine": copies a featured list (or tier list, unranked) into your own lists, then opens it. */
export async function copyCuratedList(slug: string) {
  const user = await requireUser(`/lists/featured/${slug}`);
  const curated = getCurated(slug);
  if (!curated) throw new Error("That list doesn't exist.");
  const db = await getDb();
  const found = await loadCuratedTitles(curated);
  const [row] = await db
    .insert(lists)
    .values({
      userId: user.id,
      kind: curated.kind,
      name: curated.kind === "tier" ? curated.title.replace("ranked by the internet", "ranked by me") : curated.title,
      description: curated.kind === "tier" ? null : curated.description,
      ranked: curated.ordered,
      tiers: curated.kind === "tier" ? DEFAULT_TIERS : [],
      source: slug,
    })
    .returning({ id: lists.id });
  if (found.length) await db.insert(listItems).values(found.map((t, i) => ({ listId: row.id, titleId: t.id, position: i })));
  revalidatePath("/lists");
  redirect(`/lists/${row.id}`);
}

export async function updateList(listId: number, patch: { name?: string; description?: string; ranked?: boolean; tiers?: z.infer<typeof tiersSchema> }): Promise<ListActionResult> {
  const user = await requireUser("/lists");
  const db = await getDb();
  const list = await ownList(db, listId, user.id);
  const name = patch.name === undefined ? undefined : nameSchema.safeParse(patch.name);
  if (name && !name.success) return { ok: false, error: name.error.issues[0].message };
  const tiers = patch.tiers === undefined ? undefined : tiersSchema.parse(patch.tiers);
  await db
    .update(lists)
    .set({
      ...(name ? { name: name.data } : {}),
      ...(patch.description === undefined ? {} : { description: descriptionSchema.parse(patch.description) || null }),
      ...(patch.ranked === undefined ? {} : { ranked: patch.ranked }),
      ...(tiers ? { tiers } : {}),
      updatedAt: new Date(),
    })
    .where(eq(lists.id, list.id));
  // Titles in a tier that was just removed go back to "not placed yet".
  if (tiers) {
    const kept = new Set(tiers.map((t) => t.id));
    for (const old of list.tiers) {
      if (!kept.has(old.id)) await db.update(listItems).set({ tier: null }).where(and(eq(listItems.listId, list.id), eq(listItems.tier, old.id)));
    }
  }
  return { ok: true };
}

export async function deleteList(listId: number) {
  const user = await requireUser("/lists");
  const db = await getDb();
  const list = await ownList(db, listId, user.id);
  await db.delete(lists).where(eq(lists.id, list.id));
  revalidatePath("/lists");
  redirect("/lists");
}

export async function addTitleToList(listId: number, tmdbId: number, mediaType: MediaType): Promise<ListActionResult & { item?: ListItemView }> {
  const user = await requireUser("/lists");
  const db = await getDb();
  const list = await ownList(db, listId, user.id);
  const titleId = await ensureTitle(db, idSchema.parse(tmdbId), mediaSchema.parse(mediaType));
  const [{ last, n }] = await db
    .select({ last: max(listItems.position), n: sql<number>`count(*)::int` })
    .from(listItems)
    .where(eq(listItems.listId, list.id));
  if (n >= MAX_ITEMS) return { ok: false, error: `Lists hold up to ${MAX_ITEMS} titles.` };
  const [added] = await db
    .insert(listItems)
    .values({ listId: list.id, titleId, position: (last ?? -1) + 1 })
    .onConflictDoNothing()
    .returning({ titleId: listItems.titleId });
  if (!added) return { ok: false, error: "That's already on this list." };
  await touch(db, list.id);
  const [title] = await db.select().from(titles).where(eq(titles.id, titleId));
  return { ok: true, item: toItemView(title) };
}

export async function removeTitleFromList(listId: number, titleId: number): Promise<ListActionResult> {
  const user = await requireUser("/lists");
  const db = await getDb();
  const list = await ownList(db, listId, user.id);
  await db.delete(listItems).where(and(eq(listItems.listId, list.id), eq(listItems.titleId, idSchema.parse(titleId))));
  await touch(db, list.id);
  return { ok: true };
}

/** After a drag: the whole list in its new order (and, on tier lists, which tier each title is in). */
export async function saveListLayout(listId: number, layout: { titleId: number; tier: string | null }[]): Promise<ListActionResult> {
  const user = await requireUser("/lists");
  const db = await getDb();
  const list = await ownList(db, listId, user.id);
  const tierIds = new Set(list.tiers.map((t) => t.id));
  const rows = z
    .array(z.object({ titleId: idSchema, tier: z.string().nullable() }))
    .max(MAX_ITEMS)
    .parse(layout)
    .map((r) => ({ ...r, tier: list.kind === "tier" && r.tier && tierIds.has(r.tier) ? r.tier : null }));
  if (!rows.length) return { ok: true };
  // One statement for the whole list instead of an UPDATE per title.
  const values = sql.join(
    rows.map((r, i) => sql`(${r.titleId}::int, ${i}::int, ${r.tier}::text)`),
    sql`, `,
  );
  await db.execute(sql`
    update ${listItems} set position = v.position, tier = v.tier
    from (values ${values}) as v(title_id, position, tier)
    where ${listItems.listId} = ${list.id} and ${listItems.titleId} = v.title_id
  `);
  await touch(db, list.id);
  return { ok: true };
}

/** Title pages: tick or untick a title on one of your lists. */
export async function setTitleOnList(listId: number, tmdbId: number, mediaType: MediaType, on: boolean): Promise<ListActionResult> {
  if (on) {
    const result = await addTitleToList(listId, tmdbId, mediaType);
    return result.ok || result.error === "That's already on this list." ? { ok: true } : result;
  }
  const user = await requireUser("/lists");
  const db = await getDb();
  const list = await ownList(db, listId, user.id);
  const titleId = await ensureTitle(db, idSchema.parse(tmdbId), mediaSchema.parse(mediaType));
  await db.delete(listItems).where(and(eq(listItems.listId, list.id), eq(listItems.titleId, titleId)));
  await touch(db, list.id);
  return { ok: true };
}
