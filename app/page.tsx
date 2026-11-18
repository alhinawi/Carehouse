"use client";
import dynamic from "next/dynamic";
const Carehouse = dynamic(() => import("../src/main"), {
  ssr: false,
  loading: () => (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-teal-700">
      Carehouse...
    </main>
  ),
});
export default function Page() {
  return <Carehouse />;
}
