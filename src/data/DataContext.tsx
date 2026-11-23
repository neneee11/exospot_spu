import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createRepository } from "./repository";
import type { ExercisePlan, Profile, Repository } from "./types";

interface DataState {
  repo: Repository;
  profile: Profile | null;
  plan: ExercisePlan | null;
  loading: boolean;
  error: string | null;
  setProfile: (p: Profile) => void;
  setPlan: (p: ExercisePlan) => void;
}

const DataContext = createContext<DataState | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const repo = useMemo(createRepository, []);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [plan, setPlan] = useState<ExercisePlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await repo.init();
        const [p, pl] = await Promise.all([repo.getProfile(), repo.getPlan()]);
        setProfile(p);
        setPlan(pl);
      } catch (e) {
        setError(formatError(e));
      } finally {
        setLoading(false);
      }

      function formatError(error: unknown): string {
        if (error instanceof Error) return error.message;
        if (typeof error === "string") return error;
        if (error && typeof error === "object") {
          const value = error as { message?: unknown; code?: unknown; details?: unknown };
          const parts = [value.message, value.details, value.code].filter(
            (part): part is string => typeof part === "string" && part.length > 0,
          );
          if (parts.length) return [...new Set(parts)].join(": ");
        }
        return "ไม่ทราบข้อผิดพลาดของฐานข้อมูล";
      }
    })();
  }, [repo]);

  const value = useMemo(
    () => ({ repo, profile, plan, loading, error, setProfile, setPlan }),
    [repo, profile, plan, loading, error],
  );
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData ต้องอยู่ใน <DataProvider>");
  return ctx;
}

/** โหลด session ย้อนหลังตามจำนวนวัน */
export function useSessions(days: number) {
  const { repo } = useData();
  const [sessions, setSessions] = useState<Awaited<ReturnType<Repository["listSessions"]>>>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - (days - 1));
    try {
      setSessions(await repo.listSessions(since.toISOString()));
    } finally {
      setLoading(false);
    }
  }, [repo, days]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { sessions, loading, reload };
}
