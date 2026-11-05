/** Tüm sayfaların kullandığı tek HTTP istemcisi. Hata mesajını sunucudan alır. */
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function api(url, { method = "GET", body } = {}) {
  let response;
  try {
    response = await fetch(url, {
      method,
      credentials: "same-origin",
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch {
    throw new ApiError("Sunucuya bağlanılamadı. Lütfen tekrar deneyin.", 0);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    throw new ApiError(data.message || "İşlem başarısız.", response.status);
  }
  return data;
}
