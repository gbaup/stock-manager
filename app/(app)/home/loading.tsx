import { BottomNavShell } from '@/components/ui/chrome';

export default function HomeLoading() {
  return (
    <div className="screen">
      <div className="body">
        <div className="body-pad">
          <div className="skeleton-bar" style={{ marginTop: 8, height: 56 }} />
          <div className="skeleton-bar" style={{ marginTop: 12, height: 96 }} />
          <div className="skeleton-bar" style={{ marginTop: 12, height: 36 }} />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton-card" style={{ marginTop: 10 }} />
          ))}
        </div>
      </div>
      <BottomNavShell active="home" />
    </div>
  );
}
