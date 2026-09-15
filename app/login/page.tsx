import { redirect } from "next/navigation";
import { getCurrentUser, homeForRole } from "@/lib/auth";
import { LoginForm } from "./login-form";
import { RESTAURANT_NAME } from "@/lib/restaurant";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  // Only send someone onward once we know who they are. A session whose
  // profile is missing or unreadable falls through to the form, which is a
  // recoverable state — unlike bouncing them in a loop.
  const user = await getCurrentUser();
  if (user) redirect(homeForRole(user.role));

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            {RESTAURANT_NAME}
          </h1>
          <p className="mt-1 text-slate-500">Order management</p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
