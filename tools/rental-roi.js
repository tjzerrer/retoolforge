// tools/rental-roi.js
// REToolForge – Rental ROI Calculator logic

// ---------- helper functions ----------
function asNumber(id) {
  const el = document.getElementById(id);
  if (!el) return 0;
  const raw = el.value.trim();
  const n = raw === "" ? 0 : Number(raw);
  return isNaN(n) ? 0 : n;
}

function setValue(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  if (val === undefined || val === null) return;
  el.value = val;
}

function formatMoney(val) {
  const n = isNaN(val) ? 0 : val;
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function formatPercent(val) {
  const n = isNaN(val) ? 0 : val;
  return `${n.toFixed(1)}%`;
}

function showStatusChip(id, message, variant = "ok") {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message;
  el.className = "status-chip";
  el.classList.add(variant === "error" ? "status-error" : "status-ok");
  el.classList.add("visible");
  setTimeout(() => el.classList.remove("visible"), 3000);
}

// ---------- math core ----------
function computeDeal(inputs) {
  const {
    purchasePrice,
    monthlyRent,
    interestRate,
    loanTermYears,
    downPaymentPercent,
    annualTaxes,
    annualInsurance,
    monthlyHOA,
    maintenancePercent,
    otherMonthly,
    closingCostsPercent,
    upfrontRepairs,
  } = inputs;

  const downPaymentAmount = purchasePrice * (downPaymentPercent / 100);
  const loanAmount = purchasePrice - downPaymentAmount;

  let monthlyMortgage = 0;
  if (loanAmount > 0 && interestRate > 0 && loanTermYears > 0) {
    const r = interestRate / 100 / 12;
    const n = loanTermYears * 12;
    monthlyMortgage = (loanAmount * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  }

  const monthlyTaxes = annualTaxes / 12;
  const monthlyInsurance = annualInsurance / 12;
  const maintVacancy = monthlyRent * (maintenancePercent / 100);

  const totalMonthlyExpenses =
    monthlyMortgage +
    monthlyTaxes +
    monthlyInsurance +
    monthlyHOA +
    maintVacancy +
    otherMonthly;

  const grossMonthlyIncome = monthlyRent;
  const monthlyCashFlow = grossMonthlyIncome - totalMonthlyExpenses;
  const annualCashFlow = monthlyCashFlow * 12;

  const annualNOI =
    grossMonthlyIncome * 12 -
    (annualTaxes +
      annualInsurance +
      monthlyHOA * 12 +
      maintVacancy * 12 +
      otherMonthly * 12);

  const capRate = purchasePrice > 0 ? (annualNOI / purchasePrice) * 100 : 0;

  const closingCostsAmount = purchasePrice * (closingCostsPercent / 100);
  const totalCashInvested = downPaymentAmount + closingCostsAmount + upfrontRepairs;
  const cashOnCashReturn =
    totalCashInvested > 0 ? (annualCashFlow / totalCashInvested) * 100 : 0;

  // verdict
  let verdictLabel = "Borderline — cash flow is thin";
  let verdictTone = "neutral";

  if (monthlyCashFlow > 0 && cashOnCashReturn >= 12) {
    verdictLabel = "Strong on paper";
    verdictTone = "strong";
  } else if (monthlyCashFlow >= 0 && cashOnCashReturn >= 8) {
    verdictLabel = "Decent, stress-test it";
    verdictTone = "ok";
  } else if (monthlyCashFlow < 0) {
    verdictLabel = "Negative cash flow — be cautious";
    verdictTone = "weak";
  }

  return {
    monthlyMortgage,
    totalMonthlyExpenses,
    monthlyCashFlow,
    annualCashFlow,
    capRate,
    totalCashInvested,
    cashOnCashReturn,
    verdictLabel,
    verdictTone,
    maintVacancy,
  };
}

function buildDealSummary(propertyLabel, res, inputs) {
  const {
    monthlyCashFlow,
    annualCashFlow,
    totalMonthlyExpenses,
    capRate,
    totalCashInvested,
    cashOnCashReturn,
    verdictLabel,
  } = res;

  const lines = [];

  lines.push(`REToolForge Rental ROI Report`);
  lines.push(`--------------------------------`);
  if (propertyLabel) lines.push(`Property: ${propertyLabel}`);
  lines.push("");
  lines.push(`Monthly cash flow: ${formatMoney(monthlyCashFlow)}`);
  lines.push(`Annual cash flow: ${formatMoney(annualCashFlow)}`);
  lines.push(`Cash-on-cash return: ${formatPercent(cashOnCashReturn)}`);
  lines.push(`Cap rate: ${formatPercent(capRate)}`);
  lines.push(`Total monthly expenses: ${formatMoney(totalMonthlyExpenses)}`);
  lines.push(`Total cash invested: ${formatMoney(totalCashInvested)}`);
  lines.push("");
  lines.push(`Verdict: ${verdictLabel}`);
  lines.push("");
  lines.push(`Key assumptions:`);
  lines.push(
    `• Purchase price: ${formatMoney(inputs.purchasePrice)} | Rent: ${formatMoney(
      inputs.monthlyRent
    )}`
  );
  lines.push(
    `• Interest: ${inputs.interestRate}% | Term: ${inputs.loanTermYears} years | Down payment: ${inputs.downPaymentPercent}%`
  );
  lines.push(
    `• Taxes: ${formatMoney(inputs.annualTaxes)} /yr | Insurance: ${formatMoney(
      inputs.annualInsurance
    )} /yr`
  );
  lines.push(
    `• Maintenance + vacancy: ${inputs.maintenancePercent}% of rent | Other monthly: ${formatMoney(
      inputs.otherMonthly
    )}`
  );
  lines.push(
    `• Closing costs: ${inputs.closingCostsPercent}% | Upfront repairs: ${formatMoney(
      inputs.upfrontRepairs
    )}`
  );
  lines.push("");
  lines.push(
    `Use this as a quick screening tool only. Adjust assumptions for your market before making decisions.`
  );

  return lines.join("\n");
}

// ---------- persistence ----------
const STORAGE_KEY = "rentalROI-lastInputs";

function saveLastInputs(inputs) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...inputs,
        savedAt: new Date().toISOString(),
      })
    );
  } catch (e) {
    // ignore; storage is a bonus feature
  }
}

function loadLastInputs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

// ---------- UI wiring ----------
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("rentalForm");
  const calcBtn = document.getElementById("calculateBtn");
  const copyBtn = document.getElementById("copySummaryBtn");
  const emailBtn = document.getElementById("emailReportBtn");
  const resetBtn = document.getElementById("resetBtn");

  const cashFlowBlock = document.getElementById("cashFlowBlock");
  const cashFlowDisplay = document.getElementById("cashFlowDisplay");
  const cashFlowCaption = document.getElementById("cashFlowCaption");
  const cocDisplay = document.getElementById("cocDisplay");
  const cocCaption = document.getElementById("cocCaption");
  const capRateDisplay = document.getElementById("capRateDisplay");
  const expensesDisplay = document.getElementById("expensesDisplay");
  const expenseBreakdown = document.getElementById("expenseBreakdown");
  const cashInvestedDisplay = document.getElementById("cashInvestedDisplay");
  const verdictBlock = document.getElementById("verdictBlock");
  const verdictTag = document.getElementById("verdictTag");
  const verdictText = document.getElementById("verdictText");

  if (!form || !calcBtn) {
    console.error("Rental ROI form or calculate button not found.");
    return;
  }

  // Restore last inputs if available
  const last = loadLastInputs();
  if (last) {
    setValue("propertyLabel", last.propertyLabel || "");
    setValue("userEmail", last.userEmail || "");
    setValue("purchasePrice", last.purchasePrice);
    setValue("downPayment", last.downPaymentPercent);
    setValue("interestRate", last.interestRate);
    setValue("loanTerm", last.loanTermYears);
    setValue("monthlyRent", last.monthlyRent);
    setValue("annualTaxes", last.annualTaxes);
    setValue("annualInsurance", last.annualInsurance);
    setValue("monthlyHOA", last.monthlyHOA);
    setValue("maintenancePercent", last.maintenancePercent);
    setValue("otherMonthly", last.otherMonthly);
    setValue("closingCostsPercent", last.closingCostsPercent);
    setValue("upfrontRepairs", last.upfrontRepairs);
  }

  function applyCashFlowCardStyle(monthlyCashFlow) {
    if (!cashFlowBlock) return;

    cashFlowBlock.classList.remove(
      "result-cash-neutral",
      "result-cash-positive",
      "result-cash-negative"
    );

    if (monthlyCashFlow < 0) {
      cashFlowBlock.classList.add("result-cash-negative");
      cashFlowCaption.textContent =
        "Negative cash flow — be cautious. This deal would lose money each month on these assumptions.";
    } else if (monthlyCashFlow > 0) {
      cashFlowBlock.classList.add("result-cash-positive");
      cashFlowCaption.textContent =
        "Approximate monthly cash flow after mortgage and expenses.";
    } else {
      cashFlowBlock.classList.add("result-cash-neutral");
      cashFlowCaption.textContent =
        "Cash flow is roughly break-even. Small changes in rent or expenses could push this deal positive or negative.";
    }
  }

  function handleCalculate() {
    const inputs = {
      propertyLabel: document.getElementById("propertyLabel").value.trim(),
      userEmail: document.getElementById("userEmail").value.trim(),
      purchasePrice: asNumber("purchasePrice"),
      downPaymentPercent: asNumber("downPayment"),
      interestRate: asNumber("interestRate"),
      loanTermYears: asNumber("loanTerm"),
      monthlyRent: asNumber("monthlyRent"),
      annualTaxes: asNumber("annualTaxes"),
      annualInsurance: asNumber("annualInsurance"),
      monthlyHOA: asNumber("monthlyHOA"),
      maintenancePercent: asNumber("maintenancePercent"),
      otherMonthly: asNumber("otherMonthly"),
      closingCostsPercent: asNumber("closingCostsPercent"),
      upfrontRepairs: asNumber("upfrontRepairs"),
    };

    const res = computeDeal(inputs);

    cashFlowDisplay.textContent = formatMoney(res.monthlyCashFlow);
    applyCashFlowCardStyle(res.monthlyCashFlow);

    cocDisplay.textContent =
      res.cashOnCashReturn > 0 ? formatPercent(res.cashOnCashReturn) : "—";
    cocCaption.textContent = "Annual cash flow ÷ total cash invested, before taxes.";

    capRateDisplay.textContent = res.capRate > 0 ? formatPercent(res.capRate) : "—";

    expensesDisplay.textContent = formatMoney(res.totalMonthlyExpenses);
    expenseBreakdown.textContent =
      "Includes mortgage, taxes, insurance, HOA, maintenance, and other expenses.";

    cashInvestedDisplay.textContent = formatMoney(res.totalCashInvested);

    verdictTag.textContent = res.verdictLabel;
    verdictBlock.classList.remove("tone-strong", "tone-ok", "tone-weak", "tone-neutral");
    verdictBlock.classList.add(`tone-${res.verdictTone}`);

    verdictText.textContent =
      res.verdictTone === "strong"
        ? "This deal shows positive monthly cash flow and a double-digit cash-on-cash return. Still, verify rents, rehab, and vacancy with local data before moving forward."
        : res.verdictTone === "ok"
        ? "This deal looks workable on paper. Stress-test your assumptions by lowering rent slightly or increasing expenses to see how sensitive the numbers are."
        : res.verdictTone === "weak"
        ? "This deal appears weak on today’s assumptions, especially on cash flow. Consider renegotiating price, improving terms, or moving on to a stronger deal."
        : "Monthly cash flow looks tight on these assumptions. Small changes in rent or expenses could push this deal negative — dig into comps and real expenses before you commit.";

    // store summary for copy/email + persist inputs
    form.dataset.lastSummary = buildDealSummary(inputs.propertyLabel, res, inputs);
    saveLastInputs(inputs);
  }

  // Click handler for calculate
  calcBtn.addEventListener("click", (e) => {
    e.preventDefault();
    handleCalculate();
  });

  // Also catch Enter key on the form
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    handleCalculate();
  });

  // Copy summary
  copyBtn.addEventListener("click", async () => {
    const summary = form.dataset.lastSummary;
    if (!summary) {
      showStatusChip("copyStatus", "Run the calculator first.", "error");
      return;
    }
    try {
      await navigator.clipboard.writeText(summary);
      showStatusChip("copyStatus", "Copied deal summary.", "ok");
    } catch (err) {
      console.error(err);
      showStatusChip("copyStatus", "Could not copy to clipboard.", "error");
    }
  });

  // Email summary (via user’s email client)
  emailBtn.addEventListener("click", () => {
    const summary = form.dataset.lastSummary;
    const email = document.getElementById("userEmail").value.trim();

    if (!summary) {
      showStatusChip("emailStatus", "Run the calculator first.", "error");
      return;
    }
    if (!email) {
      showStatusChip("emailStatus", "Add an email address above.", "error");
      return;
    }

    const subject = encodeURIComponent("REToolForge Rental ROI Report");
    const body = encodeURIComponent(summary);
    const mailtoLink = `mailto:${email}?subject=${subject}&body=${body}`;
    window.location.href = mailtoLink;

    showStatusChip("emailStatus", "Opening email draft…", "ok");
  });

  // Reset inputs (but keep last saved in localStorage until next calculate)
  resetBtn.addEventListener("click", () => {
    form.reset();
    form.dataset.lastSummary = "";

    cashFlowDisplay.textContent = "—";
    cashFlowCaption.textContent =
      "Enter numbers on the left and hit “Calculate” to see your cash flow.";

    cocDisplay.textContent = "—";
    cocCaption.textContent = "Annual cash flow ÷ total cash invested, before taxes.";
    capRateDisplay.textContent = "—";
    expensesDisplay.textContent = "—";
    expenseBreakdown.textContent =
      "Mortgage, taxes, insurance, HOA, maintenance, and other expenses.";
    cashInvestedDisplay.textContent = "—";

    verdictTag.textContent = "Awaiting inputs";
    verdictText.textContent =
      "Once you calculate, you’ll see a quick summary of how this deal looks based on cash flow and cash-on-cash return.";
    verdictBlock.classList.remove("tone-strong", "tone-ok", "tone-weak", "tone-neutral");

    if (cashFlowBlock) {
      cashFlowBlock.classList.remove(
        "result-cash-neutral",
        "result-cash-positive",
        "result-cash-negative"
      );
      cashFlowBlock.classList.add("result-cash-neutral");
    }
  });

  // On initial load, default cash-flow card to neutral look
  if (cashFlowBlock) {
    cashFlowBlock.classList.add("result-cash-neutral");
  }
});
