let stockChart;

// build a minimal stock-like object from a chart-like result node
function buildFromChartLike(r0, symbolFallback) {
    const meta = r0.meta || {};
    const quote = (r0.indicators && r0.indicators.quote && r0.indicators.quote[0]) || {};
    const timestamps = r0.timestamp || [];
    const lastIdx = (quote.close && quote.close.length - 1) || 0;
    return {
        symbol: meta.symbol || symbolFallback || (r0.symbol) || "",
        longName: meta.longName || meta.exchangeName || meta.fullExchangeName || "",
        shortName: meta.shortName || "",
        regularMarketPrice: (quote.close && quote.close[lastIdx] != null) ? quote.close[lastIdx] : (quote.close && quote.close[0]) || null,
        regularMarketOpen: (quote.open && quote.open[lastIdx]) ?? null,
        regularMarketDayHigh: (quote.high && quote.high[lastIdx]) ?? null,
        regularMarketDayLow: (quote.low && quote.low[lastIdx]) ?? null,
        regularMarketPreviousClose: meta.previousClose ?? null,
        regularMarketTime: (meta.regularMarketTime ?? (timestamps.length ? timestamps[timestamps.length - 1] : null))
    };
}

// small local suggestions list (ticker — company). Extend as needed.
const SUGGESTIONS = [
    "AAPL — Apple Inc.",
    "MSFT — Microsoft Corp.",
    "GOOGL — Alphabet Inc.",
    "AMZN — Amazon.com Inc.",
    "TSLA — Tesla Inc.",
    "NVDA — NVIDIA Corp.",
    "META — Meta Platforms",
    "BRK-A — Berkshire Hathaway",
    "JPM — JPMorgan Chase",
    "V — Visa Inc.",
    "JNJ — Johnson & Johnson",
    "WMT — Walmart Inc.",
    "DIS — Walt Disney",
    "NFLX — Netflix",
    "BAC — Bank of America",
    "^GSPC — S&P 500",
];

const inputEl = document.getElementById("symbolInput");
const suggestionsEl = document.getElementById("suggestions");
let selIndex = -1;

inputEl.addEventListener("input", onInput);
inputEl.addEventListener("keydown", onKeyDown);
document.addEventListener("click", (e) => {
    if (!suggestionsEl.contains(e.target) && e.target !== inputEl) hideSuggestions();
});

// new: simple scoring for "prediction" / autocomplete confidence
function scoreCandidate(s, q) {
    const qU = q.toUpperCase();
    const parts = s.split("—").map(p => p.trim());
    const ticker = (parts[0] || "").toUpperCase();
    const name = (parts[1] || "").toUpperCase();

    if (!qU) return 0;
    if (ticker.startsWith(qU)) return 100;
    if (name.startsWith(qU)) return 90;
    if (ticker.includes(qU)) return 80;
    if (name.includes(qU)) return 70;

    // token presence scoring for multi-word queries
    const tokens = qU.split(/\s+/).filter(Boolean);
    if (tokens.length) {
        let hits = tokens.reduce((acc, t) => acc + (name.includes(t) ? 1 : 0), 0);
        if (hits > 0) return 60 + Math.floor((hits / tokens.length) * 20);
    }
    return 0;
}

function onInput(e) {
    const q = e.target.value.trim();
    if (!q) { hideSuggestions(); return; }

    // score all candidates, filter zero, sort by score desc then alphabetically
    const scored = SUGGESTIONS
        .map(s => ({ s, score: scoreCandidate(s, q) }))
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score || a.s.localeCompare(b.s));

    renderSuggestions(scored.slice(0, 8));
}

function onKeyDown(e) {
    const items = suggestionsEl.querySelectorAll(".suggestion-item");
    if (items.length === 0) return;
    if (e.key === "ArrowDown") {
        e.preventDefault();
        selIndex = Math.min(selIndex + 1, items.length - 1);
        updateActive(items);
    } else if (e.key === "ArrowUp") {
        e.preventDefault();
        selIndex = Math.max(selIndex - 1, 0);
        updateActive(items);
    } else if (e.key === "Enter") {
        e.preventDefault();
        if (selIndex >= 0 && items[selIndex]) {
            pickSuggestion(items[selIndex].dataset.ticker);
        } else {
            searchStock();
        }
    } else if (e.key === "Escape") {
        hideSuggestions();
    }
}

function renderSuggestions(list) {
    selIndex = -1;
    suggestionsEl.innerHTML = "";
    if (!list || list.length === 0) { hideSuggestions(); return; }

    list.forEach(entry => {
        // entry may be an object { s, score } or a plain string
        const text = (typeof entry === "string") ? entry : entry.s;
        const score = (typeof entry === "string") ? null : entry.score;
        const parts = text.split("—").map(p => p.trim());
        const ticker = parts[0].split(" ")[0]; // robust extraction
        const name = parts[1] || "";

        const div = document.createElement("div");
        div.className = "suggestion-item";
        div.dataset.ticker = ticker;

        // main label
        const label = document.createElement("span");
        label.textContent = `${ticker} — ${name}`;
        div.appendChild(label);

        // small confidence badge (prediction hint)
        if (score !== null) {
            const badge = document.createElement("small");
            badge.style.float = "right";
            badge.style.opacity = "0.8";
            badge.style.fontSize = "12px";
            badge.textContent = `${score}%`;
            div.appendChild(badge);
        }

        div.addEventListener("click", () => pickSuggestion(ticker));
        suggestionsEl.appendChild(div);
    });

    suggestionsEl.classList.add("visible");
    suggestionsEl.setAttribute("aria-hidden", "false");
}

function updateActive(items) {
    items.forEach(i => i.classList.remove("active"));
    if (selIndex >= 0 && items[selIndex]) items[selIndex].classList.add("active");
    // update input preview
    if (selIndex >= 0 && items[selIndex]) inputEl.value = items[selIndex].dataset.ticker;
}

function pickSuggestion(ticker) {
    inputEl.value = ticker;
    hideSuggestions();
    searchStock();
}

function hideSuggestions() {
    suggestionsEl.classList.remove("visible");
    suggestionsEl.setAttribute("aria-hidden", "true");
    selIndex = -1;
}

// existing searchStock function with improved error handling for history/chart
async function searchStock() {
    const symbol = document.getElementById("symbolInput").value.toUpperCase().trim();
    const error = document.getElementById("error");
    const result = document.getElementById("result");

    error.textContent = "";
    result.classList.add("hidden");

    if (symbol === "") {
        error.textContent = "Please enter a stock ticker symbol.";
        return;
    }

    try {
        // Try chart endpoint first (gives meta + indicators) and use it for both info and chart
        // build full target URL and encode it before calling the CORS proxy
        const targetChart = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=7d&interval=1d`;
        const chartUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetChart)}`;
        console.log("Fetching chart URL:", chartUrl);
        const chartRes = await fetch(chartUrl);
        console.log("Chart fetch status:", chartRes.status, chartRes.statusText);
        if (!chartRes.ok) throw new Error("Chart fetch failed");
        const chartData = await chartRes.json();
        console.log("Chart response data:", chartData);

        // attempt to build stock info from chart payload
        let stock = null;
        if (chartData && chartData.chart && chartData.chart.result && chartData.chart.result[0]) {
            stock = buildFromChartLike(chartData.chart.result[0]);
        }

        // fallback: try v7 quote endpoint only if chart didn't yield a usable stock
        if (!stock) {
            const targetQuote = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;
            const url = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetQuote)}`;
            console.log("Falling back to quote URL:", url);
            const res = await fetch(url);
            console.log("Quote fetch status:", res.status, res.statusText);
            if (!res.ok) throw new Error("Quote fetch failed");
            const data = await res.json();
            console.log("Quote response data:", data);

            // flexible parsing for v7/wrapped shapes
            if (data && data.quoteResponse && data.quoteResponse.result && data.quoteResponse.result[0]) {
                stock = data.quoteResponse.result[0];
            } else if (data && data.finance) {
                // try to find a quote-like node inside the wrapper
                const f = data.finance;
                if (f.result && f.result[0]) {
                    const r0 = f.result[0];
                    stock = (r0.symbol || r0.longName || r0.shortName) ? r0 : buildFromChartLike(r0);
                } else if (f.quoteResponse && f.quoteResponse.result && f.quoteResponse.result[0]) {
                    stock = f.quoteResponse.result[0];
                } else if (f.quotes && f.quotes[0]) {
                    stock = f.quotes[0];
                } else {
                    // shallow search
                    for (const k in f) {
                        if (f[k] && typeof f[k] === "object" && (f[k].symbol || f[k].regularMarketPrice)) {
                            stock = f[k];
                            break;
                        }
                    }
                }
            }
        }

        if (!stock) {
            console.error("Stock not found in any response (chart or quote).");
            error.textContent = "Stock not found. See console (Ctrl+Shift+I) for details.";
            return;
        }

        // Populate info (use stock object built above)
        function fmt(n) {
            return (n === null || n === undefined || isNaN(Number(n))) ? "N/A" : Number(n).toFixed(2);
        }

        const priceNum = (stock.regularMarketPrice !== undefined && stock.regularMarketPrice !== null) ? Number(stock.regularMarketPrice) : null;

        // try to get a reliable previous close
        let prevCloseNum = (stock.regularMarketPreviousClose !== undefined && stock.regularMarketPreviousClose !== null) ? Number(stock.regularMarketPreviousClose) : null;

        // if prevClose is missing try to extract from chart payload (best-effort)
        if (prevCloseNum === null && typeof chartData === "object") {
            const r = (chartData.chart && chartData.chart.result && chartData.chart.result[0]) ?
                chartData.chart.result[0] :
                (chartData.finance && chartData.finance.result && chartData.finance.result[0]) ? chartData.finance.result[0] : null;
            if (r) {
                const q = (r.indicators && r.indicators.quote && r.indicators.quote[0]) || {};
                const closes = q.close || [];
                // use second-last value as previous close if available
                if (closes.length >= 2) {
                    const idx = closes.length - 1;
                    const prev = closes[idx - 1];
                    if (prev !== null && prev !== undefined && !isNaN(Number(prev))) prevCloseNum = Number(prev);
                }
            }
        }

        // Derive diff and percent (do NOT trust provider percent — compute from price & prevClose)
        let diffNum = (stock.regularMarketChange !== undefined && stock.regularMarketChange !== null) ? Number(stock.regularMarketChange) : null;
        if (diffNum === null && priceNum !== null && prevCloseNum !== null) {
            diffNum = priceNum - prevCloseNum;
        }

        // Always compute percent from diff & prevClose when possible (ignore stock.regularMarketChangePercent)
        let diffPercentNum = null;
        if (diffNum !== null && prevCloseNum !== null && prevCloseNum !== 0) {
            diffPercentNum = (diffNum / prevCloseNum) * 100;
        } else {
            diffPercentNum = null;
        }

        document.getElementById("companyName").textContent = stock.longName || stock.shortName || "";
        document.getElementById("symbol").textContent = `(${stock.symbol || ""})`;
        document.getElementById("price").textContent = priceNum !== null ? `$${priceNum.toFixed(2)}` : "N/A";

        const changeEl = document.getElementById("change");
        if (diffNum === null && diffPercentNum === null) {
            changeEl.textContent = "N/A";
            changeEl.style.color = "#fff";
        } else {
            const sign = (diffNum !== null && diffNum > 0) ? "+" : (diffNum !== null && diffNum < 0) ? "" : "";
            const pSign = (diffPercentNum !== null && diffPercentNum > 0) ? "+" : (diffPercentNum !== null && diffPercentNum < 0) ? "" : "";
            const diffText = diffNum !== null ? `${sign}${diffNum.toFixed(2)}` : "N/A";
            const pctText = diffPercentNum !== null ? `${pSign}${diffPercentNum.toFixed(2)}%` : "N/A";
            changeEl.textContent = `${diffText} (${pctText})`;
            changeEl.style.color = (diffNum !== null && diffNum >= 0) ? "lightgreen" : (diffNum !== null ? "salmon" : "#fff");
        }

        document.getElementById("open").textContent = fmt(stock.regularMarketOpen);
        document.getElementById("high").textContent = fmt(stock.regularMarketDayHigh);
        document.getElementById("low").textContent = fmt(stock.regularMarketDayLow);
        document.getElementById("prevClose").textContent = prevCloseNum !== null ? `$${prevCloseNum.toFixed(2)}` : "N/A";
        const date = stock.regularMarketTime ? new Date(stock.regularMarketTime * 1000) : null;
        document.getElementById("time").textContent = date ? date.toLocaleString() : "N/A";

        result.classList.remove("hidden");

        // Use chartData (already fetched) to build the chart
        const histData = chartData;
        if (!histData || !histData.chart || !histData.chart.result || !histData.chart.result.length) {
            if (stockChart) { stockChart.destroy(); stockChart = null; }
            console.error("Unexpected history/chart response structure:", histData);
            return;
        }

        const result0 = histData.chart.result[0];
        const timestamps = result0.timestamp || [];
        const closeArr = (result0.indicators && result0.indicators.quote && result0.indicators.quote[0] && result0.indicators.quote[0].close) || [];

        // filter out null/undefined prices and keep labels aligned
        const labels = [];
        const prices = [];
        for (let i = 0; i < Math.min(timestamps.length, closeArr.length); i++) {
            const p = closeArr[i];
            if (p === null || p === undefined) continue;
            labels.push(new Date(timestamps[i] * 1000).toLocaleDateString());
            prices.push(p);
        }

        if (prices.length === 0) {
            if (stockChart) { stockChart.destroy(); stockChart = null; }
            console.error("No valid price points found for chart");
            return;
        }

        // Remove old chart if exists
        if (stockChart) stockChart.destroy();

        const ctx = document.getElementById('stockChart').getContext('2d');
        stockChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: `${symbol} Price ($)`,
                    data: prices,
                    borderColor: 'dodgerblue',
                    backgroundColor: 'rgba(30,144,255,0.2)',
                    fill: true,
                    tension: 0.2,
                    pointRadius: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { grid: { color: '#333' }, ticks: { color: '#fff' } },
                    y: { grid: { color: '#333' }, ticks: { color: '#fff' } }
                },
                plugins: { legend: { labels: { color: '#fff' } } }
            }
        });

    } catch (err) {
        console.error(err);
        error.textContent = "Error fetching stock data. Check console for details.";
    }
}
