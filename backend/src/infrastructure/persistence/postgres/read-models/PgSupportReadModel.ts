"use strict";

import type { Pool } from "pg";
import { binder, paginate, type Binder } from "./sql";
import type { ListFilters, Row, SupportReadModel } from "../../../../application/shared/contracts";

const SUMMARY = `
  t.id, t.reference, t.subject, t.status, t.priority, t.created_at AS "createdAt",
  t.full_name AS "fullName", t.email, t.store_id AS "storeId"`;

const MESSAGES = `
  COALESCE((
    SELECT json_agg(json_build_object(
      'id', m.id, 'body', m.body, 'isStaff', m.is_staff, 'createdAt', m.created_at
    ) ORDER BY m.created_at)
    FROM support_messages m WHERE m.ticket_id = t.id
  ), '[]'::json)`;

/*
 * Talebin ekleri. Diskteki ad (file_name) BİLİNÇLİ OLARAK yok: istemci eki
 * yalnızca kimliğiyle ister, ad sunucuda kalır.
 */
const EKLER = `
  COALESCE((
    SELECT json_agg(json_build_object(
      'id', a.id, 'originalName', a.original_name, 'contentType', a.content_type,
      'size', a.size_bytes, 'isStaff', a.is_staff, 'createdAt', a.created_at
    ) ORDER BY a.created_at)
    FROM support_attachments a WHERE a.ticket_id = t.id
  ), '[]'::json)`;

/*
 * Panelin varsayılan sırası: önce ilgilenilmemiş talepler, sonra öncelik,
 * sonra en yeni.
 *
 * Öncelik metin olduğu için alfabetik sırası YANLIŞ (high < low < normal <
 * urgent); CASE ile sayıya çevriliyor. Göçteki indeks aynı ifadeyi taşıyor,
 * yoksa her sıralama tabloyu tarardı.
 */
const SIRA = `
  CASE t.status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,
  CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
  t.created_at DESC`;

/** Referans numarası biçimi: DT-000123. Aramada birebir eşleşmeye gider. */
const REFERANS = /^DT-\d{6}$/i;

/**
 * Arama ve süzme koşullarını ekler.
 *
 * ARAMA tam metin: konu ve mesaj üzerinde Türkçe kök bulucuyla çalışıyor, yani
 * "kargolar" araması "Kargom gecikti" diyen talebi de buluyor. ILIKE ile
 * yapılsaydı yalnızca birebir aynı harf dizisi eşleşirdi.
 *
 * KÖK BULUCUNUN SINIRI: PostgreSQL'in Türkçe çözümleyicisi isimlerde iyi
 * ("kargom", "kargolar", "kargoyu" hepsi "kargo"), fiil çekimlerinde değil —
 * "gecikti" ile "gecikiyor" ayrı kelime sayılıyor. Bu bir hata değil,
 * kullanılan kök bulucunun kapsamı; entegrasyon testi bunu kayıt altına
 * alıyor ki ileride "arama bozuk" diye aranmasın.
 *
 * Kelimeler VE ile birleşiyor (websearch_to_tsquery'nin varsayılanı): yazdıkça
 * sonuç daralıyor. VEYA yapılsaydı iki kelimelik bir arama, tek kelimesi
 * geçen her talebi getirip listeyi gürültüye çevirirdi.
 *
 * websearch_to_tsquery seçildi, to_tsquery değil: kullanıcının yazdığı serbest
 * metni olduğu gibi kabul ediyor ve bozuk girdide HATA FIRLATMIYOR. to_tsquery
 * "kargo &" gibi yarım bir ifadede sorguyu düşürürdü — arama kutusuna yazarken
 * bu durum sürekli oluşur.
 *
 * Referans numarası yazıldığında tam metne hiç gidilmiyor: "DT-000123" kelime
 * olarak parçalanıp beklenmedik taleplerle eşleşebilirdi.
 */
function kosullar(filters: Row, bind: Binder["bind"], where: string[]): string | null {
  if (filters.status) where.push(`t.status = ${bind(filters.status)}`);
  if (filters.priority) where.push(`t.priority = ${bind(filters.priority)}`);

  const terim = typeof filters.q === "string" ? filters.q.trim() : "";
  if (!terim) return null;

  if (REFERANS.test(terim)) {
    where.push(`t.reference = ${bind(terim.toUpperCase())}`);
    return null;
  }

  const sorgu = `websearch_to_tsquery('turkish', ${bind(terim)})`;
  where.push(`t.search_vector @@ ${sorgu}`);
  // Sıralama için geri döndürülüyor: arama varken ilgi düzeyi tarihten önce gelir.
  return sorgu;
}

export class PgSupportReadModel implements SupportReadModel {
  private readonly db: Pool;

  constructor(pool: Pool) {
    this.db = pool;
  }

  async listForUser(userId: string, paging: ListFilters): Promise<Row> {
    const count = await this.db.query("SELECT COUNT(*)::int AS total FROM support_tickets WHERE user_id = $1", [
      userId
    ]);
    const { rows } = await this.db.query(
      `SELECT ${SUMMARY} FROM support_tickets t
       WHERE t.user_id = $1 ORDER BY t.created_at DESC LIMIT $2 OFFSET $3`,
      [userId, paging.limit, paging.offset]
    );
    return paginate(rows, count.rows[0].total, paging);
  }

  async listForStore(storeId: string, filters: ListFilters): Promise<Row> {
    const { params, bind } = binder([storeId]);
    const where = ["t.store_id = $1"];
    const sorgu = kosullar(filters, bind, where);

    const from = `FROM support_tickets t WHERE ${where.join(" AND ")}`;
    const count = await this.db.query(`SELECT COUNT(*)::int AS total ${from}`, params);
    const { rows } = await this.db.query(
      `SELECT ${SUMMARY} ${from}
       ORDER BY ${sorgu ? `ts_rank(t.search_vector, ${sorgu}) DESC, ` : ""}${SIRA}
       LIMIT ${bind(filters.limit)} OFFSET ${bind(filters.offset)}`,
      params
    );
    return paginate(rows, count.rows[0].total, filters);
  }

  async listForAdmin(filters: ListFilters): Promise<Row> {
    const { params, bind } = binder();
    const where: string[] = [];
    const sorgu = kosullar(filters, bind, where);

    const from = `FROM support_tickets t LEFT JOIN stores s ON s.id = t.store_id ${where.length ? `WHERE ${where.join(" AND ")}` : ""}`;
    const count = await this.db.query(`SELECT COUNT(*)::int AS total ${from}`, params);
    const { rows } = await this.db.query(
      `SELECT ${SUMMARY}, s.name AS "storeName" ${from}
       ORDER BY ${sorgu ? `ts_rank(t.search_vector, ${sorgu}) DESC, ` : ""}${SIRA}
       LIMIT ${bind(filters.limit)} OFFSET ${bind(filters.offset)}`,
      params
    );
    return paginate(rows, count.rows[0].total, filters);
  }

  /**
   * Tek bir ekin kaydı (diskteki adıyla birlikte).
   *
   * Kapsam sorgunun içinde: ek kimliği tahmin edilse bile, talebe erişimi
   * olmayan kişi için satır dönmüyor. Diskteki ad yalnızca BURADAN çıkıyor ve
   * istemciye hiçbir yanıtta gönderilmiyor.
   */
  async getAttachment(ticketId: string, attachmentId: string, scope: Row = {}): Promise<Row | null> {
    const { userId = null, storeId = null } = scope;
    const { rows } = await this.db.query(
      `SELECT a.id, a.file_name AS "fileName", a.original_name AS "originalName",
              a.content_type AS "contentType", a.size_bytes AS "size"
       FROM support_attachments a
       JOIN support_tickets t ON t.id = a.ticket_id
       WHERE a.id = $1 AND a.ticket_id = $2
         AND ($3::uuid IS NULL OR t.user_id = $3::uuid)
         AND ($4::uuid IS NULL OR t.store_id = $4::uuid)`,
      [attachmentId, ticketId, userId, storeId]
    );
    return rows[0] || null;
  }

  /** Kapsam filtresi sorgunun içindedir: başkasının talebi dönmez. */
  async get(ticketId: string, scope: Row = {}): Promise<Row | null> {
    const { userId = null, storeId = null } = scope;
    const { rows } = await this.db.query(
      `SELECT ${SUMMARY}, t.message, t.order_id AS "orderId", ${MESSAGES} AS messages, ${EKLER} AS attachments
       FROM support_tickets t
       WHERE t.id = $1
         AND ($2::uuid IS NULL OR t.user_id = $2::uuid)
         AND ($3::uuid IS NULL OR t.store_id = $3::uuid)`,
      [ticketId, userId, storeId]
    );
    return rows[0] || null;
  }
}
