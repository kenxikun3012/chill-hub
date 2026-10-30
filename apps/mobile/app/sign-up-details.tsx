import { studentIdNumberSchema } from "@chill-hub/shared";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Banner, Button, Field, Muted, Screen, Steps } from "../src/components/ui";
import { api, errorMessage } from "../src/lib/api";
import { useSession } from "../src/lib/session";

interface Game {
  id: string;
  name: string;
  inGameIdLabel: string;
}

interface InGameAccount {
  inGameName: string;
  game: { id: string };
}

/** Sign-up step 3, and fixing details after a rejection (the saved details are filled in). */
export default function SignUpDetails() {
  const { account, stage, refresh, logOut } = useSession();
  const [studentId, setStudentId] = useState(account?.studentIdNumber ?? "");
  const [games, setGames] = useState<Game[]>([]);
  const [gameId, setGameId] = useState<string>();
  const [inGameName, setInGameName] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Game[]>("/games").then(setGames).catch((err) => setFormError(errorMessage(err)));
    api<InGameAccount[]>("/me/in-game-accounts")
      .then((accounts) => {
        const saved = accounts[0];
        if (saved) {
          setGameId(saved.game.id);
          setInGameName(saved.inGameName);
        }
      })
      .catch(() => undefined); // nothing to fill in
  }, []);

  const game = games.find((g) => g.id === gameId);

  async function submit() {
    const parsedId = studentIdNumberSchema.safeParse(studentId);
    const next: Record<string, string> = {};
    if (!parsedId.success) next.studentId = "Enter your student ID number";
    if (!gameId) next.game = "Choose a game";
    else if (!inGameName.trim()) next.inGameName = `Enter your ${game?.inGameIdLabel ?? "in-game ID"}`;
    setErrors(next);
    setFormError(undefined);
    if (Object.keys(next).length || !parsedId.success || !gameId) return;

    setBusy(true);
    try {
      await api("/me/sign-up-details", {
        method: "PUT",
        body: { studentIdNumber: parsedId.data, inGameAccount: { gameId, inGameName: inGameName.trim() } },
      });
      await refresh(); // moves on to the waiting screen
    } catch (err) {
      setFormError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Screen
      title={stage === "rejected" ? "Fix and re-apply" : "Create account"}
      back={stage === "rejected"}
      right={stage === "rejected" ? undefined : <Button title="Log out" variant="ghost" onPress={logOut} />}
    >
      {stage === "rejected" ? null : <Steps current={3} label="Student check and games" />}
      {formError ? <Banner tone="bad">{formError}</Banner> : null}
      <Field
        label="Student ID number"
        value={studentId}
        onChangeText={setStudentId}
        error={errors.studentId}
        autoCapitalize="characters"
        autoCorrect={false}
        hint="Only admins can see this."
      />
      <View className="gap-2">
        <Text className="text-sm font-medium text-ink">Your main game</Text>
        <View className="flex-row flex-wrap gap-2">
          {games.map((g) => (
            <Pressable
              key={g.id}
              accessibilityRole="radio"
              accessibilityLabel={g.name}
              accessibilityState={{ selected: g.id === gameId }}
              onPress={() => setGameId(g.id)}
              className={`min-h-[44px] justify-center rounded-full border px-4 ${g.id === gameId ? "border-accent bg-accent-soft" : "border-line bg-white"}`}
            >
              <Text className={g.id === gameId ? "font-semibold text-accent" : "text-ink"}>{g.name}</Text>
            </Pressable>
          ))}
        </View>
        {errors.game ? <Text className="text-sm text-bad">{errors.game}</Text> : <Muted>You can add more games, ranks and roles later in your profile.</Muted>}
      </View>
      {game ? (
        <Field
          label={game.inGameIdLabel}
          value={inGameName}
          onChangeText={setInGameName}
          error={errors.inGameName}
          autoCapitalize="none"
          autoCorrect={false}
        />
      ) : null}
      <Button title={stage === "rejected" ? "Send request again" : "Send for approval"} onPress={submit} busy={busy} />
    </Screen>
  );
}
