export function Sidebar({ pages, activeId, onSelect, statusLabel }) {
  return (
    <nav className="sidebar" aria-label="Section navigation">
      <div className="sidebar-title">CUDA X-Ray Lab</div>
      {statusLabel && <div className="sidebar-status">{statusLabel}</div>}

      <ol className="sidebar-links">
        {pages.map((p) => (
          <li key={p.id}>
            <button
              className={activeId === p.id ? "active" : ""}
              onClick={() => onSelect(p.id)}
              aria-current={activeId === p.id ? "true" : "false"}
            >
              {p.title}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
