export function buildWhatsAppLink(number: string, message: string) {
  const cleanNumber = number.replace(/\D/g, "");
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${cleanNumber}?text=${encoded}`;
}
