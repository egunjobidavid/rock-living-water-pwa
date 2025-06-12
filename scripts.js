/**
 * @file Main application script for Rock Living Water PWA
 * @description Progressive Web App for sales, expenses, and customer management
 * @version 3.0
 */

// Import localforage for offline storage (would be bundled in your build process)
// import localforage from 'localforage';

// State management using a simple store pattern
const Store = {
  state: {
    credentials: { email: '', token: '' },
    cachedData: {
      sales: [],
      customers: [],
      vendors: [],
      expenses: [],
      metrics: null // For offline metrics storage
    },
    uiState: {
      currentView: 'dashboard',
      isLoading: false,
      offline: !navigator.onLine
    }
  },

  setCredentials(credentials) {
    this.state.credentials = { ...this.state.credentials, ...credentials };
    this.saveToStorage('credentials', this.state.credentials);
  },

  setMetrics(metrics) {
    this.state.cachedData.metrics = metrics;
    this.saveToStorage('metrics', metrics);
  },

  setCachedData(type, data) {
    this.state.cachedData[type] = data;
    this.saveToStorage(type, data);
  },

  setOfflineStatus(status) {
    this.state.uiState.offline = status;
  },

  async loadFromStorage() {
    try {
      const credentials = await localforage.getItem('credentials');
      if (credentials) this.state.credentials = credentials;
      
      const metrics = await localforage.getItem('metrics');
      if (metrics) this.state.cachedData.metrics = metrics;

      const sales = await localforage.getItem('sales');
      if (sales) this.state.cachedData.sales = sales;

      const customers = await localforage.getItem('customers');
      if (customers) this.state.cachedData.customers = customers;

      const vendors = await localforage.getItem('vendors');
      if (vendors) this.state.cachedData.vendors = vendors;

      const expenses = await localforage.getItem('expenses');
      if (expenses) this.state.cachedData.expenses = expenses;

      Utils.logInfo('State loaded from storage', 'Store');
    } catch (err) {
      Utils.logError(`Failed to load state: ${err.message || err}`, 'Store');
    }
  },

  async saveToStorage(key, value) {
    try {
      await localforage.setItem(key, value);
    } catch (err) {
      Utils.logError(`Failed to save ${key}: ${err.message || err}`, 'Store');
    }
  }
};

// DOM Elements cache with accessibility attributes
const DOM = {
  get errorConsole() {
    const el = document.getElementById('errorConsole');
    if (el) el.setAttribute('aria-live', 'polite');
    return el;
  },
  get loadingIndicator() {
    const el = document.getElementById('loading');
    if (el) {
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
    }
    return el;
  },
  get today() {
    return moment().tz('Africa/Lagos').format('YYYY-MM-DD');
  },
  get mainContent() {
    const el = document.getElementById('main-content');
    if (el) el.setAttribute('role', 'main');
    return el;
  }
};

// Enhanced utility functions with JSDoc
const Utils = {
  /**
   * Logs an error message to console and error console UI
   * @param {string} message - The error message
   * @param {string} source - The source module where error occurred
   */
  logError(message, source) {
    console.error(`[${source}] ${message}`);
    if (DOM.errorConsole) {
      const timestamp = moment().tz('Africa/Lagos').format('HH:mm:ss');
      DOM.errorConsole.textContent += `[${timestamp}] [${source}] ERROR: ${message}\n`;
      DOM.errorConsole.scrollTop = DOM.errorConsole.scrollHeight;
    }
  },

  /**
   * Logs an info message to console and error console UI
   * @param {string} message - The info message
   * @param {string} source - The source module
   */
  logInfo(message, source) {
    console.log(`[${source}] ${message}`);
    if (DOM.errorConsole) {
      const timestamp = moment().tz('Africa/Lagos').format('HH:mm:ss');
      DOM.errorConsole.textContent += `[${timestamp}] [${source}] INFO: ${message}\n`;
      DOM.errorConsole.scrollTop = DOM.errorConsole.scrollHeight;
    }
  },

  /**
   * Displays a temporary toast message
   * @param {string} message - The message to display
   * @param {string} type - Alert type (success, danger, warning, info)
   */
  showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `alert alert-${type} position-fixed top-0 end-0 m-3`;
    toast.style.zIndex = '1000';
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  },

  /**
   * Displays a message in a specified element
   * @param {string} elementId - ID of the message element
   * @param {string} message - The message to display
   * @param {string} type - Alert type
   */
  showMessage(elementId, message, type = 'info') {
    const messageDiv = document.getElementById(elementId);
    if (messageDiv) {
      messageDiv.className = `alert alert-${type}`;
      messageDiv.textContent = message;
      messageDiv.style.display = 'block';
      setTimeout(() => messageDiv.style.display = 'none', 5000);
    } else {
      Utils.logError(`Message div with ID ${elementId} not found`, 'Utils');
    }
  },

  /**
   * Sanitizes input to prevent XSS
   * @param {string} str - The string to sanitize
   * @return {string} Sanitized string
   */
  sanitizeInput(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  /**
   * Validates a form field
   * @param {HTMLElement} field - The form field to validate
   * @param {Object} rules - Validation rules
   * @return {boolean} True if valid, false otherwise
   */
  validateField(field, rules) {
    const value = field.value.trim();
    const errorElement = document.getElementById(`${field.id}-error`);
    
    if (rules.required && !value) {
      if (errorElement) errorElement.textContent = 'This field is required';
      return false;
    }

    if (rules.numeric) {
      if (isNaN(value) || value === '') {
        if (errorElement) errorElement.textContent = 'Must be a number';
        return false;
      }
      if (rules.min && parseFloat(value) < rules.min) {
        if (errorElement) errorElement.textContent = `Must be at least ${rules.min}`;
        return false;
      }
      if (rules.max && parseFloat(value) > rules.max) {
        if (errorElement) errorElement.textContent = `Cannot exceed ${rules.max}`;
        return false;
      }
    }

    if (rules.date) {
      const date = moment(value, 'YYYY-MM-DD', true);
      if (!date.isValid()) {
        if (errorElement) errorElement.textContent = 'Invalid date format';
        return false;
      }
      if (rules.future === false && date.isAfter(moment())) {
        if (errorElement) errorElement.textContent = 'Date cannot be in the future';
        return false;
      }
    }

    if (rules.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        if (errorElement) errorElement.textContent = 'Invalid email format';
        return false;
      }
    }

    if (errorElement) errorElement.textContent = '';
    return true;
  },

  /**
   * Formats currency for display
   * @param {number} amount - The amount to format
   * @return {string} Formatted currency string
   */
  formatCurrency(amount) {
    return amount.toLocaleString('en-NG', { 
      style: 'currency', 
      currency: 'NGN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  },

  /**
   * Checks if required dependencies are loaded
   */
  checkDependencies() {
    if (!window.moment) {
      Utils.showMessage('appMessage', 'Moment.js not loaded', 'danger');
      Utils.logError('Moment.js not available', 'Utils');
    }
    if (!window.Chart) {
      Utils.showMessage('appMessage', 'Chart.js not loaded', 'danger');
      Utils.logError('Chart.js not available', 'Utils');
    }
    if (!window.bootstrap) {
      Utils.showMessage('appMessage', 'Bootstrap not loaded', 'danger');
      Utils.logError('Bootstrap not available', 'Utils');
    }
  }
};

// Offline Data Manager with IndexedDB support
const OfflineManager = {
  async init() {
    try {
      localforage.config({
        driver: [
          localforage.INDEXEDDB,
          localforage.WEBSQL,
          localforage.LOCALSTORAGE
        ],
        name: 'RockLivingWaterDB',
        version: 1.0,
        storeName: 'app_data'
      });
      await Store.loadFromStorage();
      Utils.logInfo('Offline manager initialized', 'OfflineManager');
    } catch (err) {
      Utils.logError(`Failed to initialize offline manager: ${err.message || err}`, 'OfflineManager');
    }
  },

  async saveMetrics(metrics) {
    try {
      await Store.setMetrics(metrics);
      Utils.logInfo('Metrics saved for offline use', 'OfflineManager');
    } catch (err) {
      Utils.logError(`Failed to save metrics: ${err.message || err}`, 'OfflineManager');
    }
  },

  async getCachedMetrics() {
    try {
      const metrics = await localforage.getItem('metrics');
      if (metrics) {
        Utils.logInfo('Loaded metrics from cache', 'OfflineManager');
        return metrics;
      }
      return null;
    } catch (err) {
      Utils.logError(`Failed to get cached metrics: ${err.message || err}`, 'OfflineManager');
      return null;
    }
  },

async queueForm(formData) {
  try {
    let queue = await localforage.getItem('formQueue') || [];
    queue.push({
      ...formData,
      timestamp: new Date().toISOString(),
      attempts: 0,
      csrfToken: DataManager.getCSRFToken() // Add CSRF token
    });
    await localforage.setItem('formQueue', queue);
    Utils.logInfo('Form queued for sync', 'OfflineManager');

    // Notify service worker
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      const channel = new MessageChannel();
      navigator.serviceWorker.controller.postMessage(
        { type: 'queue-form', formData: { ...formData, csrfToken: DataManager.getCSRFToken() } },
        [channel.port2]
      );
    }
  } catch (err) {
    Utils.logError(`Failed to queue form: ${err.message || err}`, 'OfflineManager');
  }
}

  async syncPendingForms() {
    try {
      let queue = await localforage.getItem('formQueue') || [];
      if (queue.length === 0) return;

      for (let form of queue) {
        if (form.attempts >= 3) {
          queue = queue.filter(q => q !== form);
          Utils.showToast(`Failed to sync form ${form.formId} after max attempts`, 'danger');
          continue;
        }
        try {
          await DataManager.fetchData(form.url, {
            method: form.method,
            body: form.data
          });
          queue = queue.filter(q => q !== form);
          Utils.showToast(`Synced form ${form.formId}`, 'success');
        } catch (err) {
          form.attempts++;
          Utils.logError(`Failed to sync form ${form.formId}: ${err.message || err}`, 'OfflineManager');
        }
      }
      await localforage.setItem('formQueue', queue);
    } catch (err) {
      Utils.logError(`Error syncing forms: ${err.message || err}`, 'OfflineManager');
    }
  }
};

// Enhanced DataManager with offline support and pagination
const DataManager = {
  currentPage: 1,
  pageSize: 20,
  charts: {
    dashboardPaymentMethodChart: null,
    dashboardTopCustomersChart: null,
    dashboardTopExpenseCategoriesChart: null,
    dashboardTotalSalesChart: null
  },

  async fetchData(url, options = {}) {
    if (Store.state.uiState.offline) {
      return this.handleOfflineData(url, options);
    }

    try {
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': this.getCSRFToken(),
          ...(Store.state.credentials.token && { 
            'Authorization': `Bearer ${Store.state.credentials.token}` 
          }),
          ...options.headers
        },
        body: options.body ? JSON.stringify(options.body) : undefined
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (url.includes('/api/getSalesRecords') && data.success) {
        await Store.setCachedData('sales', data.data);
      } else if (url.includes('/api/getCustomers') && data.success) {
        await Store.setCachedData('customers', data.data);
      } else if (url.includes('/api/getVendors') && data.success) {
        await Store.setCachedData('vendors', data.data);
      } else if (url.includes('/api/getExpensesRecords') && data.success) {
        await Store.setCachedData('expenses', data.data);
      } else if (url.includes('/api/generateReports') && data.success) {
        await OfflineManager.saveMetrics(data.data);
      }

      return data;
    } catch (error) {
      Utils.logError(`Failed to fetch data from ${url}: ${error.message || error}`, 'DataManager');
      throw error;
    }
  },

  getCSRFToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.content : '';
  },

  async handleOfflineData(url, options) {
    Utils.logInfo(`Attempting offline data fetch for ${url}`, 'DataManager');
    
    if (url.includes('/api/generateReports')) {
      const cachedMetrics = await OfflineManager.getCachedMetrics();
      if (cachedMetrics) {
        return { success: true, data: cachedMetrics };
      }
      return { success: false, message: 'No cached metrics available offline' };
    } else if (url.includes('/api/getSalesRecords')) {
      const cachedSales = Store.state.cachedData.sales;
      if (cachedSales) {
        return { success: true, data: cachedSales };
      }
    } else if (url.includes('/api/getCustomers')) {
      const cachedCustomers = Store.state.cachedData.customers;
      if (cachedCustomers) {
        return { success: true, data: cachedCustomers };
      }
    } else if (url.includes('/api/getVendors')) {
      const cachedVendors = Store.state.cachedData.vendors;
      if (cachedVendors) {
        return { success: true, data: cachedVendors };
      }
    } else if (url.includes('/api/getExpensesRecords')) {
      const cachedExpenses = Store.state.cachedData.expenses;
      if (cachedExpenses) {
        return { success: true, data: cachedExpenses };
      }
    }

    return { success: false, message: 'Cannot fetch this data while offline' };
  },

  async submitForm({ url, method, data, formId, successCallback }) {
    if (Store.state.uiState.offline) {
      await OfflineManager.queueForm({ url, method, data, formId });
      Utils.showToast('Request queued for sync when online', 'info');
      return { success: true, message: 'Request queued' };
    }

    try {
      const result = await this.fetchData(url, {
        method,
        body: data
      });
      if (result.success && successCallback) successCallback();
      return result;
    } catch (err) {
      Utils.showToast('Error submitting form', 'danger');
      Utils.logError(`Form submission error for ${formId}: ${err.message || err}`, 'DataManager');
      throw err;
    }
  },

  async initDashboard() {
    try {
      DOM.loadingIndicator.style.display = 'block';
      const startDate = document.getElementById('dashboardStartDate')?.value || DOM.today;
      const endDate = document.getElementById('dashboardEndDate')?.value || DOM.today;

      const result = await this.fetchData('/api/generateReports', {
        method: 'POST',
        body: { startDate, endDate }
      });

      if (result.success) {
        this.renderDashboard(result.data);
      } else {
        Utils.showToast(result.message, 'warning');
      }
    } catch (err) {
      Utils.showToast('Error loading dashboard data', 'danger');
      Utils.logError(`Dashboard error: ${err.message || err}`, 'DataManager');
    } finally {
      DOM.loadingIndicator.style.display = 'none';
    }
  },

  renderDashboard(data) {
    const defaultData = {
      totalSales: 0,
      outstandingPayments: 0,
      totalQuantitySold: 0,
      overduePayments: 0,
      cashSales: 0,
      transferSales: 0,
      creditSales: 0,
      totalExpenses: 0,
      totalExpensesPaid: 0,
      topCustomers: [],
      topExpenseCategories: [],
      metricsByDate: []
    };
    const dashboardData = { ...defaultData, ...data };

    document.getElementById('totalSales').textContent = Utils.formatCurrency(dashboardData.totalSales);
    document.getElementById('totalQuantitySold').textContent = dashboardData.totalQuantitySold.toLocaleString();
    document.getElementById('outstandingPayments').textContent = Utils.formatCurrency(dashboardData.outstandingPayments);
    document.getElementById('overduePayments').textContent = dashboardData.overduePayments.toLocaleString();
    document.getElementById('totalExpenses').textContent = Utils.formatCurrency(dashboardData.totalExpenses);
    document.getElementById('totalExpensesPaid').textContent = Utils.formatCurrency(dashboardData.totalExpensesPaid);

    const netIncome = dashboardData.totalSales - dashboardData.totalExpenses;
    const netIncomeElement = document.getElementById('netIncome');
    netIncomeElement.textContent = Utils.formatCurrency(netIncome);
    netIncomeElement.classList.toggle('negative', netIncome < 0);

    this.renderAccessibleChart('dashboardPaymentMethodChart', {
      type: 'doughnut',
      labels: ['Cash', 'Transfer', 'Credit'],
      data: [dashboardData.cashSales, dashboardData.transferSales, dashboardData.creditSales],
      title: 'Sales by Payment Method'
    });

    this.renderAccessibleChart('dashboardTopCustomersChart', {
      type: 'bar',
      labels: dashboardData.topCustomers.length ? dashboardData.topCustomers.map(c => c.name) : ['No Data'],
      data: dashboardData.topCustomers.length ? dashboardData.topCustomers.map(c => c.totalPurchases) : [0],
      title: 'Top Customers by Purchases'
    });

    this.renderAccessibleChart('dashboardTopExpenseCategoriesChart', {
      type: 'bar',
      labels: dashboardData.topExpenseCategories.length ? dashboardData.topExpenseCategories.map(c => c.name) : ['No Data'],
      data: dashboardData.topExpenseCategories.length ? dashboardData.topExpenseCategories.map(c => c.totalVendorExpenses) : [0],
      title: 'Top Expense Categories'
    });

    if (dashboardData.metricsByDate.length) {
      this.renderTotalSalesChart(dashboardData.metricsByDate);
    }
  },

  renderAccessibleChart(canvasId, { type, labels, data, title }) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !window.Chart) {
      Utils.logError(`Chart.js not available or canvas ${canvasId} not found`, 'DataManager');
      return;
    }

    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `${title} data visualization`);

    if (this.charts[canvasId]) {
      this.charts[canvasId].destroy();
    }

    const isMobile = window.innerWidth <= 768;
    const backgroundColors = ['#60A5FA', '#34D399', '#F472B6', '#4BC0C0', '#FF9F40', '#9966FF', '#FF6384', '#36A2EB', '#FFCE56'];

    this.charts[canvasId] = new Chart(canvas, {
      type,
      data: {
        labels,
        datasets: [{
          label: title.includes('Customers') ? 'Total Purchases (NGN)' : title.includes('Expense') ? 'Total Expenses (NGN)' : 'Amount (NGN)',
          data,
          backgroundColor: backgroundColors.slice(0, data.length)
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: isMobile ? 'bottom' : 'top' },
          title: { display: true, text: title }
        },
        scales: type === 'bar' ? { y: { beginAtZero: true } } : {},
        layout: { padding: { left: isMobile ? 5 : 10, right: isMobile ? 5 : 10, top: isMobile ? 5 : 10, bottom: isMobile ? 5 : 10 } }
      }
    });
  },

  renderTotalSalesChart(metricsByDate) {
    const canvas = document.getElementById('dashboardTotalSalesChart');
    if (!canvas || !window.Chart) {
      Utils.logError('Chart.js not available or canvas not found', 'DataManager');
      return;
    }

    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Sales and Expenses Trend visualization');

    if (this.charts.dashboardTotalSalesChart) {
      this.charts.dashboardTotalSalesChart.destroy();
    }

    const isMobile = window.innerWidth <= 768;
    const labels = metricsByDate.map(item => item.date);

    this.charts.dashboardTotalSalesChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Paid',
            data: metricsByDate.map(item => item.paid),
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            borderColor: 'rgba(75, 192, 192, 1)',
            borderWidth: isMobile ? 1.5 : 2,
            tension: 0.1
          },
          {
            label: 'Credit',
            data: metricsByDate.map(item => item.outstanding),
            backgroundColor: 'rgba(255, 159, 64, 0.2)',
            borderColor: 'rgba(255, 159, 64, 1)',
            borderWidth: isMobile ? 1.5 : 2,
            tension: 0.1
          },
          {
            label: 'Expenses',
            data: metricsByDate.map(item => item.expenses),
            backgroundColor: 'rgba(255, 99, 132, 0.2)',
            borderColor: 'rgba(255, 99, 132, 1)',
            borderWidth: isMobile ? 1.5 : 2,
            tension: 0.1
          },
          {
            label: 'Sales',
            data: metricsByDate.map(item => item.total),
            backgroundColor: 'rgba(54, 162, 235, 0.2)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: isMobile ? 2 : 3,
            tension: 0.1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: { display: true, text: 'Sales and Expenses Trend' },
          legend: { position: isMobile ? 'bottom' : 'top' }
        },
        scales: {
          y: { beginAtZero: true, ticks: { callback: value => Utils.formatCurrency(value) } },
          x: { ticks: { maxRotation: isMobile ? 90 : 45, minRotation: isMobile ? 90 : 45 } }
        }
      }
    });
  },

  async initSalesTable() {
    try {
      DOM.loadingIndicator.style.display = 'block';
      const result = await this.fetchData('/api/getSalesRecords');
      if (result.success) {
        this.renderTable('salesTable', result.data, [
          { key: 'ID', label: 'ID' },
          { key: 'Customer Name', label: 'Customer' },
          { key: 'Date', label: 'Date' },
          { key: 'Quantity', label: 'Quantity' },
          { key: 'Total Amount (NGN)', label: 'Total', format: Utils.formatCurrency },
          { key: 'Amount Paid (NGN)', label: 'Paid', format: Utils.formatCurrency },
          { key: 'Payment Method', label: 'Method' },
          { key: 'Payment Status', label: 'Status' },
          { key: 'Balance (NGN)', label: 'Balance', format: Utils.formatCurrency },
          { key: 'Due Date', label: 'Due Date' },
          { key: 'Notes', label: 'Notes' }
        ]);
      } else {
        Utils.showMessage('salesTableMessage', result.message, 'warning');
      }
    } catch (err) {
      Utils.showMessage('salesTableMessage', 'Error loading sales records', 'danger');
      Utils.logError(`Error fetching sales: ${err.message || err}`, 'DataManager');
    } finally {
      DOM.loadingIndicator.style.display = 'none';
    }
  },

  async initCustomersTable() {
    try {
      DOM.loadingIndicator.style.display = 'block';
      const result = await this.fetchData('/api/getCustomers');
      if (result.success) {
        this.renderTable('customersTable', result.data, [
          { key: 'ID', label: 'ID' },
          { key: 'Name', label: 'Name' },
          { key: 'Phone', label: 'Phone' },
          { key: 'Email', label: 'Email' },
          { key: 'Town', label: 'Town' },
          { key: 'Total Purchases (NGN)', label: 'Total Purchases', format: Utils.formatCurrency },
          { key: 'Outstanding Balance (NGN)', label: 'Balance', format: Utils.formatCurrency },
          { key: 'Customer Since', label: 'Since' },
          { key: 'Notes', label: 'Notes' },
          {
            key: 'actions',
            label: 'Actions',
            render: row => `
              <button class="btn btn-sm btn-primary edit-customer" data-id="${row['ID']}" aria-label="Edit customer ${row['Name']}">Edit</button>
              <button class="btn btn-sm btn-danger delete-customer" data-id="${row['ID']}" aria-label="Delete customer ${row['Name']}">Delete</button>
            `
          }
        ], {
          onRowRendered: (tbody) => {
            tbody.querySelectorAll('.edit-customer').forEach(btn => {
              btn.addEventListener('click', () => Utils.showToast('Edit customer not implemented', 'warning'));
            });
            tbody.querySelectorAll('.delete-customer').forEach(btn => {
              btn.addEventListener('click', async () => {
                if (confirm('Are you sure you want to delete this customer?') && Store.state.credentials.token) {
                  try {
                    DOM.loadingIndicator.style.display = 'block';
                    const result = await this.submitForm({
                      url: `/api/deleteCustomer/${btn.dataset.id}`,
                      method: 'POST',
                      data: { credentials: Store.state.credentials },
                      formId: 'deleteCustomer'
                    });
                    if (result.success) {
                      Utils.showToast(result.message);
                      await Promise.all([this.initCustomersTable(), this.populateCustomerDropdown()]);
                    } else {
                      Utils.showToast(result.message, 'Error');
                    }
                  } catch (err) {
                    Utils.showToast('Error deleting customer', 'danger');
                    Utils.logError(`Error deleting customer: ${err.message || err}`, 'error');
                  } finally {
                    DOM.loadingIndicator.style.display = 'none';
                  }
                } else {
                  Utils.showToast('Please log in to perform this action', 'warning');
                }
              });
            });
          }
        });
      } else {
        Utils.showMessage('customersTableMessage', result.message, 'warning');
      }
    } catch (err) {
      Utils.showMessage('customersTableMessage', 'Error loading customers', 'danger');
      Utils.logError(`Error fetching customers: ${err.message || err}`, 'DataManager');
    } finally {
      DOM.loadingIndicator.style.display = 'none';
    }
  },

  async initExpensesTable() {
    try {
      DOM.loadingIndicator.style.display = 'block';
      const result = await this.fetchData('/api/getExpensesRecords');
      if (result.success) {
        this.renderTable('expensesTable', result.data, [
          { key: 'ID', label: 'ID' },
          { key: 'Vendor', label: 'Vendor' },
          { key: 'Category', label: 'Category' },
          { key: 'Date', label: 'Date' },
          { key: 'Quantity', label: 'Quantity' },
          { key: 'Total Expenses (NGN)', label: 'Total', format: Utils.formatCurrency },
          { key: 'Amount Paid (NGN)', label: 'Paid', format: Utils.formatCurrency },
          { key: 'Notes', label: 'Notes' },
          { key: 'Status', label: 'Status' }
        ]);
      } else {
        Utils.showMessage('expensesTableMessage', result.message, 'warning');
      }
    } catch (err) {
      Utils.showMessage('expensesTableMessage', 'Error loading expenses', 'danger');
      Utils.logError(`Error fetching expenses: ${err.message || err}`, 'Data');
    } finally {
      DOM.loadingIndicator.style.display = 'none';
    }
  },

  async initVendorsTable() {
    try {
      DOM.loadingIndicator.style.display = 'block';
      const result = await this.fetchData('/api/getVendors');
      if (result.success) {
        this.renderTable('vendorsTable', result.data, [
          { key: 'ID', label: 'ID' },
          { key: 'Name', label: 'Name' },
          { key: 'Phone', label: 'Phone' },
          { key: 'Service Category', label: 'Service' },
          { key: 'Town', label: 'Town' },
          { key: 'Total Expenses (NGN)', label: 'Total Expenses', format: Utils.formatCurrency },
          { key: 'Outstanding Balance (NGN)', label: 'Balance', format: Utils.formatCurrency },
          { key: 'Vendor Since', label: 'Since' },
          { key: 'Notes', label: 'Notes' },
          {
            key: 'actions',
            label: 'Actions',
            render: row => `
              <button class="btn btn-sm btn-primary edit-vendor" data-id="${row['ID']}" aria-label="Edit vendor ${row['Name']}">Edit</button>
              <button class="btn btn-sm btn-danger delete-vendor" data-id="${row['ID']}" aria-label="Delete vendor ${row['Name']}">Delete</button>
            `
          }
        ], {
          onRowRendered: (tbody) => {
            tbody.querySelectorAll('tbody').forEach(btn => {
              btn.addEventListener('click', () => Utils.showToast('Edit vendor not implemented', 'warning'));
            });
            tbody.querySelectorAll('.delete-vendor').forEach(btn => {
              btn.addEventListener('click', async () => {
                if (confirm('Are you sure you want to delete this vendor?') && Store.state.credentials.token) {
                  try {
                    DOM.loadingIndicator.style.display = 'block';
                    const result = await this.submitForm({
                      url: `/api/deleteVendor/${btn.dataset.id}`,
                      method: 'POST',
                      data: { credentials: Store.state.credentials },
                      formId: 'deleteVendor'
                    });
                    if (result.success) {
                      Utils.showToast(result.message);
                      await Promise.all([this.initVendorsTable(), this.populateVendorDropdown()]);
                    } else {
                      Utils.showToast(result.message, 'Error');
                    }
                  } catch (err) {
                    Utils.showToast('Error deleting vendor', 'danger');
                    Utils.logError(`Error deleting vendor: ${err.message || err}`, 'error');
                  } finally {
                    DOM.loadingIndicator.style.display = 'none';
                  }
                } else {
                  Utils.showToast('Please log in to perform this action', 'warning');
                }
              });
            });
          }
        });
      } else {
        Utils.showMessage('vendorsTableMessage', result.message, 'warning');
      }
    } catch (err) {
      Utils.showMessage('vendorsTableMessage', 'Error loading vendors', 'danger');
      Utils.logError(`Error fetching vendors: ${err.message || err}`, 'DataManager');
    } finally {
      DOM.loadingIndicator.style.display = 'none';
    }
  },

  async populateCustomerDropdown() {
    try {
      DOM.loadingIndicator.style.display = 'block';
      const result = await this.fetchData('/api/getCustomers');
      if (result.success) {
        const saleSelect = document.getElementById('saleCustomer');
        const historySelect = document.getElementById('historyCustomer');
        if (saleSelect && historySelect) {
          saleSelect.innerHTML = '<option value="">Select Customer</option>';
          historySelect.innerHTML = '<option value="">Select Customer</option>';
          result.data.forEach(customer => {
            const option = document.createElement('option');
            option.value = customer.ID;
            option.textContent = `${customer.Name} (${customer.Phone})`;
            saleSelect.appendChild(option.cloneNode(true));
            historySelect.appendChild(option);
          });
        }
      } else {
        Utils.showMessage('customersTableMessage', result.message, 'warning');
      }
    } catch (err) {
      Utils.showMessage('customersTableMessage', 'Error loading customers', 'danger');
      Utils.logError(`Error fetching customers: ${err.message || err}`, 'error');
    } finally {
      DOM.loadingIndicator.style.display = 'none';
    }
  },

  async populateVendorDropdown() {
    try {
      DOM.loadingIndicator.style.display = 'block';
      const result = await this.fetchData('/api/getVendors');
      if (result.success) {
        const expenseSelect = document.getElementById('expenseVendor');
        const historySelect = document.getElementById('historyVendor');
        if (expenseSelect && historySelect) {
          expenseSelect.innerHTML = '<option value="">Select Vendor</option>';
          historySelect.innerHTML = '<option value="">Select Vendor</option>';
          result.data.forEach(vendor => {
            const option = document.createElement('option');
            option.value = vendor.ID;
            option.textContent = `${vendor.Name} (${vendor.Phone})`;
            expenseSelect.appendChild(option.cloneNode(true));
            historySelect.appendChild(option);
          });
        }
      } else {
        Utils.showMessage('vendorsTableMessage', result.message, 'warning');
      }
    } catch (err) {
      Utils.showMessage('vendorsTableMessage', 'Error loading vendors', 'danger');
      Utils.logError(`Error fetching vendors: ${err.message || ''}`, 'error');
    } finally {
      DOM.loadingIndicator.style.display = 'none';
    }
  },

  renderTable(tableId, data, columns, options = {}) {
    const table = document.getElementById(tableId}`);
    if (!table) {
      Utils.logError(`Table ${tableId} not found`, 'table');
      return;
    }
    
    const tbody = table.querySelector('tbody');
    tbody.innerHTML = '';

    if (!data || data.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = columns.length;
      td.textContent = 'No data available';
      td.className = 'text-center';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    data.forEach(row => {
      const tr = document.createElement('tr');
      columns.forEach(col => {
        const td = document.createElement('td');
        if (col.render) {
          td.innerHTML = col.render(row);
        } else {
          const value = row[col.key] || '';
          td.textContent = col.format ? col.format(value) : value;
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });

    if (options.onRowRendered) {
      options.onRowRendered(tbody);
    }
  },

  async loadPaginatedTable(tableId, apiEndpoint) {
    try {
      const response = await this.fetchData(`${apiEndpoint}?page=${this.currentPage}&pageSize=${this.pageSize}`);
      if (response.success) {
        this.renderTable(tableId, response.data);
        this.setupPaginationControls(response.totalCount);
      }
    } catch (err) {
      Utils.logError(`Failed to load ${tableId}: ${err.message || err}`, 'DataManager');
    }
  },

  setupPaginationControls(totalItems) {
    const totalPages = Math.ceil(totalItems / this.pageSize);
    const paginationDiv = document.getElementById('pagination-controls');
    
    if (!paginationDiv) return;

    paginationDiv.innerHTML = `
      <nav aria-label="Table pagination">
        <ul class="pagination">
          <li class="page-item ${this.currentPage === 1 ? 'disabled' : ''}">
            <button class="page-link" aria-label="Previous page" id="prev-page">
              <span aria-hidden="true">&laquo;</span>
            </button>
          </li>
          ${Array.from({ length: totalPages }, (_, i) => `
            <li class="page-item ${i + 1 === this.currentPage ? 'active' : ''}">
              <button class="page-link">${i + 1}</button>
            </li>
          `).join('')}
          <li class="page-item ${this.currentPage === totalPages ? 'disabled' : ''}">
            <button class="page-link" aria-label="Next page" id="next-page">
              <span aria-hidden="true">&raquo;</span>
            </button>
          </li>
        </ul>
      </nav>
    `;

    document.getElementById('prev-page')?.addEventListener('click', () => {
      if (this.currentPage > 1) {
        this.currentPage--;
        this.loadPaginatedTable();
      }
    });

    document.getElementById('next-page')?.addEventListener('click', () => {
      if (this.currentPage < totalPages) {
        this.currentPage++;
        this.loadPaginatedTable();
      }
    });

    document.querySelectorAll('.page-link').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const pageNumber = parseInt(e.target.textContent);
        if (!isNaN(pageNumber)) {
          this.currentPage = pageNumber;
          this.loadPaginatedTable();
        }
      });
    });
  }
};

// Enhanced Form Handler with validation and security
const FormHandler = {
  init() {
    this.initSaleForm();
    this.initExpenseForm();
    this.initCustomerForm();
    this.initVendorForm();
    this.initLoginForm();
    this.initUpdatePaymentForm();
    this.initArchiveForm();
    this.initDeleteForm();
    this.initCustomerSalesForm();
    this.initVendorExpensesForm();
    this.initReportForm();
    this.initDashboardDateForm();
    this.setupGlobalEventListeners();
  },

  initSaleForm() {
    const form = document.getElementById('saleForm');
    if (!form) return;

    const dateField = form.querySelector('#saleDate');
    if (dateField) dateField.value = DOM.today;

    this.setupFieldValidation('#saleCustomer', { required: true });
    this.setupFieldValidation('#saleDate', { required: true, date: true, future: false });
    this.setupFieldValidation('#saleQuantity', { required: true, numeric: true, min: 1 });
    this.setupFieldValidation('#saleTotalAmount', { required: true, numeric: true, min: 0.01 });
    this.setupFieldValidation('#saleAmountPaid', { required: true, numeric: true, min: 0 });
    this.setupFieldValidation('#salePaymentMethod', { required: true });

    const paymentMethod = form.querySelector('#salePaymentMethod');
    if (paymentMethod) {
      paymentMethod.addEventListener('change', (e) => {
        const creditDaysGroup = form.querySelector('#creditDaysGroup');
        if (creditDaysGroup) {
          creditDaysGroup.style.display = e.target.value === 'credit' ? 'block' : 'none';
          if (e.target.value === 'credit') {
            this.setupFieldValidation('#saleCreditDays', { required: true, numeric: true, min: 1 });
          }
        }
      });
    }

    form.addEventListener('submit', this.handleSaleSubmit.bind(this));
  },

  initExpenseForm() {
    const form = document.getElementById('expenseForm');
    if (!form) return;

    const dateField = form.querySelector('#expenseDate');
    if (dateField) dateField.value = DOM.today;

    this.setupFieldValidation('#expenseVendor', { required: true });
    this.setupFieldValidation('#expenseCategory', { required: 'true' });
    this.setupFieldValidation('#expenseStaff', { required: 'true' });
    this.setupFieldValidation('#expenseDate', { required: true, date: true, future: false });
    this.setupFieldValidation('#expenseQuantity', { required: true, numeric: true, min: 1 });
    this.setupFieldValidation('#expenseAmount', { required: true, numeric: true, min: 0.01 });
    this.setupFieldValidation('#expenseAmountPaid', { required: true, numeric: true, min: 0 });

    form.addEventListener('submit', this.handleExpenseSubmit.bind(this));
  },

  initCustomerForm() {
    const form = document.getElementById('customerForm');
    if (!form) return;

    this.setupFieldValidation('#customerName', { required: true });
    this.setupFieldValidation('#customerPhone', { required: true });
    this.setupFieldValidation('#customerEmail', { email: true });

    form.addEventListener('submit', this.handleCustomerSubmit.bind(this));
  },

  initVendorForm() {
    const form = document.getElementById('vendorForm');
    if (!form) return;

    this.setupFieldValidation('#vendorName', { required: true });
    this.setupFieldValidation('#vendorPhone', { required: true });
    this.setupFieldValidation('#vendorEmail', { email: true });

    form.addEventListener('submit', this.handleVendorSubmit.bind(this));
  },

  initLoginForm() {
    const form = document.getElementById('loginForm');
    if (!form) return;

    this.setupFieldValidation('#email', { required: true, email: true });
    this.setupFieldValidation('#password', { required: true });

    form.addEventListener('submit', this.handleLoginSubmit.bind(this));
  },

  initUpdatePaymentForm() {
    const form = document.getElementById('updatePaymentForm');
    if (!form) return;

    this.setupFieldValidation('#updateSaleId', { required: true });
    this.setupFieldValidation('#updateAmount', { required: true, numeric: true, min: 0.01 });

    form.addEventListener('submit', this.handleUpdatePaymentSubmit.bind(this));
  },

  initArchiveForm() {
    const form = document.getElementById('archiveForm');
    if (!form) return;

    this.setupFieldValidation('#archiveSaleId', { required: true });

    form.addEventListener('submit', this.handleArchiveSubmit.bind(this));
  },

  initDeleteForm() {
    const form = document.getElementById('deleteForm');
    if (!form) return;

    this.setupFieldValidation('#deleteSaleId', { required: true });

    form.addEventListener('submit', this.handleDeleteSubmit.bind(this));
  },

  initCustomerSalesForm() {
    const form = document.getElementById('customerSalesForm');
    if (!form) return;

    this.setupFieldValidation('#historyCustomer', { required: true });
    this.setupFieldValidation('#historyStartDate', { date: true });
    this.setupFieldValidation('#historyEndDate', { date: true });

    form.addEventListener('submit', this.handleCustomerSalesSubmit.bind(this));
  },

  initVendorExpensesForm() {
    const form = document.getElementById('vendorExpensesForm');
    if (!form) return;

    this.setupFieldValidation('#historyVendor', { required: true });
    this.setupFieldValidation('#historyVendorStartDate', { date: true });
    this.setupFieldValidation('#historyVendorEndDate', { date: true });

    form.addEventListener('submit', this.handleVendorExpensesSubmit.bind(this));
  },

  initReportForm() {
    const form = document.getElementById('reportForm');
    if (!form) return;

    this.setupFieldValidation('#startDate', { required: true, date: true });
    this.setupFieldValidation('#endDate', { required: true, date: true });

    form.addEventListener('submit', this.handleReportSubmit.bind(this));

    const exportCSV = document.getElementById('exportCSV');
    if (exportCSV) {
      exportCSV.addEventListener('click', this.handleExportCSV.bind(this));
    }
  },

  initDashboardDateForm() {
    const form = document.getElementById('dashboardDateForm');
    if (!form) return;

    this.setupFieldValidation('#dashboardStartDate', { required: true, date: true });
    this.setupFieldValidation('#dashboardEndDate', { required: true, date: true });

    form.addEventListener('submit', this.handleDashboardDateSubmit.bind(this));
  },

  setupFieldValidation(selector, rules) {
    const field = document.querySelector(selector);
    if (!field) return;

    if (!document.getElementById(`${field.id}-error`)) {
      const errorEl = document.createElement('div');
      errorEl.id = `${field.id}-error`;;
      errorEl.className = 'invalid-feedback';
      errorEl.setAttribute('aria-live', 'polite');
      field.parentNode.appendChild(errorEl);
    }

    field.dataset.validate = JSON.stringify(rules);
    field.addEventListener('blur', () => {
      Utils.validateField(field, rules);
    });
    field.addEventListener('input', () => {
      const errorEl = document.getElementById(`${field.id}-error`);
      if (errorEl) errorEl.textContent = '';
    });
  },

  async handleSaleSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    let isValid = true;
    form.querySelectorAll('[data-validate]').forEach(field => {
      if (!Utils.validateField(field, JSON.parse(field.dataset.validate))) {
        isValid = false;
      }
    });

    if (!isValid) {
      Utils.showToast('Please fix form errors', 'warning');
      submitButton.disabled = false;
      return;
    }

    const formData = new FormData(form);
    const saleData = {
      customerId: formData.get('saleCustomer'),
      date: formData.get('saleDate'),
      quantity: parseInt(formData.get('saleQuantity')),
      totalAmount: parseFloat(formData.get('saleTotalAmount')),
      amountPaid: parseFloat(formData.get('saleAmountPaid')),
      paymentMethod: formData.get('salePaymentMethod'),
      creditDays: formData.get('salePaymentMethod') === 'credit' ? parseInt(formData.get('saleCreditDays')) : null,
      notes: Utils.sanitizeInput(formData.get('saleNotes'))
    };

    if (saleData.amountPaid > saleData.totalAmount) {
      Utils.showToast('Amount paid cannot exceed total amount', 'warning');
      submitButton.disabled = false;
      return;
    }

    try {
      DOM.loadingIndicator.style.display = 'block';
      const result = await DataManager.submitForm({
        url: '/api/addSale',
        method: 'POST',
        data: saleData,
        formId: 'saleForm',
        successCallback: () => {
          form.reset();
          form.querySelector('#saleDate').value = DOM.today;
        }
      });

      if (result.success) {
        Utils.showToast('Sale added successfully');
        await Promise.all([
          DataManager.initSalesTable(),
          DataManager.initDashboard(),
          DataManager.populateCustomerDropdown()
        ]);
      } else {
        Utils.showToast(result.message, 'error');
      }
    } catch (err) {
      // Handled by submitForm
    } finally {
      DOM.loadingIndicator.style.display = 'none';
      submitButton.disabled = false;
    }
  },

  async handleExpenseSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    let isValid = true;
    form.querySelectorAll('[data-validate]').forEach(field => {
      if (!Utils.validateField(field, JSON.parse(field.dataset.validate))) {
        isValid = false;
      }
    });

    if (!isValid) {
      Utils.showToast('Please fix form errors', 'warning');
      submitButton.disabled = false;
      return;
    }

    const formData = new FormData(form);
    const expenseData = {
      vendorId: formData.get('expenseVendor'),
      category: formData.get('expenseCategory'),
      staff: formData.get('expenseStaff'),
      date: formData.get('expenseDate'),
      quantity: parseInt(formData.get('expenseQuantity')),
      totalAmount: parseFloat(formData.get('expenseAmount')),
      amountPaid: parseFloat(formData.get('expenseAmountPaid')),
      notes: Utils.sanitizeInput(formData.get('expenseNotes'))
    };

    if (expenseData.amountPaid > expenseData.totalAmount) {
      Utils.showToast('Amount paid cannot exceed total amount', 'warning');
      submitButton.disabled = false;
      return;
    }

    try {
      DOM.loadingIndicator.style.display = 'block';
      const result = await DataManager.submitForm({
        url: '/api/addExpense',
        method: 'POST',
        data: expenseData,
        formId: 'expenseForm',
        successCallback: () => {
          form.reset();
          form.querySelector('#expenseDate').value = DOM.today;
        }
      });

      if (result.success) {
        Utils.showToast('Expense added successfully');
        await Promise.all([
          DataManager.initExpensesTable(),
          DataManager.initDashboard(),
          DataManager.populateVendorDropdown()
        ]);
      } else {
        Utils.showToast(result.message, 'error');
      }
    } catch (err) {
      // Handled by submitForm
    } finally {
      DOM.loadingIndicator.style.display = 'none';
      submitButton.disabled = false;
    }
  },

  async handleCustomerSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    let isValid = true;
    form.querySelectorAll('[data-validate]').forEach(field => {
      if (!Utils.validateField(field, JSON.parse(field.dataset.validate))) {
        isValid = false;
      }
    });

    if (!isValid) {
      Utils.showToast('Please fix form errors', 'warning');
      submitButton.disabled = false;
      return;
    }

    const formData = new FormData(form);
    const customerData = {
      name: Utils.sanitizeInput(formData.get('customerName')),
      phone: formData.get('customerPhone'),
      email: formData.get('customerEmail'),
      town: Utils.sanitizeInput(formData.get('town')),
      notes: Utils.sanitizeInput(formData.get('customerNotes'))
    };

    try {
      DOM.loadingIndicator.style.display = 'block';
      const result = await DataManager.submitForm({
        url: '/api/addCustomer',
        method: 'POST',
        data: customerData,
        formId: 'customerForm',
        successCallback: () => form.reset()
      });

      if (result.success) {
        Utils.showToast('Customer added successfully');
        await Promise.all([
          DataManager.initCustomersTable(),
          DataManager.populateCustomerDropdown()
        ]);
      } else {
        Utils.showToast(result.message, 'error');
      }
    } catch (err) {
      // Handled by submitForm
    } finally {
      DOM.loadingIndicator.style.display = 'none';
      submitButton.disabled = false;
    }
  },

  async handleVendorSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    let isValid = true;
    form.querySelectorAll('[data-validate]').forEach(field => {
      if (!Utils.validateField(field, JSON.parse(field.dataset.validate))) {
        isValid = false;
      }
    });

    if (!isValid) {
      Utils.showToast('Please fix form errors', 'warning');
      submitButton.disabled = false;
      return;
    }

    const formData = new FormData(form);
    const vendorData = {
      name: Utils.sanitizeInput(formData.get('vendorName')),
      phone: formData.get('vendorPhone'),
      email: formData.get('vendorEmail'),
      town: Utils.sanitizeInput(formData.get('town')),
      serviceCategory: Utils.sanitizeInput(formData.get('vendorServiceCategory')),
      notes: Utils.sanitizeInput(formData.get('vendorNotes'))
    };

    try {
      DOM.loadingIndicator.style.display = 'block';
      const result = await DataManager.submitForm({
        url: '/api/addVendor',
        method: 'POST',
        data: vendorData,
        formId: 'vendorForm',
        successCallback: () => form.reset()
      });

      if (result.success) {
        Utils.showToast('Vendor added successfully');
        await Promise.all([
          DataManager.initVendorsTable(),
          DataManager.populateVendorDropdown()
        ]);
      } else {
        Utils.showToast(result.message, 'error');
      }
    } catch (err) {
      // Handled by submitForm
    } finally {
      DOM.loadingIndicator.style.display = 'none';
      submitButton.disabled = false;
    }
  },

  async handleLoginSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    let isValid = true;
    form.querySelectorAll('[data-validate]').forEach(field => {
      if (!Utils.validateField(field, JSON.parse(field.dataset.validate))) {
        isValid = false;
      }
    });

    if (!isValid) {
      Utils.showToast('Please fix form errors', 'warning');
      submitButton.disabled = false;
      return;
    }

    const formData = new FormData(form);
    const loginData = {
      email: formData.get('email'),
      password: formData.get('password')
    };

    try {
      DOM.loadingIndicator.style.display = 'block';
      const result = await DataManager.submitForm({
        url: '/api/adminLogin',
        method: 'POST',
        data: loginData,
        formId: 'loginForm',
        successCallback: () => form.reset()
      });

      if (result.success) {
        Store.setCredentials({ email: loginData.email, token: result.token });
        Utils.showToast('Login successful');
        document.getElementById('adminActions').style.display = 'block';
      } else {
        Utils.showToast(result.message, 'error');
      }
    } catch (err) {
      // Handled by submitForm
    } finally {
      DOM.loadingIndicator.style.display = 'none';
      submitButton.disabled = false;
    }
  },

  async handleUpdatePaymentSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    let isValid = true;
    form.querySelectorAll('[data-validate]').forEach(field => {
      if (!Utils.validateField(field, JSON.parse(field.dataset.validate))) {
        isValid = false;
      }
    });

    if (!isValid || !Store.state.credentials.token) {
      Utils.showToast(isValid ? 'Please log in to update payment' : 'Please fix form errors', 'warning');
      submitButton.disabled = false;
      return;
    }

    const formData = new FormData(form);
    const paymentData = {
      amount: parseFloat(formData.get('updateAmount')),
      credentials: Store.state.credentials
    };

    try {
      DOM.loadingIndicator.style.display = 'block';
      const result = await DataManager.submitForm({
        url: `/api/updatePayment/${formData.get('updateSaleId')}`,
        method: 'POST',
        data: paymentData,
        formId: 'updatePaymentForm',
        successCallback: () => {
          form.reset();
          document.getElementById('updateCustomerName').textContent = '';
        }
      });

      if (result.success) {
        Utils.showToast('Payment updated successfully');
        await Promise.all([
          DataManager.initSalesTable(),
          DataManager.initDashboard()
        ]);
      } else {
        Utils.showToast(result.message, 'error');
      }
    } catch (err) {
      // Handled by submitForm
    } finally {
      DOM.loadingIndicator.style.display = 'none';
      submitButton.disabled = false;
    }
  },

  async handleArchiveSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    let isValid = true;
    form.querySelectorAll('[data-validate]').forEach(field => {
      if (!Utils.validateField(field, JSON.parse(field.dataset.validate))) {
        isValid = false;
      }
    });

    if (!isValid || !Store.state.credentials.token) {
      Utils.showToast(isValid ? 'Please log in to archive record' : 'Please fix form errors', 'warning');
      submitButton.disabled = false;
      return;
    }

    const formData = new FormData(form);
    const archiveData = {
      credentials: Store.state.credentials
    };

    try {
      DOM.loadingIndicator.style.display = 'block';
      const result = await DataManager.submitForm({
        url: `/api/archiveRecord/${formData.get('archiveSaleId')}`,
        method: 'POST',
        data: archiveData,
        formId: 'archiveForm',
        successCallback: () => {
          form.reset();
          document.getElementById('archiveCustomerName').textContent = '';
        }
      });

      if (result.success) {
        Utils.showToast('Record archived successfully');
        await Promise.all([
          DataManager.initSalesTable(),
          DataManager.initDashboard()
        ]);
      } else {
        Utils.showToast(result.message, 'error');
      }
    } catch (err) {
      // Handled by submitForm
    } finally {
      DOM.loadingIndicator.style.display = 'none';
      submitButton.disabled = false;
    }
  },

  async handleDeleteSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    let isValid = true;
    form.querySelectorAll('[data-validate]'').forEach(field => {
      if (!Utils.validateField(field, JSON.parse(field.dataset.validate))) {
        isValid = false;
      }
    });

    if (!isValid || !Store.state.credentials.token) {
      Utils.showToast(isValid ? 'Please log in to delete record' : 'Please fix form errors', 'warning');
      submitButton.disabled = false;
      return;
    }

    const formData = new FormData(form);
    const deleteData = {
      credentials: Store.state.credentials
    };

    try {
      DOM.loadingIndicator.style.display = 'block';
      const result = await DataManager.submitForm({
        url: `/api/deleteRecord/${formData.get('deleteSaleId')}`,
        method: 'DELETE',
        data: deleteData,
        formId: 'deleteForm',
        successCallback: () => {
          form.reset();
          document.getElementById('deleteCustomerName').textContent = '';
        }
      });

      if (result.success) {
        Utils.showToast('Record deleted successfully');
        await Promise.all([
          DataManager.initSalesTable(),
          DataManager.initDashboard()
        ]);
      } else {
        Utils.showToast(result.message, 'error');
      }
    } catch (err) {
      // Handled by submitForm
    } finally {
      DOM.loadingIndicator.style.display = 'none';
      submitButton.disabled = false;
    }
  },

  async handleCustomerSalesSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    let isValid = true;
    form.querySelectorAll('[data-validate]').forEach(field => {
      if (!Utils.validateField(field, JSON.parse(field.dataset.validate))) {
        isValid = false;
      }
    });

    if (!isValid) {
      Utils.showToast('Please fix form errors', 'warning');
      submitButton.disabled = false;
      return;
    }

    const formData = new FormData(form);
    const salesData = {
      startDate: formData.get('historyStartDate'),
      endDate: formData.get('historyEndDate')
    };

    try {
      DOM.loadingIndicator.style.display = 'block';
      const result = await DataManager.submitForm({
        url: `/api/getCustomerSales/${formData.get('historyCustomer')}`,
        method: 'POST',
        data: salesData,
        formId: 'customerSalesForm'
      });

      if (result.success) {
        DataManager.renderTable('customerSalesTable', result.data, [
          { key: 'ID', label: 'ID' },
          { key: 'Customer Name', label: 'Customer' },
          { key: 'Date', label: 'Date' },
          { key: 'Quantity', label: 'Quantity' },
          { key: 'Total Amount (NGN)', label: 'Total', format: Utils.formatCurrency },
          { key: 'Amount Paid (NGN)', label: 'Paid', format: Utils.formatCurrency },
          { key: 'Payment Method', label: 'Method' },
          { key: 'Payment Status', label: 'Status' },
          { key: 'Balance (NGN)', label: 'Balance', format: Utils.formatCurrency },
          { key: 'Due Date', label: 'Due Date' },
          { key: 'Notes', label: 'Notes' }
        ]);
        Utils.showMessage('customerSalesTableMessage', 'Customer sales loaded successfully');
      } else {
        Utils.showMessage('customerSalesTableMessage', result.message, 'warning');
      }
    } catch (err) {
      Utils.showMessage('customerSalesTable', 'Error loading customer sales', 'error');
      Utils.logError(`Failed to load customer sales: ${err.message || err}`, 'error');
    } finally {
      DOM.loadingIndicator.style.display = 'none';
      submitButton.disabled = false;
    }
  },

  async handleVendorExpensesSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    let isValid = true;
    form.querySelectorAll('[data-validate]').forEach(field => {
      if (!Utils.validateField(field, JSON.parse(field.dataset.validate))) {
        isValid = false;
      }
    });

    if (!isValid) {
      Utils.showToast('Please fix form errors', 'warning');
      submitButton.disabled = false;
      return;
    }

    const formData = new FormData(form);
    const vendorData = {
      startDate: formData.get('historyVendorStartDate'),
      endDate: formData.get('historyVendorEndDate')
    };

    if (vendorData.startDate && vendorData.endDate && new Date(vendorData.startDate) > new Date(vendorData.endDate)) {
      Utils.showToast('Start date cannot be after end date', 'warning');
      submitButton.disabled = false;
      return;
    }

    try {
      DOM.loadingIndicator.style.display = 'block';
      const result = await DataManager.submitForm({
        url: `/api/getVendorExpenses/${formData.get('historyVendor')}`,
        method: 'POST',
        data: vendorData,
        formId: 'vendorExpensesForm'
      });

      if (result.success) {
        DataManager.renderTable('vendorExpensesTable', result.data, [
          { key: 'ID', label: 'ID' },
          { key: 'Vendor Name', label: 'Vendor' },
          { key: 'Category', label: 'Category' },
          { key: 'Date', label: 'Date' },
          { key: 'Quantity', label: 'Quantity' },
          { key: 'Total Expenses (NGN)', label: 'Total', format: Utils.formatCurrency },
          { key: 'Amount Paid (NGN)', label: 'Paid', format: Utils.formatCurrency },
          { key: 'Notes', 'Notes': 'Notes' },
          { key: 'Status', label: 'Status' }
        ]);
        Utils.showMessage('vendorExpensesTableMessage', 'Vendor expenses loaded successfully');
      } else {
        Utils.showMessage('vendorExpensesTableMessage', result.message, 'warning');
      }
    } catch (err) {
      Utils.showMessage('vendorExpensesTableMessage', 'Error loading vendor expenses', 'danger');
      Utils.logError(`Failed to load vendor expenses: ${err.message || err}`, 'error');
    } finally {
      DOM.loadingIndicator.style.display = 'none';
      submitButton.disabled = false;
    }
  },

  async handleReportSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    let isValid = true;
    form.querySelectorAll('[data-validate]').forEach(field => {
      if (!Utils.validateField(field, JSON.parse(field.dataset.validate))) {
        isValid = false;
      }
    });

    if (!isValid) {
      Utils.showToast('Please fix form errors', 'warning');
      submitButton.disabled = false;
      return;
    }

    const formData = new FormData(form);
    const reportData = {
      startDate: formData.get('startDate'),
      endDate: formData.get('endDate')
    };

    if (reportData.startDate && reportData.endDate && new Date(reportData.startDate) > new Date(reportData.endDate)) {
      Utils.showToast('Start date cannot be after end date', 'warning');
      submitButton.disabled = false;
      return;
    }

    try {
      DOM.loadingIndicator.style.display = 'block';
      const result = await DataManager.fetchData('/api/generateReports', {
        method: 'POST',
        data: reportData,
      });

      if (result.success) {
        DataManager.renderTable('reportTable', result.data.records, [
          { key: 'Date', label: 'Date' },
          { key: 'Total Sales (NGN)', label: 'Sales', format: Utils.formatCurrency },
          { key: 'Total Expenses (NGN)', label: 'Expenses', format: Utils.formatCurrency },
          { key: 'Net Profit', label: 'Profit', format: Utils.formatCurrency }
        ]);
        document.getElementById('totalProfit').textContent = Utils.formatCurrency(result.data.totalProfit);
        Utils.showMessage('reportTableMessage', 'Report generated successfully');
      } else {
        Utils.showMessage('reportTableMessage', result.message, 'warning');
      }
    } catch (err) {
      Utils.showMessage('reportTable', 'Error generating report', 'error');
      Utils.logError(`Failed to generate report: ${err.message || err}`, 'error');
    } finally {
      DOM.loadingIndicator.style.display = 'none';
      submitButton.disabled = false;
    }
  },

  async handleExportCSV(e) {
    e.preventDefault();
    const form = document.getElementById('reportForm');
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    try {
      DOM.loadingIndicator.style.display = 'block';
      const formData = new FormData(form);
      const reportData = {
        startDate: formData.get('startDate'),
        endDate: formData.get('endDate')
      };

      const result = await DataManager.submitForm({
        url: '/api/exportReportsAsCSV',
        method: 'POST',
        data: reportData,
        formId: 'reportForm'
      });

      if (result.success) {
        const blob = new Blob([result.data.csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `report_${reportData.startDate}_${reportData.endDate}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        Utils.showToast('Report exported as CSV');
      } else {
        Utils.showToast(result.message, 'error');
      }
    } catch (err) {
      Utils.showToast('Error exporting CSV', 'error');
      Utils.logError(`Failed to export report: ${err.message || err}`, 'error');
    } finally {
      DOM.loadingIndicator.style.display = 'none';
      submitButton.disabled = false;
    }
  },

  async handleDashboardDateSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    let isValid = true;
    form.querySelectorAll('[data-validate]').forEach(field => {
      if (!Utils.validateField(field, JSON.parse(field.dataset.validate))) {
        isValid = false;
      }
    });

    if (!isValid) {
      Utils.showToast('Please fix form errors', 'warning');
      submitButton.disabled = false;
      return;
    }

    const formData = new FormData(form);
    const dashboardData = {
      startDate: formData.get('dashboardStartDate'),
      endDate: formData.get('dashboardEndDate')
    };

    if (dashboardData.startDate && dashboardData.endDate && new Date(dashboardData.startDate) > new Date(dashboardData.endDate)) {
      Utils.showToast('Start date cannot be after end date', 'warning');
      submitButton.disabled = false;
      return;
    }

    try {
      DOM.loadingIndicator.style.display = 'block';
      const result = await DataManager.fetchData('/api/generateReports', {
        method: 'POST',
        data: dashboardData
      });

      if (result.success) {
        DataManager.renderDashboard(result.data);
        Utils.showToast('Dashboard updated successfully');
      } else {
        Utils.showToast(result.message, 'warning');
      }
    } catch (err) {
      Utils.showToast('Error updating dashboard', 'error');
      Utils.logError(`Failed to update dashboard: ${err.message || err}`, 'error');
    } finally {
      DOM.loadingIndicator.style.display = 'none';
      submitButton.disabled = false;
    }
  },

  setupGlobalEventListeners() {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
      modal.addEventListener('shown.bs.modal', () => {
        const firstInput = modal.querySelector('input');
        if (firstInput) firstInput.focus();
      });
    });
  }
};

// Service Worker with enhanced offline support
const ServiceWorkerManager = {
  async init() {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        Utils.logInfo('ServiceWorker registered', 'ServiceWorkerManager');

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              Utils.showToast('New version available. Refresh to update.', 'info');
            }
          });
        });

        navigator.serviceWorker.addEventListener('message', event => {
          if (event.data && event.data.type === 'offline-status-changed') {
            Store.setOfflineStatus(event.data.status);
            Utils.showToast(
              event.data.status ? 'You are now offline' : 'Back online',
              event.data.status ? 'warning' : 'success'
            );
            if (!event.data.status) {
              this.syncPendingForms();
            }
          }
        });
      } catch (err) {
        Utils.logError(`ServiceWorker registration failed: ${err.message || err}`, 'ServiceWorkerManager');
      }
    }
  },

  async checkPendingForms() {
    if (!Store.state.uiState.offline) {
      await this.syncPendingForms();
    }
  },

  async syncPendingForms() {
    await OfflineManager.syncPendingForms();
  }
};

// Accessibility Helper
const AccessibilityHelper = {
  init() {
    // Add focus management for accessibility
    document.querySelectorAll('button, input, select, textarea').forEach(element => {
      element.addEventListener('focus', () => {
        element.classList.add('focused');
      });
      element.addEventListener('blur', () => {
        element.classList.remove('focused');
      });
    });

    // Ensure all images have alt attributes
    document.querySelectorAll('img').forEach(img => {
      if (!img.alt) img.setAttribute('alt', '');
    });
  }
};



// Mobile menu toggle
document.addEventListener("DOMContentLoaded", function () {
    const menuBtn = document.querySelector(".mobile-menu-btn");
    const sidebar = document.querySelector(".sidebar");

    if (menuBtn && sidebar) {
        menuBtn.addEventListener("click", function (event) {
            sidebar.classList.toggle("active");
            event.stopPropagation(); // Prevents immediate closing when clicking the button
        });

        // Detect clicks outside the sidebar and hide it
        document.addEventListener("click", function (event) {
            if (!sidebar.contains(event.target) && !menuBtn.contains(event.target)) {
                sidebar.classList.remove("active");
            }
        });
    } else {
        console.error("Menu button or sidebar not found!");
    }
});

// Navigation setup
function closeMenu() {
  const navbar = document.querySelector('.navbar-collapse');
  if (navbar && navbar.classList.contains('show')) {
    const bsCollapse = bootstrap.Collapse.getInstance(navbar);
    if (bsCollapse) bsCollapse.hide();
  }
}

function showSection(sectionId) {
  const sections = document.querySelectorAll('.section-content');
  sections.forEach(el => el.classList.remove('active'));
  const section = document.getElementById(sectionId);
  if (section) section.classList.add('active');
  document.querySelectorAll('.sub-section').forEach(el => el.classList.remove('active'));
  // Activate default sub-section for Sales
  if (sectionId === 'sales') {
    const defaultSubSection = document.getElementById('sale-form');
    if (defaultSubSection) defaultSubSection.classList.add('active');
  }
  closeMenu();
}

function showSubSection(sectionId, subId) {
  showSection(sectionId);
  const subSections = document.querySelectorAll(`#${sectionId} .sub-section`);
  subSections.forEach(el => el.classList.remove('active'));
  const subSection = document.getElementById(subId);
  if (subSection) subSection.classList.add('active');
  closeMenu();
}

document.addEventListener('click', function (event) {
    const nav = document.querySelector('.navbar-collapse');
    
    // Ensure nav is found before checking .contains()
    if (nav && (nav.contains(event.target) || event.target.closest('.navbar-toggler'))) {
        return;
    }

    if (nav && nav.classList.contains('show')) {
        const bsCollapse = bootstrap.Collapse.getInstance(nav);
        if (bsCollapse) bsCollapse.hide();
    }
});


class DataManager {
  static baseUrl = 'https://script.google.com/macros/s/YOURSPREADSHEET/executable'; // Replace with your Google Apps Script web app URL

  static async getCSRFToken() {
    try {
      const response = await fetch(`${this.baseUrl}?${path}=${encodeURIComponent('getCSRFToken')}`);
      const data = await response.json();
      if (data.success) {
        localStorage.setItem('csrf_token', data.token);
        return data.token;
      }
      throw new Error('Failed to get CSRF token');
    } catch (err) {
      Utils.logError(`Error fetching CSRF token: ${err.message}`, 'DataManager');
      return null;
    } catch (error) {
      Utils.logError('Failed to get CSRF token', error.message);
      return '';
    }
  }

  static async login(email, password) {
    try {
      const csrfToken = await this.getCSRFToken();
      const response = await fetch(`${this.baseUrl}?path=${encodeURIComponent('mylogin')}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': csrfToken
        },
        body: JSON.stringify({ email, password, csrfToken })
      });
      const data = await response.json();
      if (data.success) {
        // Store session data
        localStorage.setItem('sessionToken', JSON.stringify({
          tokenId: data.token,
          email,
          expiry: data.expiryDate
        }));
        Utils.showToast('Login successful', 'success');
        return data;
      }
      throw new Error('data.message' || 'Login failed');
    } catch (err) {
      Utils.logError(`Login error: ${err.message}`, 'DataManager.login');
      Utils.showToast(`Login error: ${err.message}`);
      throw err;
    }
  }

  static async checkSession() {
    const session = localStorage.getItem('sessionToken');
    if (!session) return false;
    const { tokenId, email, expiry } = JSON.parse(session);
    if (new Date(expiry) < new Date()) {
      localStorage.removeItem('sessionToken');
      Utils.showToast('Session expired. Please log in.');
      window.location.href = 'index.html';
      return false;
    }
    return { tokenId, email };
  }

  static async submitForm(formData, endpoint) {
    try {
      const session = await this.checkSession();
      if (!session.valid) throw new Error('Invalid session');
      const csrfToken = localStorage.getItem('csrfToken') || await this.getCSRFToken();
      const response = await fetch(`${this.baseUrl}?${path}=${encodeURIComponent(endpoint.replace('/api/', ''))}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
          'Authorization': `Bearer ${session.token}`,
        },
        body: JSON.stringify({ ...formData, ...session, csrfToken })
      });
      const data = await response.json();
      if (!data.success()) {
        throw new Error('data.message' || 'Form submission failed');
      }
      return data;
    } catch (err) {
      Utils.logError(`Error submitting form to ${endpoint}: ${err.message}`, 'DataManager');
      if (!navigator.onLine) {
        await OfflineManager.queueForm({
          url: `${this.baseUrl}?${encodeURIComponent(path)}`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': localStorage.getItem('csrfToken') || '',
            'Authorization': `Bearer ${session?.token || ''}`,
          },
          body: formData,
          formId: `form-${Date.now()}`,
          csrfToken: localStorage.getItem('csrfToken') || '',
          sessionTokenId: session?.tokenId || ''
        });
        Utils.showToast('Form queued for sync', 'success');
      } else {
        throw err;
      }
    }
  }

  static async fetchData(endpoint) {
    try {
      const session = await this.checkSession();
      const csrfToken = localStorage.getItem('csrfToken') || '' || await this.getCSRFToken();
      const response = await fetch(`${this.baseUrl}?${encodeURIComponent(path)}`, {
        headers: {
          'X-CSRF-Token': csrfToken,
          'Authorization': `Bearer ${session?.tokenId || ''}`,
        }
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error('data.message' || `Failed to fetch ${endpoint}`);
      }
      return data.data;
    } catch (err) {
      if (!navigator.onLine && ['getdbsalesrecords', 'newreports', 'getdbcustomers', 'getdbvendors', 'getdbexpensesrecords'].includes(endpoint.replace('/api/', ''))) {
        return Store.getCachedData(endpoint);
      }
      Utils.logError(`Fetch error for ${endpoint}: ${err.message}`, 'DataManager');
      throw err;
    }
  }

  static async logout() {
    try {
      const session = await this.checkSession();
      if (!session) return;
      const csrfToken = localStorage.getItem('csrfToken') || await this.getCSRFToken();
      const response = await fetch(`${this.baseUrl}?path=${encodeURIComponent('logout')}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
          'Authorization': `Bearer ${session.token}`
        },
        body: JSON.stringify({ email: session.email, sessionToken: session.token, csrfToken })
      });
      const data = await response.json();
      if (data.success) {
        localStorage.removeItem('sessionToken');
        localStorage.removeItem('csrfToken');
        Utils.showToast('Logged out successfully', 'success');
        window.location.href = 'index.html';
      } else {
        throw new Error(data.message || 'Logout failed');
      }
    } catch (err) {
      Utils.logError(`Logout error: ${err.message}`, 'DataManager');
      Utils.showToast(`Error logging out: ${err.message}`);
    }
  }
}
// Main initialization
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize all components
  await Promise.all([
    OfflineManager.init(),
    ServiceWorkerManager.init(),
    Store.loadFromStorage()
  ]);

  // Set up network status monitoring
  window.addEventListener('online', () => {
    Store.setOfflineStatus(false);
    Utils.showToast('Back online. Syncing data...', 'success');
    ServiceWorkerManager.syncPendingForms();
  });

  window.addEventListener('offline', () => {
    Store.setOfflineStatus(true);
    Utils.showToast('You are now offline. Working in offline mode.', 'warning');
  });

  // Initialize the rest of the app
  DataManager.init();
  FormHandler.init();
  AccessibilityHelper.init(); // Would contain accessibility enhancements
});
