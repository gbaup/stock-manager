export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <span
      className="spinner"
      aria-hidden
      style={{ width: size, height: size, borderWidth: Math.max(2, Math.round(size / 10)) }}
    />
  );
}
