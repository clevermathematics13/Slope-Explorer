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
let currentCol = 0;               // 0 = x_n, 1 = y_n, 2 = m_n

function slopeAt(x) { return x + 1; }

// Round to avoid floating-point noise
function r(v) { return Math.round(v * 10000) / 10000; }

// Slope preview line: { x, y, slope } or null
let slopePreview = null;

// Trace animation: { fromX, fromY, curX, curY } or null
let traceSegment = null;
let animating = false;

// Show exact curve after stage complete
let showExact = false;

function exactY(x) { return x * x / 2 + x; }

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
    // Blue trace line (hypotenuse)
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
    // Green run (horizontal)
    datasets.push({
      data: [
        { x: traceSegment.fromX, y: traceSegment.fromY },
        { x: traceSegment.curX, y: traceSegment.fromY }
      ],
      borderColor: "#4ade80", borderWidth: 2, borderDash: [4, 3],
      pointRadius: 0, showLine: true
    });
    // Red rise (vertical)
    datasets.push({
      data: [
        { x: traceSegment.curX, y: traceSegment.fromY },
        { x: traceSegment.curX, y: traceSegment.curY }
      ],
      borderColor: "#f87171", borderWidth: 2, borderDash: [4, 3],
      pointRadius: 0, showLine: true
    });
  }

  // Exact solution curve (shown after stage complete)
  if (showExact) {
    const xMax = Math.max(5, ...path.map(p => p.x));
    const exactData = [];
    for (let x = 0; x <= xMax; x += 0.1) {
      exactData.push({ x: r(x), y: r(exactY(x)) });
    }
    datasets.push({
      label: "Exact: y = x²/2 + x",
      data: exactData,
      borderColor: "#a78bfa",
      borderWidth: 2,
      borderDash: [2, 2],
      pointRadius: 0,
      showLine: true,
      tension: 0.4
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

  // Row 0 — always pre-filled (n, x, y, m)
  const tr0 = document.createElement("tr");
  tr0.classList.add("completed-row");
  tr0.innerHTML = `<td>0</td><td>0</td><td>0</td><td>${slopeAt(0)}</td>`;
  tableBody.appendChild(tr0);

  // Confirmed rows 1..currentRow-1
  for (let n = 1; n < currentRow; n++) {
    const d = rowData[n];
    const tr = document.createElement("tr");
    tr.classList.add("completed-row");
    tr.innerHTML = `<td>${n}</td><td class="cell-done">${d.x}</td><td class="cell-done">${d.y}</td><td class="cell-done">${d.m}</td>`;
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

    // x cell (col 0)
    const tdX = document.createElement("td");
    if (currentCol === 0) {
      tdX.appendChild(createInput("x"));
    } else {
      tdX.textContent = rowData[currentRow]?.x ?? "";
      if (rowData[currentRow]?.x !== undefined) tdX.classList.add("cell-done");
    }
    tr.appendChild(tdX);

    // y cell (col 1)
    const tdY = document.createElement("td");
    if (currentCol === 1) {
      tdY.appendChild(createInput("y"));
    } else if (currentCol > 1) {
      tdY.textContent = rowData[currentRow]?.y ?? "";
      if (rowData[currentRow]?.y !== undefined) tdY.classList.add("cell-done");
    }
    tr.appendChild(tdY);

    // m cell (col 2)
    const tdM = document.createElement("td");
    if (currentCol === 2) {
      tdM.appendChild(createInput("m"));
    } else if (currentCol > 2) {
      tdM.textContent = rowData[currentRow]?.m ?? "";
    }
    tr.appendChild(tdM);

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
  } else if (which === "y") {
    // y_n = y_{n-1} + m_{n-1} · h  (using previous row's slope)
    expected = r(prev.y + slopeAt(prev.x) * stepSize);
    label = `y<sub>${currentRow}</sub>`;
  } else {
    // m_n = x_n + 1
    const xn = rowData[currentRow].x;
    expected = r(slopeAt(xn));
    label = `m<sub>${currentRow}</sub>`;
  }

  if (Math.abs(val - expected) < 0.01) {
    // Correct
    input.classList.add("correct");
    input.disabled = true;

    if (!rowData[currentRow]) rowData[currentRow] = {};

    if (which === "x") {
      rowData[currentRow].x = expected;
      showFeedback(`✅ ${label} = ${expected}`, "success");
      currentCol++;
      buildTable();
      updatePrompt();
    } else if (which === "y") {
      rowData[currentRow].y = expected;
      showFeedback(`✅ ${label} = ${expected}`, "success");
      // Animate trace from previous point to new point, then advance to m_n
      const fromPt = path[path.length - 1];
      const toPt = { x: rowData[currentRow].x, y: rowData[currentRow].y };
      animateSegment(fromPt, toPt, () => {
        path.push(toPt);
        traceSegment = null;
        updateChartRaw();
        currentCol = 2;
        buildTable();
        updatePrompt();
      });
    } else {
      // m_n confirmed — update slope preview, then advance row
      rowData[currentRow].m = expected;
      slopePreview = { x: rowData[currentRow].x, y: rowData[currentRow].y, slope: expected };
      updateChart();
      showFeedback(`✅ ${label} = ${expected}`, "success");

      const stepsNeeded = stages[currentStage].stepsNeeded;
      const stepsCompleted = path.length - 1;

      if (stepsCompleted >= stepsNeeded) {
        showExact = true;
        updateChart();
        if (currentStage < stages.length - 1) {
          showFeedback(`🎉 Stage complete! The Euler path is an <strong>under-estimate</strong> — it stays below the exact curve y = x²/2 + x.`, "success");
          reflectionSec.classList.remove("hidden");
        } else {
          showFeedback(`🏆 Challenge complete! Notice the path with h = ${stepSize} is closer to the exact curve — smaller steps give a better estimate.`, "success");
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
    }
  } else {
    // Wrong
    shakInput(input);
    let hint = "";
    if (which === "x") {
      hint = ` Hint: x<sub>${currentRow}</sub> = x<sub>${currentRow - 1}</sub> + h = ${prev.x} + ${stepSize}`;
    } else if (which === "y") {
      const prevSlope = slopeAt(prev.x);
      hint = ` Hint: y<sub>${currentRow}</sub> = y<sub>${currentRow - 1}</sub> + m<sub>${currentRow - 1}</sub> · h = ${prev.y} + ${prevSlope} × ${stepSize}`;
    } else {
      hint = ` Hint: m<sub>${currentRow}</sub> = x<sub>${currentRow}</sub> + 1 = ${rowData[currentRow].x} + 1`;
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

  if (slopePreview) {
    const sp = slopePreview;
    const xEnd = Math.max(5, ...path.map(p => p.x)) + 4;
    const yEnd = sp.y + sp.slope * (xEnd - sp.x);
    datasets.push({
      data: [{ x: sp.x, y: sp.y }, { x: xEnd, y: yEnd }],
      borderColor: "#facc15", borderWidth: 2, borderDash: [6, 4],
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
    datasets.push({
      data: [
        { x: traceSegment.fromX, y: traceSegment.fromY },
        { x: traceSegment.curX, y: traceSegment.fromY }
      ],
      borderColor: "#4ade80", borderWidth: 2, borderDash: [4, 3],
      pointRadius: 0, showLine: true
    });
    datasets.push({
      data: [
        { x: traceSegment.curX, y: traceSegment.fromY },
        { x: traceSegment.curX, y: traceSegment.curY }
      ],
      borderColor: "#f87171", borderWidth: 2, borderDash: [4, 3],
      pointRadius: 0, showLine: true
    });
  }

  if (showExact) {
    const xMax = Math.max(5, ...path.map(p => p.x));
    const exactData = [];
    for (let x = 0; x <= xMax; x += 0.1) {
      exactData.push({ x: r(x), y: r(exactY(x)) });
    }
    datasets.push({
      label: "Exact: y = x²/2 + x",
      data: exactData,
      borderColor: "#a78bfa",
      borderWidth: 2,
      borderDash: [2, 2],
      pointRadius: 0,
      showLine: true,
      tension: 0.4
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
    promptText.innerHTML = `Now enter y${sub} →`;
  } else {
    promptText.innerHTML = `Now enter m${sub} (the slope) →`;
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
  reflectionFeedback.className = "reflection-feedback hidden";
  submitReflectionBtn.classList.remove("hidden");
  nextStageBtn.classList.add("hidden");
  studentReflection.value = "";
  studentReflection.disabled = false;
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
  showExact = false;
  reflectionSec.classList.add("hidden");
  reflectionFeedback.className = "reflection-feedback hidden";
  submitReflectionBtn.classList.remove("hidden");
  nextStageBtn.classList.add("hidden");
  studentReflection.value = "";
  studentReflection.disabled = false;
  feedbackBox.className = "feedback-box hidden";
  stepSizeEl.textContent = stepSize;
  hideOverlay();
  buildTable();
  updateChart();
  updatePrompt();
}

// ── Reflection Evaluation ───────────────────────────────
const submitReflectionBtn = document.getElementById("submit-reflection-btn");
const reflectionFeedback  = document.getElementById("reflection-feedback");
const studentReflection   = document.getElementById("student-reflection");

function evaluateReflection(response) {
  const text = response.toLowerCase().trim();
  if (text.length < 5) {
    return { score: 0, feedback: "Try writing a bit more! Think about what smaller steps might do to the shape of the path." };
  }

  const keywords = {
    smooth: ["smooth", "smoother", "curved", "curvy", "less jagged", "less sharp"],
    accurate: ["accurat", "closer", "precise", "better", "exact", "nearer", "close to"],
    moreSteps: ["more steps", "more points", "more segments", "twice", "double", "10 steps", "ten steps"],
    smaller: ["smaller", "shorter", "half", "tiny", "little"],
  };

  let hits = 0;
  const matched = [];
  for (const [concept, words] of Object.entries(keywords)) {
    if (words.some(w => text.includes(w))) {
      hits++;
      matched.push(concept);
    }
  }

  if (hits >= 3) {
    return { score: 3, feedback: "🌟 Excellent thinking! You identified that smaller steps create a smoother, more accurate path with more points. That's exactly what happens — the approximation gets closer to the true curve." };
  } else if (hits >= 2) {
    return { score: 2, feedback: "👍 Great insight! You're on the right track. Smaller step sizes do make the path " +
      (!matched.includes("smooth") ? "smoother and " : "") +
      (!matched.includes("accurate") ? "more accurate. " : "") +
      (!matched.includes("moreSteps") ? "We also get more points to plot. " : "") +
      "The key idea is that smaller h means the straight-line segments better follow the actual curve." };
  } else if (hits >= 1) {
    return { score: 1, feedback: "👌 Good start! You've noticed one important aspect. Think also about: Does the path get smoother or more jagged? Does it stay closer to the real curve? How many points will we plot?" };
  } else {
    return { score: 0, feedback: "🤔 Interesting thought! Here's a hint: when we take smaller steps, we get more points and the path becomes smoother and closer to the actual curve. See if you notice that in Stage 2!" };
  }
}

submitReflectionBtn.addEventListener("click", () => {
  const response = studentReflection.value.trim();
  if (!response) {
    reflectionFeedback.className = "reflection-feedback error";
    reflectionFeedback.textContent = "Please type your thoughts before submitting.";
    return;
  }
  const result = evaluateReflection(response);
  reflectionFeedback.className = "reflection-feedback";
  reflectionFeedback.textContent = result.feedback;
  submitReflectionBtn.classList.add("hidden");
  studentReflection.disabled = true;
  nextStageBtn.classList.remove("hidden");
});

// ── Event Listeners ─────────────────────────────────────
resetBtn.addEventListener("click", resetAll);
nextStageBtn.addEventListener("click", advanceStage);

// ── Initialize ──────────────────────────────────────────
slopePreview = { x: 0, y: 0, slope: slopeAt(0) };
buildTable();
updateChart();
updatePrompt();
