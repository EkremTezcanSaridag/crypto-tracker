/* ==========================================================================
   Crypto Tracker — CoinGecko Public API v3 (Ücretsiz & API Anahtarsız)
   ========================================================================== */

const API_BASE_URL = "https://api.coingecko.com/api/v3/coins/markets";
const COIN_COUNT = 25;
const CACHE_TTL_MS = 60 * 1000; // 60 saniye önbellek (ücretsiz API limitini korumak için)
const FAVORITES_STORAGE_KEY = "crypto_tracker_favorites";

// Uygulama durumu (State)
const state = {
  currency: "usd",
  coins: [],
  searchQuery: "",
  sortBy: "rank",
  onlyFavorites: false,
  favorites: loadFavorites(),
  selectedCoin: null,
  isLoading: false,
};

// DOM Referansları
const elements = {
  currencyButtons: document.querySelectorAll(".currency-btn"),
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
  modalHigh24h: document.getElementById("modalHigh24h"),
  modalLow24h: document.getElementById("modalLow24h"),
  modalMarketCap: document.getElementById("modalMarketCap"),
  modalVolume: document.getElementById("modalVolume"),
  modalAth: document.getElementById("modalAth"),
  modalSupply: document.getElementById("modalSupply"),
  converterAmount: document.getElementById("converterAmount"),
  converterUnit: document.getElementById("converterUnit"),
  converterResult: document.getElementById("converterResult"),
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
  if (typeof value !== "number" || Number.isNaN(value)) return "0,00%";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2).replace(".", ",")}%`;
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
  return `crypto_tracker_cache_${currency}`;
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
        <td><div class="skeleton-bar"></div></td>
        <td class="hide-sm"><div class="skeleton-bar"></div></td>
        <td class="hide-md"><div class="skeleton-bar"></div></td>
        <td class="hide-lg"><div class="skeleton-bar"></div></td>
        <td class="hide-sm"><div class="skeleton-bar"></div></td>
      </tr>
    `
    )
    .join("");
}

/* ---------- CoinGecko API İsteği ---------- */

async function fetchCryptoData({ forceRefresh = false } = {}) {
  if (state.isLoading) return;

  const currency = state.currency;
  const cached = readCache(currency);
  const isFreshCache =
    cached && Array.isArray(cached.data) && Date.now() - cached.timestamp < CACHE_TTL_MS;

  // Önbellek tazeyse ve kullanıcı zorla yenilemeye basmadıysa API limitini koru
  if (isFreshCache && !forceRefresh) {
    state.coins = cached.data;
    hideBanner();
    updateUI(cached.timestamp, "Önbellekten yüklendi (60sn)");
    return;
  }

  state.isLoading = true;
  elements.refreshBtn.disabled = true;
  elements.refreshBtn.classList.add("loading");
  if (state.coins.length === 0) renderSkeletonRows();

  const url =
    `${API_BASE_URL}?vs_currency=${encodeURIComponent(currency)}` +
    `&order=market_cap_desc&per_page=${COIN_COUNT}&page=1` +
    `&sparkline=true&price_change_percentage=24h`;

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

    state.coins = data;
    writeCache(currency, data);
    hideBanner();
    updateUI(Date.now(), "CoinGecko Public API v3");
  } catch (error) {
    // Hata durumunda elde eski önbellek varsa kullanıcıyı boş bırakma
    if (cached && Array.isArray(cached.data)) {
      state.coins = cached.data;
      const reason =
        error.message === "RATE_LIMIT"
          ? "CoinGecko ücretsiz kullanım limitine (429) ulaşıldı. Son kaydedilen veriler gösteriliyor; 1 dakika sonra tekrar yenileyebilirsiniz."
          : "Canlı bağlantıda geçici sorun oluştu. Son kaydedilen veriler gösteriliyor.";
      showBanner(reason, "warning");
      updateUI(cached.timestamp, "Kayıtlı veri (çevrimdışı yedek)");
    } else {
      state.coins = [];
      elements.tableBody.innerHTML = "";
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
  renderTable();

  // Modal açıksa para birimi değişiminde içeriğini de tazele
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

  const withChange = state.coins.filter(
    (c) => typeof c.price_change_percentage_24h === "number"
  );

  if (withChange.length > 0) {
    const best = [...withChange].sort(
      (a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h
    )[0];
    const worst = [...withChange].sort(
      (a, b) => a.price_change_percentage_24h - b.price_change_percentage_24h
    )[0];

    elements.topGainer.textContent = `${best.symbol.toUpperCase()} ${formatPercent(
      best.price_change_percentage_24h
    )}`;
    elements.topGainerSub.textContent = `${best.name} • ${formatPrice(
      best.current_price,
      state.currency
    )}`;

    elements.topLoser.textContent = `${worst.symbol.toUpperCase()} ${formatPercent(
      worst.price_change_percentage_24h
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
    case "change_desc":
      sorted.sort(
        (a, b) =>
          (b.price_change_percentage_24h ?? -Infinity) -
          (a.price_change_percentage_24h ?? -Infinity)
      );
      break;
    case "change_asc":
      sorted.sort(
        (a, b) =>
          (a.price_change_percentage_24h ?? Infinity) -
          (b.price_change_percentage_24h ?? Infinity)
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
      const change = coin.price_change_percentage_24h;
      const badgeClass =
        typeof change !== "number" ? "flat" : change > 0 ? "up" : change < 0 ? "down" : "flat";
      const arrow = typeof change !== "number" ? "" : change > 0 ? "▲" : change < 0 ? "▼" : "";
      const isFav = state.favorites.has(coin.id);
      const sparkPrices = coin.sparkline_in_7d?.price || [];

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
          <td class="num price-cell">${formatPrice(coin.current_price, state.currency)}</td>
          <td class="num">
            <span class="change-badge ${badgeClass}">
              ${arrow} ${formatPercent(change)}
            </span>
          </td>
          <td class="num hide-sm">
            <span class="range-text">
              ${formatPrice(coin.low_24h, state.currency)} – ${formatPrice(coin.high_24h, state.currency)}
            </span>
          </td>
          <td class="num hide-md">${formatCompactCurrency(coin.market_cap, state.currency)}</td>
          <td class="num hide-lg">${formatCompactCurrency(coin.total_volume, state.currency)}</td>
          <td class="col-chart hide-sm">${createSparklineSvg(sparkPrices)}</td>
        </tr>
      `;
    })
    .join("");
}

/* ---------- Coin Detay Modalı & Hesaplayıcı ---------- */

function openCoinModal(coin) {
  state.selectedCoin = coin;

  elements.modalLogo.src = safeImageUrl(coin.image);
  elements.modalLogo.alt = `${coin.name} logosu`;
  elements.modalTitle.textContent = coin.name;
  elements.modalSymbol.textContent = coin.symbol.toUpperCase();
  elements.modalPrice.textContent = formatPrice(coin.current_price, state.currency);

  const change = coin.price_change_percentage_24h;
  const badgeClass =
    typeof change !== "number" ? "flat" : change > 0 ? "up" : change < 0 ? "down" : "flat";
  const arrow = typeof change !== "number" ? "" : change > 0 ? "▲" : change < 0 ? "▼" : "";
  elements.modalChange.className = `change-badge ${badgeClass}`;
  elements.modalChange.textContent = `${arrow} ${formatPercent(change)} (24s)`.trim();

  elements.modalHigh24h.textContent = formatPrice(coin.high_24h, state.currency);
  elements.modalLow24h.textContent = formatPrice(coin.low_24h, state.currency);
  elements.modalMarketCap.textContent = formatCompactCurrency(coin.market_cap, state.currency);
  elements.modalVolume.textContent = formatCompactCurrency(coin.total_volume, state.currency);
  elements.modalAth.textContent = formatPrice(coin.ath, state.currency);
  elements.modalSupply.textContent = `${formatNumber(coin.circulating_supply)} ${coin.symbol.toUpperCase()}`;

  elements.converterUnit.textContent = coin.symbol.toUpperCase();
  updateConverterResult();

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

elements.currencyButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const selected = btn.dataset.currency;
    if (!selected || selected === state.currency) return;

    state.currency = selected;
    elements.currencyButtons.forEach((b) =>
      b.classList.toggle("active", b.dataset.currency === selected)
    );
    fetchCryptoData();
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
  renderTable();
});

elements.sortSelect.addEventListener("change", (event) => {
  state.sortBy = event.target.value;
  renderTable();
});

elements.favoritesFilterBtn.addEventListener("click", () => {
  state.onlyFavorites = !state.onlyFavorites;
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

// İlk açılışta verileri çek
fetchCryptoData();
