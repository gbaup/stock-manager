import { TopBar, BottomNavShell } from '@/components/ui/chrome';

export default function MetricsLoading() {
  return (
    <div className="screen">
      <TopBar eyebrow="STOCKCONTROL" title="Métricas" />
      <div className="body">
        <div className="body-pad">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton-card" style={{ marginTop: 10, height: 220 }} />
          ))}
        </div>
      </div>
      <BottomNavShell active="metrics" />
    </div>
  );
}
