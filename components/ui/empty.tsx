import { Package, Search, Truck, ShoppingCart, Shirt, Wallet, Receipt, Tag } from 'lucide-react';
import type { ComponentType } from 'react';

const ICONS: Record<string, ComponentType<{ size?: number; strokeWidth?: number }>> = {
  box: Package, search: Search, truck: Truck, cart: ShoppingCart,
  shirt: Shirt, wallet: Wallet, receipt: Receipt, tag: Tag,
};

export function Empty({
  icon = 'box' as const,
  title,
  desc,
}: {
  icon?: 'box' | 'search' | 'truck' | 'cart' | 'shirt' | 'wallet' | 'receipt' | 'tag';
  title: string;
  desc?: string;
}) {
  const Ico = ICONS[icon] ?? Package;
  return (
    <div className="empty">
      <div className="ico">
        <Ico size={26} strokeWidth={1.8} />
      </div>
      <div className="t">{title}</div>
      {desc && <div className="d">{desc}</div>}
    </div>
  );
}
