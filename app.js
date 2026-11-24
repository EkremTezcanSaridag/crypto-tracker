/* ==========================================================================
   Crypto Tracker — CoinGecko Public API v3 (Ücretsiz & API Anahtarsız)
   ========================================================================== */

const API_BASE_URL = "https://api.coingecko.com/api/v3/coins/markets";
const COIN_COUNT = 25;
const AUTO_REFRESH_SECONDS = 60; // Ücretsiz API güncelleme ve limit döngüsüyle uyumlu
const CACHE_TTL_MS = 55 * 1000;  // 55 saniye önbellek
const FAVORITES_STORAGE_KEY = "crypto_tracker_favorites";
const PREFERRED_CHART_IDS = ["bitcoin", "ethereum", "solana", "binancecoin"];
const STABLECOIN_IDS = new Set([
  "tether",
  "usd-coin",
  "usds",
  "dai",
  "first-digital-usd",
  "ethena-usde",
  "true-usd",
  "paypal-usd",
]);

// Uygulama durumu (State)
const state = {
  currency: "usd",
  coins: [],
  previousPrices: {},   // Aynı para birimindeki bir önceki fiyatlar (anlık değişim vurgusu için)
  priceFlashMap: {},    // { [coinId]: "flash-up" | "flash-down" }
  chartRange: "7d",     // Öne çıkan grafik kartları zaman aralığı ("24h" | "7d")
  modalChartRange: "7d",// Modal büyük grafiği zaman aralığı ("24h" | "7d")
  searchQuery: "",
  sortBy: "rank",
  onlyFavorites: false,
  favorites: loadFavorites(),
  selectedCoin: null,
  isLoading: false,
  autoRefreshEnabled: true,
  countdown: AUTO_REFRESH_SECONDS,
};

// DOM Referansları
const elements = {
  autoRefreshToggle: document.getElementById("autoRefreshToggle"),
  autoRefreshLabel: document.getElementById("autoRefreshLabel"),
  currencyButtons: document.querySelectorAll(".currency-btn"),
  rangeButtons: document.querySelectorAll(".range-btn"),
  modalRangeButtons: document.querySelectorAll(".modal-range-btn"),
  chartCardsGrid: document.getElementById("chartCardsGrid"),
  refreshBtn: document.getElementById("refreshBtn"),
  statusBanner: document.getElementById("statusBanner"),
  totalMarketCap: document.getElementById("totalMarketCap"),
  marketCapSub: document.getElementById("marketCapSub"),
  topGainer: document.getElementById("topGainer"),
  topGainerSub: document.getElementById("topGainerSub"),
  topLoser: document.getElementById("topLoser"),
  topLoserSub: document.getElementById("topLoserSub"),
  lastUpdated: document.getElementById("lastUpdated"),
  dataSourceLabel: document.getElementById("dataSourceLabel"),
  searchInput: document.getElementById("searchInput"),
  favoritesFilterBtn: document.getElementById("favoritesFilterBtn"),
  favCount: document.getElementById("favCount"),
  sortSelect: document.getElementById("sortSelect"),
  tableBody: document.getElementById("cryptoTableBody"),
  emptyState: document.getElementById("emptyState"),
  emptyStateMessage: document.getElementById("emptyStateMessage"),
  retryBtn: document.getElementById("retryBtn"),
  modal: document.getElementById("coinModal"),
  closeModalBtn: document.getElementById("closeModalBtn"),
  modalLogo: document.getElementById("modalLogo"),
  modalTitle: document.getElementById("modalTitle"),
  modalSymbol: document.getElementById("modalSymbol"),
  modalPrice: document.getElementById("modalPrice"),
  modalChange: document.getElementById("modalChange"),
  modalChange1h: document.getElementById("modalChange1h"),
  modalChartMeta: document.getElementById("modalChartMeta"),
  modalChartWrap: document.getElementById("modalChartWrap"),
  modalHigh24h: document.getElementById("modalHigh24h"),
  modalLow24h: document.getElementById("modalLow24h"),
  modalMarketCap: document.getElementById("modalMarketCap"),
  modalVolume: document.getElementById("modalVolume"),
  modalAth: document.getElementById("modalAth"),
  modalSupply: document.getElementById("modalSupply"),
  converterAmount: document.getElementById("converterAmount"),
  converterUnit: document.getElementById("converterUnit"),
  converterResult: document.getElementById("converterResult"),
  apiEndpointCode: document.getElementById("apiEndpointCode"),
  copyEndpointBtn: document.getElementById("copyEndpointBtn"),
};

/* ---------- Yardımcı Fonksiyonlar ---------- */

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeImageUrl(url) {
  return typeof url === "string" && url.startsWith("https://") ? url : "";
}

function getChange1h(coin) {
  return coin.price_change_percentage_1h_in_currency;
}

function getChange24h(coin) {
  return coin.price_change_percentage_24h_in_currency ?? coin.price_change_percentage_24h;
}

function formatPrice(value, currency) {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";

  let maxDigits = 2;
  if (value > 0 && value < 0.0001) maxDigits = 8;
  else if (value > 0 && value < 0.01) maxDigits = 6;
  else if (value > 0 && value < 1) maxDigits = 4;

  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: maxDigits,
  }).format(value);
}

function formatCompactCurrency(value, currency) {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: currency.toUpperCase(),
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(value);
}

function formatPercent(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2).replace(".", ",")}%`;
}

function renderChangeBadge(value, suffix = "") {
  const isNum = typeof value === "number" && !Number.isNaN(value);
  const badgeClass = !isNum ? "flat" : value > 0 ? "up" : value < 0 ? "down" : "flat";
  const arrow = !isNum ? "" : value > 0 ? "▲" : value < 0 ? "▼" : "";
  const text = `${arrow} ${formatPercent(value)}${suffix}`.trim();
  return `<span class="change-badge ${badgeClass}">${text}</span>`;
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/* ---------- LocalStorage (Favoriler & Önbellek) ---------- */

function loadFavorites() {
  try {
    const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function saveFavorites() {
  try {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify([...state.favorites]));
  } catch {
    // Tarayıcı depolama izni kapalıysa sessizce geç
  }
}

function getCacheKey(currency) {
  return `crypto_tracker_v2_cache_${currency}`;
}

function readCache(currency) {
  try {
    const raw = localStorage.getItem(getCacheKey(currency));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeCache(currency, data) {
  try {
    localStorage.setItem(
      getCacheKey(currency),
      JSON.stringify({ timestamp: Date.now(), data })
    );
  } catch {
    // Depolama doluysa yoksay
  }
}

/* ---------- Durum Mesajı & Yükleme Gösterimi ---------- */

function showBanner(message, type = "info") {
  elements.statusBanner.textContent = message;
  elements.statusBanner.className = `status-banner ${type}`;
}

function hideBanner() {
  elements.statusBanner.className = "status-banner hidden";
}

function renderSkeletonRows() {
  elements.emptyState.classList.add("hidden");
  elements.tableBody.innerHTML = Array.from({ length: 8 })
    .map(
      () => `
      <tr class="skeleton-row">
        <td><div class="skeleton-bar"></div></td>
        <td><div class="skeleton-bar"></div></td>
        <td><div class="skeleton-bar" style="width: 150px"></div></td>
        <td><div class="skeleton-bar"></div></td>
        <td class="hide-xs"><div class="skeleton-bar"></div></td>
        <td><div class="skeleton-bar"></div></td>
        <td class="hide-md"><div class="skeleton-bar"></div></td>
        <td class="hide-lg"><div class="skeleton-bar"></div></td>
        <td class="hide-sm"><div class="skeleton-bar"></div></td>
      </tr>
    `
    )
    .join("");
}

/* ---------- Otomatik Canlı Güncelleme Zamanlayıcısı ---------- */

function updateAutoRefreshUI() {
  elements.autoRefreshToggle.classList.toggle("active", state.autoRefreshEnabled);
  elements.autoRefreshToggle.setAttribute("aria-pressed", String(state.autoRefreshEnabled));
  elements.autoRefreshLabel.textContent = state.autoRefreshEnabled
    ? `Canlı · ${state.countdown}sn`
    : "Otomatik: Kapalı";
}

function startAutoRefreshTimer() {
  setInterval(() => {
    // Sekme arka plandaysa veya otomatik güncelleme kapalıysa sayacı beklet
    if (!state.autoRefreshEnabled || document.visibilityState === "hidden" || state.isLoading) {
      return;
    }

    state.countdown -= 1;
    if (state.countdown <= 0) {
      state.countdown = AUTO_REFRESH_SECONDS;
      updateAutoRefreshUI();
      fetchCryptoData({ forceRefresh: true, isAuto: true });
    } else {
      updateAutoRefreshUI();
    }
  }, 1000);
}

/* ---------- Fiyat Değişim Karşılaştırması (Anlık Vurgu) ---------- */

function computePriceFlashes(newCoins, currencyChanged) {
  const flashes = {};

  if (!currencyChanged) {
    newCoins.forEach((coin) => {
      const prev = state.previousPrices[coin.id];
      if (typeof prev === "number" && typeof coin.current_price === "number") {
        if (coin.current_price > prev) flashes[coin.id] = "flash-up";
        else if (coin.current_price < prev) flashes[coin.id] = "flash-down";
      }
    });
  }

  // Sonraki güncelleme için güncel fiyatları kaydet
  const nextPrices = {};
  newCoins.forEach((coin) => {
    if (typeof coin.current_price === "number") {
      nextPrices[coin.id] = coin.current_price;
    }
  });
  state.previousPrices = nextPrices;
  state.priceFlashMap = flashes;
}

/* ---------- CoinGecko API İsteği ---------- */

async function fetchCryptoData({ forceRefresh = false, currencyChanged = false, isAuto = false } = {}) {
  if (state.isLoading) return;

  const currency = state.currency;
  const cached = readCache(currency);
  const isFreshCache =
    cached && Array.isArray(cached.data) && Date.now() - cached.timestamp < CACHE_TTL_MS;

  // Önbellek tazeyse ve zorla yenileme istenmediyse API limitini koru
  if (isFreshCache && !forceRefresh) {
    computePriceFlashes(cached.data, true);
    state.coins = cached.data;
    state.countdown = AUTO_REFRESH_SECONDS;
    updateAutoRefreshUI();
    hideBanner();
    updateUI(cached.timestamp, "Önbellekten yüklendi (60sn)");
    return;
  }

  state.isLoading = true;
  elements.refreshBtn.disabled = true;
  elements.refreshBtn.classList.add("loading");
  if (state.coins.length === 0) {
    renderChartCardSkeletons();
    renderSkeletonRows();
  }

  const url =
    `${API_BASE_URL}?vs_currency=${encodeURIComponent(currency)}` +
    `&order=market_cap_desc&per_page=${COIN_COUNT}&page=1` +
    `&sparkline=true&price_change_percentage=1h,24h`;

  try {
    const response = await fetch(url);

    if (response.status === 429) {
      throw new Error("RATE_LIMIT");
    }
    if (!response.ok) {
      throw new Error(`HTTP_${response.status}`);
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      throw new Error("INVALID_DATA");
    }

    computePriceFlashes(data, currencyChanged);
    state.coins = data;
    writeCache(currency, data);
    hideBanner();
    updateUI(
      Date.now(),
      isAuto ? "Canlı otomatik güncellendi" : "CoinGecko Public API v3"
    );
  } catch (error) {
    // Hata durumunda elde eski önbellek varsa kullanıcıyı boş bırakma
    if (cached && Array.isArray(cached.data)) {
      state.coins = cached.data;
      state.priceFlashMap = {};
      const reason =
        error.message === "RATE_LIMIT"
          ? "CoinGecko ücretsiz kullanım limitine (429) ulaşıldı. Son kaydedilen veriler gösteriliyor; 1 dakika sonra otomatik güncellenecek."
          : "Canlı bağlantıda geçici sorun oluştu. Son kaydedilen veriler gösteriliyor.";
      showBanner(reason, "warning");
      updateUI(cached.timestamp, "Kayıtlı veri (çevrimdışı yedek)");
    } else {
      state.coins = [];
      elements.tableBody.innerHTML = "";
      if (elements.chartCardsGrid) elements.chartCardsGrid.innerHTML = "";
      const errText =
        error.message === "RATE_LIMIT"
          ? "CoinGecko ücretsiz istek limiti geçici olarak doldu. Lütfen 1 dakika bekleyip tekrar deneyin."
          : "Veriler alınamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.";
      showBanner(errText, "error");
      elements.emptyStateMessage.textContent = errText;
      elements.retryBtn.classList.remove("hidden");
      elements.emptyState.classList.remove("hidden");
    }
  } finally {
    state.isLoading = false;
    state.countdown = AUTO_REFRESH_SECONDS;
    updateAutoRefreshUI();
    elements.refreshBtn.disabled = false;
    elements.refreshBtn.classList.remove("loading");
  }
}

/* ---------- 7 Günlük Mini Grafik (Saf SVG) ---------- */

function createSparklineSvg(prices) {
  const validPrices = Array.isArray(prices)
    ? prices.filter((p) => typeof p === "number" && !Number.isNaN(p))
    : [];

  if (validPrices.length < 2) {
    return '<span class="range-text">—</span>';
  }

  const width = 108;
  const height = 32;
  const pad = 3;

  const min = Math.min(...validPrices);
  const max = Math.max(...validPrices);
  const span = max - min || 1;

  // Çok fazla nokta varsa performansı artırmak için seyrelt
  const step = Math.max(1, Math.floor(validPrices.length / 36));
  const sampled = validPrices.filter((_, i) => i % step === 0 || i === validPrices.length - 1);

  const points = sampled
    .map((price, idx) => {
      const x = pad + (idx / (sampled.length - 1)) * (width - pad * 2);
      const y = height - pad - ((price - min) / span) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const isUp = sampled[sampled.length - 1] >= sampled[0];
  const color = isUp ? "#22c55e" : "#ef4444";

  return `
    <svg class="sparkline" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true">
      <polyline
        fill="none"
        stroke="${color}"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        points="${points}"
      />
    </svg>
  `;
}

/* ---------- Arayüz Güncelleme ---------- */

function updateUI(updatedTimestamp, sourceText) {
  elements.lastUpdated.textContent = formatTime(updatedTimestamp);
  elements.dataSourceLabel.textContent = sourceText;
  elements.favCount.textContent = String(state.favorites.size);

  renderSummaryCards();
  renderChartCards();
  renderTable();

  // Modal açıksa güncellemede içeriğini de tazele
  if (state.selectedCoin) {
    const updatedCoin = state.coins.find((c) => c.id === state.selectedCoin.id);
    if (updatedCoin) openCoinModal(updatedCoin);
  }
}

function renderSummaryCards() {
  if (state.coins.length === 0) return;

  const totalCap = state.coins.reduce((sum, coin) => sum + (coin.market_cap || 0), 0);
  elements.totalMarketCap.textContent = formatCompactCurrency(totalCap, state.currency);
  elements.marketCapSub.textContent = `Listelenen ${state.coins.length} kripto para`;

  const withChange = state.coins.filter((c) => typeof getChange24h(c) === "number");

  if (withChange.length > 0) {
    const best = [...withChange].sort((a, b) => getChange24h(b) - getChange24h(a))[0];
    const worst = [...withChange].sort((a, b) => getChange24h(a) - getChange24h(b))[0];

    elements.topGainer.textContent = `${best.symbol.toUpperCase()} ${formatPercent(
      getChange24h(best)
    )}`;
    elements.topGainerSub.textContent = `${best.name} • ${formatPrice(
      best.current_price,
      state.currency
    )}`;

    elements.topLoser.textContent = `${worst.symbol.toUpperCase()} ${formatPercent(
      getChange24h(worst)
    )}`;
    elements.topLoserSub.textContent = `${worst.name} • ${formatPrice(
      worst.current_price,
      state.currency
    )}`;
  }
}

function getFilteredAndSortedCoins() {
  const query = state.searchQuery.trim().toLowerCase();

  const filtered = state.coins.filter((coin) => {
    if (state.onlyFavorites && !state.favorites.has(coin.id)) return false;
    if (!query) return true;
    return (
      coin.name.toLowerCase().includes(query) ||
      coin.symbol.toLowerCase().includes(query)
    );
  });

  const sorted = [...filtered];
  switch (state.sortBy) {
    case "price_desc":
      sorted.sort((a, b) => (b.current_price || 0) - (a.current_price || 0));
      break;
    case "price_asc":
      sorted.sort((a, b) => (a.current_price || 0) - (b.current_price || 0));
      break;
    case "change_1h_desc":
      sorted.sort(
        (a, b) => (getChange1h(b) ?? -Infinity) - (getChange1h(a) ?? -Infinity)
      );
      break;
    case "change_desc":
      sorted.sort(
        (a, b) => (getChange24h(b) ?? -Infinity) - (getChange24h(a) ?? -Infinity)
      );
      break;
    case "change_asc":
      sorted.sort(
        (a, b) => (getChange24h(a) ?? Infinity) - (getChange24h(b) ?? Infinity)
      );
      break;
    default:
      sorted.sort((a, b) => (a.market_cap_rank || 999) - (b.market_cap_rank || 999));
  }

  return sorted;
}

function renderTable() {
  const coins = getFilteredAndSortedCoins();

  if (coins.length === 0) {
    elements.tableBody.innerHTML = "";
    elements.retryBtn.classList.add("hidden");
    elements.emptyStateMessage.textContent = state.onlyFavorites
      ? "Henüz favori coin eklemediniz. Yıldız (★) simgesine tıklayarak favori ekleyebilirsiniz."
      : "Aramanızla eşleşen coin bulunamadı.";
    elements.emptyState.classList.remove("hidden");
    return;
  }

  elements.emptyState.classList.add("hidden");

  elements.tableBody.innerHTML = coins
    .map((coin) => {
      const isFav = state.favorites.has(coin.id);
      const sparkPrices = coin.sparkline_in_7d?.price || [];
      const flashClass = state.priceFlashMap[coin.id] || "";

      return `
        <tr data-coin-id="${escapeHtml(coin.id)}">
          <td class="col-fav">
            <button
              class="fav-btn ${isFav ? "is-fav" : ""}"
              type="button"
              data-fav-id="${escapeHtml(coin.id)}"
              aria-label="${escapeHtml(coin.name)} favorilere ekle veya çıkar"
              title="${isFav ? "Favorilerden çıkar" : "Favorilere ekle"}"
            >${isFav ? "★" : "☆"}</button>
          </td>
          <td class="col-rank">${coin.market_cap_rank ?? "—"}</td>
          <td>
            <div class="coin-cell">
              <img
                class="coin-logo"
                src="${escapeHtml(safeImageUrl(coin.image))}"
                alt="${escapeHtml(coin.name)} logosu"
                loading="lazy"
              />
              <div>
                <span class="coin-name">${escapeHtml(coin.name)}</span>
                <span class="coin-symbol">${escapeHtml(coin.symbol)}</span>
              </div>
            </div>
          </td>
          <td class="num price-cell ${flashClass}">${formatPrice(coin.current_price, state.currency)}</td>
          <td class="num hide-xs">${renderChangeBadge(getChange1h(coin))}</td>
          <td class="num">${renderChangeBadge(getChange24h(coin))}</td>
          <td class="num hide-md">${formatCompactCurrency(coin.market_cap, state.currency)}</td>
          <td class="num hide-lg">${formatCompactCurrency(coin.total_volume, state.currency)}</td>
          <td class="col-chart hide-sm">${createSparklineSvg(sparkPrices)}</td>
        </tr>
      `;
    })
    .join("");
}

/* ---------- İnteraktif Grafik Kartları (Saf SVG + Hover) ---------- */

function formatChartDate(timestamp) {
  return new Date(timestamp).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getChartSeries(coin, range) {
  const raw = coin.sparkline_in_7d?.price;
  const allPrices = Array.isArray(raw)
    ? raw.filter((p) => typeof p === "number" && !Number.isNaN(p))
    : [];

  if (allPrices.length < 2) {
    return null;
  }

  const prices =
    range === "24h" && allPrices.length > 25 ? allPrices.slice(-25) : allPrices;

  const endTime = coin.last_updated ? new Date(coin.last_updated).getTime() : Date.now();
  const safeEnd = Number.isNaN(endTime) ? Date.now() : endTime;
  const timestamps = prices.map(
    (_, idx) => safeEnd - (prices.length - 1 - idx) * 60 * 60 * 1000
  );

  const first = prices[0];
  const last = prices[prices.length - 1];
  const changePct = first > 0 ? ((last - first) / first) * 100 : 0;

  return {
    prices,
    timestamps,
    min: Math.min(...prices),
    max: Math.max(...prices),
    changePct,
  };
}

function mountInteractiveChart({ container, series, gradId, width = 320, height = 112, onHover, onLeave }) {
  if (!container) return;
  if (!series || series.prices.length < 2) {
    container.innerHTML = '<div class="range-text" style="padding: 28px 0; text-align: center;">Grafik verisi yok</div>';
    return;
  }

  const { prices, timestamps, min, max } = series;
  const padX = 6;
  const padTop = 10;
  const padBottom = 8;
  const plotW = width - padX * 2;
  const plotH = height - padTop - padBottom;
  const span = max - min || 1;

  const coords = prices.map((price, idx) => {
    const x = padX + (idx / (prices.length - 1)) * plotW;
    const y = padTop + plotH - ((price - min) / span) * plotH;
    return { x, y, price, ts: timestamps[idx] };
  });

  const linePath = coords
    .map((pt, i) => `${i === 0 ? "M" : "L"}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`)
    .join(" ");

  const firstPt = coords[0];
  const lastPt = coords[coords.length - 1];
  const baseY = (padTop + plotH).toFixed(1);
  const areaPath = `${linePath} L${lastPt.x.toFixed(1)},${baseY} L${firstPt.x.toFixed(1)},${baseY} Z`;

  const isUp = lastPt.price >= firstPt.price;
  const strokeColor = isUp ? "#22c55e" : "#ef4444";
  const midY = (padTop + plotH / 2).toFixed(1);

  container.innerHTML = `
    <svg class="interactive-chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Fiyat trend grafiği">
      <defs>
        <linearGradient id="${escapeHtml(gradId)}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${strokeColor}" stop-opacity="0.34" />
          <stop offset="100%" stop-color="${strokeColor}" stop-opacity="0.01" />
        </linearGradient>
      </defs>

      <line x1="${padX}" y1="${padTop}" x2="${width - padX}" y2="${padTop}" stroke="rgba(148,163,184,0.12)" stroke-dasharray="3 3" />
      <line x1="${padX}" y1="${midY}" x2="${width - padX}" y2="${midY}" stroke="rgba(148,163,184,0.12)" stroke-dasharray="3 3" />
      <line x1="${padX}" y1="${baseY}" x2="${width - padX}" y2="${baseY}" stroke="rgba(148,163,184,0.12)" stroke-dasharray="3 3" />

      <path d="${areaPath}" fill="url(#${escapeHtml(gradId)})" />
      <path d="${linePath}" fill="none" stroke="${strokeColor}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />

      <line class="chart-crosshair" x1="0" y1="${padTop}" x2="0" y2="${baseY}" stroke="rgba(226,232,240,0.4)" stroke-width="1" stroke-dasharray="3 3" opacity="0" />
      <circle class="chart-dot-ring" cx="0" cy="0" r="7" fill="${strokeColor}" opacity="0" />
      <circle class="chart-dot" cx="0" cy="0" r="3.6" fill="#ffffff" stroke="${strokeColor}" stroke-width="2" opacity="0" />
    </svg>
  `;

  const svg = container.querySelector("svg");
  const crosshair = svg.querySelector(".chart-crosshair");
  const dotRing = svg.querySelector(".chart-dot-ring");
  const dot = svg.querySelector(".chart-dot");

  function handlePointer(event) {
    const rect = svg.getBoundingClientRect();
    if (!rect.width) return;

    const relX = ((event.clientX - rect.left) / rect.width) * width;
    const clamped = Math.max(padX, Math.min(width - padX, relX));
    const ratio = (clamped - padX) / plotW;
    const idx = Math.round(ratio * (coords.length - 1));
    const pt = coords[idx];
    if (!pt) return;

    crosshair.setAttribute("x1", pt.x.toFixed(1));
    crosshair.setAttribute("x2", pt.x.toFixed(1));
    crosshair.setAttribute("opacity", "1");

    dotRing.setAttribute("cx", pt.x.toFixed(1));
    dotRing.setAttribute("cy", pt.y.toFixed(1));
    dotRing.setAttribute("opacity", "0.28");

    dot.setAttribute("cx", pt.x.toFixed(1));
    dot.setAttribute("cy", pt.y.toFixed(1));
    dot.setAttribute("opacity", "1");

    if (onHover) onHover(pt.price, pt.ts);
  }

  function handleLeave() {
    crosshair.setAttribute("opacity", "0");
    dotRing.setAttribute("opacity", "0");
    dot.setAttribute("opacity", "0");
    if (onLeave) onLeave();
  }

  svg.addEventListener("pointermove", handlePointer);
  svg.addEventListener("pointerdown", handlePointer);
  svg.addEventListener("pointerleave", handleLeave);
}

function getFeaturedChartCoins() {
  const picked = [];
  const usedIds = new Set();

  PREFERRED_CHART_IDS.forEach((id) => {
    const found = state.coins.find((c) => c.id === id);
    if (found) {
      picked.push(found);
      usedIds.add(found.id);
    }
  });

  // Eksik kalırsa sabit coin dışındaki en büyük coinlerle 4'e tamamla
  for (const coin of state.coins) {
    if (picked.length >= 4) break;
    if (!usedIds.has(coin.id) && !STABLECOIN_IDS.has(coin.id)) {
      picked.push(coin);
      usedIds.add(coin.id);
    }
  }

  return picked;
}

function renderChartCardSkeletons() {
  if (!elements.chartCardsGrid) return;
  elements.chartCardsGrid.innerHTML = Array.from({ length: 4 })
    .map(
      () => `
      <article class="chart-card chart-card-skeleton">
        <div class="skeleton-bar" style="width: 55%"></div>
        <div class="skeleton-bar" style="width: 42%; height: 22px"></div>
        <div class="skeleton-bar" style="width: 100%; height: 88px"></div>
        <div class="skeleton-bar" style="width: 75%"></div>
      </article>
    `
    )
    .join("");
}

function renderChartCards() {
  if (!elements.chartCardsGrid) return;
  const featured = getFeaturedChartCoins();

  if (featured.length === 0) {
    elements.chartCardsGrid.innerHTML = "";
    return;
  }

  elements.chartCardsGrid.innerHTML = "";
  const rangeText = state.chartRange === "24h" ? "24s" : "7g";

  featured.forEach((coin) => {
    const series = getChartSeries(coin, state.chartRange);
    const badgeVal =
      state.chartRange === "24h" && typeof getChange24h(coin) === "number"
        ? getChange24h(coin)
        : series?.changePct;

    const card = document.createElement("article");
    card.className = "chart-card";
    card.innerHTML = `
      <div class="chart-card-head" data-open-coin="${escapeHtml(coin.id)}" title="Detay ve hesaplayıcı için tıkla">
        <div class="chart-card-coin">
          <img src="${escapeHtml(safeImageUrl(coin.image))}" alt="${escapeHtml(coin.name)} logosu" loading="lazy" />
          <div>
            <div class="chart-card-name">${escapeHtml(coin.name)}</div>
            <span class="chart-card-sym">${escapeHtml(coin.symbol)}</span>
          </div>
        </div>
        ${renderChangeBadge(badgeVal)}
      </div>

      <div class="chart-card-price-block">
        <strong class="chart-card-price">${formatPrice(coin.current_price, state.currency)}</strong>
        <span class="chart-card-time">Canlı · ${rangeText}</span>
      </div>

      <div class="chart-svg-wrap"></div>

      <div class="chart-card-foot">
        <span>
          Min <strong>${formatPrice(series?.min, state.currency)}</strong> ·
          Max <strong>${formatPrice(series?.max, state.currency)}</strong>
        </span>
        <button class="chart-card-detail-btn" type="button" data-open-coin="${escapeHtml(coin.id)}">Detay →</button>
      </div>
    `;

    const priceEl = card.querySelector(".chart-card-price");
    const timeEl = card.querySelector(".chart-card-time");
    const svgWrap = card.querySelector(".chart-svg-wrap");

    mountInteractiveChart({
      container: svgWrap,
      series,
      gradId: `chartGrad-${coin.id}`,
      width: 320,
      height: 108,
      onHover: (price, ts) => {
        priceEl.textContent = formatPrice(price, state.currency);
        timeEl.textContent = formatChartDate(ts);
        timeEl.classList.add("is-hovering");
      },
      onLeave: () => {
        priceEl.textContent = formatPrice(coin.current_price, state.currency);
        timeEl.textContent = `Canlı · ${rangeText}`;
        timeEl.classList.remove("is-hovering");
      },
    });

    card.querySelectorAll("[data-open-coin]").forEach((el) => {
      el.addEventListener("click", () => {
        elements.converterAmount.value = "1";
        openCoinModal(coin);
      });
    });

    elements.chartCardsGrid.appendChild(card);
  });
}

function renderModalChart(coin) {
  if (!coin || !elements.modalChartWrap) return;
  const series = getChartSeries(coin, state.modalChartRange);
  const defaultMeta =
    state.modalChartRange === "24h"
      ? "Son 24 Saat Saatlik Trend"
      : "Son 7 Gün Saatlik Trend";

  elements.modalChartMeta.textContent = defaultMeta;
  elements.modalChartMeta.classList.remove("is-hovering");

  mountInteractiveChart({
    container: elements.modalChartWrap,
    series,
    gradId: "chartGrad-modal",
    width: 460,
    height: 132,
    onHover: (price, ts) => {
      elements.modalChartMeta.textContent = `${formatChartDate(ts)} · ${formatPrice(
        price,
        state.currency
      )}`;
      elements.modalChartMeta.classList.add("is-hovering");
    },
    onLeave: () => {
      elements.modalChartMeta.textContent = defaultMeta;
      elements.modalChartMeta.classList.remove("is-hovering");
    },
  });
}

/* ---------- Coin Detay Modalı & Hesaplayıcı ---------- */

function setBadgeElement(el, value, label) {
  const isNum = typeof value === "number" && !Number.isNaN(value);
  const badgeClass = !isNum ? "flat" : value > 0 ? "up" : value < 0 ? "down" : "flat";
  const arrow = !isNum ? "" : value > 0 ? "▲" : value < 0 ? "▼" : "";
  el.className = `change-badge ${badgeClass}`;
  el.textContent = `${arrow} ${formatPercent(value)} (${label})`.trim();
}

function openCoinModal(coin) {
  state.selectedCoin = coin;

  elements.modalLogo.src = safeImageUrl(coin.image);
  elements.modalLogo.alt = `${coin.name} logosu`;
  elements.modalTitle.textContent = coin.name;
  elements.modalSymbol.textContent = coin.symbol.toUpperCase();
  elements.modalPrice.textContent = formatPrice(coin.current_price, state.currency);

  setBadgeElement(elements.modalChange, getChange24h(coin), "24s");
  setBadgeElement(elements.modalChange1h, getChange1h(coin), "1s");

  elements.modalHigh24h.textContent = formatPrice(coin.high_24h, state.currency);
  elements.modalLow24h.textContent = formatPrice(coin.low_24h, state.currency);
  elements.modalMarketCap.textContent = formatCompactCurrency(coin.market_cap, state.currency);
  elements.modalVolume.textContent = formatCompactCurrency(coin.total_volume, state.currency);
  elements.modalAth.textContent = formatPrice(coin.ath, state.currency);
  elements.modalSupply.textContent = `${formatNumber(coin.circulating_supply)} ${coin.symbol.toUpperCase()}`;

  elements.converterUnit.textContent = coin.symbol.toUpperCase();
  updateConverterResult();
  renderModalChart(coin);

  elements.modal.classList.remove("hidden");
}

function closeCoinModal() {
  state.selectedCoin = null;
  elements.modal.classList.add("hidden");
}

function updateConverterResult() {
  if (!state.selectedCoin) return;
  const amount = parseFloat(elements.converterAmount.value);
  if (Number.isNaN(amount) || amount < 0) {
    elements.converterResult.textContent = "—";
    return;
  }
  const total = amount * (state.selectedCoin.current_price || 0);
  elements.converterResult.textContent = formatPrice(total, state.currency);
}

/* ---------- Olay Dinleyicileri (Event Listeners) ---------- */

elements.autoRefreshToggle.addEventListener("click", () => {
  state.autoRefreshEnabled = !state.autoRefreshEnabled;
  if (state.autoRefreshEnabled) {
    state.countdown = AUTO_REFRESH_SECONDS;
  }
  updateAutoRefreshUI();
});

elements.currencyButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const selected = btn.dataset.currency;
    if (!selected || selected === state.currency) return;

    state.currency = selected;
    state.previousPrices = {};
    state.priceFlashMap = {};
    elements.currencyButtons.forEach((b) =>
      b.classList.toggle("active", b.dataset.currency === selected)
    );
    fetchCryptoData({ currencyChanged: true });
  });
});

elements.rangeButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const selected = btn.dataset.range;
    if (!selected || selected === state.chartRange) return;

    state.chartRange = selected;
    elements.rangeButtons.forEach((b) =>
      b.classList.toggle("active", b.dataset.range === selected)
    );
    renderChartCards();
  });
});

elements.modalRangeButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const selected = btn.dataset.range;
    if (!selected || selected === state.modalChartRange) return;

    state.modalChartRange = selected;
    elements.modalRangeButtons.forEach((b) =>
      b.classList.toggle("active", b.dataset.range === selected)
    );
    if (state.selectedCoin) renderModalChart(state.selectedCoin);
  });
});

elements.refreshBtn.addEventListener("click", () => {
  fetchCryptoData({ forceRefresh: true });
});

elements.retryBtn.addEventListener("click", () => {
  fetchCryptoData({ forceRefresh: true });
});

elements.searchInput.addEventListener("input", (event) => {
  state.searchQuery = event.target.value;
  state.priceFlashMap = {};
  renderTable();
});

elements.sortSelect.addEventListener("change", (event) => {
  state.sortBy = event.target.value;
  state.priceFlashMap = {};
  renderTable();
});

elements.favoritesFilterBtn.addEventListener("click", () => {
  state.onlyFavorites = !state.onlyFavorites;
  state.priceFlashMap = {};
  elements.favoritesFilterBtn.classList.toggle("active", state.onlyFavorites);
  elements.favoritesFilterBtn.setAttribute("aria-pressed", String(state.onlyFavorites));
  renderTable();
});

// Tablo satırı veya favori yıldızı tıklaması (Event Delegation)
elements.tableBody.addEventListener("click", (event) => {
  const favBtn = event.target.closest(".fav-btn");
  if (favBtn) {
    event.stopPropagation();
    const id = favBtn.dataset.favId;
    if (state.favorites.has(id)) state.favorites.delete(id);
    else state.favorites.add(id);

    saveFavorites();
    elements.favCount.textContent = String(state.favorites.size);
    state.priceFlashMap = {};
    renderTable();
    return;
  }

  const row = event.target.closest("tr[data-coin-id]");
  if (!row) return;
  const coin = state.coins.find((c) => c.id === row.dataset.coinId);
  if (coin) {
    elements.converterAmount.value = "1";
    openCoinModal(coin);
  }
});

elements.closeModalBtn.addEventListener("click", closeCoinModal);

elements.modal.addEventListener("click", (event) => {
  if (event.target === elements.modal) closeCoinModal();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.selectedCoin) {
    closeCoinModal();
  }
});

elements.converterAmount.addEventListener("input", updateConverterResult);

if (elements.copyEndpointBtn && elements.apiEndpointCode) {
  elements.copyEndpointBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(elements.apiEndpointCode.textContent.trim());
      elements.copyEndpointBtn.textContent = "Kopyalandı ✓";
      setTimeout(() => {
        elements.copyEndpointBtn.textContent = "Kopyala";
      }, 1800);
    } catch {
      elements.copyEndpointBtn.textContent = "Seçip Kopyala";
    }
  });
}

// İlk açılışta verileri çek ve otomatik canlı zamanlayıcıyı başlat
updateAutoRefreshUI();
fetchCryptoData();
startAutoRefreshTimer();
