"use strict";

import { Command, type Handler } from "../../shared/cqrs/Message";
import { isUuid } from "../../../domain/shared/guards";
import { mergeGuestCart, type MergeResult } from "../services/mergeGuestCart";
import type { UnitOfWork } from "../../shared/contracts";

export class AdoptGuestCartCommand extends Command {
  readonly userId: string;
  readonly guestCartId: unknown;

  constructor(input: { userId: string; guestCartId: unknown }) {
    super();
    this.userId = input.userId;
    this.guestCartId = input.guestCartId;
  }
}

/**
 * Oturum açıkken tarayıcıda kalmış misafir sepetini kullanıcıya taşır.
 *
 * Misafir sepeti normalde giriş adımında (parola / kod / kayıt) taşınıyor.
 * Ama giriş her zaman o adımdan geçmiyor: tarayıcıda açık bir oturum varsa
 * yetkilendirme sessizce tamamlanıyor ve misafirken eklenen ürünler
 * kayboluyordu. Sepet uçları, oturum açık bir istekte misafir sepeti çerezi
 * görünce bu komutu çalıştırıp çerezi siliyor.
 *
 * Başka bir kullanıcıya bağlı sepet taşınmaz (mergeGuestCart denetliyor).
 */
export class AdoptGuestCartHandler implements Handler<AdoptGuestCartCommand, MergeResult> {
  private readonly unitOfWork: UnitOfWork;

  constructor({ unitOfWork }: { unitOfWork: UnitOfWork }) {
    this.unitOfWork = unitOfWork;
  }

  async handle({ userId, guestCartId }: AdoptGuestCartCommand): Promise<MergeResult> {
    if (!isUuid(guestCartId)) return { merged: 0 };
    return this.unitOfWork.run((repos) => mergeGuestCart(repos, { guestCartId, userId }));
  }
}
