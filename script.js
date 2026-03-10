// ── DOM References ──────────────────────────────────────
const stepSizeEl      = document.getElementById("step-size");
const promptText      = document.getElementById("prompt-text");
const feedbackBox     = document.getElementById("feedback-box");
const feedbackTextEl  = document.getElementById("feedback-text");
const resetBtn        = document.getElementById("resetBtn");
const reflectionSec   = document.getElementById("reflection-section");
const nextStageBtn    = document.getElementById("next-stage-btn");
const tableBody       = document.querySelector("#values-table tbody");
const stageOverlay    = document.getElementById("stage-overlay");
const overlayText     = document.getElementById("overlay-text");
const ctx             = document.getElementById("slopeChart").getContext("2d");

// ── Game State ──────────────────────────────────────────
const stages = [
  { stepSize: 1,   stepsNeeded: 5 },
  { stepSize: 0.5, stepsNeeded: 10 }
];

let currentStage = 0;
let stepSize = stages[0].stepSize;
let path = [{ x: 0, y: 0 }];     // confirmed points
let currentRow = 1;               // row we're filling (0 is pre-filled)
let currentCol = 0;               // 0 = x_n, 1 = m_n, 2 = y_n

function slopeAt(x) { return x + 1; }

// Round to avoid floating-point noise
function r(v) { return Math.round(v * 10000) / 10000; }

// Slope preview line: { x, y, slope } or null
let slopePreview = null;

// Trace animation: { fromX, fromY, curX, curY } or null
let traceSegment = null;
let animating = false;

// ── Chart Setup ─────────────────────────────────────────
const slopeChart = new Chart(ctx, {
  type: "scatter",
  data: { datasets: [] },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        type: "linear",
        title: { display: true, text: "x", color: "#94a3b8", font: { family: "Fira Code" } },
        grid: { color: "#1e293b" },
        ticks: { color: "#94a3b8", font: { family: "Fira Code" } },
        border: { color: "#475569" },
        min: -1, max: 7
      },
      y: {
        type: "linear",
        title: { display: true, text: "y", color: "#94a3b8", font: { family: "Fira Code" } },
        grid: { color: "#1e293b" },
        ticks: { color: "#94a3b8", font: { family: "Fira Code" } },
        border: { color: "#475569" },
        min: -1, max: 20
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: { label: (tip) => `(${tip.parsed.x}, ${tip.parsed.y})` }
      }
    }
  }
});

// ── Chart Drawing ───────────────────────────────────────
function updateChart() {
  const datasets = [];

  if (path.length >= 2) {
    datasets.push({
      label: "Path",
      data: path.map(p => ({ x: p.x, y: p.y })),
      borderColor: "#38bdf8",
      backgroundColor: "#38bdf8",
      borderWidth: 2,
      pointRadius: 6,
      pointHoverRadius: 8,
      showLine: true
    });
  }

  datasets.push({
    label: "Points",
    data: path.map(p => ({ x: p.x, y: p.y })),
    backgroundColor: "#38bdf8",
    pointRadius: 7,
    pointHoverRadius: 9,
    showLine: false
  });

  // Rise / Run staircases
  for (let i = 0; i < path.length - 1; i++) {
    const p1 = path[i], p2 = path[i + 1];
    datasets.push({
      label: i === 0 ? "Run (Δx)" : "",
      data: [{ x: p1.x, y: p1.y }, { x: p2.x, y: p1.y }],
      borderColor: "#4ade80", borderWidth: 2, borderDash: [4, 3],
      pointRadius: 0, showLine: true
    });
    datasets.push({
      label: i === 0 ? "Rise (Δy)" : "",
      data: [{ x: p2.x, y: p1.y }, { x: p2.x, y: p2.y }],
      borderColor: "#f87171", borderWidth: 2, borderDash: [4, 3],
      pointRadius: 0, showLine: true
    });
  }

  // Slope preview dashed line (shown after m_n is entered, before y_n)
  if (slopePreview) {
    const sp = slopePreview;
    const xEnd = Math.max(5, ...path.map(p => p.x)) + 4;
    const yEnd = sp.y + sp.slope * (xEnd - sp.x);
    datasets.push({
      label: "Slope preview",
      data: [{ x: sp.x, y: sp.y }, { x: xEnd, y: yEnd }],
      borderColor: "#facc15",
      borderWidth: 2,
      borderDash: [6, 4],
      pointRadius: 0,
      showLine: true
    });
  }

  // Trace animation segment (solid line growing from old point toward new point)
  if (traceSegment) {
    datasets.push({
      label: "Trace",
      data: [
        { x: traceSegment.fromX, y: traceSegment.fromY },
        { x: traceSegment.curX, y: traceSegment.curY }
      ],
      borderColor: "#38bdf8",
      borderWidth: 3,
      pointRadius: [0, 5],
      backgroundColor: ["transparent", "#38bdf8"],
      showLine: true
    });
  }

  // Auto-scale
  const allX = path.map(p => p.x), allY = path.map(p => p.y);
  const pad = 2;
  slopeChart.options.scales.x.min = Math.min(0, ...allX) - pad;
  slopeChart.options.scales.x.max = Math.max(5, ...allX) + pad;
  slopeChart.options.scales.y.min = Math.min(0, ...allY) - pad;
  slopeChart.options.scales.y.max = Math.max(5, ...allY) + pad;

  slopeChart.data.datasets = datasets;
  slopeChart.update();
}

// ── Table Rendering ─────────────────────────────────────
// We track accepted values for each row: { x, m, y }
let rowData = [];   // rowData[n] = { x, m, y } once confirmed

function buildTable() {
  tableBody.innerHTML = "";

  // Row 0 — always pre-filled
  const tr0 = document.createElement("tr");
  tr0.classList.add("completed-row");
  tr0.innerHTML = `<td>0</td><td>0</td><td>${slopeAt(0)}</td><td>0</td>`;
  tableBody.appendChild(tr0);

  // Confirmed rows 1..currentRow-1
  for (let n = 1; n < currentRow; n++) {
    const d = rowData[n];
    const tr = document.createElement("tr");
    tr.classList.add("completed-row");
    tr.innerHTML = `<td>${n}</td><td class="cell-done">${d.x}</td><td class="cell-done">${d.m}</td><td class="cell-done">${d.y}</td>`;
    tableBody.appendChild(tr);
  }

  // Active row (if we haven't finished the stage)
  const stepsNeeded = stages[currentStage].stepsNeeded;
  if (currentRow <= stepsNeeded) {
    const tr = document.createElement("tr");
    tr.classList.add("active-row");
    tr.id = "active-row";

    const tdN = document.createElement("td");
    tdN.textContent = currentRow;
    tr.appendChild(tdN);

    // x cell
    const tdX = document.createElement("td");
    if (currentCol === 0) {
      tdX.appendChild(createInput("x"));
    } else {
      tdX.textContent = rowData[currentRow]?.x ?? "";
      if (rowData[currentRow]?.x !== undefined) tdX.classList.add("cell-done");
    }
    tr.appendChild(tdX);

    // m cell
    const tdM = document.createElement("td");
    if (currentCol === 1) {
      tdM.appendChild(createInput("m"));
    } else if (currentCol > 1) {
      tdM.textContent = rowData[currentRow]?.m ?? "";
      if (rowData[currentRow]?.m !== undefined) tdM.classList.add("cell-done");
    }
    tr.appendChild(tdM);

    // y cell
    const tdY = document.createElement("td");
    if (currentCol === 2) {
      tdY.appendChild(createInput("y"));
    } else if (currentCol > 2) {
      tdY.textContent = rowData[currentRow]?.y ?? "";
    }
    tr.appendChild(tdY);

    tableBody.appendChild(tr);
  }

  // Scroll to bottom
  const scrollEl = tableBody.closest(".table-scroll");
  if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
}

function createInput(which) {
  const input = document.createElement("input");
  input.type = "text";
  input.inputMode = "decimal";
  input.classList.add("cell-input");
  input.id = "active-input";
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") validateEntry(input, which);
  });
  // Auto-focus after DOM insert
  requestAnimationFrame(() => input.focus());
  return input;
}

// ── Validation ──────────────────────────────────────────
function validateEntry(input, which) {
  if (animating) return;  // wait for trace animation to finish
  const val = parseFloat(input.value);
  if (Number.isNaN(val)) {
    showFeedback("Enter a number.", "error");
    shakInput(input);
    return;
  }

  const prev = path[path.length - 1];  // last confirmed point
  let expected, label;

  if (which === "x") {
    expected = r(prev.x + stepSize);
    label = `x<sub>${currentRow}</sub>`;
  } else if (which === "m") {
    const xn = rowData[currentRow].x;
    expected = r(slopeAt(xn));
    label = `m<sub>${currentRow}</sub>`;
  } else {
    // y_n  (this IS the new y value: y_{n} = y_{n-1} + m_{n-1} * h)
    // But wait — in the table, the columns are n, x_n, m_n, y_n.
    // The Euler formula is: y_{n+1} = y_n + m_n · h
    // So for row n: y_n is the y value at step n.
    // y_n = y_{n-1} + m_{n-1} · h  (using previous row's slope)
    expected = r(prev.y + slopeAt(prev.x) * stepSize);
    label = `y<sub>${currentRow}</sub>`;
  }

  if (Math.abs(val - expected) < 0.01) {
    // Correct
    input.classList.add("correct");
    input.disabled = true;

    if (!rowData[currentRow]) rowData[currentRow] = {};
    if (which === "x") rowData[currentRow].x = expected;
    if (which === "m") {
      rowData[currentRow].m = expected;
      // Show slope preview line from current point
      const prev2 = path[path.length - 1];
      slopePreview = { x: prev2.x, y: prev2.y, slope: expected };
      updateChart();
    }
    if (which === "y") {
      rowData[currentRow].y = expected;
      // Clear slope preview — animate trace to the new point
      slopePreview = null;
    }

    showFeedback(`✅ ${label} = ${expected}`, "success");

    currentCol++;

    if (currentCol > 2) {
      // Row complete — animate trace along the slope, then finalize
      const fromPt = path[path.length - 1];
      const toPt = { x: rowData[currentRow].x, y: rowData[currentRow].y };
      animateSegment(fromPt, toPt, () => {
        path.push(toPt);
        traceSegment = null;
        updateChart();
        hideOverlay();

        const stepsNeeded = stages[currentStage].stepsNeeded;
        const stepsCompleted = path.length - 1;

        if (stepsCompleted >= stepsNeeded) {
          if (currentStage < stages.length - 1) {
            showFeedback(`🎉 Stage complete! You plotted ${stepsNeeded} steps with h = ${stepSize}.`, "success");
            reflectionSec.classList.remove("hidden");
          } else {
            showFeedback("🏆 Challenge complete! Both stages done.", "success");
          }
          currentRow++;
          currentCol = 0;
          buildTable();
          updatePrompt();
          return;
        }

        currentRow++;
        currentCol = 0;
        buildTable();
        updatePrompt();
      });
      return;
    }

    buildTable();
    updatePrompt();
  } else {
    // Wrong
    shakInput(input);
    let hint = "";
    if (which === "x") {
      hint = ` Hint: x<sub>${currentRow}</sub> = x<sub>${currentRow - 1}</sub> + h = ${prev.x} + ${stepSize}`;
    } else if (which === "m") {
      hint = ` Hint: m<sub>${currentRow}</sub> = x<sub>${currentRow}</sub> + 1 = ${rowData[currentRow].x} + 1`;
    } else {
      const prevSlope = slopeAt(prev.x);
      hint = ` Hint: y<sub>${currentRow}</sub> = y<sub>${currentRow - 1}</sub> + m<sub>${currentRow - 1}</sub> · h = ${prev.y} + ${prevSlope} × ${stepSize}`;
    }
    showFeedback(`❌ Not quite.${hint}`, "error");
  }
}

// ── Trace Animation ─────────────────────────────────────
function animateSegment(from, to, onComplete) {
  animating = true;
  const duration = 600; // ms
  const startTime = performance.now();

  function tick(now) {
    const t = Math.min((now - startTime) / duration, 1);
    // Ease-out quad
    const ease = t * (2 - t);
    traceSegment = {
      fromX: from.x,
      fromY: from.y,
      curX: from.x + (to.x - from.x) * ease,
      curY: from.y + (to.y - from.y) * ease
    };
    // Use Chart.js update with no animation to avoid flicker
    updateChartRaw();

    if (t < 1) {
      requestAnimationFrame(tick);
    } else {
      animating = false;
      onComplete();
    }
  }

  requestAnimationFrame(tick);
}

// Fast chart update without Chart.js built-in animation (for smooth RAF loop)
function updateChartRaw() {
  const datasets = [];

  if (path.length >= 2) {
    datasets.push({
      label: "Path",
      data: path.map(p => ({ x: p.x, y: p.y })),
      borderColor: "#38bdf8", backgroundColor: "#38bdf8",
      borderWidth: 2, pointRadius: 6, pointHoverRadius: 8, showLine: true
    });
  }

  datasets.push({
    label: "Points",
    data: path.map(p => ({ x: p.x, y: p.y })),
    backgroundColor: "#38bdf8", pointRadius: 7, pointHoverRadius: 9, showLine: false
  });

  for (let i = 0; i < path.length - 1; i++) {
    const p1 = path[i], p2 = path[i + 1];
    datasets.push({
      data: [{ x: p1.x, y: p1.y }, { x: p2.x, y: p1.y }],
      borderColor: "#4ade80", borderWidth: 2, borderDash: [4, 3],
      pointRadius: 0, showLine: true
    });
    datasets.push({
      data: [{ x: p2.x, y: p1.y }, { x: p2.x, y: p2.y }],
      borderColor: "#f87171", borderWidth: 2, borderDash: [4, 3],
      pointRadius: 0, showLine: true
    });
  }

  if (traceSegment) {
    datasets.push({
      label: "Trace",
      data: [
        { x: traceSegment.fromX, y: traceSegment.fromY },
        { x: traceSegment.curX, y: traceSegment.curY }
      ],
      borderColor: "#38bdf8", borderWidth: 3,
      pointRadius: [0, 5], backgroundColor: ["transparent", "#38bdf8"],
      showLine: true
    });
  }

  slopeChart.data.datasets = datasets;
  slopeChart.update("none");
}

function shakInput(input) {
  input.classList.add("wrong");
  setTimeout(() => input.classList.remove("wrong"), 350);
}

// ── Prompt Updates ──────────────────────────────────────
function updatePrompt() {
  const stepsNeeded = stages[currentStage].stepsNeeded;
  if (path.length - 1 >= stepsNeeded) {
    if (currentStage >= stages.length - 1) {
      promptText.innerHTML = "🏆 All stages complete!";
    } else {
      promptText.innerHTML = "Reflect below, then continue →";
    }
    return;
  }

  const sub = `<sub>${currentRow}</sub>`;
  if (currentCol === 0) {
    promptText.innerHTML = `Enter x${sub} in the table →`;
  } else if (currentCol === 1) {
    promptText.innerHTML = `Now enter m${sub} (the slope) →`;
  } else {
    promptText.innerHTML = `Now enter y${sub} →`;
  }
}

// ── Feedback ────────────────────────────────────────────
function showFeedback(html, type) {
  feedbackTextEl.innerHTML = html;
  feedbackBox.className = "feedback-box " + type;
}

// ── Stage / Overlay ─────────────────────────────────────
function advanceStage() {
  currentStage++;
  if (currentStage >= stages.length) {
    reflectionSec.classList.add("hidden");
    showFeedback("🏆 Challenge complete! Both stages done.", "success");
    return;
  }

  stepSize = stages[currentStage].stepSize;
  path = [{ x: 0, y: 0 }];
  rowData = [];
  currentRow = 1;
  currentCol = 0;
  slopePreview = null;
  reflectionSec.classList.add("hidden");
  feedbackBox.className = "feedback-box hidden";
  stepSizeEl.textContent = stepSize;

  showOverlay(`Stage ${currentStage + 1}\nh = ${stepSize}\nSmaller steps → smoother curve!`);
  setTimeout(() => {
    hideOverlay();
    buildTable();
    updatePrompt();
  }, 2200);
  updateChart();
}

function showOverlay(text) {
  overlayText.textContent = text;
  stageOverlay.classList.remove("hidden");
}

function hideOverlay() {
  stageOverlay.classList.add("hidden");
}

// ── Reset ───────────────────────────────────────────────
function resetAll() {
  currentStage = 0;
  stepSize = stages[0].stepSize;
  path = [{ x: 0, y: 0 }];
  rowData = [];
  currentRow = 1;
  currentCol = 0;
  slopePreview = null;
  reflectionSec.classList.add("hidden");
  feedbackBox.className = "feedback-box hidden";
  stepSizeEl.textContent = stepSize;
  hideOverlay();
  buildTable();
  updateChart();
  updatePrompt();
}

// ── Event Listeners ─────────────────────────────────────
resetBtn.addEventListener("click", resetAll);
nextStageBtn.addEventListener("click", advanceStage);

// ── Initialize ──────────────────────────────────────────
buildTable();
updateChart();
updatePrompt();
