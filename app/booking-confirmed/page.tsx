// BSA Phase 23 — the successUrl a REAL payment provider (Square, later
// Stripe) redirects the visitor back to after a booking deposit is paid
// (lib/booking-service.ts's confirmBookingRequest, vibemeasite-mcp side).
// Deliberately does NOT claim the booking is confirmed purely from having
// landed here — the actual confirmation (the calendar event) is created by
// the provider's webhook, which can complete slightly after this redirect
// does. A plain server-rendered page (no client-side status polling yet —
// there's no public "check booking status" endpoint to poll) that sets the
// right expectation instead of a premature "you're booked."
export default function BookingConfirmedPage() {
  return (
    <div style={{ maxWidth: 480, margin: "64px auto", padding: "0 24px", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif" }}>
      <div style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: 32 }}>
        <h1 style={{ fontSize: 20, margin: "0 0 12px" }}>Payment received</h1>
        <p style={{ fontSize: 15, lineHeight: 1.6, color: "#444" }}>
          Thanks — your deposit payment was received. Your appointment is being confirmed now; you&apos;ll get a
          confirmation email with the details within a few minutes. If it doesn&apos;t arrive, please contact the
          business directly.
        </p>
      </div>
    </div>
  );
}
