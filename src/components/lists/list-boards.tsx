"use client";

import {
  closestCenter,
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type CollisionDetection,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import type { Tier } from "@/db/schema";
import { addTitleToList, removeTitleFromList, saveListLayout, updateList } from "@/lib/list-actions";
import type { ListItemView } from "@/lib/lists";
import { cn, titleHref, tmdbImage } from "@/lib/format";
import { TIER_COLORS } from "@/lib/tiers";
import { TitleSearch, type SearchItem } from "./title-search";

const key = (item: ListItemView) => String(item.titleId);

// ---------------------------------------------------------------------------
// Pieces shared by both boards
// ---------------------------------------------------------------------------

/** A poster. On someone else's list (or a featured one) it links to the title. */
function Tile({
  item,
  label,
  onRemove,
  link,
  className,
}: {
  item: ListItemView;
  label?: ReactNode;
  onRemove?: () => void;
  link?: boolean;
  className?: string;
}) {
  const poster = tmdbImage(item.posterPath, "w185");
  const art = (
    <span className="relative block aspect-[2/3] overflow-hidden rounded-md bg-surface-2 shadow-md shadow-black/40">
      {poster ? (
        <Image src={poster} alt={item.title} fill sizes="(min-width: 640px) 120px, 25vw" className="object-cover" draggable={false} />
      ) : (
        <span className="grid h-full place-items-center p-1 text-center text-[10px] leading-tight text-muted">{item.title}</span>
      )}
      {label !== undefined && (
        <span className="absolute left-1 top-1 rounded bg-black/80 px-1.5 py-0.5 text-xs font-black tabular-nums text-fg">{label}</span>
      )}
    </span>
  );
  return (
    <div className={cn("group/tile relative", className)} title={`${item.title}${item.year ? ` (${item.year})` : ""}`}>
      {link ? <Link href={titleHref(item.mediaType, item.tmdbId)}>{art}</Link> : art}
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove ${item.title}`}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onClick={onRemove}
          className="absolute -right-1.5 -top-1.5 z-10 hidden size-6 place-items-center rounded-full bg-black/90 text-muted shadow ring-1 ring-line hover:text-fg focus-visible:grid group-hover/tile:grid"
        >
          <X className="size-3.5" />
        </button>
      )}
      {item.caption && <p className="mt-1 truncate text-center text-[11px] text-dim">{item.caption}</p>}
    </div>
  );
}

function SortableTile(props: Parameters<typeof Tile>[0]) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: key(props.item) });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("cursor-grab touch-manipulation active:cursor-grabbing", isDragging && "opacity-30")}
      {...attributes}
      {...listeners}
    >
      <Tile {...props} />
    </div>
  );
}

function useBoardSensors() {
  return useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Touch: press and hold briefly, so swiping still scrolls the page.
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
}

type SaveState = "idle" | "saving" | "saved" | "error";

/** Runs a save and reports how it went, for the little status note. */
function useSaver() {
  const [state, setState] = useState<SaveState>("idle");
  const save = (work: Promise<{ ok: boolean; error?: string }>) => {
    setState("saving");
    work.then((r) => setState(r.ok ? "saved" : "error")).catch(() => setState("error"));
  };
  return { state, save };
}

function SaveNote({ state }: { state: SaveState }) {
  if (state === "idle") return null;
  return (
    <span className={cn("text-xs", state === "error" ? "text-accent" : "text-dim")}>
      {state === "saving" ? "Saving…" : state === "saved" ? "Saved" : "Couldn't save. Check your connection."}
    </span>
  );
}

function AddBar({ listId, onAdded, saveState }: { listId: number; onAdded: (item: ListItemView) => void; saveState: SaveState }) {
  const [error, setError] = useState<string | null>(null);
  const add = (pick: SearchItem) => {
    setError(null);
    addTitleToList(listId, pick.id, pick.mediaType)
      .then((r) => (r.ok && r.item ? onAdded(r.item) : setError(r.error ?? "Couldn't add that.")))
      .catch(() => setError("Couldn't add that."));
  };
  return (
    <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2">
      <TitleSearch onPick={add} />
      {error ? <span className="text-sm text-accent">{error}</span> : <SaveNote state={saveState} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Regular lists
// ---------------------------------------------------------------------------

/** A poster grid. Yours: drag to reorder, × to remove, search to add. */
export function ListBoard({ listId, initialItems, ranked, editable }: { listId: number; initialItems: ListItemView[]; ranked: boolean; editable: boolean }) {
  const [items, setItems] = useState(initialItems);
  const [active, setActive] = useState<ListItemView | null>(null);
  const { state, save } = useSaver();
  const sensors = useBoardSensors();
  const dndId = useId();
  const grid = "grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8";

  const persist = (next: ListItemView[]) => save(saveListLayout(listId, next.map((i) => ({ titleId: i.titleId, tier: null }))));
  const remove = (item: ListItemView) => {
    setItems((prev) => prev.filter((i) => i.titleId !== item.titleId));
    save(removeTitleFromList(listId, item.titleId));
  };

  if (!editable) {
    return items.length ? (
      <div className={grid}>
        {items.map((item, i) => (
          <Tile key={key(item)} item={item} label={ranked ? i + 1 : undefined} link />
        ))}
      </div>
    ) : (
      <p className="text-muted">Nothing on this list yet.</p>
    );
  }

  return (
    <div>
      <AddBar listId={listId} onAdded={(item) => setItems((prev) => [...prev, item])} saveState={state} />
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-10 text-center text-muted">Search above to add the first title.</p>
      ) : (
        <DndContext
          id={dndId}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={({ active: a }: DragStartEvent) => setActive(items.find((i) => key(i) === a.id) ?? null)}
          onDragCancel={() => setActive(null)}
          onDragEnd={({ active: a, over }: DragEndEvent) => {
            setActive(null);
            if (!over || a.id === over.id) return;
            const next = arrayMove(
              items,
              items.findIndex((i) => key(i) === a.id),
              items.findIndex((i) => key(i) === over.id),
            );
            setItems(next);
            persist(next);
          }}
        >
          <SortableContext items={items.map(key)} strategy={rectSortingStrategy}>
            <div className={grid}>
              {items.map((item, i) => (
                <SortableTile key={key(item)} item={item} label={ranked ? i + 1 : undefined} onRemove={() => remove(item)} />
              ))}
            </div>
          </SortableContext>
          <DragOverlay>{active ? <Tile item={active} className="w-28 rotate-2 scale-105" /> : null}</DragOverlay>
        </DndContext>
      )}
      <p className="mt-6 text-xs text-dim">Drag posters to reorder. On a phone, press and hold first.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tier lists
// ---------------------------------------------------------------------------

const POOL = "pool";

// Whatever row (or poster) is under the pointer; keyboard dragging has no pointer, so fall back to the nearest.
const underPointer: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length ? hits : closestCorners(args);
};
type Columns = Record<string, ListItemView[]>;

function toColumns(tiers: Tier[], items: ListItemView[]): Columns {
  const columns: Columns = { [POOL]: [] };
  for (const t of tiers) columns[t.id] = [];
  for (const item of items) (item.tier && columns[item.tier] ? columns[item.tier] : columns[POOL]).push(item);
  return columns;
}

const laneClass = "flex flex-1 flex-wrap content-start gap-1.5 p-1.5 transition-colors";

/** A tier row's poster area (or the tray) that posters can be dropped into, even when it's empty. */
function DropLane({ id, ids, children, className }: { id: string; ids: string[]; children: ReactNode; className?: string }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <SortableContext items={ids} strategy={rectSortingStrategy}>
      <div ref={setNodeRef} className={cn(laneClass, isOver && "bg-fg/5", className)}>
        {children}
      </div>
    </SortableContext>
  );
}

function PlainLane({ children, className }: { id: string; ids: string[]; children: ReactNode; className?: string }) {
  return <div className={cn(laneClass, className)}>{children}</div>;
}

function TierLabel({ tier, editable, onRename, onDelete }: { tier: Tier; editable: boolean; onRename: (label: string) => void; onDelete?: () => void }) {
  const [editing, setEditing] = useState(false);
  return (
    <div
      className="group/label relative grid w-16 shrink-0 place-items-center p-1 text-center text-black sm:w-24"
      style={{ backgroundColor: tier.color }}
    >
      {editing ? (
        <input
          autoFocus
          defaultValue={tier.label}
          maxLength={20}
          aria-label="Tier name"
          onBlur={(e) => {
            setEditing(false);
            if (e.target.value.trim() && e.target.value.trim() !== tier.label) onRename(e.target.value.trim());
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") setEditing(false);
          }}
          className="w-full rounded bg-white/70 px-1 text-center text-sm font-bold outline-none"
        />
      ) : editable ? (
        <button type="button" onClick={() => setEditing(true)} title="Rename tier" className="break-words text-lg font-black leading-tight sm:text-2xl">
          {tier.label}
        </button>
      ) : (
        <span className="break-words text-lg font-black leading-tight sm:text-2xl">{tier.label}</span>
      )}
      {editable && onDelete && !editing && (
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete tier ${tier.label}`}
          className="absolute right-0.5 top-0.5 hidden size-5 place-items-center rounded-full bg-black/60 text-white group-hover/label:grid"
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  );
}

/**
 * Drag posters between tiers and the "not ranked yet" tray. Yours: tiers can be renamed, added and removed,
 * and every change saves as you go. Read-only for everyone else and for the featured tier lists.
 */
export function TierBoard({
  listId,
  initialTiers,
  initialItems,
  editable,
}: {
  listId?: number;
  initialTiers: Tier[];
  initialItems: ListItemView[];
  editable: boolean;
}) {
  const [tiers, setTiers] = useState(initialTiers);
  const [columns, setColumns] = useState(() => toColumns(initialTiers, initialItems));
  const [active, setActive] = useState<ListItemView | null>(null);
  const { state, save } = useSaver();
  const sensors = useBoardSensors();
  const dndId = useId();
  const tile = "w-14 sm:w-[72px]";

  const containerOf = (id: UniqueIdentifier) =>
    id in columns ? String(id) : Object.keys(columns).find((c) => columns[c].some((i) => key(i) === id));
  const layout = (cols: Columns, ts: Tier[]) => [
    ...ts.flatMap((t) => cols[t.id].map((i) => ({ titleId: i.titleId, tier: t.id }))),
    ...cols[POOL].map((i) => ({ titleId: i.titleId, tier: null })),
  ];
  const persistTiers = (nextTiers: Tier[], nextColumns: Columns) => {
    setTiers(nextTiers);
    setColumns(nextColumns);
    if (!listId) return;
    save(updateList(listId, { tiers: nextTiers }).then((r) => (r.ok ? saveListLayout(listId, layout(nextColumns, nextTiers)) : r)));
  };

  const onDragOver = ({ active: a, over }: DragOverEvent) => {
    if (!over) return;
    const from = containerOf(a.id);
    const to = containerOf(over.id);
    if (!from || !to || from === to) return;
    setColumns((cols) => {
      const item = cols[from].find((i) => key(i) === a.id);
      if (!item) return cols;
      const target = cols[to].filter((i) => key(i) !== a.id);
      const at = over.id in cols ? target.length : Math.max(0, target.findIndex((i) => key(i) === over.id));
      return { ...cols, [from]: cols[from].filter((i) => key(i) !== a.id), [to]: [...target.slice(0, at), item, ...target.slice(at)] };
    });
  };

  const onDragEnd = ({ active: a, over }: DragEndEvent) => {
    setActive(null);
    if (!over) return;
    const container = containerOf(a.id);
    if (!container) return;
    let next = columns;
    if (containerOf(over.id) === container && !(over.id in columns) && a.id !== over.id) {
      const list = columns[container];
      next = { ...columns, [container]: arrayMove(list, list.findIndex((i) => key(i) === a.id), list.findIndex((i) => key(i) === over.id)) };
      setColumns(next);
    }
    if (listId) save(saveListLayout(listId, layout(next, tiers)));
  };

  const remove = (item: ListItemView) => {
    if (!listId) return;
    setColumns((cols) => Object.fromEntries(Object.entries(cols).map(([c, list]) => [c, list.filter((i) => i.titleId !== item.titleId)])));
    save(removeTitleFromList(listId, item.titleId));
  };

  const tileProps = (item: ListItemView) => ({ item, className: tile, onRemove: editable ? () => remove(item) : undefined, link: !editable });
  const Item = editable ? SortableTile : Tile;
  const Lane = editable ? DropLane : PlainLane;

  const board = (
    <>
      <div className="overflow-hidden rounded-xl border border-line">
        {tiers.map((t) => (
          <div key={t.id} className="flex min-h-24 border-b border-line bg-surface last:border-0 sm:min-h-28">
            <TierLabel
              tier={t}
              editable={editable}
              onRename={(label) => persistTiers(tiers.map((x) => (x.id === t.id ? { ...x, label } : x)), columns)}
              onDelete={
                tiers.length > 1
                  ? () =>
                      persistTiers(
                        tiers.filter((x) => x.id !== t.id),
                        Object.fromEntries(
                          Object.entries(columns)
                            .filter(([c]) => c !== t.id)
                            .map(([c, list]) => [c, c === POOL ? [...list, ...columns[t.id]] : list]),
                        ),
                      )
                  : undefined
              }
            />
            <Lane id={t.id} ids={columns[t.id].map(key)}>
              {columns[t.id].map((item) => (
                <Item key={key(item)} {...tileProps(item)} />
              ))}
            </Lane>
          </div>
        ))}
      </div>
      {(editable || columns[POOL].length > 0) && (
        <div className="mt-4 rounded-xl border border-dashed border-line">
          <p className="px-3 pt-2.5 text-xs font-semibold uppercase tracking-wider text-muted">
            {editable ? "Not ranked yet · drag these into a tier" : "Not rated yet"}
          </p>
          <Lane id={POOL} ids={columns[POOL].map(key)} className="min-h-24">
            {columns[POOL].map((item) => (
              <Item key={key(item)} {...tileProps(item)} />
            ))}
          </Lane>
        </div>
      )}
    </>
  );

  return (
    <div>
      {editable && listId && (
        <AddBar listId={listId} onAdded={(item) => setColumns((cols) => ({ ...cols, [POOL]: [...cols[POOL], item] }))} saveState={state} />
      )}
      {editable ? (
        <DndContext
          id={dndId}
          sensors={sensors}
          collisionDetection={underPointer}
          onDragStart={({ active: a }) => setActive(Object.values(columns).flat().find((i) => key(i) === a.id) ?? null)}
          onDragCancel={() => setActive(null)}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
        >
          {board}
          <DragOverlay>{active ? <Tile item={active} className="w-16 rotate-3 scale-110 sm:w-20" /> : null}</DragOverlay>
        </DndContext>
      ) : (
        board
      )}
      {editable && (
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <button
            type="button"
            disabled={tiers.length >= 12}
            onClick={() => {
              const id = `t${Date.now().toString(36)}`;
              persistTiers([...tiers, { id, label: "New", color: TIER_COLORS[tiers.length % TIER_COLORS.length] }], { ...columns, [id]: [] });
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm hover:border-fg/40 disabled:opacity-40"
          >
            <Plus className="size-4" /> Add a tier
          </button>
          <span className="text-xs text-dim">Click a tier&apos;s name to rename it. On a phone, press and hold a poster to drag it.</span>
        </div>
      )}
    </div>
  );
}
