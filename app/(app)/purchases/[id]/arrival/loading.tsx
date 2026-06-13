import { FormHeadShell } from '@/components/ui/chrome';

export default function ArrivalLoading() {
  return (
    <div className="screen">
      <FormHeadShell title="Marcar llegada" saveLabel="Confirmar" />
      <div className="body">
        <div className="body-pad">
          <div className="skeleton-bar" style={{ marginTop: 8, height: 36 }} />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton-card" style={{ marginTop: 10, height: 60 }} />
          ))}
        </div>
      </div>
    </div>
  );
}
