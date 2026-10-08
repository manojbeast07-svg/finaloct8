import { useState } from "react";

// Technical details remain individually expandable without a global mode toggle.
export function TechnicalDetail({ label = "Technical detail", children }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="tech-detail">
      <button className="tech-toggle" onClick={() => setOpen((o) => !o)}>
        {open ? "Hide" : "Show"} {label}
      </button>
      {open && <div style={{ marginTop: "0.6rem" }}>{children}</div>}
    </div>
  );
}
