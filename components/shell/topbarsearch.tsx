"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/format";
import type { RoleKey } from "@/config/navigation";
import type { SearchResult } from "@/types/directory";

const MIN_CHARS = 2;
const DEBOUNCE_MS = 250;

type Status = "idle" | "loading" | "done" | "error";

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
}

export function TopbarSearch({
  role,
  placeholder,
}: {
  role: RoleKey;
  placeholder: string;
}) {
  const router = useRouter();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const iconButtonRef = useRef<HTMLButtonElement>(null);

  const [expanded, setExpanded] = useState(false); // small screens only
  const [query, setQuery] = useState("");
  // The last response. Whether it answers the current query is worked out below,
  // so loading never needs a setState inside the effect.
  const [fetched, setFetched] = useState<{
    key: string;
    results: SearchResult[];
    failed: boolean;
  } | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const trimmed = query.trim();
  const tooShort = trimmed.length < MIN_CHARS;
  const searchKey = `${role}:${trimmed}`;
  const results = fetched?.results ?? [];
  const status: Status = tooShort
    ? "idle"
    : fetched?.key !== searchKey
      ? "loading"
      : fetched.failed
        ? "error"
        : "done";
  const panelVisible = open && trimmed.length > 0;
  const showList =
    panelVisible &&
    !tooShort &&
    results.length > 0 &&
    (status === "done" || status === "loading");
  const optionId = (i: number) => `${listId}-option-${i}`;

  // Focus the field after it expands on small screens.
  useEffect(() => {
    if (expanded) inputRef.current?.focus();
  }, [expanded]);

  // Debounced fetch. Each keystroke cancels the previous request.
  useEffect(() => {
    if (trimmed.length < MIN_CHARS) return;

    const controller = new AbortController();

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?role=${encodeURIComponent(role)}&q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error(`Search failed with ${res.status}`);
        const data: unknown = await res.json();
        const list = (data as { results?: unknown }).results;
        if (!Array.isArray(list)) throw new Error("Unexpected response");
        setFetched({ key: searchKey, results: list as SearchResult[], failed: false });
        setActive(-1);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setFetched({ key: searchKey, results: [], failed: true });
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed, role, searchKey]);

  // "/" or Ctrl/Cmd+K focuses the search from anywhere.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isModK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      const isSlash =
        e.key === "/" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !isTypingTarget(e.target);
      if (!isModK && !isSlash) return;
      e.preventDefault();
      setExpanded(true);
      requestAnimationFrame(() => inputRef.current?.focus());
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Close the panel on outside click or when focus leaves the search.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onFocusIn = (e: FocusEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [open]);

  // Keep the highlighted option visible while arrowing through a long list.
  useEffect(() => {
    if (active >= 0) {
      document.getElementById(optionId(active))?.scrollIntoView({ block: "nearest" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const collapse = () => {
    setExpanded(false);
    setOpen(false);
    setQuery("");
    requestAnimationFrame(() => iconButtonRef.current?.focus());
  };

  const choose = (result: SearchResult) => {
    router.push(result.href);
    setOpen(false);
    setQuery("");
    setActive(-1);
    setExpanded(false);
    inputRef.current?.blur();
  };

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!showList) return;
      e.preventDefault();
      setOpen(true);
      const delta = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) =>
        i === -1
          ? delta === 1
            ? 0
            : results.length - 1
          : (i + delta + results.length) % results.length,
      );
      return;
    }

    if (e.key === "Enter") {
      const target = results[active] ?? results[0];
      if (status === "done" && !tooShort && target) {
        e.preventDefault();
        choose(target);
      }
      return;
    }

    if (e.key === "Escape") {
      if (panelVisible) setOpen(false);
      else if (expanded) collapse();
    }
  };

  const announcement =
    tooShort || !panelVisible
      ? ""
      : status === "loading"
        ? "Searching"
        : status === "error"
          ? "Search failed"
          : status === "done"
            ? results.length === 0
              ? "No results"
              : `${results.length} result${results.length === 1 ? "" : "s"} available`
            : "";

  return (
    <div
      ref={rootRef}
      className="relative flex min-w-0 flex-1 items-center justify-end sm:justify-start"
    >
      <button
        ref={iconButtonRef}
        type="button"
        aria-label="Open search"
        onClick={() => setExpanded(true)}
        className={cn(
          "flex size-10 items-center justify-center rounded-lg text-muted hover:bg-canvas sm:hidden",
          expanded && "hidden",
        )}
      >
        <Search size={20} aria-hidden />
      </button>

      <div
        className={cn(
          "flex min-w-0 flex-1 items-center gap-3 text-muted",
          !expanded && "hidden sm:flex",
        )}
      >
        <Search size={18} aria-hidden className="shrink-0" />
        <input
          ref={inputRef}
          type="text"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          role="combobox"
          aria-label={placeholder.replace(/\.\.\.$/, "")}
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={showList ? listId : undefined}
          aria-activedescendant={showList && active >= 0 ? optionId(active) : undefined}
          placeholder={placeholder}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            const value = e.target.value;
            setQuery(value);
            setOpen(true);
            setActive(-1);
          }}
          onKeyDown={onInputKeyDown}
          className="w-full min-w-0 bg-transparent text-[15px] text-ink outline-none placeholder:text-muted"
        />

        {status === "loading" && !tooShort && (
          <Loader2 size={16} aria-hidden className="shrink-0 animate-spin" />
        )}

        {query ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setQuery("");
              setActive(-1);
              inputRef.current?.focus();
            }}
            className="flex size-7 shrink-0 items-center justify-center rounded-md hover:bg-canvas"
          >
            <X size={14} aria-hidden />
          </button>
        ) : (
          <kbd
            aria-hidden
            className="hidden shrink-0 rounded-md border border-line px-1.5 py-0.5 text-xs text-muted lg:inline"
          >
            /
          </kbd>
        )}
      </div>

      {expanded && (
        <button
          type="button"
          aria-label="Close search"
          onClick={collapse}
          className="flex size-10 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-canvas sm:hidden"
        >
          <X size={18} aria-hidden />
        </button>
      )}

      {panelVisible && (
        <div className="absolute left-0 top-full z-40 mt-2 w-full max-w-xl overflow-hidden rounded-xl border border-line bg-white shadow-lg">
          {showList ? (
            <ul
              id={listId}
              role="listbox"
              aria-label="Search results"
              className={cn(
                "max-h-80 overflow-y-auto py-1",
                status === "loading" && "opacity-60",
              )}
            >
              {results.map((r, i) => (
                <li
                  key={r.id}
                  id={optionId(i)}
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(r)}
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5",
                    i === active ? "bg-canvas" : "hover:bg-canvas",
                  )}
                >
                  <div className="min-w-0">
                    <div className="truncate text-[15px] font-medium text-ink">
                      {r.title}
                    </div>
                    <div className="truncate text-sm text-muted">{r.subtitle}</div>
                  </div>
                  <span className="shrink-0 rounded-md border border-line bg-white px-2 py-0.5 text-xs font-medium text-muted">
                    {r.kind}
                  </span>
                </li>
              ))}
            </ul>
          ) : tooShort ? (
            <p className="px-4 py-3 text-sm text-muted">
              Type at least {MIN_CHARS} characters to search.
            </p>
          ) : status === "error" ? (
            <p className="px-4 py-3 text-sm text-muted">
              Search failed. Check your connection and try again.
            </p>
          ) : status === "done" ? (
            <p className="px-4 py-3 text-sm text-muted">
              No results for &ldquo;{trimmed}&rdquo;.
            </p>
          ) : (
            <p className="px-4 py-3 text-sm text-muted">Searching&hellip;</p>
          )}
        </div>
      )}

      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </div>
  );
}