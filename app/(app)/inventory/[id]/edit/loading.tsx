import { FormHeadShell } from '@/components/ui/chrome';

export default function EditModelLoading() {
  return (
    <div className="screen">
      <FormHeadShell title="Editar modelo" saveLabel="Guardar cambios" />
      <div className="body">
        <div className="body-pad">
          <div className="skeleton-bar" style={{ marginTop: 8, height: 120 }} />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton-card" style={{ marginTop: 10, height: 60 }} />
          ))}
        </div>
      </div>
    </div>
  );
}
