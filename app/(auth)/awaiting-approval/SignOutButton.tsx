"use client";

export function SignOutButton() {
  async function handleClick() {
    await fetch("/api/auth/signout", { method: "POST", credentials: "include" });
    window.location.href = "/login";
  }
  return (
    <button
      type="button"
      onClick={handleClick}
      className="fts-btn-primary inline-block w-full rounded-xl px-4 py-3 text-sm font-semibold text-white"
    >
      Sign out
    </button>
  );
}
