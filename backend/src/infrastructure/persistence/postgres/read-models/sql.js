"use strict";

/**
 * Okuma tarafının ortak SQL parçaları.
 *
 * Okuma modelleri domain nesnesi kurmaz: doğrudan arayüzün ihtiyaç duyduğu
 * DTO'yu üretirler. Bu, CQRS'in okuma tarafının temel kazancıdır — tek sorguda
 * birleştirilmiş, sayfalanmış, hazır veri.
 */

/** LIKE içindeki joker karakterler kullanıcı girdisinde joker sayılmasın. */
const escapeLike = (text) => String(text).replace(/[\\%_]/g, (char) => `\\${char}`);

/** Kuruşu arayüzün beklediği para nesnesine çevirir. */
const money = (expression) => `json_build_object(
  'cents', ${expression},
  'amount', to_char((${expression})::numeric / 100, 'FM999999999990.00'),
  'currency', 'TRY'
)`;

/** Sorguya sırayla parametre ekleyip $n yer tutucusunu döndüren yardımcı. */
function binder(params = []) {
  return {
    params,
    bind(value) {
      params.push(value);
      return `$${params.length}`;
    }
  };
}

const paginate = (rows, total, { page, pageSize }) => ({
  items: rows,
  total,
  page,
  pageSize,
  pages: Math.max(1, Math.ceil(total / pageSize))
});

module.exports = { escapeLike, money, binder, paginate };
