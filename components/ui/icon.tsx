import {
  Search, Plus, Package, ShoppingCart, Tag, Truck, Eye,
  ChevronRight, ChevronLeft, Check, Pencil, X, Calendar,
  Scale, TrendingUp, Filter, Shirt, Wallet, Receipt, ArrowLeftRight,
  Camera, Image, Trash2, LayoutGrid, List, Loader2,
} from 'lucide-react';

const ICONS = {
  search:   Search,
  plus:     Plus,
  box:      Package,
  cart:     ShoppingCart,
  tag:      Tag,
  truck:    Truck,
  eye:      Eye,
  chevR:    ChevronRight,
  chevL:    ChevronLeft,
  check:    Check,
  edit:     Pencil,
  x:        X,
  calendar: Calendar,
  scale:    Scale,
  trend:    TrendingUp,
  filter:   Filter,
  shirt:    Shirt,
  wallet:   Wallet,
  receipt:  Receipt,
  swap:     ArrowLeftRight,
  camera:   Camera,
  image:    Image,
  trash:    Trash2,
  grid:     LayoutGrid,
  list:     List,
  loader:   Loader2,
} as const;

type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 22,
  strokeWidth = 1.8,
  style,
  className,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  style?: React.CSSProperties;
  className?: string;
}) {
  const Comp = ICONS[name];
  return <Comp size={size} strokeWidth={strokeWidth} style={style} className={className} />;
}
