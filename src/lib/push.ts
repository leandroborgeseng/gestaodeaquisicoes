import webpush from "web-push";
import { prisma } from "./prisma";

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    `mailto:${process.env.SMTP_FROM ?? "tech@aionengenharia.com.br"}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; url?: string }
) {
  if (!process.env.VAPID_PUBLIC_KEY) return;
  const subs = await prisma.userPushSubscription.findMany({ where: { userId } });
  await Promise.allSettled(
    subs.map((s) =>
      webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload)
      ).catch(() => prisma.userPushSubscription.delete({ where: { id: s.id } }))
    )
  );
}

export async function sendPushToRole(
  role: string,
  payload: { title: string; body: string; url?: string }
) {
  const users = await prisma.user.findMany({ where: { role: role as never }, select: { id: true } });
  await Promise.all(users.map((u) => sendPushToUser(u.id, payload)));
}
