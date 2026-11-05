-- Frontend yeniden düzenlendi: resimler OKUL/<bolum>resim/ yerine
-- /assets/images/<bolum>/ altında ve ASCII dosya adlarıyla duruyor.
-- Veritabanındaki ürünlerin eski göreli resim yollarını yenileriyle değiştirir.
-- Tam URL (https://...) veya tabloda olmayan yollara dokunulmaz.

UPDATE products AS p
SET image = m.new_path
FROM (VALUES
  ('anasyafresim/1.png', '/assets/images/anasayfa/1.png'),
  ('anasyafresim/2.webp', '/assets/images/anasayfa/2.webp'),
  ('anasyafresim/3.webp', '/assets/images/anasayfa/3.webp'),
  ('anasyafresim/Intel_i9-14900KF_CPU.jpg', '/assets/images/anasayfa/intel-i9-14900kf-cpu.jpg'),
  ('anasyafresim/anaresim.jpg', '/assets/images/anasayfa/anaresim.jpg'),
  ('anasyafresim/asus-proart-geforce-rtx-4060-8gb-gddr6-128-bit-dlss-3-ekran-karti-y.jpg', '/assets/images/anasayfa/asus-proart-geforce-rtx-4060-8gb-gddr6-128-bit-dlss-3-ekran-karti-y.jpg'),
  ('anasyafresim/bg.png', '/assets/images/shared/bg.png'),
  ('anasyafresim/internet-nedir-1536x968.jpg', '/assets/images/anasayfa/internet-nedir-1536x968.jpg'),
  ('anasyafresim/msi-h510m-pro-e-ddr4-1200-pin-micro-at-d73730.jpg', '/assets/images/anasayfa/msi-h510m-pro-e-ddr4-1200-pin-micro-at-d73730.jpg'),
  ('anasyafresim/msi.jpg', '/assets/images/anasayfa/msi.jpg'),
  ('anasyafresim/nasıl.jpg', '/assets/images/anasayfa/nasil.jpg'),
  ('hakkımızdaresim/Hakkimizdaslider1.jpg', '/assets/images/hakkimizda/hakkimizdaslider1.jpg'),
  ('hakkımızdaresim/Hakkimizdaslider2.jpg', '/assets/images/hakkimizda/hakkimizdaslider2.jpg'),
  ('hakkımızdaresim/Hakkimizdaslider3.jpg', '/assets/images/hakkimizda/hakkimizdaslider3.jpg'),
  ('hakkımızdaresim/biz kimiz.png', '/assets/images/hakkimizda/biz-kimiz.png'),
  ('markalarresim/Gigabyte.webp', '/assets/images/markalar/gigabyte.webp'),
  ('markalarresim/Logitech.jpg', '/assets/images/markalar/logitech.jpg'),
  ('markalarresim/asus.jpg', '/assets/images/markalar/asus.jpg'),
  ('markalarresim/intel.png', '/assets/images/markalar/intel.png'),
  ('markalarresim/markalarresim1.jpg', '/assets/images/markalar/markalarresim1.jpg'),
  ('markalarresim/markalarresim2.jpg', '/assets/images/markalar/markalarresim2.jpg'),
  ('markalarresim/markalarresim3.jpg', '/assets/images/markalar/markalarresim3.jpg'),
  ('markalarresim/markalarresim4.jpg', '/assets/images/markalar/markalarresim4.jpg'),
  ('markalarresim/msi.png', '/assets/images/markalar/msi.png'),
  ('markalarresim/philips.png', '/assets/images/markalar/philips.png'),
  ('markalarresim/razer.png', '/assets/images/markalar/razer.png'),
  ('markalarresim/samsung.avif', '/assets/images/markalar/samsung.avif'),
  ('ürünlerresim/asusdual.jpg', '/assets/images/urunler/asusdual.jpg'),
  ('ürünlerresim/ekrankart.png', '/assets/images/urunler/ekrankart.png'),
  ('ürünlerresim/ekrankartıcard.png', '/assets/images/urunler/ekrankarticard.png'),
  ('ürünlerresim/klavye.png', '/assets/images/urunler/klavye.png'),
  ('ürünlerresim/klavyecard.png', '/assets/images/urunler/klavyecard.png'),
  ('ürünlerresim/laptop.jpg', '/assets/images/urunler/laptop.jpg'),
  ('ürünlerresim/laptopcard.png', '/assets/images/urunler/laptopcard.png'),
  ('ürünlerresim/mausecard.png', '/assets/images/urunler/mausecard.png'),
  ('ürünlerresim/ssd.png', '/assets/images/urunler/ssd.png'),
  ('ürünlerresim/xboxkolmavi.jpg', '/assets/images/urunler/xboxkolmavi.jpg'),
  ('ürünlerresim/ürün1.jpg/excalibur monitör 27.jpg', '/assets/images/urunler/katalog/excalibur-monitor-27.jpg'),
  ('ürünlerresim/ürün1.jpg/i7 11700kf.jpg', '/assets/images/urunler/katalog/i7-11700kf.jpg'),
  ('ürünlerresim/ürün1.jpg/lgmonitör.jpg', '/assets/images/urunler/katalog/lgmonitor.jpg'),
  ('ürünlerresim/ürün1.jpg/probook.webp', '/assets/images/urunler/katalog/probook.webp'),
  ('ürünlerresim/ürün1.jpg/razerkrakenv3.jpg', '/assets/images/urunler/katalog/razerkrakenv3.jpg'),
  ('ürünlerresim/ürün1.jpg/rival.png', '/assets/images/urunler/katalog/rival.png'),
  ('ürünlerresim/ürünlerslider1.jpg', '/assets/images/urunler/urunlerslider1.jpg'),
  ('ürünlerresim/ürünlerslider2.jpg', '/assets/images/urunler/urunlerslider2.jpg'),
  ('ürünlerresim/ürünlerslider3.jpg', '/assets/images/urunler/urunlerslider3.jpg'),
  ('ürünlerresim/ürünlerslider4.jpg', '/assets/images/urunler/urunlerslider4.jpg')
) AS m(old_path, new_path)
WHERE p.image IN (m.old_path, '/' || m.old_path, './' || m.old_path);
