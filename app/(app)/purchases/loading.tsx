import { TopBar, BottomNavShell } from '@/components/ui/chrome';

export default function PurchasesLoading() {
  return (
    <div className="screen">
      <TopBar eyebrow="STOCKCONTROL" title="Compras" />
      <div className="body">
        <div className="body-pad">
          <div className="skeleton-bar" style={{ marginTop: 4, height: 36 }} />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton-card" style={{ marginTop: 10 }} />
          ))}
        </div>
      </div>
      <BottomNavShell active="purchases" />
    </div>
  );
}
