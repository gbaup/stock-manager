import { FormHeadShell } from '@/components/ui/chrome';

// Route-level loading state for /purchases/new and /purchases/[id]/edit.
// Server-rendered, so it can't branch on viewport: it ships both headers and
// CSS shows the mobile form-head or the desktop builder outline.
export function PurchaseBuilderSkeleton({ title, saveLabel }: { title: string; saveLabel: string }) {
  return (
    <div className="screen pb-skel">
      <FormHeadShell title={title} saveLabel={saveLabel} />
      <header className="main-header pb-skel-head">
        <div className="mh-title">{title}</div>
      </header>
      <div className="pbuilder">
        <div className="pbuilder-cat pb-skel-cat">
          <div className="pcat-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton-card" style={{ height: 190 }} />
            ))}
          </div>
        </div>
        <div className="pbuilder-cart">
          <div className="pbuilder-cart-in body-pad">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton-card" style={{ marginTop: 10, height: 60 }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
