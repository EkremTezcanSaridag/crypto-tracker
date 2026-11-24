# Crypto Tracker

Ücretsiz ve API anahtarı gerektirmeyen **CoinGecko Public API v3** kullanılarak saf **HTML, CSS ve JavaScript** ile geliştirilmiş canlı kripto para takip web uygulaması.

## Özellikler

- **Canlı Piyasa Verileri:** Piyasa değerine göre ilk 25 kripto paranın anlık fiyatı, 24 saatlik değişim oranı, işlem hacmi ve piyasa değeri.
- **Para Birimi Seçimi:** Tek tıkla **USD ($)**, **TRY (₺)** ve **EUR (€)** arasında geçiş.
- **7 Günlük Mini Trend Grafiği:** Her coin için harici kütüphane kullanmadan çizilen saf SVG grafik.
- **Arama ve Sıralama:** İsim/sembole göre anlık arama; piyasa değeri, fiyat veya 24 saatlik değişime göre sıralama.
- **Favoriler (`localStorage`):** Seçilen coinleri yıldızlayıp tarayıcıda kalıcı olarak saklama.
- **Detay Penceresi & Hızlı Hesaplayıcı:** Herhangi bir coine tıklayarak 24s en yüksek/düşük, ATH ve anlık tutar dönüştürücüye erişim.
- **Akıllı Önbellek:** 60 saniyelik `localStorage` önbelleği sayesinde ücretsiz API limitine takılmadan akıcı kullanım.

## Kullanılan API

- **API Adı:** [CoinGecko Public API v3](https://www.coingecko.com/en/api)
- **Ücret / Anahtar Durumu:** Tamamen **ücretsizdir**, kayıt veya API anahtarı (API key) gerektirmez ve tarayıcıdan doğrudan CORS destekli çalışır.
- **Kullanılan Endpoint:**
  ```text
  GET https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=25&page=1&sparkline=true&price_change_percentage=24h
  ```

## Proje Yapısı

```text
crypto-tracker/
├── index.html   # Uygulama iskeleti ve detay modalı
├── style.css    # Responsive karanlık tema tasarımı
├── app.js       # Fetch API istekleri, önbellek, filtreleme ve SVG grafik
└── README.md    # Proje dokümantasyonu
```

## Çalıştırma

Herhangi bir kurulum veya paket yüklemesi gerektirmez:

1. Repoyu bilgisayarına indir veya klonla:
   ```bash
   git clone https://github.com/EkremTezcanSaridag/crypto-tracker.git
   ```
2. `index.html` dosyasını tarayıcıda aç.

### GitHub Pages ile Canlı Yayınlama

1. GitHub reposunda **Settings → Pages** menüsüne gir.
2. **Source** bölümünde `Deploy from a branch` seç, branch olarak `main` ve klasör olarak `/ (root)` seçip **Save** butonuna bas.
3. Birkaç dakika içinde uygulama şu adreste yayında olur:
   `https://ekremtezcansaridag.github.io/crypto-tracker/`

## Atıf

Piyasa verileri [CoinGecko](https://www.coingecko.com/) ücretsiz genel API'si tarafından sağlanmaktadır.
