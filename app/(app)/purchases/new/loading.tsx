import { FormHeadShell } from '@/components/ui/chrome';

export default function NewPurchaseLoading() {
  return (
    <div className="screen">
      <FormHeadShell title="Nueva compra · info" saveLabel="Siguiente" />
      <div className="body">
        <div className="body-pad">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton-card" style={{ marginTop: 10, height: 60 }} />
          ))}
        </div>
      </div>
    </div>
  );
}
