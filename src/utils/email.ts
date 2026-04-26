import Handlebars from "handlebars";

import { emailTransport } from "../config/email.js";
import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";

type SendTemplateOptions = {
  to: string;
  templateName: string;
  variables: Record<string, unknown>;
};

function isEmailConfigured() {
  const demoValues = new Set(["", "demo", "your_mailtrap_user", "your_mailtrap_pass"]);
  return Boolean(env.EMAIL_HOST && env.EMAIL_USER && env.EMAIL_PASS)
    && !demoValues.has(env.EMAIL_USER)
    && !demoValues.has(env.EMAIL_PASS);
}

async function safeSendMail(options: { to: string; subject: string; html: string }) {
  if (!isEmailConfigured()) {
    console.warn("[Email] SMTP not configured. Skipping email:", options.subject);
    return;
  }

  try {
    await emailTransport.sendMail(options);
  } catch (error) {
    // IMPORTANT: email delivery must never crash the API.
    // Bad SMTP credentials previously killed the backend and caused frontend "Failed to fetch".
    console.warn("[Email] Failed to send email (non-fatal):", error instanceof Error ? error.message : error);
  }
}

export async function sendTemplateEmail(options: SendTemplateOptions) {
  const template = await prisma.emailTemplate.findUnique({
    where: { name: options.templateName }
  });

  if (!template) {
    return;
  }

  const compiledSubject = Handlebars.compile(template.subject);
  const compiledBody = Handlebars.compile(template.htmlBody);

  // Queue email asynchronously and do not block or crash API response.
  setImmediate(() => {
    void safeSendMail({
      to: options.to,
      subject: compiledSubject(options.variables),
      html: compiledBody(options.variables)
    });
  });
}

export async function sendRawEmail(options: { to: string; subject: string; html: string }) {
  setImmediate(() => {
    void safeSendMail(options);
  });
}
