import { router } from "expo-router";
import { Banner, Button, Heading, Muted, Screen } from "../src/components/ui";
import { useSession } from "../src/lib/session";

export default function Rejected() {
  const { latestRequest, logOut } = useSession();
  return (
    <Screen title="Chill Hub" right={<Button title="Log out" variant="ghost" onPress={logOut} />}>
      <Heading>We couldn't approve your account</Heading>
      {latestRequest?.rejectReason ? <Banner tone="bad">Reason from admin: {latestRequest.rejectReason}</Banner> : null}
      <Muted>Fix the problem and send your request again.</Muted>
      <Button title="Fix and re-apply" onPress={() => router.push("/sign-up-details")} />
    </Screen>
  );
}
