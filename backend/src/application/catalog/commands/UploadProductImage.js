"use strict";

const { Command } = require("../../shared/cqrs/Message");
const { requireUuid } = require("../../../domain/shared/guards");
const { assertCan } = require("../../shared/authorize");

/**
 * Mağaza paneline yüklenen ürün görselini saklar ve adresini döndürür.
 *
 * Görsel bir ürüne bağlı DEĞİLDİR: önce yüklenir, dönen adres ürün formuna
 * yazılır. Böylece henüz kaydedilmemiş bir ürüne de görsel seçilebilir.
 *
 * Yetki ürün yazma iznidir ve mağaza kapsamıyla sorulur — başka mağazanın
 * numarasıyla yükleme yapılamaz.
 */
class UploadProductImageCommand extends Command {
  constructor(input) {
    super();
    this.storeId = input?.storeId;
    this.content = input?.content;
  }
}

class UploadProductImageHandler {
  constructor({ fileStorage }) {
    this.fileStorage = fileStorage;
  }

  async handle({ storeId, content }, context = {}) {
    requireUuid(storeId, "Mağaza numarası");
    assertCan(context, "catalog:product:write", { storeId });

    // Tür ve boyut denetimi depolama katmanındadır: dosyanın gerçekte ne
    // olduğunu baytları söyler, bu yüzden karar orada verilir.
    const { fileName, contentType, size } = await this.fileStorage.save(content);

    return { imageUrl: `/yuklenen/${fileName}`, contentType, size };
  }
}

module.exports = { UploadProductImageCommand, UploadProductImageHandler };
