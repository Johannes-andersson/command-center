export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {Icon && (
        <div className="w-12 h-12 rounded-full bg-elevated flex items-center justify-center mb-4">
          <Icon className="w-5 h-5 text-muted" />
        </div>
      )}
      <h3 className="font-medium mb-1">{title}</h3>
      {description && <p className="text-sm text-muted mb-4 max-w-sm">{description}</p>}
      {action}
    </div>
  )
}
