"use strict";

/**
 * E-posta metinleri. Tek yerde tutulur ki ton ve bağlantı biçimi her yerde aynı olsun.
 * Her şablon hem düz metin hem HTML üretir.
 */
const HTML_KACIS: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
};

/** Şablonlara giren her değer buradan geçer: e-postaya HTML enjekte edilemez. */
const escapeHtml = (value: unknown): string =>
  String(value ?? "").replace(/[&<>"']/g, (char) => HTML_KACIS[char] ?? char);

/** Üretilen e-postanın üç parçası; hepsi zorunlu. */
export interface EmailContent {
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

/** Şablonun ihtiyaç duyduğu ortam bilgisi (bağlantıları kurmak için). */
export interface TemplateOptions {
  readonly publicUrl: string;
}

type Template = (payload: any, options: TemplateOptions) => EmailContent;

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;background:#f6f7f9;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1f2430">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px">
    <div style="font-weight:700;font-size:20px;margin-bottom:20px">Donanex</div>
    <div style="background:#fff;border-radius:12px;padding:28px;line-height:1.6">
      ${bodyHtml}
    </div>
    <p style="color:#6b7280;font-size:12px;margin-top:20px">
      Bu ileti Donanex demo ortamından gönderildi.
    </p>
  </div>
</body></html>`;
}

const button = (href: string, label: string): string =>
  `<p style="margin:24px 0"><a href="${escapeHtml(href)}" style="background:#1f2430;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;display:inline-block">${escapeHtml(label)}</a></p>`;

const templates: Record<string, Template> = {
  "user.registered": ({ fullName, verificationToken }, { publicUrl }) => {
    const link = `${publicUrl}/eposta-dogrula#token=${verificationToken}`;
    return {
      subject: "Donanex'a hoş geldiniz — e-postanızı doğrulayın",
      text: `Merhaba ${fullName},\n\nDonanex hesabınız oluşturuldu. E-posta adresinizi doğrulamak için:\n\n${link}\n\nBu bağlantı 3 gün geçerlidir.`,
      html: layout(
        "Hoş geldiniz",
        `<p>Merhaba <strong>${escapeHtml(fullName)}</strong>,</p>
         <p>Donanex hesabınız oluşturuldu. E-posta adresinizi doğrulayarak tüm özellikleri kullanmaya başlayabilirsiniz.</p>
         ${button(link, "E-postamı doğrula")}
         <p style="color:#6b7280;font-size:13px">Bağlantı 3 gün geçerlidir.</p>`
      )
    };
  },

  "user.password_reset_requested": ({ fullName, resetToken }, { publicUrl }) => {
    // Jeton "#" sonrasında taşınır: sunucu günlüklerine ve Referer başlığına düşmez.
    const link = `${publicUrl}/parola-sifirla#token=${resetToken}`;
    return {
      subject: "Parola sıfırlama isteği",
      text: `Merhaba ${fullName},\n\nParolanızı sıfırlamak için 30 dakika içinde şu bağlantıyı açın:\n\n${link}\n\nBu isteği siz yapmadıysanız bu e-postayı yok sayabilirsiniz.`,
      html: layout(
        "Parola sıfırlama",
        `<p>Merhaba <strong>${escapeHtml(fullName)}</strong>,</p>
         <p>Parolanızı sıfırlamak için aşağıdaki düğmeye tıklayın.</p>
         ${button(link, "Parolamı sıfırla")}
         <p style="color:#6b7280;font-size:13px">Bağlantı 30 dakika geçerlidir. Bu isteği siz yapmadıysanız hiçbir şey yapmanıza gerek yok.</p>`
      )
    };
  },

  "user.password_changed": ({ fullName }) => ({
    subject: "Parolanız değiştirildi",
    text: `Merhaba ${fullName},\n\nHesabınızın parolası değiştirildi ve diğer cihazlardaki oturumlarınız kapatıldı.\n\nBu işlemi siz yapmadıysanız hemen destek ekibiyle iletişime geçin.`,
    html: layout(
      "Parolanız değiştirildi",
      `<p>Merhaba <strong>${escapeHtml(fullName)}</strong>,</p>
       <p>Hesabınızın parolası değiştirildi ve diğer cihazlardaki oturumlarınız kapatıldı.</p>
       <p><strong>Bu işlemi siz yapmadıysanız</strong> hemen destek ekibiyle iletişime geçin.</p>`
    )
  }),

  "order.placed": ({ fullName, orderNumber, total, trackingCode, isGuest }, { publicUrl }) => {
    const trackLink = `${publicUrl}/siparis-takip?no=${encodeURIComponent(orderNumber)}`;
    const guestNote = isGuest
      ? `\n\nSiparişinizi takip etmek için takip kodunuz: ${trackingCode}\nBu kodu saklayın.`
      : "";
    return {
      subject: `Siparişiniz alındı — ${orderNumber}`,
      text: `Merhaba ${fullName},\n\n${orderNumber} numaralı siparişiniz alındı. Tutar: ${total} TL.${guestNote}\n\nTakip: ${trackLink}`,
      html: layout(
        "Siparişiniz alındı",
        `<p>Merhaba <strong>${escapeHtml(fullName)}</strong>,</p>
         <p><strong>${escapeHtml(orderNumber)}</strong> numaralı siparişiniz alındı.</p>
         <p>Tutar: <strong>${escapeHtml(total)} TL</strong></p>
         ${isGuest ? `<p>Takip kodunuz: <code style="background:#f1f3f5;padding:4px 8px;border-radius:6px">${escapeHtml(trackingCode)}</code><br><span style="color:#6b7280;font-size:13px">Bu kodu saklayın; siparişinizi takip etmek için gerekir.</span></p>` : ""}
         ${button(trackLink, "Siparişimi takip et")}`
      )
    };
  },

  "order.paid": ({ fullName, orderNumber }) => ({
    subject: `Ödemeniz alındı — ${orderNumber}`,
    text: `Merhaba ${fullName},\n\n${orderNumber} numaralı siparişinizin ödemesi alındı. Mağazalar siparişinizi hazırlamaya başlayacak.`,
    html: layout(
      "Ödemeniz alındı",
      `<p>Merhaba <strong>${escapeHtml(fullName)}</strong>,</p>
       <p><strong>${escapeHtml(orderNumber)}</strong> numaralı siparişinizin ödemesi alındı. Mağazalar siparişinizi hazırlamaya başlayacak.</p>`
    )
  }),

  "order.payment_failed": ({ fullName, orderNumber }) => ({
    subject: `Ödeme tamamlanamadı — ${orderNumber}`,
    text: `Merhaba ${fullName},\n\n${orderNumber} numaralı siparişinizin ödemesi tamamlanamadı ve sipariş iptal edildi. Ürünler yeniden stoğa alındı.`,
    html: layout(
      "Ödeme tamamlanamadı",
      `<p>Merhaba <strong>${escapeHtml(fullName)}</strong>,</p>
       <p><strong>${escapeHtml(orderNumber)}</strong> numaralı siparişinizin ödemesi tamamlanamadı ve sipariş iptal edildi.</p>`
    )
  }),

  "order.cancelled": ({ fullName, orderNumber }) => ({
    subject: `Siparişiniz iptal edildi — ${orderNumber}`,
    text: `Merhaba ${fullName},\n\n${orderNumber} numaralı siparişiniz iptal edildi.`,
    html: layout(
      "Siparişiniz iptal edildi",
      `<p>Merhaba <strong>${escapeHtml(fullName)}</strong>,</p>
       <p><strong>${escapeHtml(orderNumber)}</strong> numaralı siparişiniz iptal edildi.</p>`
    )
  }),

  "order.package_status_changed": ({ fullName, orderNumber, status }, { publicUrl }) => {
    const labels: Record<string, string> = {
      preparing: "hazırlanıyor",
      shipped: "kargoya verildi",
      delivered: "teslim edildi",
      cancelled: "iptal edildi",
      refunded: "iade edildi"
    };
    const label = labels[status] || status;
    return {
      subject: `Sipariş durumu güncellendi — ${orderNumber}`,
      text: `Merhaba ${fullName},\n\n${orderNumber} numaralı siparişinizin bir paketi ${label}.\n\nTakip: ${publicUrl}/siparis-takip?no=${encodeURIComponent(orderNumber)}`,
      html: layout(
        "Sipariş durumu güncellendi",
        `<p>Merhaba <strong>${escapeHtml(fullName)}</strong>,</p>
         <p><strong>${escapeHtml(orderNumber)}</strong> numaralı siparişinizin bir paketi <strong>${escapeHtml(label)}</strong>.</p>
         ${button(`${publicUrl}/siparis-takip?no=${encodeURIComponent(orderNumber)}`, "Siparişimi görüntüle")}`
      )
    };
  },

  "store.approved": ({ name }, { publicUrl }) => ({
    subject: "Mağaza başvurunuz onaylandı",
    text: `${name} mağazanız onaylandı. Artık ürün ekleyip satış yapabilirsiniz.\n\nPanel: ${publicUrl}/magaza`,
    html: layout(
      "Mağazanız onaylandı",
      `<p><strong>${escapeHtml(name)}</strong> mağazanız onaylandı. Artık ürün ekleyip satış yapabilirsiniz.</p>
       ${button(`${publicUrl}/magaza`, "Mağaza paneline git")}`
    )
  }),

  "support.ticket_opened": ({ fullName, reference, subject }) => ({
    subject: `Destek talebiniz alındı — ${reference}`,
    text: `Merhaba ${fullName},\n\n"${subject}" konulu destek talebiniz alındı. Talep numaranız: ${reference}.`,
    html: layout(
      "Destek talebiniz alındı",
      `<p>Merhaba <strong>${escapeHtml(fullName)}</strong>,</p>
       <p>"${escapeHtml(subject)}" konulu talebiniz alındı.</p>
       <p>Talep numaranız: <strong>${escapeHtml(reference)}</strong></p>`
    )
  }),

  "support.ticket_answered": ({ fullName, reference, body }) => ({
    subject: `Destek talebinize yanıt verildi — ${reference}`,
    text: `Merhaba ${fullName},\n\n${reference} numaralı talebinize yanıt verildi:\n\n${body}`,
    html: layout(
      "Talebinize yanıt verildi",
      `<p>Merhaba <strong>${escapeHtml(fullName)}</strong>,</p>
       <p><strong>${escapeHtml(reference)}</strong> numaralı talebinize yanıt verildi:</p>
       <blockquote style="margin:16px 0;padding:12px 16px;background:#f6f7f9;border-left:3px solid #1f2430">${escapeHtml(body)}</blockquote>`
    )
  })
};

/** Olay tipine karşılık gelen e-postayı üretir; şablon yoksa null döner. */
export function renderEmail(type: string, payload: any, options: TemplateOptions): EmailContent | null {
  const template = templates[type];
  return template ? template(payload, options) : null;
}

export { templates };
