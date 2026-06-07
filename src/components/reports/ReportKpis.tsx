export type ReportKpi = {
  label: string
  value: string
  detail: string
}

type Props = {
  items: ReportKpi[]
}

export default function ReportKpis({ items }: Props){
  return (
    <div className="metric-grid report-center-kpi-grid">
      {items.map(item => (
        <div className="metric-card report-kpi-card" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          <p className="muted">{item.detail}</p>
        </div>
      ))}
    </div>
  )
}
