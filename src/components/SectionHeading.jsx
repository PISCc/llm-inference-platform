import { cn } from '../utils/cn.js';

export default function SectionHeading({ title, subtitle, className }) {
  return (
    <div className={cn('mb-8', className)}>
      <h2 className="text-2xl font-bold tracking-tight text-space-100">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-2 text-sm text-space-400">{subtitle}</p>
      )}
      <div className="mt-3 h-px w-24 bg-gradient-to-r from-cyan-500/60 via-violet-500/40 to-transparent" />
    </div>
  );
}
