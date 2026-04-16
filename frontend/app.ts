type Expense = {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  payment_method: string;
  notes: string;
};

type StatsResponse = {
  cards: {
    total_spend: number;
    current_month_total: number;
    average_transaction: number;
    top_category: string;
    transaction_count: number;
  };
  monthly_series: Array<{ label: string; total: number }>;
  category_series: Array<{ label: string; total: number }>;
};

const form = document.querySelector<HTMLFormElement>("#expense-form");
const formStatus = document.querySelector<HTMLParagraphElement>("#form-status");
const cards = document.querySelector<HTMLDivElement>("#cards");
const monthlyChart = document.querySelector<HTMLDivElement>("#monthly-chart");
const categoryChart = document.querySelector<HTMLDivElement>("#category-chart");
const expensesTable = document.querySelector<HTMLTableSectionElement>("#expenses-table");

function currency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
    },
    ...options,
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || "Request failed");
  }

  return (await response.json()) as T;
}

function renderCards(stats: StatsResponse): void {
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
    .map(
      (item) => `
        <article class="stat-card">
          <h3>${item.label}</h3>
          <p class="metric-value">${item.value}</p>
        </article>
      `
    )
    .join("");
}

function renderMonthlyChart(stats: StatsResponse): void {
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

function renderCategoryChart(stats: StatsResponse): void {
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

function renderExpenses(expenses: Expense[]): void {
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
    .map(
      (expense) => `
        <tr>
          <td>${expense.date}</td>
          <td>${expense.category}</td>
          <td>${expense.description}</td>
          <td>${expense.payment_method}</td>
          <td class="amount-cell">${currency(expense.amount)}</td>
          <td><button class="ghost-button" data-delete-id="${expense.id}" type="button">Delete</button></td>
        </tr>
      `
    )
    .join("");
}

async function refresh(): Promise<void> {
  const [expensesResponse, stats] = await Promise.all([
    fetchJSON<{ expenses: Expense[] }>("/api/expenses"),
    fetchJSON<StatsResponse>("/api/stats"),
  ]);

  renderCards(stats);
  renderMonthlyChart(stats);
  renderCategoryChart(stats);
  renderExpenses(expensesResponse.expenses);
}

async function handleSubmit(event: SubmitEvent): Promise<void> {
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
    const dateInput = form.querySelector<HTMLInputElement>('input[name="date"]');
    if (dateInput) {
      dateInput.value = new Date().toISOString().slice(0, 10);
    }
    formStatus.textContent = "Expense saved.";
    await refresh();
  } catch (error) {
    formStatus.textContent = error instanceof Error ? error.message : "Unable to save expense.";
  }
}

async function handleTableClick(event: Event): Promise<void> {
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
  } catch (error) {
    if (formStatus) {
      formStatus.textContent = error instanceof Error ? error.message : "Unable to delete expense.";
    }
  }
}

function initialize(): void {
  if (!form || !expensesTable) {
    return;
  }

  const dateInput = form.querySelector<HTMLInputElement>('input[name="date"]');
  if (dateInput) {
    dateInput.value = new Date().toISOString().slice(0, 10);
  }

  form.addEventListener("submit", (event) => {
    void handleSubmit(event as SubmitEvent);
  });

  expensesTable.addEventListener("click", (event) => {
    void handleTableClick(event);
  });

  void refresh();
}

initialize();
