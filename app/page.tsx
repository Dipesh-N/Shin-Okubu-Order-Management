import { redirect } from "next/navigation";
import { requireUser, homeForRole } from "@/lib/auth";

/**
 * The root is just a signpost: admins go to the admin area, staff to the
 * mode picker. Nobody needs a landing page.
 */
export default async function Home() {
  const user = await requireUser();
  redirect(homeForRole(user.role));
}
