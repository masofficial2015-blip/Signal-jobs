"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function EditJobRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/jobs");
  }, [router]);

  return (
    <div className="p-12 text-center text-sm text-slate-400">
      Redirecting to Jobs Directory...
    </div>
  );
}
