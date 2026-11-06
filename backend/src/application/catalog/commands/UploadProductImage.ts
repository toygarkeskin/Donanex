"use strict";

import { Command, type Handler } from "../../shared/cqrs/Message";
import { requireUuid } from "../../../domain/shared/guards";
import { assertCan, type UseCaseContext } from "../../shared/authorize";
import type { FileStorage } from "../../shared/contracts";

/**
 * Mağaza paneline yüklenen ürün görselini saklar ve adresini döndürür.
 *
 * Görsel bir ürüne bağlı DEĞİLDİR: önce yüklenir, dönen adres ürün formuna
 * yazılır. Böylece henüz kaydedilmemiş bir ürüne de görsel seçilebilir.
 *
 * Yetki ürün yazma iznidir ve mağaza kapsamıyla sorulur — başka mağazanın
 * numarasıyla yükleme yapılamaz.
 */
export class UploadProductImageCommand extends Command {
  readonly storeId: string;
  readonly content: Buffer;

  constructor(input?: { storeId?: string; content?: Buffer }) {
    super();
    this.storeId = input?.storeId as string;
    this.content = input?.content as Buffer;
  }
}

export interface UploadedImage {
  readonly imageUrl: string;
  readonly contentType: string;
  readonly size: number;
}

export class UploadProductImageHandler implements Handler<UploadProductImageCommand, UploadedImage, UseCaseContext> {
  private readonly fileStorage: FileStorage;

  constructor({ fileStorage }: { fileStorage: FileStorage }) {
    this.fileStorage = fileStorage;
  }

  async handle({ storeId, content }: UploadProductImageCommand, context: UseCaseContext = {}): Promise<UploadedImage> {
    requireUuid(storeId, "Mağaza numarası");
    assertCan(context, "catalog:product:write", { storeId });

    // Tür ve boyut denetimi depolama katmanındadır: dosyanın gerçekte ne
    // olduğunu baytları söyler, bu yüzden karar orada verilir.
    const { fileName, contentType, size } = await this.fileStorage.save(content);

    return { imageUrl: `/yuklenen/${fileName}`, contentType, size };
  }
}
