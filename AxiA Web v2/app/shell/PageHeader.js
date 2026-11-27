// The bar at the top of a page: title (and a line under it) on the left, the page's actions on the right.
export default function PageHeader({ title, sub, children }) {
  return (
    <header className="page-bar">
      <div className="page-bar-title">
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {children && <div className="page-bar-actions">{children}</div>}
    </header>
  );
}
