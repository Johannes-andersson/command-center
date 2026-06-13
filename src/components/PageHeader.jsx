export default function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="px-4 md:px-8 pt-6 md:pt-8 pb-4 border-b border-border">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}
