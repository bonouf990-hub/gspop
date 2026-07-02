"use server";

import { createClient } from "./supabase-server";

type NotifyParams = {
  userId: string;
  title: string;
  message: string;
  type?: "info" | "warning" | "urgent" | "success";
  entityType?: string;
  entityId?: string;
  link?: string;
};

export async function sendNotification(params: NotifyParams) {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("tenant_id")
    .eq("id", params.userId)
    .single();

  if (!profile?.tenant_id) return;

  await supabase.from("notifications").insert({
    tenant_id: profile.tenant_id,
    user_id: params.userId,
    title: params.title,
    message: params.message,
    type: params.type ?? "info",
    entity_type: params.entityType,
    entity_id: params.entityId,
    link: params.link,
  });
}

export async function notifyRole(
  role: string | string[],
  title: string,
  message: string,
  options?: {
    type?: "info" | "warning" | "urgent" | "success";
    entityType?: string;
    entityId?: string;
    link?: string;
  }
) {
  const supabase = await createClient();
  const roles = Array.isArray(role) ? role : [role];

  const { data: users } = await supabase
    .from("user_profiles")
    .select("id, tenant_id")
    .in("role", roles);

  if (!users || users.length === 0) return;

  const rows = users.map((u) => ({
    tenant_id: u.tenant_id,
    user_id: u.id,
    title,
    message,
    type: options?.type ?? "info",
    entity_type: options?.entityType,
    entity_id: options?.entityId,
    link: options?.link,
  }));

  await supabase.from("notifications").insert(rows);
}
