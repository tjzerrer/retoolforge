// tools/rental-roi.js

document.addEventListener("DOMContentLoaded", () => {
  // ---------- Helpers ----------
  const byId = (id) => document.getElementById(id);

  const asNumber = (id) => {
    const el = byId(id);
    if (!el) return 0;
    const v = parseFloat(el.value);
    return isNaN(v) ? 0 : v;
  };

  const formatMoney = (val) =>
    isNaN(val)
      ? "—"
      : val.toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        });

  const formatMoney0 = (val) => formatMoney(Math.round(val));

  const formatPercent = (val) =>
    isNaN(val) ? "—" : `${val.toFixed(1)}%`;

  // Status chip helper (small “Copied!” / “Email draft opened” bubble)
  function showStatusChip(id, message, variant = "ok") {
    const el = byId(id);
    if (!el) return;

    el.textContent = message;

    el.classList.remove("status-ok", "status-error", "status-muted", "visible");

    if (variant === "ok") {
      el.classList.add("status-ok");
    } else if (variant === "error") {
      el.classList.add("status-error");
    } else {
      el.classList.add("status-muted");
    }

    el.classList.add("visible");

    // auto-hide after 2 seconds
    setTimeout(() => {
      el.classList.remove("visible");
    }, 2000);
  }

  // ---------- Compute deal from current inputs ----------
  function computeDealFromInputs() {
    const purchasePrice = asNumber("purchasePrice");
    const downPaymentPercent = asNumber("downPayment");
    const interestRate = asNumber("interestRate");
    const loanTermYears = asNumber("loanTerm");

    const monthlyRent = asNumber("monthlyRent");
    const annualTaxes = asNumber("annualTaxes");
    const annualInsurance = asNumber("annualInsurance");
    const monthlyHOA = asNumber("monthlyHOA");
    const maintenancePercent = asNumber("maintenancePercent");
    const otherMonthly = asNumber("otherMonthly");

    const closingCostsPercent = asNumber("closingCostsPercent");
    const upfrontRepairs = asNumber("upfrontRepairs");

    const propertyLabel = (byId("propertyLabel")?.value || "").trim();
    const emailAddress = (byId("userEmail")?.value || "").trim();

    // Basic sanity: we need at least a price + rent
    if (purchasePrice <= 0 || monthlyRent <= 0) {
      return null;
    }

    // Down payment & loan
    const downPaymentAmount = (purchasePrice * downPaymentPercent) / 100;
    const loanAmount = Math.max(purchasePrice - downPaymentAmount, 0);

    // Mortgage payment (standard amortization)
    const nMonths = loanTermYears * 12;
    const monthlyRate = interestRate > 0 ? interestRate / 100 / 12 : 0;

    let monthlyMortgage = 0;
    if (loanAmount > 0 && nMonths > 0) {
      if (monthlyRate > 0) {
        const factor = Math.pow(1 + monthlyRate, nMonths);
        monthlyMortgage = (loanAmount * monthlyRate * factor) / (factor - 1);
      } else {
        // 0% interest edge case
        monthlyMortgage = loanAmount / nMonths;
      }
    }

    // Income & expenses
    const monthlyTaxes = annualTaxes / 12;
    const monthlyInsurance = annualInsurance / 12;
    const maintenanceVacancy = (monthlyRent * maintenancePercent) / 100;

    const totalMonthlyExpenses =
      monthlyMortgage +
      monthlyTaxes +
      monthlyInsurance +
      monthlyHOA +
      maintenanceVacancy +
      otherMonthly;

    const grossMonthlyIncome = monthlyRent;
    const monthlyCashFlow = grossMonthlyIncome - totalMonthlyExpenses;
    const annualCashFlow = monthlyCashFlow * 12;

    // NOI for cap rate (exclude mortgage)
    const monthlyOperatingExpensesExMortgage =
      monthlyTaxes +
      monthlyInsurance +
      monthlyHOA +
      maintenanceVacancy +
      otherMonthly;

    const monthlyNOI = grossMonthlyIncome - monthlyOperatingExpensesExMortgage;
    const annualNOI = monthlyNOI * 12;
    const capRate =
      purchasePrice > 0 ? (annualNOI * 100) / purchasePrice : NaN;

    // Cash invested
    const closingCosts = (purchasePrice * closingCostsPercent) / 100;
    const totalCashInvested = downPaymentAmount + closingCosts + upfrontRepairs;

    const cashOnCash =
      totalCashInvested > 0
        ? (annualCashFlow * 100) / totalCashInvested
        : NaN;

    // Verdict logic
    let verdictLabel = "Tight cash flow – verify numbers";
    let verdictExplanation =
      "Cash flow is thin. Double-check taxes, insurance, repairs, and rent assumptions.";
    let verdictTone = "neutral";

    if (monthlyCashFlow < 0) {
      verdictLabel = "Negative cash flow – be cautious";
      verdictExplanation =
        "This deal loses money each month on these assumptions. It might still work if you expect strong appreciation, but it deserves a deeper look.";
      verdictTone = "bad";
    } else if (monthlyCashFlow >= 0 && monthlyCashFlow < 200) {
      verdictLabel = "Barely cash-flow positive";
      verdictExplanation =
        "The deal just clears the expenses. A small change in taxes, insurance, or repairs could wipe out the profit.";
      verdictTone = "weak";
    } else if (monthlyCashFlow >= 200 && cashOnCash >= 8) {
      verdictLabel = "Strong on paper";
      verdictExplanation =
        "Solid monthly cash flow with a healthy cash-on-cash return on these assumptions.";
      verdictTone = "strong";
    }

    return {
      // raw inputs
      propertyLabel,
      emailAddress,
      purchasePrice,
      downPaymentPercent,
      interestRate,
      loanTermYears,
      monthlyRent,
      annualTaxes,
      annualInsurance,
      monthlyHOA,
      maintenancePercent,
      otherMonthly,
      closingCostsPercent,
      upfrontRepairs,

      // derived
      downPaymentAmount,
      loanAmount,
      monthlyMortgage,
      monthlyTaxes,
      monthlyInsurance,
      maintenanceVacancy,
      totalMonthlyExpenses,
      grossMonthlyIncome,
      monthlyCashFlow,
      annualCashFlow,
      monthlyNOI,
      annualNOI,
      capRate,
      closingCosts,
      totalCashInvested,
      cashOnCash,

      // verdict
      verdictLabel,
      verdictExplanation,
      verdictTone,
    };
  }

  // ---------- Update the right-hand UI ----------
  function updateUI(deal) {
    const cashFlowDisplay = byId("cashFlowDisplay");
    const cashFlowCaption = byId("cashFlowCaption");
    const cocDisplay = byId("cocDisplay");
    const capRateDisplay = byId("capRateDisplay");
    const expensesDisplay = byId("expensesDisplay");
    const expenseBreakdown = byId("expenseBreakdown");
    const cashInvestedDisplay = byId("cashInvestedDisplay");
    const verdictBlock = byId("verdictBlock");
    const verdictTag = byId("verdictTag");
    const verdictText = byId("verdictText");

    const cashFlowBlock = cashFlowDisplay?.closest(".result-block");

    if (!deal) {
      // reset to neutral “awaiting inputs” state
      if (cashFlowDisplay) cashFlowDisplay.textContent = "—";
      if (cashFlowCaption)
        cashFlowCaption.textContent =
          'Enter numbers on the left and hit "Calculate" to see your cash flow.';
      if (cocDisplay) cocDisplay.textContent = "—";
      if (capRateDisplay) capRateDisplay.textContent = "—";
      if (expensesDisplay) expensesDisplay.textContent = "—";
      if (expenseBreakdown)
        expenseBreakdown.textContent =
          "Mortgage, taxes, insurance, HOA, maintenance, and other expenses.";
      if (cashInvestedDisplay) cashInvestedDisplay.textContent = "—";
      if (verdictTag) verdictTag.textContent = "Awaiting inputs";
      if (verdictText)
        verdictText.textContent =
          "Once you calculate, you’ll see a quick summary of how this deal looks based on cash flow and cash-on-cash return.";

      if (verdictBlock) {
        verdictBlock.classList.remove(
          "tone-strong",
          "tone-weak",
          "tone-neutral",
          "tone-bad"
        );
        verdictBlock.classList.add("tone-neutral");
      }

      if (cashFlowBlock) {
        cashFlowBlock.classList.remove(
          "result-cash-positive",
          "result-cash-negative",
          "result-cash-neutral"
        );
        cashFlowBlock.classList.add("result-cash-neutral");
      }

      return;
    }

    const {
      monthlyCashFlow,
      cashOnCash,
      capRate,
      totalMonthlyExpenses,
      monthlyMortgage,
      monthlyTaxes,
      monthlyInsurance,
      monthlyHOA,
      maintenanceVacancy,
      otherMonthly,
      totalCashInvested,
      verdictLabel,
      verdictExplanation,
      verdictTone,
    } = deal;

    if (cashFlowDisplay) cashFlowDisplay.textContent = formatMoney0(monthlyCashFlow);
    if (cocDisplay) cocDisplay.textContent = formatPercent(cashOnCash);
    if (capRateDisplay) capRateDisplay.textContent = formatPercent(capRate);
    if (expensesDisplay)
      expensesDisplay.textContent = formatMoney0(totalMonthlyExpenses);
    if (cashInvestedDisplay)
      cashInvestedDisplay.textContent = formatMoney0(totalCashInvested);

    if (cashFlowCaption) {
      if (monthlyCashFlow < 0) {
        cashFlowCaption.textContent =
          "Approximate monthly cash flow after mortgage and expenses (negative).";
      } else {
        cashFlowCaption.textContent =
          "Approximate monthly cash flow after mortgage and expenses.";
      }
    }

    if (expenseBreakdown) {
      expenseBreakdown.textContent =
        `Includes mortgage (${formatMoney0(monthlyMortgage)}), ` +
        `taxes (${formatMoney0(monthlyTaxes)}), insurance (${formatMoney0(
          monthlyInsurance
        )}), HOA (${formatMoney0(monthlyHOA)}), ` +
        `maintenance & vacancy (${formatMoney0(
          maintenanceVacancy
        )}), and other expenses (${formatMoney0(otherMonthly)}).`;
    }

    if (verdictTag) verdictTag.textContent = verdictLabel;
    if (verdictText) verdictText.textContent = verdictExplanation;

    if (verdictBlock) {
      verdictBlock.classList.remove(
        "tone-strong",
        "tone-weak",
        "tone-neutral",
        "tone-bad"
      );
      const toneClass =
        verdictTone === "strong"
          ? "tone-strong"
          : verdictTone === "bad"
          ? "tone-bad"
          : verdictTone === "weak"
          ? "tone-weak"
          : "tone-neutral";
      verdictBlock.classList.add(toneClass);
    }

    if (cashFlowBlock) {
      cashFlowBlock.classList.remove(
        "result-cash-positive",
        "result-cash-negative",
        "result-cash-neutral"
      );
      if (monthlyCashFlow < 0) {
        cashFlowBlock.classList.add("result-cash-negative");
      } else if (monthlyCashFlow >= 0 && monthlyCashFlow < 200) {
        cashFlowBlock.classList.add("result-cash-neutral");
      } else {
        cashFlowBlock.classList.add("result-cash-positive");
      }
    }
  }

  // ---------- Build the text report (used by copy + email) ----------
  function buildDealSummaryText(deal, options) {
    const {
      propertyLabel,
      purchasePrice,
      downPaymentPercent,
      interestRate,
      loanTermYears,
      monthlyRent,
      annualTaxes,
      annualInsurance,
      monthlyHOA,
      maintenancePercent,
      otherMonthly,
      closingCostsPercent,
      upfrontRepairs,
      downPaymentAmount,
      monthlyMortgage,
      monthlyTaxes,
      monthlyInsurance,
      maintenanceVacancy,
      totalMonthlyExpenses,
      monthlyCashFlow,
      annualCashFlow,
      cashOnCash,
      capRate,
      closingCosts,
      totalCashInvested,
      verdictLabel,
      verdictExplanation,
    } = deal;

    const lines = [];

    lines.push("REToolForge Rental ROI Report");
    lines.push("------------------------------");
    lines.push(
      `Property: ${propertyLabel || "Unnamed property"}`
    );
    lines.push("");
    lines.push("Purchase & financing");
    lines.push(
      `• Purchase price: ${formatMoney0(purchasePrice)}`
    );
    lines.push(
      `• Down payment: ${downPaymentPercent.toFixed(
        1
      )}% (${formatMoney0(downPaymentAmount)})`
    );
    lines.push(
      `• Interest rate: ${interestRate.toFixed(2)}% | Term: ${loanTermYears} years`
    );
    lines.push("");
    lines.push("Income & expenses (monthly)");
    lines.push(`• Rent: ${formatMoney0(monthlyRent)}`);
    lines.push(
      `• Taxes: ${formatMoney0(monthlyTaxes)} | Insurance: ${formatMoney0(
        monthlyInsurance
      )}`
    );
    lines.push(
      `• HOA: ${formatMoney0(monthlyHOA)} | Maintenance & vacancy: ${maintenancePercent.toFixed(
        1
      )}% of rent (${formatMoney0(maintenanceVacancy)})`
    );
    lines.push(
      `• Other expenses: ${formatMoney0(otherMonthly)}`
    );
    lines.push(`• Mortgage: ${formatMoney0(monthlyMortgage)}`);
    lines.push("");
    lines.push("Key metrics");
    lines.push(
      `• Monthly cash flow: ${formatMoney0(monthlyCashFlow)}`
    );
    lines.push(
      `• Annual cash flow: ${formatMoney0(annualCashFlow)}`
    );
    lines.push(
      `• Cash-on-cash return: ${formatPercent(cashOnCash)}`
    );
    lines.push(`• Cap rate: ${formatPercent(capRate)}`);
    lines.push(
      `• Total cash invested: ${formatMoney0(totalCashInvested)} ` +
        `(closing costs ${closingCostsPercent.toFixed(
          1
        )}% ≈ ${formatMoney0(closingCosts)}, ` +
        `upfront repairs ${formatMoney0(upfrontRepairs)})`
    );
    lines.push("");

    if (options.includeVerdictNotes) {
      lines.push(`Deal verdict: ${verdictLabel}`);
      lines.push(verdictExplanation);
      lines.push("");
    }

    if (options.includeBreakdown) {
      lines.push("Expense breakdown (monthly):");
      lines.push(
        `• Mortgage: ${formatMoney0(monthlyMortgage)}`
      );
      lines.push(
        `• Taxes: ${formatMoney0(monthlyTaxes)} | Insurance: ${formatMoney0(
          monthlyInsurance
        )}`
      );
      lines.push(
        `• HOA: ${formatMoney0(monthlyHOA)} | Maintenance & vacancy: ${formatMoney0(
          maintenanceVacancy
        )}`
      );
      lines.push(
        `• Other expenses: ${formatMoney0(otherMonthly)}`
      );
      lines.push(
        `• Total monthly expenses: ${formatMoney0(totalMonthlyExpenses)}`
      );
      lines.push("");
    }

    if (options.includeStrategyTips) {
      lines.push("Strategy notes & next steps:");
      lines.push(
        "• Stress-test the deal by lowering rent or raising expenses slightly."
      );
      lines.push(
        "• Compare this property to others using the same assumptions."
      );
      lines.push(
        "• Consider your risk tolerance: thin cash flow deals can still work if appreciation or value-add is strong."
      );
    }

    return lines.join("\n");
  }

  // ---------- Wire up the UI ----------
  const form = byId("rentalForm");
  const copyBtn = byId("copySummaryBtn");
  const emailBtn = byId("emailReportBtn");
  const resetBtn = byId("resetBtn");

  let lastComputed = null;

  // Calculate button (form submit)
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const deal = computeDealFromInputs();
      if (!deal) {
        lastComputed = null;
        updateUI(null);
        showStatusChip("copyStatus", "Add price & rent", "error");
        return;
      }
      lastComputed = deal;
      updateUI(deal);
    });
  }

  // Copy deal summary
  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      if (!lastComputed) {
        showStatusChip("copyStatus", "Calculate first", "error");
        return;
      }

      const includeBreakdown =
        byId("includeBreakdown")?.checked ?? true;
      const includeVerdictNotes =
        byId("includeVerdictNotes")?.checked ?? true;
      const includeStrategyTips =
        byId("includeStrategyTips")?.checked ?? true;

      const summary = buildDealSummaryText(lastComputed, {
        includeBreakdown,
        includeVerdictNotes,
        includeStrategyTips,
      });

      try {
        await navigator.clipboard.writeText(summary);
        showStatusChip("copyStatus", "Copied!", "ok");
      } catch (err) {
        console.error("Copy failed:", err);
        showStatusChip("copyStatus", "Copy failed", "error");
      }
    });
  }

  // Email me this report (simple mailto draft for now)
  if (emailBtn) {
    emailBtn.addEventListener("click", () => {
      if (!lastComputed) {
        showStatusChip("emailStatus", "Calculate first", "error");
        return;
      }

      const emailField = byId("userEmail");
      const email = emailField?.value.trim() || "";

      if (!email) {
        showStatusChip("emailStatus", "Enter an email", "error");
        emailField?.focus();
        return;
      }

      const includeBreakdown =
        byId("includeBreakdown")?.checked ?? true;
      const includeVerdictNotes =
        byId("includeVerdictNotes")?.checked ?? true;
      const includeStrategyTips =
        byId("includeStrategyTips")?.checked ?? true;

      const summary = buildDealSummaryText(lastComputed, {
        includeBreakdown,
        includeVerdictNotes,
        includeStrategyTips,
      });

      const subject = encodeURIComponent(
        `REToolForge Rental ROI Report – ${
          lastComputed.propertyLabel || "Property"
        }`
      );
      const body = encodeURIComponent(summary);

      window.location.href = `mailto:${encodeURIComponent(
        email
      )}?subject=${subject}&body=${body}`;

      showStatusChip("emailStatus", "Email draft opened", "ok");
    });
  }

  // Reset inputs
  if (resetBtn && form) {
    resetBtn.addEventListener("click", () => {
      form.reset();
      lastComputed = null;
      updateUI(null);
      showStatusChip("copyStatus", "", "muted");
      showStatusChip("emailStatus", "", "muted");
    });
  }

  // Initial neutral UI
  updateUI(null);
});
