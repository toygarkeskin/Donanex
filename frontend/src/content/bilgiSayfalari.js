/*
 * Bilgilendirme sayfalarının metinleri.
 *
 * Dokuz sayfa için dokuz Vue görünümü yazılmadı: hepsinin yaptığı iş aynı
 * (başlık + paragraflar + listeler çizmek), değişen yalnızca metin. Metin
 * veriye alınınca tek bir BilgiView bunların hepsini çiziyor; yeni bir
 * sayfa eklemek buraya bir kayıt ve rotaya bir satır demek.
 *
 * ADRESLER AYRI AYRI YAZILI (/kvkk, /hakkimizda ...), tek bir
 * "/bilgi/:slug" deseni kullanılmadı: kullanıcı ve arama motoru için
 * "/kvkk" ile "/bilgi/kvkk" arasında okunabilirlik farkı var.
 *
 * YASAL METİNLER ÖRNEKTİR. Bu bir okul/demo projesi; buradaki KVKK,
 * gizlilik ve mesafeli satış metinleri gerçek bir hukuk metni değil,
 * yapının nasıl durduğunu gösteren şablonlardır. Sayfalar bunu kendi
 * üstünde de yazıyor (ornekMetin alanı), çünkü hukuki metin gibi görünen
 * bir sayfanın gerçek sanılması kullanıcıyı yanıltır.
 */

/** Sayfalarda geçen tek kaynak: değişince her sayfada değişsin. */
export const ILETISIM = {
  telefon: "0850 000 00 00",
  eposta: "destek@donanex.test",
  calismaSaatleri: "Hafta içi 09:00 – 18:00",
  unvan: "Donanex Teknoloji Pazaryeri (demo)",
  adres: "Örnek Mah. Örnek Cad. No: 1, İstanbul"
};

export const BILGI_SAYFALARI = {
  hakkimizda: {
    baslik: "Hakkımızda",
    aciklama: "Donanex nedir, nasıl çalışır ve kimler satış yapar.",
    bolumler: [
      {
        paragraflar: [
          "Donanex çok satıcılı bir teknoloji pazaryeridir. Ürünleri Donanex satmaz; birbirinden bağımsız mağazalar kendi ürünlerini kendi stoklarıyla listeler. Donanex bu mağazaları tek bir vitrinde, tek bir sepette ve tek bir ödemede buluşturur."
        ]
      },
      {
        baslik: "Tek sepet ne demek",
        paragraflar: [
          "Farklı mağazalardan aldığınız ürünler aynı sepete girer ve tek seferde ödenir. Ödeme sonrasında sipariş, mağaza sayısı kadar pakete bölünür. Her paketi hazırlayan, kargoya veren ve teslim eden kendi mağazasıdır; bu yüzden paketler ayrı ayrı yola çıkabilir ve ayrı ayrı takip edilir."
        ]
      },
      {
        baslik: "Mağaza olmak",
        paragraflar: [
          "Mağaza başvurusu hesabınızdaki başvuru formundan yapılır. Başvuru onaylandığında mağazanıza ait bir panel açılır: ürünlerinizi, stoklarınızı, siparişlerinizi ve çalışanlarınızı oradan yönetirsiniz."
        ]
      },
      {
        baslik: "Bu bir demo ortamıdır",
        paragraflar: [
          "Donanex bir bitirme/portföy projesidir. Ürünler, mağazalar ve müşteriler örnek veridir. Ödeme adımı benzetimdir: kart bilgisi istenmez, gerçek para hareketi olmaz. Giden e-postalar gerçek adreslere değil, geliştirme ortamındaki e-posta kutusuna düşer."
        ]
      }
    ]
  },

  kvkk: {
    baslik: "KVKK Aydınlatma Metni",
    aciklama: "Kişisel verilerinizin hangi amaçla işlendiği ve haklarınız.",
    ornekMetin: true,
    bolumler: [
      {
        baslik: "Veri sorumlusu",
        paragraflar: [
          `${ILETISIM.unvan}, 6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında veri sorumlusudur. İletişim: ${ILETISIM.eposta}`
        ]
      },
      {
        baslik: "İşlenen veriler",
        liste: [
          "Kimlik ve iletişim: ad soyad, e-posta adresi, telefon numarası",
          "Teslimat: adres başlığı, açık adres, il ve ilçe",
          "Sipariş: sipariş içeriği, tutar, sipariş ve paket durumları",
          "İşlem güvenliği: oturum kayıtları, isteklerin zaman damgaları"
        ]
      },
      {
        baslik: "İşleme amaçları",
        liste: [
          "Siparişin oluşturulması, mağazalara iletilmesi ve teslimi",
          "Hesabınızın oluşturulması ve oturumunuzun güvenliği",
          "Sipariş ve hesap durumuyla ilgili bilgilendirmelerin gönderilmesi",
          "Destek taleplerinin yanıtlanması",
          "Yasal saklama ve bilgi verme yükümlülüklerinin yerine getirilmesi"
        ]
      },
      {
        baslik: "Aktarım",
        paragraflar: [
          "Siparişinizin ilgili kalemleri, o ürünü satan mağazaya teslimi gerçekleştirebilmesi için aktarılır. Bunun dışında kişisel veriniz, yasal bir yükümlülük olmadıkça üçüncü kişilerle paylaşılmaz. Bu demo ortamında ödeme ve kargo entegrasyonu bulunmadığı için bu alanlarda aktarım yapılmaz."
        ]
      },
      {
        baslik: "Saklama süresi",
        paragraflar: [
          "Veriler, işleme amacı ortadan kalktıktan sonra ilgili mevzuatın öngördüğü süre kadar saklanır, sonrasında silinir veya anonim hâle getirilir."
        ]
      },
      {
        baslik: "Haklarınız",
        paragraflar: [
          "Kanunun 11. maddesi uyarınca verilerinizin işlenip işlenmediğini öğrenme, işlenmişse bilgi talep etme, düzeltilmesini veya silinmesini isteme ve işlemeye itiraz etme haklarına sahipsiniz. Taleplerinizi yukarıdaki e-posta adresine iletebilirsiniz."
        ]
      }
    ]
  },

  gizlilik: {
    baslik: "Gizlilik Politikası",
    aciklama: "Verilerinizi nasıl topluyor, kullanıyor ve koruyoruz.",
    ornekMetin: true,
    bolumler: [
      {
        baslik: "Ne topluyoruz",
        paragraflar: [
          "Yalnızca hizmetin çalışması için gereken veriyi topluyoruz: hesabınızı oluşturmak için e-posta adresi, siparişi teslim etmek için adres ve iletişim bilgisi, güvenlik için oturum kayıtları."
        ]
      },
      {
        baslik: "Parolanız",
        paragraflar: [
          "Parolanız hiçbir yerde okunabilir hâlde tutulmaz. Yalnızca geri döndürülemeyen bir özeti saklanır; parolanızı sıfırlarken bile eski parolanız görülemez. Oturum jetonları da aynı şekilde özetlenerek saklanır."
        ]
      },
      {
        baslik: "Çerezler ve tarayıcı belleği",
        paragraflar: [
          "Oturumunuzun açık kalması için bir adet HttpOnly çerez kullanılır; bu çerez JavaScript tarafından okunamaz. Tema seçiminiz gibi tercihleriniz tarayıcınızın kendi belleğinde kalır, sunucuya gönderilmez. Reklam veya takip çerezi kullanılmaz."
        ]
      },
      {
        baslik: "Üçüncü taraflar",
        paragraflar: [
          "Bu demo ortamında reklam ağı, analitik hizmeti veya sosyal medya takip kodu bulunmaz. Sayfa açıldığında tarayıcınız yalnızca Donanex'in kendi sunucusuna istek yapar."
        ]
      }
    ]
  },

  "cerez-politikasi": {
    baslik: "Çerez Politikası",
    aciklama: "Hangi çerezleri neden kullanıyoruz.",
    ornekMetin: true,
    bolumler: [
      {
        paragraflar: [
          "Çerez, bir siteyi açtığınızda tarayıcınıza kaydedilen küçük bir veri parçasıdır. Donanex yalnızca hizmetin çalışması için zorunlu olan çerezleri kullanır; bu yüzden karşınıza çerez onayı penceresi çıkmaz."
        ]
      },
      {
        baslik: "Zorunlu çerez",
        liste: [
          "Oturum yenileme çerezi: giriş yaptığınızda yazılır, uygulamayı kapatıp açtığınızda oturumunuzun açık kalmasını sağlar. HttpOnly ve SameSite işaretlidir, JavaScript tarafından okunamaz."
        ]
      },
      {
        baslik: "Çerez olmayan saklama",
        liste: [
          "Tema tercihi (açık/koyu) tarayıcınızın yerel belleğinde durur.",
          "Sepetiniz sunucuda hesabınıza bağlı olarak tutulur."
        ]
      },
      {
        baslik: "Kullanılmayanlar",
        paragraflar: [
          "Reklam, yeniden hedefleme ve üçüncü taraf analitik çerezi kullanılmaz."
        ]
      }
    ]
  },

  "mesafeli-satis": {
    baslik: "Mesafeli Satış Sözleşmesi",
    aciklama: "Siparişin tarafları, konusu ve cayma hakkı.",
    ornekMetin: true,
    bolumler: [
      {
        baslik: "Taraflar",
        paragraflar: [
          "Bu sözleşme, siparişi veren alıcı ile ürünü satan mağaza arasında kurulur. Donanex, satıcı değil aracı hizmet sağlayıcıdır: ürünü listeleyen, stoğundan ayıran, faturalandıran ve teslim eden taraf ilgili mağazadır."
        ]
      },
      {
        baslik: "Sözleşmenin konusu",
        paragraflar: [
          "Sipariş özetinde yer alan ürünler, adetleri ve toplam tutar sözleşmenin konusunu oluşturur. Sipariş birden çok mağazadan ürün içeriyorsa, her mağaza için ayrı bir satış ilişkisi kurulur ve paketler ayrı teslim edilebilir."
        ]
      },
      {
        baslik: "Cayma hakkı",
        paragraflar: [
          "Alıcı, teslim tarihinden itibaren 14 gün içinde gerekçe göstermeksizin cayma hakkını kullanabilir. Cayma bildirimi destek üzerinden iletilir. Ürünün kutusunun, aksesuarlarının ve varsa hediyelerinin eksiksiz iade edilmesi gerekir."
        ]
      },
      {
        baslik: "Cayma hakkının kullanılamadığı hâller",
        liste: [
          "Tek kullanımlık veya hijyen açısından iadeye uygun olmayan ürünler",
          "Dijital içerik ve kullanıma açılmış yazılım lisansları",
          "Alıcının isteğine göre özel olarak hazırlanmış ürünler"
        ]
      },
      {
        baslik: "Bu ortamda geçerliliği",
        paragraflar: [
          "Donanex bir demo ortamıdır; gerçek bir satış gerçekleşmez, ödeme benzetimdir ve bu metin örnek niteliğindedir."
        ]
      }
    ]
  },

  "iptal-iade": {
    baslik: "İptal ve İade Koşulları",
    aciklama: "Siparişi nasıl iptal edersiniz, iade nasıl işler.",
    ornekMetin: true,
    bolumler: [
      {
        baslik: "Ödeme öncesi iptal",
        paragraflar: [
          "Ödemesi tamamlanmamış sipariş iptal edilebilir. İptal edildiğinde ürünler mağazaların stoğuna geri eklenir ve sipariş kapanır."
        ]
      },
      {
        baslik: "Hazırlanmaya başlanmış paket",
        paragraflar: [
          "Bir paket hazırlanmaya başlandıktan sonra iptal, o paketi hazırlayan mağazanın onayına bağlıdır. Kargoya verilmiş paket için iptal yerine iade süreci işler."
        ]
      },
      {
        baslik: "İade",
        liste: [
          "İade talebi destek üzerinden açılır, talep numarasıyla takip edilir.",
          "Ürün eksiksiz ve hasarsız olmalıdır.",
          "İade onaylandığında tutar, ödemenin yapıldığı yönteme geri verilir."
        ]
      },
      {
        baslik: "Hasarlı veya eksik teslim",
        paragraflar: [
          "Paketi teslim alırken hasar fark ederseniz kargo görevlisine tutanak tutturun ve destek talebi açın. Eksik ürün durumunda da aynı yolu izleyin; talebe fotoğraf eklemeniz süreci hızlandırır."
        ]
      }
    ]
  },

  garanti: {
    baslik: "Garanti Koşulları",
    aciklama: "Ürün garantisi kimde ve nasıl kullanılır.",
    ornekMetin: true,
    bolumler: [
      {
        paragraflar: [
          "Donanex'te listelenen ürünler, üretici ya da yetkili distribütör garantisi altındadır. Garanti süresi ve kapsamı ürünün kendi garanti belgesinde yazılıdır."
        ]
      },
      {
        baslik: "Garanti talebi",
        liste: [
          "Talebi, ürünü satın aldığınız mağaza üzerinden destek talebi açarak başlatın.",
          "Sipariş numaranızı ve ürünün seri numarasını belirtin.",
          "Arızayı mümkün olduğunca somut anlatın: ne zaman, hangi durumda ortaya çıkıyor."
        ]
      },
      {
        baslik: "Garanti dışı kalan durumlar",
        liste: [
          "Kullanıcı kaynaklı fiziksel hasar, sıvı teması ve aşırı voltaj",
          "Yetkisiz servis müdahalesi, garanti mührünün bozulması",
          "Ürünün kullanım kılavuzuna aykırı kullanılması"
        ]
      }
    ]
  },

  "odeme-guvenlik": {
    baslik: "Ödeme ve Güvenlik",
    aciklama: "Ödeme nasıl çalışıyor ve hesabınız nasıl korunuyor.",
    bolumler: [
      {
        baslik: "Ödeme bu ortamda benzetimdir",
        paragraflar: [
          "Donanex bir demo projesidir ve gerçek bir ödeme kuruluşuna bağlı değildir. Ödeme adımında kart numarası, son kullanma tarihi veya CVV istenmez; sipariş, benzetilmiş bir ödeme sonucuyla ilerler. Gerçek para hareketi olmaz."
        ]
      },
      {
        baslik: "Kart bilgisi istenmez",
        paragraflar: [
          "Hiçbir ekranda kart bilgisi talep edilmez. Size Donanex adına kart bilgisi soran bir e-posta, mesaj veya sayfa gelirse bu Donanex'ten gelmiyordur."
        ]
      },
      {
        baslik: "Hesabınızın güvenliği",
        liste: [
          "Parolanız geri döndürülemez biçimde özetlenerek saklanır, hiçbir yerde okunabilir durmaz.",
          "Oturum jetonu tarayıcı belleğinde tutulur, kalıcı diske yazılmaz.",
          "Oturumu açık tutan çerez HttpOnly'dir: sayfadaki JavaScript onu okuyamaz.",
          "Parolanızı değiştirdiğinizde diğer cihazlardaki oturumlar kapatılır ve bunu e-postayla bildiririz."
        ]
      },
      {
        baslik: "Şüpheli bir şey görürseniz",
        paragraflar: [
          `Hesabınızla ilgili beklemediğiniz bir e-posta aldıysanız parolanızı değiştirin ve ${ILETISIM.eposta} adresine yazın.`
        ]
      }
    ]
  },

  sss: {
    baslik: "Sıkça Sorulan Sorular",
    aciklama: "En çok sorulanlar ve kısa yanıtları.",
    bolumler: [
      {
        baslik: "Üye olmadan sipariş verebilir miyim?",
        paragraflar: [
          "Evet. Sepeti doldurup ödeme adımına geçtiğinizde e-posta ve teslimat bilgisi yeterlidir. Siparişinizi, size verilen sipariş numarası ve takip koduyla sipariş takibi sayfasından sorgularsınız."
        ]
      },
      {
        baslik: "Siparişim neden ayrı ayrı geliyor?",
        paragraflar: [
          "Sepetinizde birden çok mağazanın ürünü varsa sipariş mağaza başına paketlere bölünür. Her paketi kendi mağazası hazırlar ve kargoya verir; bu yüzden paketler farklı günlerde elinize geçebilir."
        ]
      },
      {
        baslik: "Siparişimi nasıl takip ederim?",
        paragraflar: [
          "Hesabınız varsa Hesabım > Siparişlerim bölümünden. Üye olmadan sipariş verdiyseniz sipariş takibi sayfasından sipariş numarası ve takip kodunuzla."
        ]
      },
      {
        baslik: "Hangi durumlarda e-posta alıyorum?",
        paragraflar: [
          "Hesap doğrulama, parola sıfırlama ve parola değişikliğinde; sipariş alındığında, ödeme sonucunda ve her paketin durumu değiştiğinde (hazırlanıyor, kargoya verildi, teslim edildi, iptal edildi)."
        ]
      },
      {
        baslik: "E-posta gelmedi, ne yapmalıyım?",
        paragraflar: [
          "Bu bir demo ortamıdır: giden e-postalar gerçek adreslere gönderilmez, geliştirme ortamındaki e-posta kutusuna düşer. Gerçek bir kuruluma geçildiğinde bu e-postalar normal şekilde iletilir."
        ]
      },
      {
        baslik: "Mağaza nasıl açarım?",
        paragraflar: [
          "Giriş yaptıktan sonra Hesabım > Mağaza başvurusu formunu doldurun. Başvuru onaylandığında mağaza paneliniz açılır."
        ]
      },
      {
        baslik: "Ürün stokta yazıyor ama sipariş geçmedi",
        paragraflar: [
          "Stok, ödeme anında ayrılır. Aynı ürünü aynı anda birden çok kişi alıyorsa son adet başkasına gitmiş olabilir. Bu durumda sipariş oluşmaz ve sepetinizde bir uyarı görürsünüz."
        ]
      }
    ]
  }
};

/** Rota tanımı ve footer bu listeden besleniyor: başlıklar tek yerde. */
export const BILGI_ROTALARI = [
  { yol: "hakkimizda", ad: "info-about", anahtar: "hakkimizda" },
  { yol: "kvkk", ad: "info-kvkk", anahtar: "kvkk" },
  { yol: "gizlilik", ad: "info-privacy", anahtar: "gizlilik" },
  { yol: "cerez-politikasi", ad: "info-cookies", anahtar: "cerez-politikasi" },
  { yol: "mesafeli-satis", ad: "info-distance-sales", anahtar: "mesafeli-satis" },
  { yol: "iptal-iade", ad: "info-returns", anahtar: "iptal-iade" },
  { yol: "garanti", ad: "info-warranty", anahtar: "garanti" },
  { yol: "odeme-guvenlik", ad: "info-payment-security", anahtar: "odeme-guvenlik" },
  { yol: "sss", ad: "info-faq", anahtar: "sss" }
];
