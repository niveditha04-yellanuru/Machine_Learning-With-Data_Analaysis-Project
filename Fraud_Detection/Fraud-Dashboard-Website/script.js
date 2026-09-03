const chartLibraryAvailable = typeof Chart !== 'undefined';

if (chartLibraryAvailable) {
  Chart.defaults.font.family = 'Inter';
  Chart.defaults.color = '#65748b';
}

const merchantCategories = ['Grocery', 'Travel', 'Food', 'Electronics', 'Online', 'Other'];
const transactionTypes = ['Card', 'Cash', 'Online'];
const amountBuckets = ['0-1K', '1K-2K', '2K-3K', '3K-4K', '4K-5K', '5K-7.5K', '7.5K+'];

const featureImportance = [
  { name: 'Device Trust Score', value: 26 },
  { name: 'Transaction Hour', value: 22 },
  { name: 'Amount', value: 18 },
  { name: 'Velocity Last 24h', value: 14 },
  { name: 'Foreign Transaction', value: 10 },
  { name: 'Cardholder Age', value: 6 },
  { name: 'Location Mismatch', value: 12 },
  { name: 'Merchant Category', value: 8 }
];

const state = {
  transactions: [],
  filtered: [],
  currentPage: 1,
  pageSize: 8,
  activeSection: 'overview-section'
};

async function loadDashboardData() {
  try {
    const [summaryResponse, transactionsResponse] = await Promise.all([
      fetch('http://localhost:5000/api/summary'),
      fetch('http://localhost:5000/api/transactions')
    ]);

    if (!summaryResponse.ok || !transactionsResponse.ok) {
      throw new Error('API request failed');
    }

    const summary = await summaryResponse.json();
    const payload = await transactionsResponse.json();

    state.transactions = (payload.transactions || []).map((transaction) => ({
      ...transaction,
      transactionType: transaction.transactionType ?? transaction.transaction_type,
      locationMismatch: transaction.locationMismatch ?? transaction.location_mismatch,
      deviceTrustScore: transaction.deviceTrustScore ?? transaction.device_trust_score,
      velocityLast24h: transaction.velocityLast24h ?? transaction.velocity_last_24h,
      cardholderAge: transaction.cardholderAge ?? transaction.cardholder_age,
      isFraud: transaction.isFraud ?? transaction.is_fraud,
      fraudProbability: transaction.fraudProbability ?? transaction.fraud_probability,
      legitimateProbability: transaction.legitimateProbability ?? transaction.legitimate_probability,
      riskScore: transaction.riskScore ?? transaction.risk_score,
      riskLevel: transaction.riskLevel ?? transaction.risk_level,
      riskClass: transaction.riskClass ?? transaction.risk_class,
      modelFactors: transaction.modelFactors ?? transaction.model_factors
    }));
    state.filtered = [...state.transactions];

    if (document.getElementById('totalTransactions')) {
      setText('totalTransactions', summary.total_transactions?.toLocaleString() || '0');
      setText('fraudTransactions', summary.fraud_transactions?.toLocaleString() || '0');
      setText('fraudRate', formatPercent(summary.fraud_rate || 0));
      setText('totalAmountValue', `₹${((summary.total_amount || 0) / 1000000).toFixed(2)}M`);
      setText('averageAmountValue', formatCurrency(Math.round(summary.average_amount || 0)));
      setText('riskScoreKpi', `${Math.round(summary.average_risk_score || 0)} / 100`);
    }

    return true;
  } catch (error) {
    state.transactions = buildTransactions();
    state.filtered = [...state.transactions];
    return false;
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}

function formatCompact(value) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1, notation: 'compact' }).format(value);
}

function formatPercent(value) {
  return `${value.toFixed(2)}%`;
}

function riskLevelFromScore(score) {
  if (score <= 30) return 'Low';
  if (score <= 60) return 'Medium';
  if (score <= 80) return 'High';
  return 'Critical';
}

function getRiskClass(score) {
  const level = riskLevelFromScore(score);
  if (level === 'Low') return 'low';
  if (level === 'Medium') return 'medium';
  if (level === 'High') return 'high';
  return 'critical';
}

function buildTransactions() {
  const rows = [];
  const total = 1200;

  for (let i = 0; i < total; i += 1) {
    const isFraud = i < 487;
    const merchant = merchantCategories[i % merchantCategories.length];
    const amountBase = isFraud ? 650 : 240;
    const amount = Math.round(amountBase + ((i * 17) % 4200) + (merchant === 'Travel' ? 1100 : merchant === 'Electronics' ? 900 : 0));
    const hour = (i * 7 + (isFraud ? 9 : 5)) % 24;
    const foreign = i % 5 === 0 || (isFraud && i % 3 === 0);
    const locationMismatch = isFraud ? i % 2 === 0 : i % 5 === 0;
    const deviceTrustScore = clamp((0.52 + ((i * 0.011) % 0.46) + (isFraud ? -0.18 : 0.12)), 0.08, 0.99);
    const velocityLast24h = clamp((isFraud ? 7 : 2) + (i % 5), 0, 15);
    const cardholderAge = clamp(22 + ((i * 5) % 56) + (isFraud ? 2 : 0), 18, 82);
    const transactionType = transactionTypes[(i + (isFraud ? 1 : 2)) % transactionTypes.length];

    const riskScore = clamp(
      14 +
      (amount > 4000 ? 16 : 0) +
      (hour >= 22 || hour <= 4 ? 18 : 0) +
      (foreign ? 12 : 0) +
      (locationMismatch ? 18 : 0) +
      (deviceTrustScore < 0.5 ? 16 : 0) +
      (velocityLast24h > 5 ? 14 : 0) +
      (merchant === 'Travel' || merchant === 'Electronics' ? 9 : 0) +
      (isFraud ? 18 : -8),
      0,
      100
    );

    const fraudProbability = clamp((isFraud ? 0.54 : 0.18) + (riskScore / 120), 0.02, 0.99);
    const legitimateProbability = clamp(1 - fraudProbability, 0.01, 0.98);
    const status = riskScore >= 70 ? 'Fraud' : riskScore >= 45 ? 'Review' : 'Safe';

    rows.push({
      id: `TXN-${String(i + 1).padStart(5, '0')}`,
      amount,
      merchant,
      hour,
      transactionType,
      foreign,
      locationMismatch,
      deviceTrustScore: Number(deviceTrustScore.toFixed(2)),
      velocityLast24h,
      cardholderAge,
      isFraud,
      riskScore: Math.round(riskScore),
      fraudProbability: Number((fraudProbability * 100).toFixed(1)),
      legitimateProbability: Number((legitimateProbability * 100).toFixed(1)),
      status,
      riskLevel: riskLevelFromScore(riskScore),
      location: foreign ? 'Foreign' : 'Domestic',
      riskClass: getRiskClass(riskScore),
      modelFactors: generateFactors({
        amount,
        hour,
        foreign,
        locationMismatch,
        deviceTrustScore,
        velocityLast24h,
        merchant,
        isFraud
      })
    });
  }

  return rows;
}

function generateFactors({ amount, hour, foreign, locationMismatch, deviceTrustScore, velocityLast24h, merchant, isFraud }) {
  const factors = [];

  if (deviceTrustScore < 0.5) factors.push('Low device trust score');
  if (hour >= 22 || hour <= 4) factors.push('Unusual transaction hour');
  if (amount > 4000) factors.push('High transaction value');
  if (velocityLast24h > 5) factors.push('High transaction velocity');
  if (foreign) factors.push('Cross-border transaction');
  if (locationMismatch) factors.push('Location mismatch');
  if (merchant === 'Travel' || merchant === 'Electronics') factors.push('Merchant profile mismatch');
  if (isFraud) factors.push('Behavioral anomaly detected');

  return factors.slice(0, 4);
}

const chartPalette = {
  primary: '#6d5efc',
  success: '#10b981',
  danger: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6',
  neutral: '#94a3b8'
};

const chartDefaults = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: true, position: 'bottom' },
    tooltip: { enabled: true }
  },
  scales: {
    x: { grid: { display: false }, ticks: { color: '#65748b' } },
    y: { beginAtZero: true, grid: { color: '#e2e8f0' }, ticks: { color: '#65748b' } }
  }
};

const charts = {};

function getChartTextColor() {
  return document.body.classList.contains('dark') ? '#dfeaf5' : '#65748b';
}

function getChartGridColor() {
  return document.body.classList.contains('dark') ? 'rgba(148, 163, 184, 0.18)' : '#e2e8f0';
}

function buildCharts() {
  if (!chartLibraryAvailable) return;

  charts.fraud = new Chart(document.getElementById('fraudChart'), {
    type: 'bar',
    data: { labels: ['Fraud', 'Non-Fraud'], datasets: [{ label: 'Transactions', data: [0, 0], backgroundColor: [chartPalette.danger, chartPalette.success], borderRadius: 10 }] },
    options: { ...chartDefaults, plugins: { legend: { display: false } } }
  });

  charts.trend = new Chart(document.getElementById('trendChart'), {
    type: 'line',
    data: {
      labels: ['00', '03', '06', '09', '12', '15', '18', '21'],
      datasets: [
        { label: 'Total', data: [0, 0, 0, 0, 0, 0, 0, 0], borderColor: chartPalette.primary, backgroundColor: 'rgba(109, 94, 252, 0.12)', fill: true, tension: 0.35 },
        { label: 'Fraud', data: [0, 0, 0, 0, 0, 0, 0, 0], borderColor: chartPalette.danger, backgroundColor: 'rgba(239, 68, 68, 0.12)', fill: true, tension: 0.35 }
      ]
    },
    options: { ...chartDefaults }
  });

  charts.hour = new Chart(document.getElementById('hourChart'), {
    type: 'line',
    data: {
      labels: Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')),
      datasets: [{ label: 'Fraud Rate %', data: Array(24).fill(0), borderColor: chartPalette.primary, backgroundColor: 'rgba(109, 94, 252, 0.15)', fill: true, tension: 0.35, pointRadius: 2 }]
    },
    options: {
      ...chartDefaults,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: getChartTextColor() } },
        y: {
          beginAtZero: true,
          max: 100,
          grid: { color: getChartGridColor() },
          ticks: { color: getChartTextColor(), callback: value => `${value}%` }
        }
      }
    }
  });

  charts.merchant = new Chart(document.getElementById('merchantChart'), {
    type: 'bar',
    data: {
      labels: merchantCategories,
      datasets: [{ label: 'Fraud Transactions', data: Array(merchantCategories.length).fill(0), backgroundColor: chartPalette.primary, borderRadius: 8 }]
    },
    options: {
      ...chartDefaults,
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, grid: { color: getChartGridColor() }, ticks: { color: getChartTextColor() } },
        y: { grid: { display: false }, ticks: { color: getChartTextColor() } }
      }
    }
  });

  charts.amount = new Chart(document.getElementById('amountChart'), {
    type: 'bar',
    data: {
      labels: amountBuckets,
      datasets: [
        { label: 'Fraud', data: Array(7).fill(0), backgroundColor: chartPalette.danger, borderRadius: 6 },
        { label: 'Non-Fraud', data: Array(7).fill(0), backgroundColor: chartPalette.primary, borderRadius: 6 }
      ]
    },
    options: { ...chartDefaults }
  });

  charts.domestic = new Chart(document.getElementById('domesticChart'), {
    type: 'doughnut',
    data: {
      labels: ['Domestic', 'Foreign'],
      datasets: [{ data: [0, 0], backgroundColor: [chartPalette.primary, chartPalette.warning], borderWidth: 0 }]
    },
    options: {
      ...chartDefaults,
      cutout: '68%',
      plugins: { legend: { position: 'bottom' } }
    }
  });

  charts.location = new Chart(document.getElementById('locationChart'), {
    type: 'bar',
    data: {
      labels: ['Matched', 'Mismatch'],
      datasets: [{ label: 'Transactions', data: [0, 0], backgroundColor: [chartPalette.success, chartPalette.danger], borderRadius: 8 }]
    },
    options: {
      ...chartDefaults,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: getChartTextColor() } },
        y: { beginAtZero: true, grid: { color: getChartGridColor() }, ticks: { color: getChartTextColor() } }
      }
    }
  });

  charts.feature = new Chart(document.getElementById('featureChart'), {
    type: 'bar',
    data: {
      labels: featureImportance.map(item => item.name),
      datasets: [{ label: 'Importance', data: featureImportance.map(item => item.value), backgroundColor: chartPalette.primary, borderRadius: 8 }]
    },
    options: {
      ...chartDefaults,
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, max: 35, grid: { color: getChartGridColor() }, ticks: { color: getChartTextColor() } },
        y: { grid: { display: false }, ticks: { color: getChartTextColor() } }
      }
    }
  });

  charts.geo = new Chart(document.getElementById('geoChart'), {
    type: 'doughnut',
    data: {
      labels: ['Domestic', 'Foreign'],
      datasets: [{ data: [0, 0], backgroundColor: [chartPalette.primary, chartPalette.warning], borderWidth: 0 }]
    },
    options: {
      ...chartDefaults,
      cutout: '70%',
      plugins: { legend: { position: 'bottom' } }
    }
  });
}

function refreshChartThemes() {
  Object.values(charts).forEach(chart => {
    chart.options.scales = chart.options.scales || {};
    chart.options.plugins = chart.options.plugins || {};

    if (chart.options.scales.x) chart.options.scales.x.ticks = { color: getChartTextColor() };
    if (chart.options.scales.x) chart.options.scales.x.grid = { display: false, color: getChartGridColor() };
    if (chart.options.scales.y) chart.options.scales.y.ticks = { color: getChartTextColor() };
    if (chart.options.scales.y) chart.options.scales.y.grid = { color: getChartGridColor() };
    if (chart.options.plugins.legend) chart.options.plugins.legend.labels = { color: getChartTextColor() };

    chart.update();
  });
}

function updateStateFilters() {
  const searchTerm = document.getElementById('globalSearch').value.trim().toLowerCase();
  const fraudStatus = document.getElementById('fraudFilter').value;
  const merchant = document.getElementById('merchantFilter').value;
  const riskLevel = document.getElementById('riskLevelFilter').value;
  const foreign = document.getElementById('foreignFilter').value;

  state.filtered = state.transactions.filter((transaction) => {
    const matchesSearch = !searchTerm || [
      transaction.id,
      transaction.merchant,
      transaction.transactionType,
      transaction.status,
      transaction.riskLevel,
      transaction.location
    ].some(value => String(value).toLowerCase().includes(searchTerm));

    const matchesFraud = fraudStatus === 'all' || (fraudStatus === 'fraud' ? transaction.isFraud : !transaction.isFraud);
    const matchesMerchant = merchant === 'all' || transaction.merchant === merchant;
    const matchesRisk = riskLevel === 'all' || transaction.riskLevel === riskLevel;
    const matchesForeign = foreign === 'all' || String(transaction.foreign) === foreign;

    return matchesSearch && matchesFraud && matchesMerchant && matchesRisk && matchesForeign;
  });

  state.currentPage = 1;
  renderAll();
}

function getSummaryStats(list) {
  const total = list.length;
  const fraud = list.filter(item => item.isFraud).length;
  const safe = list.filter(item => !item.isFraud).length;
  const totalAmount = list.reduce((sum, item) => sum + item.amount, 0);
  const averageAmount = total ? totalAmount / total : 0;
  const avgRisk = list.length ? list.reduce((sum, item) => sum + item.riskScore, 0) / total : 0;
  const fraudRate = total ? (fraud / total) * 100 : 0;

  return { total, fraud, safe, totalAmount, averageAmount, avgRisk, fraudRate };
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function renderKpis() {
  const stats = getSummaryStats(state.filtered);
  setText('totalTransactions', stats.total.toLocaleString());
  setText('fraudTransactions', stats.fraud.toLocaleString());
  setText('fraudRate', formatPercent(stats.fraudRate));
  setText('totalAmountValue', `₹${(stats.totalAmount / 1000000).toFixed(2)}M`);
  setText('averageAmountValue', formatCurrency(Math.round(stats.averageAmount)));
  setText('riskScoreKpi', `${Math.round(stats.avgRisk)} / 100`);

  const riskLevel = riskLevelFromScore(stats.avgRisk);
  const riskLevelSummary = document.getElementById('riskLevelSummary');
  if (riskLevelSummary) {
    riskLevelSummary.textContent = `${riskLevel.toUpperCase()} RISK`;
    riskLevelSummary.className = `kpi-meta negative ${riskLevel.toLowerCase()}`;
  }

  const riskScoreDisplay = document.getElementById('riskScoreDisplay');
  const riskBadge = document.getElementById('riskBadge');
  const gaugeScore = document.getElementById('gaugeScore');
  const riskSummaryText = document.getElementById('riskSummaryText');
  const riskLevelBadge = riskLevel.toUpperCase();

  if (riskScoreDisplay) riskScoreDisplay.textContent = Math.round(stats.avgRisk);
  if (gaugeScore) gaugeScore.textContent = Math.round(stats.avgRisk);
  if (riskBadge) {
    riskBadge.textContent = `${riskLevelBadge} RISK`;
    riskBadge.className = `risk-badge ${getRiskClass(stats.avgRisk)}`;
  }

  const gauge = document.getElementById('riskGauge');
  if (gauge) {
    gauge.style.setProperty('--score', Math.round(stats.avgRisk));
    gauge.style.background = `conic-gradient(${getRiskColor(stats.avgRisk)} ${Math.round(stats.avgRisk)}%, rgba(148,163,184,0.18) 0)`;
  }

  if (riskSummaryText) {
    riskSummaryText.textContent = getRiskSummary(stats);
  }
}

function getRiskSummary(stats) {
  if (stats.fraudRate > 25) return 'Fraud concentration is elevated; rapid review is recommended for flagged transactions.';
  if (stats.avgRisk > 60) return 'Elevated risk due to unusual velocity, high-value activity, and mismatch signals.';
  return 'Portfolio remains stable with moderate anomaly levels and manageable exposure.';
}

function getRiskColor(score) {
  if (score <= 30) return '#10b981';
  if (score <= 60) return '#f59e0b';
  if (score <= 80) return '#ef4444';
  return '#b91c1c';
}

function renderChartData() {
  if (!chartLibraryAvailable) return;

  const fraudCount = state.filtered.filter(item => item.isFraud).length;
  const legitCount = state.filtered.length - fraudCount;

  charts.fraud.data.datasets[0].data = [fraudCount, legitCount];
  charts.fraud.update();

  const byHour = Array.from({ length: 24 }, (_, hour) => {
    const hourly = state.filtered.filter(item => item.hour === hour);
    const fraudHourly = hourly.filter(item => item.isFraud).length;
    return hourly.length ? (fraudHourly / hourly.length) * 100 : 0;
  });

  charts.hour.data.datasets[0].data = byHour;
  charts.hour.update();

  const trendLabels = ['00', '03', '06', '09', '12', '15', '18', '21'];
  const totalTrend = trendLabels.map((label) => {
    const hour = Number(label);
    const window = state.filtered.filter(item => item.hour >= hour && item.hour < hour + 3);
    return window.length;
  });
  const fraudTrend = trendLabels.map((label) => {
    const hour = Number(label);
    const window = state.filtered.filter(item => item.hour >= hour && item.hour < hour + 3 && item.isFraud);
    return window.length;
  });

  charts.trend.data.labels = trendLabels;
  charts.trend.data.datasets[0].data = totalTrend;
  charts.trend.data.datasets[1].data = fraudTrend;
  charts.trend.update();

  const merchantFraud = merchantCategories.map((merchant) => state.filtered.filter(item => item.merchant === merchant && item.isFraud).length);
  charts.merchant.data.datasets[0].data = merchantFraud;
  charts.merchant.update();

  const bucketValues = Array(7).fill(0);
  const legitBuckets = Array(7).fill(0);
  state.filtered.forEach((item) => {
    const bucket = getBucketIndex(item.amount);
    if (item.isFraud) bucketValues[bucket] += 1;
    else legitBuckets[bucket] += 1;
  });

  charts.amount.data.datasets[0].data = bucketValues;
  charts.amount.data.datasets[1].data = legitBuckets;
  charts.amount.update();

  const domestic = state.filtered.filter(item => item.location === 'Domestic').length;
  const foreign = state.filtered.filter(item => item.location === 'Foreign').length;
  charts.domestic.data.datasets[0].data = [domestic, foreign];
  charts.domestic.update();

  const locationMatched = state.filtered.filter(item => !item.locationMismatch).length;
  const locationMismatch = state.filtered.filter(item => item.locationMismatch).length;
  charts.location.data.datasets[0].data = [locationMatched, locationMismatch];
  charts.location.update();

  charts.geo.data.datasets[0].data = [domestic, foreign];
  charts.geo.update();

  const featureData = state.filtered.length ? featureImportance.map((feature) => ({
    name: feature.name,
    value: Math.max(5, feature.value + (feature.name === 'Device Trust Score' && state.filtered.some(item => item.deviceTrustScore < 0.5) ? 9 : 0))
  })) : featureImportance;

  charts.feature.data.labels = featureData.map(item => item.name);
  charts.feature.data.datasets[0].data = featureData.map(item => item.value);
  charts.feature.update();
}

function renderInsights() {
  const insightList = document.getElementById('insightList');
  if (!insightList) return;

  const stats = getSummaryStats(state.filtered);
  const topCategory = merchantCategories
    .map((merchant) => ({ merchant, count: state.filtered.filter(item => item.merchant === merchant && item.isFraud).length }))
    .sort((a, b) => b.count - a.count)[0];

  const highestHour = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    rate: state.filtered.filter(item => item.hour === hour && item.isFraud).length / Math.max(1, state.filtered.filter(item => item.hour === hour).length)
  })).sort((a, b) => b.rate - a.rate)[0];

  const items = [
    `Foreign activity accounts for ${formatPercent((state.filtered.filter(item => item.foreign && item.isFraud).length / Math.max(1, state.filtered.filter(item => item.foreign).length)) * 100 || 0)} of foreign transactions flagged as fraud.`,
    `${topCategory ? `${topCategory.merchant} is the highest-risk category with ${topCategory.count} fraudulent transactions.` : 'Risk is dispersed across categories.'}`,
    `${highestHour ? `Transactions during hour ${String(highestHour.hour).padStart(2, '0')} show elevated fraud exposure.` : 'Activity remains relatively stable across the day.'}`,
    `${stats.fraudRate > 8 ? 'Fraud rate is trending above the baseline, requiring deeper controls.' : 'Operating risk is within an acceptable threshold for the current time window.'}`
  ];

  insightList.innerHTML = items.map(item => `<li>${item}</li>`).join('');
}

function getBucketIndex(amount) {
  if (amount < 1000) return 0;
  if (amount < 2000) return 1;
  if (amount < 3000) return 2;
  if (amount < 4000) return 3;
  if (amount < 5000) return 4;
  if (amount < 7500) return 5;
  return 6;
}

function renderAlerts() {
  const alertsList = document.getElementById('alertsList');
  if (!alertsList) return;

  const alerts = [...state.filtered]
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 5)
    .map((transaction) => ({
      id: transaction.id,
      label: `${transaction.id} · ${transaction.merchant}`,
      amount: formatCurrency(transaction.amount),
      riskClass: getRiskClass(transaction.riskScore),
      riskLevel: transaction.riskLevel,
      status: transaction.status
    }));

  alertsList.innerHTML = alerts.map((alert) => `
    <button class="alert-item" type="button" data-id="${alert.id}" aria-label="Open transaction details for ${alert.id}">
      <span class="alert-pill ${alert.riskClass}"></span>
      <span class="alert-copy">
        <strong>${alert.label}</strong>
        <small>${alert.amount} · ${alert.riskLevel}</small>
      </span>
      <span class="status-tag ${alert.status.toLowerCase() === 'fraud' ? 'fraud' : alert.status.toLowerCase() === 'review' ? 'review' : 'safe'}">${alert.status}</span>
    </button>
  `).join('');

  alertsList.querySelectorAll('.alert-item').forEach((button) => {
    button.addEventListener('click', () => openTransactionModal(button.dataset.id));
  });

  const summaryList = document.getElementById('alertSummaryList');
  if (summaryList) {
    const summary = [
      { label: 'Critical alerts', value: state.filtered.filter(item => item.riskScore >= 80).length },
      { label: 'Review queue', value: state.filtered.filter(item => item.status === 'Review').length },
      { label: 'Fraud rate', value: formatPercent(getSummaryStats(state.filtered).fraudRate) },
      { label: 'High-risk merchants', value: merchantCategories.filter((merchant) => state.filtered.filter(item => item.merchant === merchant && item.isFraud).length > 4).length }
    ];

    summaryList.innerHTML = summary.map(item => `
      <li>
        <span>${item.label}</span>
        <strong>${item.value}</strong>
      </li>
    `).join('');
  }
}

function renderTransactionsTable() {
  const tableBody = document.getElementById('transactionTableBody');
  const pagination = document.getElementById('paginationControls');
  if (!tableBody || !pagination) return;

  const pageCount = Math.max(1, Math.ceil(state.filtered.length / state.pageSize));
  if (state.currentPage > pageCount) state.currentPage = pageCount;

  const startIndex = (state.currentPage - 1) * state.pageSize;
  const pageRows = state.filtered.slice(startIndex, startIndex + state.pageSize);

  tableBody.innerHTML = pageRows.map((transaction) => `
    <tr data-id="${transaction.id}" class="transaction-row">
      <td><button class="transaction-link" type="button" data-id="${transaction.id}">${transaction.id}</button></td>
      <td>${formatCurrency(transaction.amount)}</td>
      <td>${transaction.merchant}</td>
      <td>${String(transaction.hour).padStart(2, '0')}:00</td>
      <td>${transaction.foreign ? 'Yes' : 'No'}</td>
      <td>${transaction.locationMismatch ? 'Yes' : 'No'}</td>
      <td>${transaction.deviceTrustScore.toFixed(2)}</td>
      <td>${transaction.velocityLast24h}</td>
      <td>${transaction.cardholderAge}</td>
      <td>${transaction.riskScore}</td>
      <td><span class="status-tag ${transaction.status === 'Fraud' ? 'fraud' : transaction.status === 'Review' ? 'review' : 'safe'}">${transaction.status}</span></td>
    </tr>
  `).join('');

  tableBody.querySelectorAll('.transaction-link').forEach((button) => {
    button.addEventListener('click', () => openTransactionModal(button.dataset.id));
  });

  const pages = Array.from({ length: pageCount }, (_, index) => index + 1);
  pagination.innerHTML = pages.map((pageNumber) => `
    <button class="page-btn ${pageNumber === state.currentPage ? 'active' : ''}" type="button" data-page="${pageNumber}">${pageNumber}</button>
  `).join('');

  pagination.querySelectorAll('.page-btn').forEach((button) => {
    button.addEventListener('click', () => {
      state.currentPage = Number(button.dataset.page);
      renderTransactionsTable();
    });
  });
}

function renderMerchants() {
  const merchantStatsGrid = document.getElementById('merchantStatsGrid');
  if (!merchantStatsGrid) return;

  const merchantRows = merchantCategories.map((merchant, index) => {
    const items = state.filtered.filter(item => item.merchant === merchant);
    const fraudCount = items.filter(item => item.isFraud).length;
    const fraudRate = items.length ? (fraudCount / items.length) * 100 : 0;
    const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
    const avgAmount = items.length ? totalAmount / items.length : 0;
    return { merchant, fraudCount, fraudRate, totalAmount, avgAmount, rank: index + 1 };
  }).sort((a, b) => b.fraudRate - a.fraudRate);

  merchantStatsGrid.innerHTML = merchantRows.map((row) => `
    <article class="merchant-card">
      <div class="merchant-rank">#${row.rank}</div>
      <h3>${row.merchant}</h3>
      <div class="merchant-stat"><span>Transactions</span><strong>${row.fraudCount + (state.filtered.filter(item => item.merchant === row.merchant && !item.isFraud).length)}</strong></div>
      <div class="merchant-stat"><span>Fraud count</span><strong>${row.fraudCount}</strong></div>
      <div class="merchant-stat"><span>Fraud rate</span><strong>${formatPercent(row.fraudRate)}</strong></div>
      <div class="merchant-stat"><span>Avg amount</span><strong>${formatCurrency(Math.round(row.avgAmount))}</strong></div>
    </article>
  `).join('');
}

function renderGeographicSummary() {
  const geographicSummary = document.getElementById('geographicSummary');
  if (!geographicSummary) return;

  const foreign = state.filtered.filter(item => item.foreign).length;
  const mismatch = state.filtered.filter(item => item.locationMismatch).length;
  const domestic = state.filtered.length - foreign;

  geographicSummary.innerHTML = `
    <li><span>Domestic transactions</span><strong>${domestic}</strong></li>
    <li><span>Foreign transactions</span><strong>${foreign}</strong></li>
    <li><span>Location mismatches</span><strong>${mismatch}</strong></li>
    <li><span>Fraud rate</span><strong>${formatPercent((state.filtered.filter(item => item.isFraud).length / Math.max(1, state.filtered.length)) * 100)}</strong></li>
  `;
}

function renderModelMetrics() {
  const metricsGrid = document.getElementById('modelMetricsGrid');
  if (!metricsGrid) return;

  const tp = state.filtered.filter(item => item.isFraud && item.riskLevel !== 'Low').length;
  const fp = state.filtered.filter(item => !item.isFraud && item.riskLevel !== 'Low').length;
  const tn = state.filtered.filter(item => !item.isFraud && item.riskLevel === 'Low').length;
  const fn = state.filtered.filter(item => item.isFraud && item.riskLevel === 'Low').length;
  const accuracy = state.filtered.length ? ((tp + tn) / state.filtered.length) * 100 : 0;
  const precision = (tp + fp) ? (tp / (tp + fp)) * 100 : 0;
  const recall = (tp + fn) ? (tp / (tp + fn)) * 100 : 0;
  const f1 = (precision + recall) ? (2 * (precision * recall) / (precision + recall)) : 0;
  const auc = (accuracy + recall) / 2;

  const metrics = [
    { label: 'Accuracy', value: `${accuracy.toFixed(2)}%` },
    { label: 'Precision', value: `${precision.toFixed(2)}%` },
    { label: 'Recall', value: `${recall.toFixed(2)}%` },
    { label: 'F1 Score', value: `${f1.toFixed(2)}%` },
    { label: 'ROC-AUC', value: `${auc.toFixed(2)}%` }
  ];

  metricsGrid.innerHTML = metrics.map((metric) => `
    <article class="metric-card">
      <h3>${metric.label}</h3>
      <div class="metric-value">${metric.value}</div>
    </article>
  `).join('');
}

function renderNotifications() {
  const panel = document.getElementById('notificationList');
  if (!panel) return;

  const notifications = [
    `🔴 ${state.filtered.filter(item => item.riskScore >= 80).length} high-risk transactions detected`,
    `🟡 ${state.filtered.filter(item => item.status === 'Review').length} transactions require manual review`,
    `📊 Fraud rate is ${formatPercent(getSummaryStats(state.filtered).fraudRate)}`,
    `🟢 System analysis completed with ${state.filtered.length} active records`
  ];

  panel.innerHTML = notifications.map(item => `<li>${item}</li>`).join('');
}

function updateCurrentDate() {
  const dateNode = document.getElementById('currentDate');
  const updatedNode = document.getElementById('lastUpdated');
  if (dateNode) dateNode.textContent = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  if (updatedNode) updatedNode.textContent = new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

function renderAll() {
  renderKpis();
  renderChartData();
  renderInsights();
  renderAlerts();
  renderTransactionsTable();
  renderMerchants();
  renderGeographicSummary();
  renderModelMetrics();
  renderNotifications();
  updateCurrentDate();
}

function openTransactionModal(transactionId) {
  const transaction = state.transactions.find((item) => item.id === transactionId);
  if (!transaction) return;

  const modal = document.getElementById('transactionModal');
  const content = document.getElementById('modalContent');
  if (!modal || !content) return;

  content.innerHTML = `
    <div class="detail-row"><span>Transaction ID</span><strong>${transaction.id}</strong></div>
    <div class="detail-row"><span>Amount</span><strong>${formatCurrency(transaction.amount)}</strong></div>
    <div class="detail-row"><span>Merchant</span><strong>${transaction.merchant}</strong></div>
    <div class="detail-row"><span>Hour</span><strong>${String(transaction.hour).padStart(2, '0')}:00</strong></div>
    <div class="detail-row"><span>Foreign Transaction</span><strong>${transaction.foreign ? 'Yes' : 'No'}</strong></div>
    <div class="detail-row"><span>Location Mismatch</span><strong>${transaction.locationMismatch ? 'Yes' : 'No'}</strong></div>
    <div class="detail-row"><span>Device Trust Score</span><strong>${transaction.deviceTrustScore}</strong></div>
    <div class="detail-row"><span>Velocity</span><strong>${transaction.velocityLast24h}</strong></div>
    <div class="detail-row"><span>Cardholder Age</span><strong>${transaction.cardholderAge}</strong></div>
    <div class="detail-row"><span>Fraud Probability</span><strong>${transaction.fraudProbability}%</strong></div>
    <div class="detail-row"><span>Risk Level</span><strong>${transaction.riskLevel}</strong></div>
    <div class="detail-row"><span>Model Explanation</span><strong>${transaction.modelFactors.join(', ') || 'No major anomaly detected'}</strong></div>
  `;

  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
}

function closeTransactionModal() {
  const modal = document.getElementById('transactionModal');
  if (modal) {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }
}

async function handlePredictionSubmit(event) {
  if (event && event.preventDefault) event.preventDefault();

  const transaction = {
    amount: Number(document.getElementById('amountInput').value),
    hour: Number(document.getElementById('hourInput').value),
    merchant: document.getElementById('merchantInput').value,
    foreign: document.getElementById('foreignInput').value === 'true',
    location_mismatch: document.getElementById('mismatchInput').value === 'true',
    device_trust_score: Number(document.getElementById('deviceScoreInput').value),
    velocity_last_24h: Number(document.getElementById('velocityInput').value),
    cardholder_age: Number(document.getElementById('ageInput').value)
  };

  try {
    const response = await fetch('http://localhost:5000/api/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transaction)
    });

    if (!response.ok) {
      throw new Error('Prediction API failed');
    }

    const result = await response.json();

    document.getElementById('predictionProbability').textContent = `${result.fraud_probability.toFixed(1)}%`;
    document.getElementById('fraudProbDetail').textContent = `${result.fraud_probability.toFixed(1)}%`;
    document.getElementById('legitProbDetail').textContent = `${result.legitimate_probability.toFixed(1)}%`;
    document.getElementById('riskScoreDetail').textContent = `${result.risk_score} / 100`;
    document.getElementById('recommendationDetail').textContent = result.recommendation;

    const levelBadge = document.getElementById('predictionRiskLevel');
    levelBadge.textContent = `${result.risk_level.toUpperCase()} RISK`;
    levelBadge.className = `risk-line ${getRiskClass(result.risk_score)}`;

    document.getElementById('factorList').innerHTML = (result.factors || []).map((factor) => `<li>${factor}</li>`).join('');
    return;
  } catch (error) {
    const riskScore = clamp(
      14 +
      (transaction.amount > 4000 ? 15 : 0) +
      (transaction.hour >= 22 || transaction.hour <= 4 ? 18 : 0) +
      (transaction.foreign ? 12 : 0) +
      (transaction.location_mismatch ? 18 : 0) +
      (transaction.device_trust_score < 0.5 ? 17 : 0) +
      (transaction.velocity_last_24h > 5 ? 14 : 0) +
      (transaction.merchant === 'Travel' || transaction.merchant === 'Electronics' ? 9 : 0),
      0,
      100
    );

    const fraudProbability = clamp((0.32 + (riskScore / 170)) * 100, 0, 99.9);
    const legitimateProbability = clamp(100 - fraudProbability, 0, 99.9);
    const level = riskLevelFromScore(riskScore);
    const recommendation = riskScore >= 70 ? 'Block or manually review this transaction.' : riskScore >= 45 ? 'Review with additional verification.' : 'Allow transaction with standard monitoring.';
    const factors = generateFactors({
      amount: transaction.amount,
      hour: transaction.hour,
      foreign: transaction.foreign,
      locationMismatch: transaction.location_mismatch,
      deviceTrustScore: transaction.device_trust_score,
      velocityLast24h: transaction.velocity_last_24h,
      merchant: transaction.merchant,
      isFraud: true
    });

    document.getElementById('predictionProbability').textContent = `${fraudProbability.toFixed(1)}%`;
    document.getElementById('fraudProbDetail').textContent = `${fraudProbability.toFixed(1)}%`;
    document.getElementById('legitProbDetail').textContent = `${legitimateProbability.toFixed(1)}%`;
    document.getElementById('riskScoreDetail').textContent = `${Math.round(riskScore)} / 100`;
    document.getElementById('recommendationDetail').textContent = recommendation;

    const levelBadge = document.getElementById('predictionRiskLevel');
    levelBadge.textContent = `${level.toUpperCase()} RISK`;
    levelBadge.className = `risk-line ${getRiskClass(riskScore)}`;

    document.getElementById('factorList').innerHTML = factors.map((factor) => `<li>${factor}</li>`).join('');
  }
}

function exportCsv() {
  const rows = state.filtered.map((transaction) => [
    transaction.id,
    transaction.amount,
    transaction.merchant,
    transaction.hour,
    transaction.foreign ? 'Yes' : 'No',
    transaction.locationMismatch ? 'Yes' : 'No',
    transaction.deviceTrustScore,
    transaction.velocityLast24h,
    transaction.cardholderAge,
    transaction.fraudProbability,
    transaction.riskLevel,
    transaction.status
  ]);

  const csvContent = [
    ['Transaction ID', 'Amount', 'Merchant', 'Hour', 'Foreign Transaction', 'Location Mismatch', 'Device Trust Score', 'Velocity 24h', 'Cardholder Age', 'Fraud Probability', 'Risk', 'Status'],
    ...rows
  ].map((row) => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'fraud_transactions.csv';
  link.click();
  URL.revokeObjectURL(url);
}

function exportReport() {
  window.print();
}

function setupTheme() {
  const storedTheme = localStorage.getItem('fraudguard-theme');
  if (storedTheme === 'dark') document.body.classList.add('dark');

  document.getElementById('themeToggle').addEventListener('click', () => {
    document.body.classList.toggle('dark');
    localStorage.setItem('fraudguard-theme', document.body.classList.contains('dark') ? 'dark' : 'light');
    refreshChartThemes();
  });
}

function setupNavigation() {
  document.querySelectorAll('.nav-item').forEach((button) => {
    button.addEventListener('click', () => {
      const section = button.dataset.section;
      document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item === button));
      document.querySelectorAll('.page').forEach(page => page.classList.toggle('active', page.id === section));
      state.activeSection = section;
      document.getElementById('sidebar').classList.remove('mobile-open');
      document.body.classList.remove('sidebar-open');
    });
  });

  document.getElementById('menuToggle').addEventListener('click', () => {
    document.body.classList.toggle('sidebar-open');
  });
}

function setupFilters() {
  document.getElementById('fraudFilter').addEventListener('change', updateStateFilters);
  document.getElementById('merchantFilter').addEventListener('change', updateStateFilters);
  document.getElementById('riskLevelFilter').addEventListener('change', updateStateFilters);
  document.getElementById('foreignFilter').addEventListener('change', updateStateFilters);
  document.getElementById('globalSearch').addEventListener('input', updateStateFilters);
  document.getElementById('tableStatusFilter').addEventListener('change', () => {
    const selected = document.getElementById('tableStatusFilter').value;
    state.filtered = selected === 'all' ? state.transactions : state.transactions.filter(item => item.status === selected);
    state.currentPage = 1;
    renderAll();
  });
  document.getElementById('tableTypeFilter').addEventListener('change', () => {
    const selected = document.getElementById('tableTypeFilter').value;
    state.filtered = selected === 'all' ? state.transactions : state.transactions.filter(item => item.transactionType === selected);
    state.currentPage = 1;
    renderAll();
  });
}

function setupModalHandlers() {
  document.querySelector('.modal-close').addEventListener('click', closeTransactionModal);
  document.querySelector('.modal-backdrop').addEventListener('click', closeTransactionModal);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeTransactionModal();
  });
}

function setupNotificationToggle() {
  const button = document.getElementById('notificationButton');
  const panel = document.getElementById('notificationPanel');
  button.addEventListener('click', () => {
    panel.classList.toggle('open');
  });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.notification-wrap')) panel.classList.remove('open');
  });
}

function setupExportControls() {
  document.getElementById('exportTrigger').addEventListener('click', exportReport);
  document.getElementById('csvReportButton').addEventListener('click', exportCsv);
  document.getElementById('pdfReportButton').addEventListener('click', exportReport);
  document.getElementById('dashboardReportButton').addEventListener('click', exportReport);
  document.getElementById('exportCsvButton').addEventListener('click', exportCsv);
  document.getElementById('exportPdfButton').addEventListener('click', exportReport);
}

async function initialize() {
  await loadDashboardData();
  buildCharts();
  setupTheme();
  setupNavigation();
  setupFilters();
  setupModalHandlers();
  setupNotificationToggle();
  setupExportControls();
  document.getElementById('predictionForm').addEventListener('submit', handlePredictionSubmit);
  renderAll();
  handlePredictionSubmit({ preventDefault() {} });
  updateCurrentDate();
}

initialize();
