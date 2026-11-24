# Crypto Tracker

Ücretsiz ve API anahtarı gerektirmeyen **CoinGecko Public API v3** kullanılarak saf **HTML, CSS ve JavaScript** ile geliştirilmiş canlı kripto para takip web uygulaması.

## Özellikler

- **Canlı Otomatik Güncelleme:** 60 saniyelik geri sayım ile yeni verileri otomatik çeker; fiyatı artan veya düşen coinleri anlık yeşil/kırmızı vurgular (istenirse duraklatılabilir).
- **1 Saatlik ve 24 Saatlik Değişimler:** Piyasa değerine göre ilk 25 kripto paranın anlık fiyatı, 1s ve 24s değişim oranı, işlem hacmi ve piyasa değeri.
- **Para Birimi Seçimi:** Tek tıkla **USD ($)**, **TRY (₺)** ve **EUR (€)** arasında geçiş.
- **7 Günlük Mini Trend Grafiği:** Her coin için harici kütüphane kullanmadan çizilen saf SVG grafik.
- **Arama, Sıralama ve Favoriler:** İsim/sembole göre anlık arama, çoklu sıralama ve `localStorage` ile kalıcı favori listesi.
- **Detay Penceresi & Hızlı Hesaplayıcı:** Herhangi bir coine tıklayarak 24s en yüksek/düşük, ATH ve anlık tutar dönüştürücüye erişim.
- **Site İçi Proje Açıklaması:** Uygulamanın ne yaptığını, API akışını ve kullanılan endpoint'i doğrudan sayfa üzerinde özetleyen dokümantasyon bölümü.

## Kullanılan API

- **API Adı:** [CoinGecko Public API v3](https://www.coingecko.com/en/api)
- **Ücret / Anahtar Durumu:** Tamamen **ücretsizdir**, kayıt veya API anahtarı (API key) gerektirmez ve tarayıcıdan doğrudan CORS destekli çalışır.
- **Kullanılan Endpoint:**
  ```text
  GET https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=25&page=1&sparkline=true&price_change_percentage=1h,24h
  ```

## Proje Yapısı

```text
crypto-tracker/
├── index.html   # Uygulama iskeleti, detay modalı ve "Proje Hakkında" bölümü
├── style.css    # Responsive karanlık tema ve canlı fiyat vurgu animasyonları
├── app.js       # Fetch API istekleri, otomatik 60sn yenileme, önbellek ve SVG grafik
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
