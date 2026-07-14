import { MessageCircle } from 'lucide-react';

export function WhatsAppButton({ phone, message }: { phone: string; message?: string }) {
  const href = `https://wa.me/${phone}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="wa-fab" aria-label="Chatear por WhatsApp">
      <MessageCircle size={26} strokeWidth={2} />
    </a>
  );
}
