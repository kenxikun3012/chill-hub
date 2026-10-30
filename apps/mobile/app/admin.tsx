import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, useWindowDimensions, View } from "react-native";
import { Banner, Button, Chip, Field, Heading, Muted, Screen } from "../src/components/ui";
import { api, errorMessage } from "../src/lib/api";
import type { ApprovalRequest } from "../src/lib/session";

interface QueueItem extends ApprovalRequest {
  reviewedAt: string | null;
  reviewedBy: { id: string; name: string } | null;
  user: {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    studentIdNumber: string | null;
    inGameAccounts: { inGameName: string; game: { id: string; name: string } }[];
  };
}

type Status = ApprovalRequest["status"];

const TABS: { status: Status; label: string }[] = [
  { status: "pending", label: "Pending" },
  { status: "approved", label: "Approved" },
  { status: "rejected", label: "Rejected" },
];

const READY_REASONS = ["Student ID number is wrong", "Not a student of our college", "Details don't match"];
const SPLIT_WIDTH = 800;

const when = (date: string) => new Date(date).toLocaleString();

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View className="gap-0.5">
      <Muted>{label}</Muted>
      <Text selectable className="text-base text-ink">
        {value}
      </Text>
    </View>
  );
}

function RequestPanel({ request, onDecided }: { request: QueueItem; onDecided: (error?: string) => void }) {
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string>();
  const [busy, setBusy] = useState<"approve" | "reject">();
  const games = request.user.inGameAccounts.map((a) => `${a.game.name}: ${a.inGameName}`).join("\n");

  async function decide(decision: "approve" | "reject") {
    if (decision === "reject" && reason.trim().length < 3) {
      setReasonError("Give a reason. The student will see it.");
      return;
    }
    setReasonError(undefined);
    setBusy(decision);
    try {
      await api(`/approval-requests/${request.id}`, {
        method: "PATCH",
        body: decision === "approve" ? { decision } : { decision, rejectReason: reason.trim() },
      });
      onDecided();
    } catch (err) {
      setBusy(undefined);
      // Usually another admin got there first, so the list needs reloading either way.
      onDecided(errorMessage(err));
    }
  }

  return (
    <View className="gap-4 rounded-[10px] border border-line bg-white p-4">
      <Text className="text-lg font-semibold text-ink">{request.user.name}</Text>
      {request.user.emailVerified ? <Banner tone="ok">Email verified</Banner> : <Banner tone="bad">Email not verified</Banner>}
      <Detail label="Student ID number" value={request.user.studentIdNumber ?? "Not given"} />
      <Detail label="Email" value={request.user.email} />
      <Detail label="Submitted" value={when(request.createdAt)} />
      <Detail label="In-game IDs" value={games || "None"} />

      {request.status === "pending" ? (
        <>
          <View className="gap-2">
            <Text className="text-sm font-medium text-ink">Rejection reason (shown to the student)</Text>
            <View className="flex-row flex-wrap gap-2">
              {READY_REASONS.map((r) => (
                <Chip key={r} label={r} selected={reason === r} onPress={() => setReason(r)} />
              ))}
            </View>
            <Field label="Reason" value={reason} onChangeText={setReason} error={reasonError} maxLength={500} />
          </View>
          <View className="flex-row justify-end gap-2">
            <Button title="Reject" variant="secondary" onPress={() => decide("reject")} busy={busy === "reject"} disabled={!!busy} />
            <Button title="Approve" onPress={() => decide("approve")} busy={busy === "approve"} disabled={!!busy} />
          </View>
        </>
      ) : (
        <>
          {request.rejectReason ? <Banner tone="bad">Reason: {request.rejectReason}</Banner> : null}
          <Muted>
            {request.status === "approved" ? "Approved" : "Rejected"}
            {request.reviewedBy ? ` by ${request.reviewedBy.name}` : ""}
            {request.reviewedAt ? ` on ${when(request.reviewedAt)}` : ""}
          </Muted>
        </>
      )}
    </View>
  );
}

/** Sign-up approvals (ACC-04, ADM-02). Queue on one side, the selected request on the other. */
export default function AdminApprovals() {
  const { width } = useWindowDimensions();
  const split = width >= SPLIT_WIDTH;
  const [status, setStatus] = useState<Status>("pending");
  const [items, setItems] = useState<QueueItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  const load = useCallback(async (tab: Status, cursor?: string) => {
    setLoading(true);
    try {
      const page = await api<{ items: QueueItem[]; nextCursor: string | null }>(
        `/approval-requests?status=${tab}${cursor ? `&cursor=${cursor}` : ""}`,
      );
      setItems((current) => (cursor ? [...current, ...page.items] : page.items));
      setNextCursor(page.nextCursor);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setSelectedId(undefined);
    void load(status);
  }, [load, status]);

  const selected = items.find((r) => r.id === selectedId);

  function afterDecision(name: string, decisionError?: string) {
    setSelectedId(undefined);
    setError(decisionError);
    setNotice(decisionError ? undefined : `Decision saved for ${name}. They'll get an email.`);
    void load(status);
  }

  const panel = selected ? (
    <RequestPanel key={selected.id} request={selected} onDecided={(e) => afterDecision(selected.user.name, e)} />
  ) : split ? (
    <Muted>Choose a request to review it.</Muted>
  ) : null;

  return (
    <Screen title="Admin" back wide>
      <Heading>Sign-up approvals</Heading>
      <View className="flex-row flex-wrap gap-2">
        {TABS.map((tab) => (
          <Chip key={tab.status} label={tab.label} selected={status === tab.status} onPress={() => setStatus(tab.status)} />
        ))}
      </View>
      {error ? <Banner tone="bad">{error}</Banner> : null}
      {notice ? <Banner tone="ok">{notice}</Banner> : null}

      <View className={split ? "flex-row items-start gap-4" : "gap-4"}>
        <View className={split ? "w-[360px] gap-2" : "gap-2"}>
          {items.map((r) => (
            <View key={r.id} className="gap-2">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Review ${r.user.name}`}
                accessibilityState={{ selected: r.id === selectedId }}
                onPress={() => setSelectedId(r.id)}
                className={`gap-0.5 rounded-[10px] border p-3 ${r.id === selectedId ? "border-accent bg-accent-soft" : "border-line bg-white"}`}
              >
                <Text className="font-semibold text-ink">{r.user.name}</Text>
                <Muted>
                  {r.user.email} · {when(r.createdAt)}
                </Muted>
              </Pressable>
              {!split && r.id === selectedId ? panel : null}
            </View>
          ))}
          {!loading && !items.length ? <Muted>Nothing here.</Muted> : null}
          {status === "pending" && items.length ? <Muted>Oldest first, so nobody waits too long.</Muted> : null}
          {nextCursor ? <Button title="Load more" variant="secondary" busy={loading} onPress={() => load(status, nextCursor)} /> : null}
        </View>
        {split ? <View className="flex-1">{panel}</View> : null}
      </View>
      <Button title="Back to home" variant="ghost" onPress={() => router.replace("/home")} />
    </Screen>
  );
}
