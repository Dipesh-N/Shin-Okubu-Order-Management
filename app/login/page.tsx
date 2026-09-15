import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in · Okubu Momo" };

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Okubu Momo
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
