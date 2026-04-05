"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface SearchResult {
  id: string;
  FIRST?: string;
  LAST?: string;
  BIRTHDATE?: string;
}

export function PatientSearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/patients/search?q=${encodeURIComponent(query.trim())}`
        );
        if (res.ok) {
          const data: SearchResult[] = await res.json();
          setResults(data);
          setOpen(data.length > 0);
        }
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(id: string) {
    setOpen(false);
    setQuery("");
    router.push(`/patientdetails/${id}`);
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-xl">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        type="search"
        placeholder="Search patients…"
        className="pl-8 h-8"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
      />

      {open && (
        <ul className="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md">
          {loading && (
            <li className="px-3 py-2 text-sm text-muted-foreground">
              Searching…
            </li>
          )}
          {!loading &&
            results.map((patient) => (
              <li
                key={patient.id}
                className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                onMouseDown={() => handleSelect(patient.id)}
              >
                <span className="font-medium">
                  {patient.FIRST} {patient.LAST}
                </span>
                <span className="text-xs text-muted-foreground">
                  {patient.BIRTHDATE}
                </span>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
