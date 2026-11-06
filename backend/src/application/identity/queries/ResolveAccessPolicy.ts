"use strict";

import { Query, type Handler } from "../../shared/cqrs/Message";
import { AccessPolicy, type RoleAssignment } from "../../../domain/identity/AccessPolicy";
import { ACCESS_POLICY_CACHE_TTL_SECONDS } from "../authPolicy";
import type { Cache, UserReadModel } from "../../shared/contracts";

export class ResolveAccessPolicyQuery extends Query {
  readonly userId: string;

  constructor(input?: { userId?: string }) {
    super();
    this.userId = input?.userId as string;
  }
}

export interface ResolvedPolicy {
  readonly policy: AccessPolicy;
  /**
   * null ise kullanıcı silinmiş ya da askıya alınmıştır.
   * Jetondaki sürümle karşılaştırılır: parola değişince eski jetonlar düşer.
   */
  readonly sessionVersion: number | null;
}

interface CachedPolicy {
  readonly assignments: RoleAssignment[];
  readonly sessionVersion: number;
}

/**
 * Kullanıcının güncel yetkilerini verir. Her istekte çağrıldığı için sonuç
 * önbelleklenir; rol değişimi, parola değişimi ve askıya alma anında
 * önbellek anahtarı silinir, böylece yetki değişiklikleri hemen etkili olur.
 *
 * İzinler jetonun içine gömülmez: aksi halde yetkisi alınan bir kullanıcı
 * jetonu süresi dolana kadar yetkili kalırdı.
 */
export class ResolveAccessPolicyHandler implements Handler<ResolveAccessPolicyQuery, ResolvedPolicy> {
  private readonly readModel: UserReadModel;
  private readonly cache: Cache;

  constructor({ userReadModel, cache }: { userReadModel: UserReadModel; cache: Cache }) {
    this.readModel = userReadModel;
    this.cache = cache;
  }

  async handle({ userId }: ResolveAccessPolicyQuery): Promise<ResolvedPolicy> {
    const key = `policy:${userId}`;
    const cached = await this.cache.get<CachedPolicy>(key);
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
