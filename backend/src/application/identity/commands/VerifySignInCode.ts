"use strict";

import { Command, type Handler } from "../../shared/cqrs/Message";
import { UnauthorizedError, ForbiddenError } from "../../../domain/shared/errors";
import { UserStatus } from "../../../domain/identity/User";
import { isUuid } from "../../../domain/shared/guards";
import { finishSignIn, loginCodeHash, type SignedIn } from "../services/loginCode";
import { LOGIN_CODE_LENGTH, LOGIN_CODE_MAX_ATTEMPTS, TRUSTED_DEVICE_TTL_MS } from "../authPolicy";
import type { UseCaseContext } from "../../shared/authorize";
import type { Clock, OpaqueTokens, UnitOfWork } from "../../shared/contracts";

export class VerifySignInCodeCommand extends Command {
  readonly challengeId: unknown;
  readonly code: unknown;
  readonly rememberDevice: boolean;
  readonly guestCartId: string | null;

  constructor(input?: { challengeId?: unknown; code?: unknown; rememberDevice?: unknown; guestCartId?: string | null }) {
    super();
    this.challengeId = input?.challengeId;
    this.code = input?.code;
    this.rememberDevice = input?.rememberDevice === true;
    this.guestCartId = input?.guestCartId ?? null;
  }
}

export interface SignInCodeVerified extends SignedIn {
  /** "Bu cihazı hatırla" seçildiyse tarayıcıya çerezle verilecek jeton. */
  readonly trustedDevice: { token: string; maxAgeSeconds: number } | null;
}

type Sonuc =
  | { durum: "tamam"; sonuc: SignInCodeVerified }
  | { durum: "yanlis"; kalan: number }
  | { durum: "gecersiz"; mesaj: string };

const GECERSIZ = "Kodun süresi doldu ya da geçersiz. Lütfen yeniden giriş yapın.";

/**
 * Girişin ikinci adımı: e-postadaki 6 haneli kod.
 *
 * Yanlış deneme sayacı işlemin İÇİNDE artıyor ama hata işlemin DIŞINDA
 * atılıyor: hata işlemin içinde atılsaydı geri alma sayacı da geri alırdı
 * ve kod sınırsız denenebilirdi.
 */
export class VerifySignInCodeHandler implements Handler<VerifySignInCodeCommand, SignInCodeVerified, UseCaseContext> {
  private readonly unitOfWork: UnitOfWork;
  private readonly opaqueTokens: OpaqueTokens;
  private readonly clock: Clock;

  constructor({ unitOfWork, opaqueTokens, clock }: { unitOfWork: UnitOfWork; opaqueTokens: OpaqueTokens; clock: Clock }) {
    this.unitOfWork = unitOfWork;
    this.opaqueTokens = opaqueTokens;
    this.clock = clock;
  }

  async handle(
    { challengeId, code, rememberDevice, guestCartId }: VerifySignInCodeCommand,
    context: UseCaseContext = {}
  ): Promise<SignInCodeVerified> {
    if (!isUuid(challengeId)) throw new UnauthorizedError(GECERSIZ);
    // Boşluklu yapıştırma ("123 456") kabul ediliyor; geri kalan her şey rakam olmalı.
    const temiz = typeof code === "string" ? code.replace(/\s+/g, "") : "";
    const bicimDogru = new RegExp(`^\\d{${LOGIN_CODE_LENGTH}}$`).test(temiz);

    const sonuc = await this.unitOfWork.run<Sonuc>(async (repos) => {
      const challenge = await repos.loginChallenges.lock(challengeId);
      const now = this.clock.now();
      if (!challenge) return { durum: "gecersiz", mesaj: GECERSIZ };
      if (new Date(challenge.expiresAt) <= now || challenge.attempts >= LOGIN_CODE_MAX_ATTEMPTS) {
        await repos.loginChallenges.remove(challenge.id);
        return { durum: "gecersiz", mesaj: GECERSIZ };
      }

      if (!bicimDogru || loginCodeHash(this.opaqueTokens, challenge.id, temiz) !== challenge.codeHash) {
        const deneme = await repos.loginChallenges.recordFailure(challenge.id);
        const kalan = LOGIN_CODE_MAX_ATTEMPTS - deneme;
        if (kalan <= 0) {
          await repos.loginChallenges.remove(challenge.id);
          await repos.audit.record({
            actorId: challenge.userId,
            action: "user.login_code_locked",
            resourceType: "user",
            resourceId: challenge.userId,
            context
          });
          return { durum: "gecersiz", mesaj: "Çok fazla hatalı deneme. Güvenliğiniz için lütfen yeniden giriş yapın." };
        }
        return { durum: "yanlis", kalan };
      }

      // Doğru kod: tek kullanımlık, hemen siliniyor.
      await repos.loginChallenges.remove(challenge.id);

      const user = await repos.users.findById(challenge.userId);
      if (!user) return { durum: "gecersiz", mesaj: GECERSIZ };
      if (user.status === UserStatus.SUSPENDED) {
        throw new ForbiddenError("Hesabınız askıya alınmış. Destek ekibiyle iletişime geçin.");
      }

      const signedIn = await finishSignIn(repos, {
        user: { id: String(user.id), email: String(user.email), fullName: String(user.fullName) },
        guestCartId,
        opaqueTokens: this.opaqueTokens,
        clock: this.clock,
        context,
        method: "kod"
      });

      let trustedDevice: SignInCodeVerified["trustedDevice"] = null;
      if (rememberDevice) {
        const token = this.opaqueTokens.generate();
        await repos.loginChallenges.trustDevice({
          userId: String(user.id),
          tokenHash: this.opaqueTokens.hash(token),
          expiresAt: new Date(now.getTime() + TRUSTED_DEVICE_TTL_MS)
        });
        trustedDevice = { token, maxAgeSeconds: Math.floor(TRUSTED_DEVICE_TTL_MS / 1000) };
      }

      return { durum: "tamam", sonuc: { ...signedIn, trustedDevice } };
    });

    if (sonuc.durum === "yanlis") {
      throw new UnauthorizedError(`Kod hatalı. ${sonuc.kalan} deneme hakkınız kaldı.`);
    }
    if (sonuc.durum === "gecersiz") throw new UnauthorizedError(sonuc.mesaj);
    return sonuc.sonuc;
  }
}
