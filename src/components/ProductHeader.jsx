import Badge from './Badge.jsx';

export default function ProductHeader({ title, subtitle, accent = 'cyan', badges = [] }) {
  return (
    <header className={`workbench-page-head workbench-page-head--${accent}`}>
      <div className="workbench-page-head__main">
        <div className="workbench-page-head__eyebrow"><span className="workbench-page-head__rule" />WORKSPACE / TECHNICAL VIEW</div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {badges.length > 0 && <div className="workbench-page-head__badges">{badges.map((badge) => <Badge key={badge.label} variant={badge.variant || 'slate'}>{badge.label}</Badge>)}</div>}
    </header>
  );
}
