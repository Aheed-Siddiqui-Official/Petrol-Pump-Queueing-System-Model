// Frontend: reads the form, sends it to the backend, and shows the answer.
const $ = (id) => document.getElementById(id);

const MODELS = [
  ['GG1', 'G/G/1 (Empirically Verified by Chi-Square Test) — Recommended'],
  ['MG1', 'M/G/1 (Poisson arrivals, General service variance)'],
  ['MM1', 'M/M/1 (Poisson arrivals, Exponential service)']
];

// Configuration for the 6 exact requested parameters
const METRIC_CONFIG = {
  rho: {
    icon: '⚡',
    label: 'Utilization (ρ)',
    desc: 'Pump capacity load fraction',
    colorClass: 'metric-rho'
  },
  Lq: {
    icon: '🚗',
    label: 'Mean Number in Queue (Lq)',
    desc: 'Average vehicles waiting in line',
    colorClass: 'metric-lq'
  },
  Wq: {
    icon: '⏳',
    label: 'Mean Wait in Queue (Wq)',
    desc: 'Average delay before fueling starts',
    colorClass: 'metric-wq'
  },
  L: {
    icon: '⛽',
    label: 'Mean Number in System (L)',
    desc: 'Total vehicles at station (line + pump)',
    colorClass: 'metric-l'
  },
  W: {
    icon: '⏱️',
    label: 'Mean Wait in System (W)',
    desc: 'Total duration (waiting + fueling)',
    colorClass: 'metric-w'
  },
  p0: {
    icon: '💤',
    label: 'Idle Probability (P0)',
    desc: 'Probability pump has zero customers',
    colorClass: 'metric-p0'
  }
};

// Empirical baseline parameters computed directly from Final_Data_Transformed.csv (300 vehicles, 6 days)
const EMPIRICAL_DATA = {
  model: 'GG1',
  displayUnit: 'minutes',
  arrival: { unit: 'seconds', type: 'time', value: 40.15, sd: 23.54 },
  service: { unit: 'seconds', type: 'time', value: 39.94, sd: 23.45 }
};

// Fill the model list
function fillModels() {
  const modelEl = $('model');
  if (modelEl) {
    modelEl.innerHTML = MODELS
      .map(([value, text]) => `<option value="${value}">${text}</option>`).join('');
  }
}

// Show only the fields the chosen model needs, and update the labels
function refreshForm() {
  const modelEl = $('model');
  if (!modelEl) return;
  const m = modelEl.value;
  const generalArrival = m.startsWith('GG');
  const generalService = m !== 'MM1';

  const arrSdRow = $('arrSdRow');
  const svcSdRow = $('svcSdRow');
  const arrLegend = $('arrLegend');
  const svcLegend = $('svcLegend');

  if (arrSdRow) arrSdRow.hidden = !generalArrival;
  if (svcSdRow) svcSdRow.hidden = !generalService;
  if (arrLegend) arrLegend.textContent = generalArrival ? 'Arrival Process (General)' : 'Arrival Process (Poisson)';
  if (svcLegend) svcLegend.textContent = generalService ? 'Service Process (General)' : 'Service Process (Exponential)';

  for (const side of ['arr', 'svc']) {
    const unitEl = $(side + 'Unit');
    const typeEl = $(side + 'Type');
    if (!unitEl || !typeEl) continue;
    const unit = unitEl.value;
    const rate = typeEl.value === 'rate';
    const name = side === 'arr' ? 'Arrival' : 'Service';
    const timeName = side === 'arr' ? 'inter-arrival time' : 'service time';
    const valLbl = $(side + 'ValueLabel');
    const sdLbl = $(side + 'SdLabel');
    if (valLbl) valLbl.textContent = rate ? `${name} Rate, per ${unit.slice(0, -1)}` : `Mean ${timeName} (${unit})`;
    if (sdLbl) sdLbl.textContent = `Standard deviation of ${timeName} (${unit})`;
  }
}

const num = (id) => {
  const el = $(id);
  return (!el || el.value === '') ? null : Number(el.value);
};

function readForm() {
  return {
    model: $('model') ? $('model').value : 'GG1',
    displayUnit: $('displayUnit') ? $('displayUnit').value : 'minutes',
    arrival: {
      unit: $('arrUnit') ? $('arrUnit').value : 'seconds',
      type: $('arrType') ? $('arrType').value : 'time',
      value: num('arrValue'),
      sd: num('arrSd')
    },
    service: {
      unit: $('svcUnit') ? $('svcUnit').value : 'seconds',
      type: $('svcType') ? $('svcType').value : 'time',
      value: num('svcValue'),
      sd: num('svcSd')
    }
  };
}

function show(message, isError) {
  const msgEl = $('message');
  if (msgEl) {
    msgEl.textContent = message;
    msgEl.className = isError ? 'message error' : 'message';
    msgEl.hidden = !message;
  }
}

function updateStatusBadge(isStable, rho) {
  const badge = $('systemStatus');
  if (!badge) return;
  if (isStable) {
    if (rho >= 0.9) {
      badge.className = 'status-badge status-warning';
      badge.textContent = 'High Load (ρ ≥ 90%)';
    } else {
      badge.className = 'status-badge status-stable';
      badge.textContent = 'Steady State Equilibrium';
    }
  } else {
    badge.className = 'status-badge status-danger';
    badge.textContent = 'Unstable (ρ ≥ 1.0)';
  }
}

function showResults(data) {
  if (!data) return;
  const fmt = (n) => (Number.isInteger(n) ? n : n.toFixed(4));
  
  const results = Array.isArray(data.results) ? data.results : [];

  // Strictly filter to the exact 6 requested parameters
  const allowedKeys = ['rho', 'Lq', 'Wq', 'L', 'W', 'p0'];
  const displayMetrics = results.filter((r) => allowedKeys.includes(r.key));

  const cardsEl = $('cards');
  if (cardsEl) {
    cardsEl.innerHTML = displayMetrics.map((r) => {
      const cfg = METRIC_CONFIG[r.key] || { icon: '📊', label: r.label, desc: '', colorClass: '' };
      return `
        <div class="card ${cfg.colorClass}">
          <div class="card-top">
            <span class="card-icon">${cfg.icon}</span>
            <span class="card-title">${cfg.label}</span>
          </div>
          <div class="card-body">
            <strong class="card-value">${fmt(r.value)}</strong>
            ${r.unit ? `<small class="card-unit">${r.unit}</small>` : ''}
          </div>
          <div class="card-desc">${cfg.desc}</div>
        </div>
      `;
    }).join('');
  }

  const rhoItem = results.find((r) => r.key === 'rho');
  const gaugeBox = $('gaugeBox');
  if (rhoItem && gaugeBox) {
    const rho = rhoItem.value;
    const gaugeText = $('gaugeText');
    const gaugeFill = $('gaugeFill');
    const pill = $('gaugeStatusPill');

    const pct = (rho * 100).toFixed(1);
    if (gaugeText) gaugeText.textContent = pct + '%';
    
    if (gaugeFill) {
      gaugeFill.style.width = Math.min(rho * 100, 100) + '%';
      gaugeFill.className = rho >= 0.9 ? 'hot' : (rho >= 0.75 ? 'warm' : '');
    }

    if (pill) {
      if (rho >= 1.0) {
        pill.className = 'gauge-pill pill-critical';
        pill.textContent = 'Saturated (ρ ≥ 1)';
      } else if (rho >= 0.85) {
        pill.className = 'gauge-pill pill-heavy';
        pill.textContent = 'Near Capacity';
      } else if (rho >= 0.65) {
        pill.className = 'gauge-pill pill-moderate';
        pill.textContent = 'Moderate Traffic';
      } else {
        pill.className = 'gauge-pill pill-ok';
        pill.textContent = 'Smooth Flow';
      }
    }

    gaugeBox.hidden = false;
    updateStatusBadge(rho < 1.0, rho);
  }
  show('', false);
}

function clearResults() {
  const cardsEl = $('cards');
  if (cardsEl) cardsEl.innerHTML = '';
  const gaugeBox = $('gaugeBox');
  if (gaugeBox) gaugeBox.hidden = true;
  const badge = $('systemStatus');
  if (badge) {
    badge.className = 'status-badge status-ready';
    badge.textContent = 'Ready';
  }
}

async function calculate() {
  clearResults();
  const formPayload = readForm();
  try {
    const res = await fetch('/api/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formPayload)
    });
    if (res.ok) {
      const data = await res.json();
      return showResults(data);
    }
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await res.json().catch(() => null);
      if (data && data.error) {
        updateStatusBadge(false, 1.0);
        return show(data.error, true);
      }
    }
  } catch (err) {
    // Network failure or static fallback
  }

  // Fallback to client-side math
  if (window.queueModels && typeof window.queueModels.calculate === 'function') {
    try {
      const localData = window.queueModels.calculate(formPayload);
      return showResults(localData);
    } catch (calcErr) {
      updateStatusBadge(false, 1.0);
      return show(calcErr.message, true);
    }
  }
  show('Could not calculate results. Please check your inputs.', true);
}

function clearForm() {
  for (const id of ['arrValue', 'arrSd', 'svcValue', 'svcSd']) {
    const el = $(id);
    if (el) el.value = '';
  }
  clearResults();
  show('Configure parameters and press Calculate.', false);
}

function loadEmpiricalPreset() {
  const setVal = (id, val) => {
    const el = $(id);
    if (el) el.value = val;
  };

  setVal('model', EMPIRICAL_DATA.model);
  setVal('displayUnit', EMPIRICAL_DATA.displayUnit);

  setVal('arrUnit', EMPIRICAL_DATA.arrival.unit);
  setVal('arrType', EMPIRICAL_DATA.arrival.type);
  setVal('arrValue', EMPIRICAL_DATA.arrival.value);
  setVal('arrSd', EMPIRICAL_DATA.arrival.sd);

  setVal('svcUnit', EMPIRICAL_DATA.service.unit);
  setVal('svcType', EMPIRICAL_DATA.service.type);
  setVal('svcValue', EMPIRICAL_DATA.service.value);
  setVal('svcSd', EMPIRICAL_DATA.service.sd);

  refreshForm();
  calculate();
}

for (const id of ['model', 'arrUnit', 'arrType', 'svcUnit', 'svcType']) {
  const el = $(id);
  if (el) el.addEventListener('change', refreshForm);
}

const calcBtn = $('calcBtn');
if (calcBtn) calcBtn.addEventListener('click', calculate);

const clearBtn = $('clearBtn');
if (clearBtn) clearBtn.addEventListener('click', clearForm);

const loadBtn = $('loadPresetBtn');
if (loadBtn) loadBtn.addEventListener('click', loadEmpiricalPreset);

fillModels();
refreshForm();
