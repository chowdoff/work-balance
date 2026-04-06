import { getCurrentUser } from "@/lib/auth-utils";
import { SettingsClient } from "./client";

export default async function SettingsPage() {
  const user = await getCurrentUser();

  return <SettingsClient userName={user.name ?? ""} />;
}
