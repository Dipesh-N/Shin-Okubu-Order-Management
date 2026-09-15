import { redirect } from "next/navigation";

export default function AdminIndex() {
  // Menu management is the thing an owner opens this for most days.
  redirect("/admin/menu");
}
