"use strict";

/**
 * Okuma tarafının ortak SQL parçaları.
 *
 * Okuma modelleri domain nesnesi kurmaz: doğrudan arayüzün ihtiyaç duyduğu
 * DTO'yu üretirler. Bu, CQRS'in okuma tarafının temel kazancıdır — tek sorguda
 * birleştirilmiş, sayfalanmış, hazır veri.
 */

/** LIKE içindeki joker karakterler kullanıcı girdisinde joker sayılmasın. */
export const escapeLike = (text: unknown): string => String(text).replace(/[\\%_]/g, (char) => `\\${char}`);

/** Kuruşu arayüzün beklediği para nesnesine çevirir. */
export const money = (expression: string): string => `json_build_object(
  'cents', ${expression},
  'amount', to_char((${expression})::numeric / 100, 'FM999999999990.00'),
  'currency', 'TRY'
)`;

/** Sorguya sırayla parametre ekleyip $n yer tutucusunu döndüren yardımcı. */
export interface Binder {
  readonly params: unknown[];
  /** Değeri listeye ekler ve ona karşılık gelen $n yer tutucusunu verir. */
  bind(value: unknown): string;
}

export function binder(params: unknown[] = []): Binder {
  return {
    params,
    bind(value: unknown): string {
      params.push(value);
      return `$${params.length}`;
    }
  };
}

export interface Page<T> {
  readonly items: T[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly pages: number;
}

export const paginate = <T>(
  rows: T[],
  total: number,
  { page, pageSize }: { page: number; pageSize: number }
): Page<T> => ({
  items: rows,
  total,
  page,
  pageSize,
  pages: Math.max(1, Math.ceil(total / pageSize))
});
