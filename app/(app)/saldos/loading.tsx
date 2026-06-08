import { TopBar, BottomNavShell } from '@/components/ui/chrome';

export default function SaldosLoading() {
  return (
    <div className="screen">
      <TopBar eyebrow="STOCKCONTROL" title="Saldos" />
      <div className="body">
        <div className="body-pad">
          <div className="skeleton-bar" style={{ marginTop: 8, height: 80 }} />
          <div className="skeleton-bar" style={{ marginTop: 10, height: 36 }} />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton-card" style={{ marginTop: 10 }} />
          ))}
        </div>
      </div>
      <BottomNavShell active="saldos" />
    </div>
  );
}
