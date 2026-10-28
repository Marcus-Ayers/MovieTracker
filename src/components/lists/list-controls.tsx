"use client";

import { Check, ListPlus, Plus, Rows3, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { copyCuratedList, createList, deleteList, setTitleOnList, updateList } from "@/lib/list-actions";
import { cn, type MediaType } from "@/lib/format";
import { Modal } from "../ui/modal";

const input = "w-full rounded-md border border-line bg-bg px-3 outline-none transition focus:border-fg/50";

/** "New list" / "New tier list": asks for a name, creates it, and opens it. */
export function NewListButton({ kind, primary = false }: { kind: "list" | "tier"; primary?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (form: FormData) =>
    startTransition(async () => {
      setError(null);
      const result = await createList({
        kind,
        name: String(form.get("name") ?? ""),
        description: String(form.get("description") ?? ""),
        ranked: form.get("ranked") === "on",
      });
      if (!result.ok) return setError(result.error);
      setOpen(false);
      router.push(`/lists/${result.id}`);
    });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center gap-2 rounded px-4 py-2 text-sm font-semibold transition",
          primary ? "bg-accent text-white hover:bg-accent-hover" : "border border-line hover:border-fg/40",
        )}
      >
        {kind === "tier" ? <Rows3 className="size-4" /> : <Plus className="size-4" />}
        {kind === "tier" ? "New tier list" : "New list"}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} label={kind === "tier" ? "New tier list" : "New list"} size="sm">
        <form
          className="space-y-4 p-6"
          onSubmit={(e) => {
            e.preventDefault();
            submit(new FormData(e.currentTarget));
          }}
        >
          <h2 className="pr-8 text-xl font-bold">{kind === "tier" ? "New tier list" : "New list"}</h2>
          <label className="block">
            <span className="mb-1.5 block text-sm text-muted">Name</span>
            <input name="name" required maxLength={100} autoFocus placeholder={kind === "tier" ? "Horror movies, ranked" : "Best heist movies"} className={cn(input, "h-11")} />
          </label>
          {kind === "list" && (
            <>
              <label className="block">
                <span className="mb-1.5 block text-sm text-muted">Description (optional)</span>
                <textarea name="description" rows={3} maxLength={1000} className={cn(input, "py-2")} />
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" name="ranked" className="size-4 accent-accent" /> Ranked (number the titles)
              </label>
            </>
          )}
          {error && <p className="text-sm text-accent">{error}</p>}
          <button disabled={pending} className="h-11 w-full rounded-md bg-accent font-semibold text-white hover:bg-accent-hover disabled:opacity-60">
            {pending ? "Creating…" : "Create"}
          </button>
        </form>
      </Modal>
    </>
  );
}

/** Copies a featured list into your own lists. */
export function CopyListButton({ slug, label }: { slug: string; label: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => copyCuratedList(slug))}
      className="inline-flex items-center gap-2 rounded bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
    >
      <ListPlus className="size-4" /> {pending ? "Copying…" : label}
    </button>
  );
}

/** Your list's name, description and settings, edited in place. Saves when you click away. */
export function ListHeaderEditor({
  listId,
  kind,
  name,
  description,
  ranked,
}: {
  listId: number;
  kind: "list" | "tier";
  name: string;
  description: string | null;
  ranked: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const save = (patch: Parameters<typeof updateList>[1]) =>
    startTransition(async () => {
      const r = await updateList(listId, patch);
      setError(r.ok ? null : (r.error ?? "Couldn't save."));
      if (r.ok) router.refresh();
    });

  return (
    <div className="space-y-3">
      {/* A textarea so long names wrap on phones; Enter saves instead of adding a line. */}
      <textarea
        defaultValue={name}
        maxLength={100}
        rows={1}
        aria-label="List name"
        onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== name && save({ name: e.target.value.replace(/\s+/g, " ") })}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        className="-mx-2 w-full resize-none rounded-md bg-transparent px-2 py-1 text-3xl font-black leading-tight tracking-tight outline-none field-sizing-content hover:bg-surface focus:bg-surface sm:text-4xl"
      />
      <textarea
        defaultValue={description ?? ""}
        maxLength={1000}
        rows={2}
        placeholder="Add a description…"
        aria-label="Description"
        onBlur={(e) => e.target.value !== (description ?? "") && save({ description: e.target.value })}
        className="-mx-2 w-full max-w-3xl resize-none rounded-md bg-transparent px-2 py-1 text-muted outline-none placeholder:text-dim hover:bg-surface focus:bg-surface"
      />
      <div className="flex flex-wrap items-center gap-4 text-sm">
        {kind === "list" && (
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              defaultChecked={ranked}
              onChange={(e) => save({ ranked: e.target.checked })}
              className="size-4 accent-accent"
            />
            Ranked
          </label>
        )}
        {confirmDelete ? (
          <span className="inline-flex items-center gap-2">
            <button
              type="button"
              onClick={() => startTransition(() => deleteList(listId))}
              className="inline-flex items-center gap-1.5 rounded border border-accent/60 px-3 py-1 text-accent hover:bg-accent/10"
            >
              <Trash2 className="size-4" /> Delete for good
            </button>
            <button type="button" onClick={() => setConfirmDelete(false)} className="rounded border border-line px-3 py-1 hover:border-fg/40">
              Keep
            </button>
          </span>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-1.5 text-muted hover:text-accent">
            <Trash2 className="size-4" /> Delete {kind === "tier" ? "tier list" : "list"}
          </button>
        )}
        {pending && <span className="text-xs text-dim">Saving…</span>}
        {error && <span className="text-xs text-accent">{error}</span>}
      </div>
    </div>
  );
}

/** Title pages: a menu of your lists with a tick on the ones this title is on. */
export function AddToListMenu({
  tmdbId,
  mediaType,
  lists,
}: {
  tmdbId: number;
  mediaType: MediaType;
  lists: { id: number; name: string; kind: "list" | "tier"; has: boolean }[];
}) {
  const [open, setOpen] = useState(false);
  const [on, setOn] = useState(() => new Set(lists.filter((l) => l.has).map((l) => l.id)));
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const toggle = (id: number) => {
    const next = !on.has(id);
    setOn((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(id);
      else copy.delete(id);
      return copy;
    });
    setError(null);
    setTitleOnList(id, tmdbId, mediaType, next)
      .then((r) => !r.ok && setError(r.error ?? "Couldn't save."))
      .catch(() => setError("Couldn't save."));
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded bg-white/15 px-5 py-2.5 font-semibold backdrop-blur transition hover:bg-white/25"
      >
        <ListPlus className="size-5" /> Lists{on.size > 0 && <span className="text-sm font-normal text-muted">({on.size})</span>}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 w-72 overflow-hidden rounded-xl border border-line bg-surface-2 shadow-2xl shadow-black">
          {lists.length ? (
            <ul className="max-h-72 overflow-y-auto py-1">
              {lists.map((l) => (
                <li key={l.id}>
                  <button type="button" onClick={() => toggle(l.id)} className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-surface-3">
                    <span className={cn("grid size-5 shrink-0 place-items-center rounded border", on.has(l.id) ? "border-accent bg-accent text-white" : "border-line")}>
                      {on.has(l.id) && <Check className="size-3.5" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{l.name}</span>
                    {l.kind === "tier" && <Rows3 className="size-3.5 text-dim" aria-label="Tier list" />}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-3 text-sm text-muted">You don&apos;t have any lists yet.</p>
          )}
          {error && <p className="px-4 pb-2 text-xs text-accent">{error}</p>}
          <Link href="/lists" className="flex items-center gap-2 border-t border-line px-4 py-2.5 text-sm text-muted hover:bg-surface-3 hover:text-fg">
            <Plus className="size-4" /> New list
          </Link>
        </div>
      )}
    </div>
  );
}
