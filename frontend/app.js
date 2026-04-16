const form = document.querySelector("#expense-form");
const formStatus = document.querySelector("#form-status");
const statsFilterForm = document.querySelector("#stats-filter-form");
const statsCategory = document.querySelector("#stats-category");
const resetFilterButton = document.querySelector("#reset-filter");
const filterStatus = document.querySelector("#filter-status");
const cards = document.querySelector("#cards");
const monthlyChart = document.querySelector("#monthly-chart");
const categoryChart = document.querySelector("#category-chart");
const expensesTable = document.querySelector("#expenses-table");
const statsFilter = {
    category: "",
    date_from: "",
    date_to: "",
};
function currency(value) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
    }).format(value);
}
async function fetchJSON(url, options) {
    const response = await fetch(url, {
        headers: {
            "Content-Type": "application/json",
        },
        ...options,
    });
    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Request failed");
    }
    return await response.json();
}
function buildStatsQuery() {
    const params = new URLSearchParams();
    if (statsFilter.category) {
        params.set("category", statsFilter.category);
    }
    if (statsFilter.date_from) {
        params.set("date_from", statsFilter.date_from);
    }
    if (statsFilter.date_to) {
        params.set("date_to", statsFilter.date_to);
    }
    const query = params.toString();
    return query ? `?${query}` : "";
}
function syncFilterForm(filters) {
    if (!statsFilterForm) {
        return;
    }
    const categoryInput = statsFilterForm.querySelector('select[name="category"]');
    const fromInput = statsFilterForm.querySelector('input[name="date_from"]');
    const toInput = statsFilterForm.querySelector('input[name="date_to"]');
    if (categoryInput) {
        categoryInput.value = filters.category;
    }
    if (fromInput) {
        fromInput.value = filters.date_from;
    }
    if (toInput) {
        toInput.value = filters.date_to;
    }
}
function renderFilterStatus(filters, count) {
    if (!filterStatus) {
        return;
    }
    const parts = [];
    if (filters.category) {
        parts.push(`Category: ${filters.category}`);
    }
    if (filters.date_from) {
        parts.push(`From: ${filters.date_from}`);
    }
    if (filters.date_to) {
        parts.push(`To: ${filters.date_to}`);
    }
    filterStatus.textContent =
        parts.length > 0 ? `Filtered stats for ${parts.join(" | ")} (${count} transactions).` : "Showing statistics for all transactions.";
}
function populateCategoryOptions(expenses) {
    if (!statsCategory) {
        return;
    }
    const currentValue = statsCategory.value;
    const categories = Array.from(new Set(expenses.map((expense) => expense.category))).sort((left, right) => left.localeCompare(right));
    statsCategory.innerHTML = [
        `<option value="">All categories</option>`,
        ...categories.map((category) => `<option value="${category}">${category}</option>`),
    ].join("");
    statsCategory.value = categories.includes(currentValue) ? currentValue : statsFilter.category;
}
function renderCards(stats) {
    if (!cards) {
        return;
    }
    const items = [
        { label: "Total Spend", value: currency(stats.cards.total_spend) },
        { label: "This Month", value: currency(stats.cards.current_month_total) },
        { label: "Avg Transaction", value: currency(stats.cards.average_transaction) },
        { label: "Top Category", value: stats.cards.top_category },
    ];
    cards.innerHTML = items
        .map((item) => `
        <article class="stat-card">
          <h3>${item.label}</h3>
          <p class="metric-value">${item.value}</p>
        </article>
      `)
        .join("");
}
function renderMonthlyChart(stats) {
    if (!monthlyChart) {
        return;
    }
    if (stats.monthly_series.length === 0) {
        monthlyChart.innerHTML = `<p class="empty-state">Add expenses to see the monthly chart.</p>`;
        return;
    }
    const max = Math.max(...stats.monthly_series.map((item) => item.total), 1);
    monthlyChart.innerHTML = stats.monthly_series
        .map((item) => {
        const height = Math.max((item.total / max) * 220, 12);
        return `
        <div class="bar-column">
          <span class="bar-value">${currency(item.total)}</span>
          <div class="bar" style="height:${height}px"></div>
          <span class="bar-label">${item.label}</span>
        </div>
      `;
    })
        .join("");
}
function renderCategoryChart(stats) {
    if (!categoryChart) {
        return;
    }
    if (stats.category_series.length === 0) {
        categoryChart.innerHTML = `<p class="empty-state">Add expenses to see category breakdown.</p>`;
        return;
    }
    const total = stats.category_series.reduce((sum, item) => sum + item.total, 0) || 1;
    categoryChart.innerHTML = stats.category_series
        .slice(0, 6)
        .map((item) => {
        const percent = (item.total / total) * 100;
        return `
        <div class="category-row">
          <strong>${item.label}</strong>
          <div class="category-track">
            <div class="category-fill" style="width:${percent}%"></div>
          </div>
          <span>${currency(item.total)}</span>
        </div>
      `;
    })
        .join("");
}
function renderExpenses(expenses) {
    if (!expensesTable) {
        return;
    }
    if (expenses.length === 0) {
        expensesTable.innerHTML = `
      <tr>
        <td colspan="6" class="empty-state">No expenses yet. Add your first entry.</td>
      </tr>
    `;
        return;
    }
    expensesTable.innerHTML = expenses
        .slice(0, 12)
        .map((expense) => `
        <tr>
          <td>${expense.date}</td>
          <td>${expense.category}</td>
          <td>${expense.description}</td>
          <td>${expense.payment_method}</td>
          <td class="amount-cell">${currency(expense.amount)}</td>
          <td><button class="ghost-button" data-delete-id="${expense.id}" type="button">Delete</button></td>
        </tr>
      `)
        .join("");
}
async function refresh() {
    const [expensesResponse, stats] = await Promise.all([
        fetchJSON("/api/expenses"),
        fetchJSON(`/api/stats${buildStatsQuery()}`),
    ]);
    populateCategoryOptions(expensesResponse.expenses);
    syncFilterForm(stats.filters);
    renderFilterStatus(stats.filters, stats.cards.transaction_count);
    renderCards(stats);
    renderMonthlyChart(stats);
    renderCategoryChart(stats);
    renderExpenses(expensesResponse.expenses);
}
async function handleSubmit(event) {
    event.preventDefault();
    if (!form || !formStatus) {
        return;
    }
    const formData = new FormData(form);
    const payload = {
        date: String(formData.get("date") || ""),
        category: String(formData.get("category") || ""),
        description: String(formData.get("description") || ""),
        amount: Number(formData.get("amount") || 0),
        payment_method: String(formData.get("payment_method") || ""),
        notes: String(formData.get("notes") || ""),
    };
    try {
        formStatus.textContent = "Saving...";
        await fetchJSON("/api/expenses", {
            method: "POST",
            body: JSON.stringify(payload),
        });
        form.reset();
        const dateInput = form.querySelector('input[name="date"]');
        if (dateInput) {
            dateInput.value = new Date().toISOString().slice(0, 10);
        }
        formStatus.textContent = "Expense saved.";
        await refresh();
    }
    catch (error) {
        formStatus.textContent = error instanceof Error ? error.message : "Unable to save expense.";
    }
}
async function handleTableClick(event) {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) {
        return;
    }
    const expenseId = target.dataset.deleteId;
    if (!expenseId) {
        return;
    }
    try {
        await fetchJSON(`/api/expenses/${expenseId}`, { method: "DELETE" });
        await refresh();
    }
    catch (error) {
        if (formStatus) {
            formStatus.textContent = error instanceof Error ? error.message : "Unable to delete expense.";
        }
    }
}
async function handleFilterSubmit(event) {
    event.preventDefault();
    if (!statsFilterForm) {
        return;
    }
    const formData = new FormData(statsFilterForm);
    statsFilter.category = String(formData.get("category") || "");
    statsFilter.date_from = String(formData.get("date_from") || "");
    statsFilter.date_to = String(formData.get("date_to") || "");
    if (filterStatus) {
        filterStatus.textContent = "Updating statistics...";
    }
    try {
        await refresh();
    }
    catch (error) {
        if (filterStatus) {
            filterStatus.textContent = error instanceof Error ? error.message : "Unable to update statistics.";
        }
    }
}
async function handleFilterReset() {
    statsFilter.category = "";
    statsFilter.date_from = "";
    statsFilter.date_to = "";
    syncFilterForm(statsFilter);
    if (filterStatus) {
        filterStatus.textContent = "Resetting filter...";
    }
    try {
        await refresh();
    }
    catch (error) {
        if (filterStatus) {
            filterStatus.textContent = error instanceof Error ? error.message : "Unable to reset statistics.";
        }
    }
}
function initialize() {
    if (!form || !expensesTable) {
        return;
    }
    const dateInput = form.querySelector('input[name="date"]');
    if (dateInput) {
        dateInput.value = new Date().toISOString().slice(0, 10);
    }
    form.addEventListener("submit", (event) => {
        void handleSubmit(event);
    });
    expensesTable.addEventListener("click", (event) => {
        void handleTableClick(event);
    });
    statsFilterForm?.addEventListener("submit", (event) => {
        void handleFilterSubmit(event);
    });
    resetFilterButton?.addEventListener("click", () => {
        void handleFilterReset();
    });
    void refresh();
}
initialize();
