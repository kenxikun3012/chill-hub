import type { UserStatus } from "@chill-hub/shared";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, ApiError, tokenStore } from "./api";

export interface Account {
  id: string;
  name: string;
  email: string;
  studentIdNumber: string | null;
  status: UserStatus;
  suspendedUntil: string | null;
  createdAt: string;
}

export interface ApprovalRequest {
  id: string;
  status: "pending" | "approved" | "rejected";
  rejectReason: string | null;
  createdAt: string;
}

/** Which part of the app the user may see (ACC-06). */
export type Stage = "loading" | "guest" | "details" | "pending" | "rejected" | "approved";

interface SessionValue {
  stage: Stage;
  account: Account | null;
  latestRequest: ApprovalRequest | null;
  /** Reloads the account, e.g. to see whether an admin has decided. */
  refresh: () => Promise<void>;
  /** Call with the token from a login or email verification. */
  startSession: (token: string) => Promise<void>;
  logOut: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

function stageOf(account: Account | null, latest: ApprovalRequest | null): Stage {
  if (!account) return "guest";
  if (account.status === "rejected") return "rejected";
  if (account.status === "pending") return latest?.status === "pending" ? "pending" : "details";
  return "approved";
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<Account | null>(null);
  const [latestRequest, setLatestRequest] = useState<ApprovalRequest | null>(null);

  const refresh = useCallback(async () => {
    try {
      const me = await api<Account>("/me");
      const requests =
        me.status === "pending" || me.status === "rejected" ? await api<ApprovalRequest[]>("/me/approval-requests") : [];
      setLatestRequest(requests[0] ?? null);
      setAccount(me);
    } catch (err) {
      if (!(err instanceof ApiError) || err.status !== 0) {
        // Logged out, banned or deleted: the stored session is no use any more.
        await tokenStore.clear();
        setAccount(null);
        setLatestRequest(null);
      }
      // Offline: keep showing what we have.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<SessionValue>(
    () => ({
      stage: loading ? "loading" : stageOf(account, latestRequest),
      account,
      latestRequest,
      refresh,
      startSession: async (token) => {
        await tokenStore.set(token);
        await refresh();
      },
      logOut: async () => {
        await api("/auth/sign-out", { method: "POST", body: {} }).catch(() => undefined);
        await tokenStore.clear();
        setAccount(null);
        setLatestRequest(null);
      },
    }),
    [account, latestRequest, loading, refresh],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider");
  return value;
}
