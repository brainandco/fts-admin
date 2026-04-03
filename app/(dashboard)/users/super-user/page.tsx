import { redirect } from "next/navigation";

/** Create Super User is no longer supported; only one super user (seeded). */
export default function SuperUserCreatePage() {
  redirect("/users");
}
