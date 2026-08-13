export default function ModulePlaceholder({ title, description, todo }) {
  return (
    <div>
      <div className="mb-6">
        <span className="inline-block rounded-full border border-sky-500/40 bg-sky-500/10 px-3 py-1 text-xs text-sky-300">
          开发中
        </span>
        <h1 className="mt-3 text-3xl font-bold text-slate-100">{title}</h1>
        <p className="mt-2 max-w-2xl text-slate-400">{description}</p>
      </div>
      <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/60 p-10 text-center">
        <p className="text-slate-500">模块骨架已就绪，功能开发中</p>
        {todo && (
          <ul className="mx-auto mt-4 max-w-md list-disc pl-5 text-left text-sm text-slate-500">
            {todo.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
