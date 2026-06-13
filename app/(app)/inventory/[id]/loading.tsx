import { BottomNavShell } from '@/components/ui/chrome';

export default function ModelDetailLoading() {
  return (
    <div className="screen">
      <header className="form-head">
        <button className="link" disabled>Atrás</button>
        <div className="title" />
        <button className="link accent" disabled>Editar</button>
      </header>
      <div className="body">
        <div className="body-pad">
          <div className="skeleton-bar" style={{ marginTop: 8, height: 200 }} />
          <div className="skeleton-bar" style={{ marginTop: 12, height: 36 }} />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton-card" style={{ marginTop: 10 }} />
          ))}
        </div>
      </div>
      <BottomNavShell active="inventory" />
    </div>
  );
}
