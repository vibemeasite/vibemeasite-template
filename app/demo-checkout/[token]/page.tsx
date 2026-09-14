"use client";

import { useState } from "react";
import { useParams } from "next/navigation";

// BSA Phase 20 Decided #1's interim note — the demo payment provider's
// stand-in for Stripe's own hosted Checkout page. Deliberately plain and
// explicit that no real money moves, per this feature's Deferred-bullet
// requirement that demo mode never be presented as "accepting payments."
// A real Stripe Connect implementation (later) sends the shopper to
// Stripe's own domain instead — this page only exists while "demo" is the
// active payment_connections.provider.
export default function DemoCheckoutPage() {
  const params = useParams<{ token: string }>();
  const [state, setState] = useState<"idle" | "confirming" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleConfirm() {
    setState("confirming");
    setMessage(null);
    try {
      const res = await fetch("/api/commerce/demo-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: params.token }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setState("error");
        setMessage(json.message ?? "Something went wrong. Please try again.");
        return;
      }
      setState("done");
    } catch {
      setState("error");
      setMessage("Something went wrong. Please try again.");
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: "64px auto", padding: "0 24px", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif" }}>
      <div style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: 32 }}>
        <div
          style={{
            display: "inline-block",
            background: "#fff3cd",
            color: "#856404",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            padding: "4px 10px",
            borderRadius: 6,
            marginBottom: 16,
          }}
        >
          Demo mode — no real charge
        </div>

        {state !== "done" && (
          <>
            <h1 style={{ fontSize: 20, margin: "0 0 12px" }}>Confirm your order</h1>
            <p style={{ fontSize: 15, lineHeight: 1.6, color: "#444", margin: "0 0 24px" }}>
              This is a demo checkout — clicking confirm below will not charge any real payment method. It creates a
              real order in this shop's Orders list so the full flow can be reviewed end to end.
            </p>
            <button
              onClick={handleConfirm}
              disabled={state === "confirming"}
              style={{
                background: "#5b21b6",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "12px 24px",
                fontSize: 15,
                fontWeight: 600,
                cursor: state === "confirming" ? "default" : "pointer",
                opacity: state === "confirming" ? 0.7 : 1,
              }}
            >
              {state === "confirming" ? "Confirming…" : "Confirm demo purchase"}
            </button>
            {message && <p style={{ color: "#b91c1c", fontSize: 14, marginTop: 16 }}>{message}</p>}
          </>
        )}

        {state === "done" && (
          <>
            <h1 style={{ fontSize: 20, margin: "0 0 12px" }}>Order confirmed</h1>
            <p style={{ fontSize: 15, lineHeight: 1.6, color: "#444" }}>
              Your demo order has been placed. A confirmation email is on its way.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
