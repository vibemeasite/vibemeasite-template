"use client";

import { useEffect, useState } from "react";

// Renders on the live staging site itself (ADR-001 "Staging-First
// Deployment with Time-Boxed Claim Flow") — loss aversion only works if the
// timer is visible wherever the Site Owner or anyone they've shared the link
// with actually encounters the site, not just in the chat.
function formatRemaining(ms: number): string {
  if (ms <= 0) return "less than a minute";
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  if (hours >= 1) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function StagingBanner({ expiresAt }: { expiresAt: string }) {
  const target = new Date(expiresAt).getTime();
  const [remaining, setRemaining] = useState(() => target - Date.now());

  useEffect(() => {
    const id = setInterval(() => setRemaining(target - Date.now()), 30_000);
    return () => clearInterval(id);
  }, [target]);

  return (
    <div className="staging-banner" role="status">
      This is a preview site — it will be removed in {formatRemaining(remaining)} unless claimed.
    </div>
  );
}
