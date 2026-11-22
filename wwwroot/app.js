// ============================================================================
// Petrol Pump Queueing System - Web Interface Controller
// Manages:
//   1. Tab Navigation (Analytical Models vs Discrete Simulator)
//   2. Analytical Queueing Calculator (M/M/1, M/G/1, G/G/1)
//   3. Discrete-Event Simulator (M/M/1, M/M/2 with Trace Table & Gantt Chart)
// ============================================================================

const $ = (id) => document.getElementById(id);

// ----------------------------------------------------------------------------
// Analytical Models Setup
// ----------------------------------------------------------------------------
const ANALYTICAL_MODELS = [
  ['GG1', 'G/G/1 (General arrivals & service — Confirmed Empirical Fit)'],
  ['MG1', 'M/G/1 (Poisson arrivals, General service variance)'],
  ['MM1', 'M/M/1 (Poisson arrivals, Exponential service)']
];

const METRIC_CONFIG = {
  rho: { icon: '⚡', label: 'Utilization (ρ)', desc: 'Pump capacity load fraction', colorClass: 'metric-rho' },
  Lq:  { icon: '🚗', label: 'Mean Number in Queue (Lq)', desc: 'Average vehicles waiting in line', colorClass: 'metric-lq' },
  Wq:  { icon: '⏳', label: 'Mean Wait in Queue (Wq)', desc: 'Average delay before fueling starts', colorClass: 'metric-wq' },
  L:   { icon: '⛽', label: 'Mean Number in System (L)', desc: 'Total vehicles at station (line + pump)', colorClass: 'metric-l' },
  W:   { icon: '⏱️', label: 'Mean Wait in System (W)', desc: 'Total duration (waiting + fueling)', colorClass: 'metric-w' },
  p0:  { icon: '💤', label: 'Idle Probability (P0)', desc: 'Probability pump has zero customers', colorClass: 'metric-p0' }
};

// ----------------------------------------------------------------------------
// Simulator State
// ----------------------------------------------------------------------------
const simState = {
  model: 'MM1',       // 'MM1' or 'MM2'
  timeUnit: 'seconds',// 'seconds', 'minutes', 'hours'
  arrType: 'time',    // 'time' or 'rate'
  svcType: 'time'     // 'time' or 'rate'
};

// ----------------------------------------------------------------------------
// Initialization
// ----------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  setupAnalyticalCalculator();
  setupDiscreteSimulator();
});

// ----------------------------------------------------------------------------
// Tab Navigation
// ----------------------------------------------------------------------------
function setupTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabBtns.forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach((p) => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPane = $(btn.dataset.tab);
      if (targetPane) targetPane.classList.add('active');
    });
  });
}

// ----------------------------------------------------------------------------
// Analytical Calculator Functions
// ----------------------------------------------------------------------------
function setupAnalyticalCalculator() {
  const modelSelect = $('model');
  if (modelSelect) {
    modelSelect.innerHTML = ANALYTICAL_MODELS
      .map(([val, text]) => `<option value="${val}" ${val === 'GG1' ? 'selected' : ''}>${text}</option>`)
      .join('');
    modelSelect.addEventListener('change', refreshAnalyticalForm);
  }

  $('arrType')?.addEventListener('change', refreshAnalyticalForm);
  $('arrUnit')?.addEventListener('change', refreshAnalyticalForm);
  $('svcType')?.addEventListener('change', refreshAnalyticalForm);
  $('svcUnit')?.addEventListener('change', refreshAnalyticalForm);
  $('displayUnit')?.addEventListener('change', refreshAnalyticalForm);

  $('calcBtn')?.addEventListener('click', handleCalculateAnalytical);
  $('clearBtn')?.addEventListener('click', clearAnalyticalForm);

  refreshAnalyticalForm();
}

function refreshAnalyticalForm() {
  const model = $('model')?.value || 'GG1';
  const arrType = $('arrType')?.value || 'time';
  const svcType = $('svcType')?.value || 'time';
  const arrUnit = $('arrUnit')?.value || 'minutes';
  const svcUnit = $('svcUnit')?.value || 'minutes';

  // Toggle Standard Deviation inputs
  const arrSdRow = $('arrSdRow');
  if (arrSdRow) arrSdRow.hidden = !model.startsWith('GG');

  const svcSdRow = $('svcSdRow');
  if (svcSdRow) svcSdRow.hidden = (model === 'MM1');

  // Dynamic labels
  const arrValueLabel = $('arrValueLabel');
  if (arrValueLabel) {
    arrValueLabel.textContent = arrType === 'rate'
      ? `Arrival rate λ (vehicles / ${arrUnit.slice(0, -1)})`
      : `Mean inter-arrival time (${arrUnit})`;
  }

  const svcValueLabel = $('svcValueLabel');
  if (svcValueLabel) {
    svcValueLabel.textContent = svcType === 'rate'
      ? `Service rate μ (vehicles / ${svcUnit.slice(0, -1)})`
      : `Mean service time (${svcUnit})`;
  }

  const arrLegend = $('arrLegend');
  if (arrLegend) {
    arrLegend.textContent = model === 'GG1'
      ? 'Arrival Process (General Distribution G)'
      : 'Arrival Process (Poisson M)';
  }

  const svcLegend = $('svcLegend');
  if (svcLegend) {
    svcLegend.textContent = model === 'MM1'
      ? 'Service Process (Exponential M)'
      : 'Service Process (General Distribution G)';
  }
}

async function handleCalculateAnalytical() {
  clearAnalyticalResults();
  const msgEl = $('message');
  const statusEl = $('systemStatus');

  try {
    const input = {
      model: $('model').value,
      displayUnit: $('displayUnit').value,
      arrival: {
        unit: $('arrUnit').value,
        type: $('arrType').value,
        value: parseFloat($('arrValue').value),
        sd: parseFloat($('arrSd').value) || 0
      },
      service: {
        unit: $('svcUnit').value,
        type: $('svcType').value,
        value: parseFloat($('svcValue').value),
        sd: parseFloat($('svcSd').value) || 0
      }
    };

    if (statusEl) {
      statusEl.textContent = 'Calculating...';
      statusEl.className = 'status-badge status-ready';
    }

    let data;
    try {
      const resp = await fetch('/api/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      });
      if (resp.ok) {
        data = await resp.json();
      } else {
        const err = await resp.json();
        throw new Error(err.error || 'Backend calculation error.');
      }
    } catch {
      // Offline / fallback to client-side engine
      data = window.queueModels.calculate(input);
    }

    renderAnalyticalResults(data);

    if (statusEl) {
      statusEl.textContent = 'Operational';
      statusEl.className = 'status-badge status-stable';
    }
    if (msgEl) msgEl.hidden = true;

  } catch (err) {
    if (msgEl) {
      msgEl.hidden = false;
      msgEl.textContent = err.message || 'Could not calculate results. Please check your inputs.';
      msgEl.className = 'message error';
    }
    if (statusEl) {
      statusEl.textContent = 'Error';
      statusEl.className = 'status-badge status-unstable';
    }
  }
}

function renderAnalyticalResults(data) {
  const results = Array.isArray(data.results) ? data.results : [];
  const rhoItem = results.find((r) => r.key === 'rho');
  const rho = rhoItem ? rhoItem.value : 0;

  // Gauge
  const gaugeBox = $('gaugeBox');
  const gaugeFill = $('gaugeFill');
  const gaugeText = $('gaugeText');
  const gaugePill = $('gaugeStatusPill');

  if (gaugeBox) gaugeBox.hidden = false;
  if (gaugeFill) gaugeFill.style.width = `${Math.min(100, Math.max(0, rho * 100)).toFixed(1)}%`;
  if (gaugeText) gaugeText.textContent = `${(rho * 100).toFixed(1)}%`;

  if (gaugePill) {
    if (rho >= 0.95) {
      gaugePill.textContent = 'Near Capacity';
      gaugePill.className = 'gauge-pill pill-danger';
    } else if (rho >= 0.75) {
      gaugePill.textContent = 'Moderate Congestion';
      gaugePill.className = 'gauge-pill pill-warn';
    } else {
      gaugePill.textContent = 'Optimal Flow';
      gaugePill.className = 'gauge-pill pill-ok';
    }
  }

  // 6 Result Cards
  const cardsEl = $('cards');
  if (cardsEl) {
    const targetKeys = ['rho', 'L', 'Lq', 'W', 'Wq', 'p0'];
    const filteredResults = targetKeys
      .map((k) => results.find((r) => r.key === k))
      .filter(Boolean);

    cardsEl.innerHTML = filteredResults.map((item) => {
      const cfg = METRIC_CONFIG[item.key] || { icon: '📊', label: item.label, desc: '', colorClass: '' };
      const valStr = typeof item.value === 'number' ? Number(item.value.toFixed(4)) : item.value;
      const unitStr = item.unit ? `<span class="card-unit">${item.unit}</span>` : '';

      return `
        <div class="card ${cfg.colorClass}">
          <div class="card-top">
            <span class="card-icon">${cfg.icon}</span>
            <span class="card-title">${cfg.label}</span>
          </div>
          <div class="card-body">
            <strong class="card-val">${valStr}</strong> ${unitStr}
          </div>
          <div class="card-desc">${cfg.desc}</div>
        </div>
      `;
    }).join('');
  }

  // Step-by-step
  const stepsBox = $('stepsBox');
  const stepsList = $('stepsList');
  if (stepsBox && stepsList && Array.isArray(data.steps) && data.steps.length > 0) {
    stepsBox.hidden = false;
    stepsList.innerHTML = data.steps.map((s) => `<li>${s}</li>`).join('');
  }
}

function clearAnalyticalResults() {
  const gaugeBox = $('gaugeBox');
  if (gaugeBox) gaugeBox.hidden = true;
  const cards = $('cards');
  if (cards) cards.innerHTML = '';
  const stepsBox = $('stepsBox');
  if (stepsBox) stepsBox.hidden = true;
}

function clearAnalyticalForm() {
  $('arrValue').value = '';
  $('arrSd').value = '';
  $('svcValue').value = '';
  $('svcSd').value = '';
  clearAnalyticalResults();

  const msg = $('message');
  if (msg) {
    msg.hidden = false;
    msg.textContent = 'Enter arrival and service values on the left and click Calculate Metrics.';
    msg.className = 'message';
  }
  const status = $('systemStatus');
  if (status) {
    status.textContent = 'Ready';
    status.className = 'status-badge status-ready';
  }
}

// ----------------------------------------------------------------------------
// Discrete-Event Simulator Functions
// ----------------------------------------------------------------------------
function setupDiscreteSimulator() {
  // Model Toggle Buttons (MM1 vs MM2)
  const modelBtns = document.querySelectorAll('[data-sim-model]');
  modelBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      modelBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      simState.model = btn.dataset.simModel;
      updateSimLabels();
    });
  });

  // Time Unit Toggle Buttons
  const unitBtns = document.querySelectorAll('#simTimeUnitGroup .btn-toggle');
  unitBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      unitBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      simState.timeUnit = btn.dataset.unit;
      updateSimLabels();
    });
  });

  // Arrival Type Toggle Buttons
  const arrTypeBtns = document.querySelectorAll('#simArrTypeGroup .btn-toggle');
  arrTypeBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      arrTypeBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      simState.arrType = btn.dataset.type;
      updateSimLabels();
    });
  });

  // Service Type Toggle Buttons
  const svcTypeBtns = document.querySelectorAll('#simSvcTypeGroup .btn-toggle');
  svcTypeBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      svcTypeBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      simState.svcType = btn.dataset.type;
      updateSimLabels();
    });
  });

  // Action Buttons
  $('runSimBtn')?.addEventListener('click', handleRunSimulation);
  $('clearSimBtn')?.addEventListener('click', clearSimulator);
  $('copyTraceBtn')?.addEventListener('click', copyTraceTableToClipboard);

  updateSimLabels();
}

function updateSimLabels() {
  const u = simState.timeUnit;
  const uShort = u === 'seconds' ? 'sec' : (u === 'minutes' ? 'min' : 'hr');

  // Arrival label
  const arrLabel = $('simArrLabel');
  const arrHint = $('simArrHint');
  if (arrLabel) {
    arrLabel.textContent = simState.arrType === 'rate'
      ? `Arrival rate λ (vehicles / ${uShort})`
      : `Mean inter-arrival time (${uShort})`;
  }
  if (arrHint) {
    arrHint.textContent = simState.arrType === 'rate'
      ? `Poisson arrival rate λ. Mean inter-arrival = 1/λ ${uShort}.`
      : `Exponential inter-arrival mean time (${uShort}).`;
  }

  // Service label
  const svcLabel = $('simSvcLabel');
  const svcHint = $('simSvcHint');
  if (svcLabel) {
    svcLabel.textContent = simState.svcType === 'rate'
      ? `Service rate μ (vehicles / ${uShort})`
      : `Mean service time (${uShort})`;
  }
  if (svcHint) {
    svcHint.textContent = simState.svcType === 'rate'
      ? `Service rate μ per pump. Mean service = 1/μ ${uShort}.`
      : `Exponential service mean time per pump (${uShort}).`;
  }
}

async function handleRunSimulation() {
  const arrVal = parseFloat($('simArrValue')?.value);
  const svcVal = parseFloat($('simSvcValue')?.value);

  if (!(arrVal > 0) || !(svcVal > 0)) {
    alert('Please enter valid positive values for both Vehicle Arrival and Pump Service.');
    return;
  }

  const custCount = parseInt($('simCustomerCount')?.value, 10) || 10;

  const simRequest = {
    model: simState.model,
    customerCount: custCount,
    timeUnit: simState.timeUnit,
    seed: null,
    arrival: {
      unit: simState.timeUnit,
      type: simState.arrType,
      value: arrVal
    },
    service: {
      unit: simState.timeUnit,
      type: simState.svcType,
      value: svcVal
    }
  };

  try {
    let data;
    try {
      const resp = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(simRequest)
      });
      if (resp.ok) {
        data = await resp.json();
      } else {
        const err = await resp.json();
        throw new Error(err.error || 'Server simulation failed.');
      }
    } catch {
      // Client-side fallback
      data = window.queueModels.simulateQueue(simRequest);
    }

    renderSimulationResults(data);

  } catch (err) {
    alert(`Simulation failed: ${err.message}`);
  }
}

function renderSimulationResults(data) {
  const resPanel = $('simResultPanel');
  if (resPanel) resPanel.hidden = false;

  const uShort = data.timeUnit === 'seconds' ? 'sec' : (data.timeUnit === 'minutes' ? 'min' : 'hr');
  document.querySelectorAll('.sim-unit-txt').forEach((el) => { el.textContent = uShort; });

  // Badges & Total Time
  $('simModelBadge').textContent = data.model === 'MM2' ? 'M/M/2 (2 Pumps)' : 'M/M/1 (1 Pump)';
  $('simTotalTime').textContent = data.totalSimulationTime.toFixed(2);
  $('simTotalSimVal').textContent = data.totalSimulationTime.toFixed(2);

  // Utilization Progress Bar
  const utilPct = (data.simulatedUtilization * 100).toFixed(2);
  $('simUtilVal').textContent = `${utilPct}%`;
  $('simUtilFill').style.width = `${Math.min(100, Math.max(0, data.simulatedUtilization * 100)).toFixed(1)}%`;
  $('simUtilFormula').textContent = `ρ = ΣService / (${data.servers} × T) • ${data.customerCount} vehicles simulated`;

  const sBreakdown = $('simServerBreakdown');
  if (data.model === 'MM2' && data.server1Utilization !== null && data.server2Utilization !== null) {
    sBreakdown.hidden = false;
    sBreakdown.innerHTML = `Pump 1: <strong>${(data.server1Utilization * 100).toFixed(1)}%</strong> | Pump 2: <strong>${(data.server2Utilization * 100).toFixed(1)}%</strong>`;
  } else {
    sBreakdown.hidden = true;
  }

  // Theory vs Simulation Alert
  const alertEl = $('simTheoryAlert');
  if (alertEl) {
    const theoRhoStr = data.theoreticalRho.toFixed(4);
    if (!data.isTheoreticalStable) {
      alertEl.className = 'sim-theory-alert alert-danger';
      alertEl.innerHTML = `
        <div class="alert-head">⚠️ Theoretical ρ = ${theoRhoStr} ≥ 1.0 — System is UNSTABLE in theory</div>
        <p>In theory, arrivals exceed service capacity; queue grows infinitely in the long run. In this finite simulation run of ${data.customerCount} vehicles, simulated utilization was ${utilPct}%.</p>
      `;
    } else {
      alertEl.className = 'sim-theory-alert alert-ok';
      alertEl.innerHTML = `
        <div class="alert-head">💡 Steady-State Theory Comparison: Theoretical ρ = ${theoRhoStr} (Stable)</div>
        <div class="alert-compare-grid">
          <div>Theoretical Lq: <strong>${data.theoreticalLq ?? '—'}</strong> vs Simulated Lq: <strong>${data.avgQueueLength}</strong></div>
          <div>Theoretical Wq: <strong>${data.theoreticalWq ?? '—'}</strong> vs Simulated Wq: <strong>${data.avgWaitQueue} ${uShort}</strong></div>
          <div>Theoretical L: <strong>${data.theoreticalL ?? '—'}</strong> vs Simulated L: <strong>${data.avgNumberSystem}</strong></div>
          <div>Theoretical P₀: <strong>${data.theoreticalP0 ?? '—'}</strong> (Idle probability)</div>
        </div>
      `;
    }
  }

  // 3 Category Metric Cards
  $('simLqVal').textContent = data.avgQueueLength.toFixed(4);
  $('simWqVal').textContent = data.avgWaitQueue.toFixed(4);
  $('simResponseTimeVal').textContent = data.avgWaitQueue.toFixed(4);

  $('simLVal').textContent = data.avgNumberSystem.toFixed(4);
  $('simWVal').textContent = data.avgTimeSystem.toFixed(4);

  $('simAvgInterArrVal').textContent = data.avgInterArrivalTime.toFixed(2);
  $('simAvgSvcVal').textContent = data.avgServiceTime.toFixed(2);
  $('simWaitedVal').textContent = `${data.customersWaitedCount} / ${data.customerCount}`;
  $('simWaitedPct').textContent = `(${data.customersWaitedPercent}%)`;
  $('simMaxWaitVal').textContent = data.maxWaitTime.toFixed(2);
  $('simMaxQueueVal').textContent = data.maxQueueLength;

  // Trace Table
  renderTraceTable(data.rows, data.model, uShort);

  // Gantt Chart
  renderGanttChart(data.rows, data.servers, data.totalSimulationTime, uShort);

  // Scroll to results smoothly
  resPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function renderTraceTable(rows, model, unitStr) {
  const tbody = $('traceTableBody');
  const thServer = $('thServer');
  if (thServer) thServer.hidden = (model !== 'MM2');

  $('traceSubTitle').textContent = `(${rows.length} vehicles, times in ${unitStr})`;

  tbody.innerHTML = rows.map((r) => {
    const isP2 = r.assignedServer === 'Pump 2';
    const serverBadge = model === 'MM2'
      ? `<td><span class="server-badge ${isP2 ? 'server-p2' : 'server-p1'}">${r.assignedServer}</span></td>`
      : '';
    const waitClass = r.waitInQueue > 0 ? 'cell-highlight-wait' : '';

    return `
      <tr>
        <td class="col-id"><strong>${r.customerId}</strong></td>
        <td>${r.randomArrival > 0 ? r.randomArrival.toFixed(5) : '—'}</td>
        <td>${r.interArrivalTime.toFixed(2)}</td>
        <td class="col-clock">${r.arrivalTime.toFixed(2)}</td>
        <td>${r.randomService.toFixed(5)}</td>
        <td>${r.serviceTime.toFixed(2)}</td>
        ${serverBadge}
        <td>${r.serviceStartTime.toFixed(2)}</td>
        <td>${r.serviceEndTime.toFixed(2)}</td>
        <td>${r.timeInSystem.toFixed(2)}</td>
        <td class="${waitClass}">${r.waitInQueue.toFixed(2)}</td>
        <td>${r.serverIdleTime.toFixed(2)}</td>
      </tr>
    `;
  }).join('');
}

function renderGanttChart(rows, servers, totalTime, unitStr) {
  const chartEl = $('ganttChart');
  if (!chartEl) return;

  $('ganttSubTitle').textContent = `(Total simulated duration: ${totalTime.toFixed(2)} ${unitStr})`;

  const serverCount = servers || 1;
  let html = '';

  for (let s = 1; s <= serverCount; s++) {
    const sName = `Pump ${s}`;
    const sRows = rows.filter((r) => r.assignedServer === sName || serverCount === 1);

    html += `
      <div class="gantt-lane">
        <div class="gantt-lane-label">
          <span class="server-badge ${s === 2 ? 'server-p2' : 'server-p1'}">${sName}</span>
        </div>
        <div class="gantt-track">
    `;

    sRows.forEach((r) => {
      const leftPct = ((r.serviceStartTime / (totalTime || 1)) * 100).toFixed(2);
      const widthPct = Math.max(0.8, ((r.serviceTime / (totalTime || 1)) * 100)).toFixed(2);

      html += `
        <div class="gantt-bar ${s === 2 ? 'bar-p2' : 'bar-p1'}"
             style="left: ${leftPct}%; width: ${widthPct}%;"
             title="Vehicle #${r.customerId} | Start: ${r.serviceStartTime}s | End: ${r.serviceEndTime}s | Svc: ${r.serviceTime}s">
          <span class="bar-label">V${r.customerId} (${r.serviceTime}s)</span>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;
  }

  // Timeline Scale / Ticks
  const ticks = [0, 0.25, 0.5, 0.75, 1.0];
  html += `
    <div class="gantt-scale">
      <div class="gantt-lane-label"></div>
      <div class="gantt-ticks">
        ${ticks.map((t) => `<span>${(t * totalTime).toFixed(1)} ${unitStr}</span>`).join('')}
      </div>
    </div>
  `;

  chartEl.innerHTML = html;
}

function copyTraceTableToClipboard() {
  const table = $('traceTable');
  if (!table) return;

  let text = '';
  for (const row of table.rows) {
    const cells = Array.from(row.cells).map((c) => c.textContent.trim());
    text += cells.join('\t') + '\n';
  }

  navigator.clipboard.writeText(text).then(() => {
    const btn = $('copyTraceBtn');
    if (btn) {
      const orig = btn.textContent;
      btn.textContent = '✓ Copied!';
      setTimeout(() => { btn.textContent = orig; }, 2000);
    }
  }).catch(() => {
    alert('Failed to copy to clipboard.');
  });
}

function clearSimulator() {
  $('simArrValue').value = '';
  $('simSvcValue').value = '';
  const panel = $('simResultPanel');
  if (panel) panel.hidden = true;
}
