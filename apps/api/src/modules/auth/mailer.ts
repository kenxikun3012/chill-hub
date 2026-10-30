import { Logger } from "@nestjs/common";
import { Resend } from "resend";

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

/** Sends transactional email. Implementations are chosen in CoreModule. */
export abstract class Mailer {
  abstract send(mail: Mail): Promise<void>;
}

/** Development: prints the email, including any code, to the API console. Refused in production by env.ts. */
export class ConsoleMailer extends Mailer {
  private readonly logger = new Logger("Mail");

  async send(mail: Mail) {
    this.logger.log(`To ${mail.to}: ${mail.subject}\n${mail.text}`);
  }
}

export class ResendMailer extends Mailer {
  private readonly client: Resend;

  constructor(
    apiKey: string,
    private readonly from: string,
  ) {
    super();
    this.client = new Resend(apiKey);
  }

  async send(mail: Mail) {
    const { error } = await this.client.emails.send({ from: this.from, ...mail });
    if (error) throw new Error(`Resend: ${error.message}`);
  }
}
