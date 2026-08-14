import Badge from './Badge.jsx';

const ORB_CLASSES = {
  cyan: 'bg-cyan-500/10',
  violet: 'bg-violet-500/10',
  emerald: 'bg-emerald-500/10',
  amber: 'bg-amber-500/10',
};

export default function ProductHeader({ title, subtitle, accent = 'cyan', badges = [] }) {
  return (
    <div className="panel-shell relative overflow-hidden rounded-2xl border border-space-700/50 px-5 py-6 text-center md:px-8">
      <div className={`pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full blur-3xl ${ORB_CLASSES[accent] || ORB_CLASSES.cyan}`} />
      <div className="relative">
        <h1 className="text-headline text-gradient">{title}</h1>
        <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-space-400">{subtitle}</p>
        {badges.length > 0 && (
          <div className="mx-auto mt-4 flex max-w-3xl flex-wrap justify-center gap-2">
            {badges.map((badge) => (
              <Badge key={badge.label} variant={badge.variant || 'slate'}>{badge.label}</Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
