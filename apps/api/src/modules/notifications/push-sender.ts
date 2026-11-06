import { Logger } from "@nestjs/common";

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
}

/** Sends push notifications. Returns the tokens that no longer work, so they can be removed. */
export abstract class PushSender {
  abstract send(messages: PushMessage[]): Promise<string[]>;
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const BATCH_SIZE = 100; // Expo's limit per request

interface ExpoTicket {
  status: "ok" | "error";
  message?: string;
  details?: { error?: string };
}

/** Expo's push service, which forwards to Firebase and Apple. */
export class ExpoPushSender extends PushSender {
  private readonly logger = new Logger(ExpoPushSender.name);

  constructor(private readonly accessToken?: string) {
    super();
  }

  async send(messages: PushMessage[]) {
    const invalid: string[] = [];
    for (let i = 0; i < messages.length; i += BATCH_SIZE) {
      const batch = messages.slice(i, i + BATCH_SIZE);
      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
        },
        body: JSON.stringify(batch.map((m) => ({ ...m, sound: "default", channelId: "default" }))),
      });
      if (!response.ok) throw new Error(`Expo push: HTTP ${response.status}`);
      const { data } = (await response.json()) as { data: ExpoTicket[] };
      data.forEach((ticket, index) => {
        if (ticket.status === "ok") return;
        if (ticket.details?.error === "DeviceNotRegistered") invalid.push(batch[index]!.to);
        else this.logger.warn(`Expo push ticket: ${ticket.details?.error ?? ticket.message}`);
      });
    }
    return invalid;
  }
}
