/**
 * Main Application Entry & Orchestrator.
 *
 * Manages view navigation, active month state, modal triggers,
 * mobile sidebar drawer, and coordinated view rendering.
 */

import {
  getBudgetForMonth,
  getCurrentMonthKey,
  getTransactions,
  resetDemoData,
  seedDemoDataIfNeeded,
} from './storage.js';
import {
  formatMonthLabel,
  initTransactionUI,
  openTransactionModal,
  renderTransactionHistory,
} from './transactions.js';
import { renderDashboard } from './dashboard.js';
import { renderAnalytics } from './analytics.js';
import { initBudgetUI, renderBudgetView } from './budget.js';

const VIEW_TITLES = {
  dashboard: 'Dashboard',
  transactions: 'Transaction History',
  analytics: 'Expense Analytics',
  budget: 'Budget Management',
};

const appState = {
  activeView: 'dashboard',
  activeMonth: getCurrentMonthKey(),
};

function showToast(message) {
  const region = document.getElementById('toast-region');
  if (!region || !message) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  region.appendChild(toast);

  window.setTimeout(() => {
    toast.remove();
  }, 3000);
}

function closeMobileSidebar() {
  const sidebar = document.getElementById('app-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  const toggleBtn = document.getElementById('btn-menu-toggle');
  sidebar?.classList.remove('is-open');
  backdrop?.classList.remove('is-open');
  toggleBtn?.setAttribute('aria-expanded', 'false');
}

function openMobileSidebar() {
  const sidebar = document.getElementById('app-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  const toggleBtn = document.getElementById('btn-menu-toggle');
  sidebar?.classList.add('is-open');
  backdrop?.classList.add('is-open');
  toggleBtn?.setAttribute('aria-expanded', 'true');
}

function renderActiveView() {
  const transactions = getTransactions();
  const budgetLimit = getBudgetForMonth(appState.activeMonth);

  const periodLabel = document.getElementById('topbar-period-label');
  if (periodLabel) {
    periodLabel.textContent = `Period: ${formatMonthLabel(appState.activeMonth)}`;
  }

  const monthPicker = document.getElementById('active-month-select');
  if (monthPicker && monthPicker.value !== appState.activeMonth) {
    monthPicker.value = appState.activeMonth;
  }

  if (appState.activeView === 'dashboard') {
    renderDashboard(transactions, appState.activeMonth);
  } else if (appState.activeView === 'transactions') {
    renderTransactionHistory(transactions);
  } else if (appState.activeView === 'analytics') {
    renderAnalytics(transactions, appState.activeMonth);
  } else if (appState.activeView === 'budget') {
    renderBudgetView(transactions, appState.activeMonth, budgetLimit);
  }

  if (window.lucide?.createIcons) {
    window.lucide.createIcons();
  }
}

function navigateTo(viewName) {
  if (!VIEW_TITLES[viewName]) return;
  appState.activeView = viewName;

  document.querySelectorAll('[data-nav]').forEach((btn) => {
    const isActive = btn.dataset.nav === viewName;
    btn.classList.toggle('is-active', isActive);
    if (isActive) {
      btn.setAttribute('aria-current', 'page');
    } else {
      btn.removeAttribute('aria-current');
    }
  });

  document.querySelectorAll('.view-section').forEach((section) => {
    section.classList.toggle('is-active', section.dataset.view === viewName);
  });

  const titleEl = document.getElementById('topbar-title');
  if (titleEl) {
    titleEl.textContent = VIEW_TITLES[viewName];
  }

  closeMobileSidebar();
  renderActiveView();
}

function initApp() {
  seedDemoDataIfNeeded();

  // Initialize module UIs
  initTransactionUI({
    onDataChange: (message) => {
      renderActiveView();
      if (message) showToast(message);
    },
  });

  initBudgetUI({
    onBudgetSaved: (savedMonth, message) => {
      appState.activeMonth = savedMonth;
      renderActiveView();
      if (message) showToast(message);
    },
  });

  // Sidebar navigation links
  document.querySelectorAll('[data-nav]').forEach((btn) => {
    btn.addEventListener('click', () => {
      navigateTo(btn.dataset.nav);
    });
  });

  // View All button on Dashboard recent transactions
  document.getElementById('btn-view-all-transactions')?.addEventListener('click', () => {
    navigateTo('transactions');
  });

  // Global Add Transaction triggers
  document.getElementById('btn-add-transaction')?.addEventListener('click', () => {
    openTransactionModal(null);
  });
  document.querySelectorAll('.js-open-add').forEach((btn) => {
    btn.addEventListener('click', () => openTransactionModal(null));
  });

  // Active month selector
  const monthSelect = document.getElementById('active-month-select');
  if (monthSelect) {
    monthSelect.value = appState.activeMonth;
    monthSelect.addEventListener('change', (e) => {
      if (e.target.value) {
        appState.activeMonth = e.target.value;
        renderActiveView();
      }
    });
  }

  // Reset sample data button
  document.getElementById('btn-reset-demo')?.addEventListener('click', () => {
    resetDemoData();
    appState.activeMonth = getCurrentMonthKey();
    renderActiveView();
    showToast('Sample data restored.');
  });

  // Mobile sidebar controls
  document.getElementById('btn-menu-toggle')?.addEventListener('click', () => {
    const sidebar = document.getElementById('app-sidebar');
    if (sidebar?.classList.contains('is-open')) {
      closeMobileSidebar();
    } else {
      openMobileSidebar();
    }
  });
  document.getElementById('sidebar-backdrop')?.addEventListener('click', closeMobileSidebar);

  // Close open modals / drawer on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.getElementById('transaction-modal')?.classList.add('is-hidden');
      document.getElementById('delete-modal')?.classList.add('is-hidden');
      closeMobileSidebar();
    }
  });

  // Initial render (and re-render charts once deferred Chart.js finishes loading if needed)
  navigateTo('dashboard');
  window.addEventListener('load', () => {
    renderActiveView();
  });
}

document.addEventListener('DOMContentLoaded', initApp);
