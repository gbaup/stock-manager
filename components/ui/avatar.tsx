export function Avatar({ name, size }: { name: string; size: number }) {
  return (
    <div
      className="avatar"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.45) }}
      aria-hidden
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
