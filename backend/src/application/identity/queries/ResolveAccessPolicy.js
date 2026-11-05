"use strict";

const { Query } = require("../../shared/cqrs/Message");
const { AccessPolicy } = require("../../../domain/identity/AccessPolicy");
const { ACCESS_POLICY_CACHE_TTL_SECONDS } = require("../authPolicy");

class ResolveAccessPolicyQuery extends Query {
  constructor(input) {
    super();
    this.userId = input?.userId;
  }
}

/**
 * Kullanıcının güncel yetkilerini verir. Her istekte çağrıldığı için sonuç
 * önbelleklenir; rol değişimi, parola değişimi ve askıya alma anında
 * önbellek anahtarı silinir, böylece yetki değişiklikleri hemen etkili olur.
 *
 * İzinler jetonun içine gömülmez: aksi halde yetkisi alınan bir kullanıcı
 * jetonu süresi dolana kadar yetkili kalırdı.
 */
class ResolveAccessPolicyHandler {
  constructor({ userReadModel, cache }) {
    this.readModel = userReadModel;
    this.cache = cache;
  }

  /**
   * @returns {{policy: AccessPolicy, sessionVersion: number|null}}
   *   sessionVersion null ise kullanıcı silinmiş ya da askıya alınmıştır.
   *   Jetondaki sürümle karşılaştırılır: parola değişince eski jetonlar düşer.
   */
  async handle({ userId }) {
    const key = `policy:${userId}`;
    const cached = await this.cache.get(key);
    if (cached) {
      return { policy: new AccessPolicy(cached.assignments), sessionVersion: cached.sessionVersion };
    }

    const [assignments, sessionVersion] = await Promise.all([
      this.readModel.getAccessPolicy(userId),
      this.readModel.getSessionVersion(userId)
    ]);

    // Askıya alınmış kullanıcı önbelleğe yazılmaz; her istekte yeniden bakılır.
    if (sessionVersion !== null) {
      await this.cache.set(key, { assignments, sessionVersion }, ACCESS_POLICY_CACHE_TTL_SECONDS);
    }
    return { policy: new AccessPolicy(assignments), sessionVersion };
  }
}

module.exports = { ResolveAccessPolicyQuery, ResolveAccessPolicyHandler };
