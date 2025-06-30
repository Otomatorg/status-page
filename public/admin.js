class AdminDashboard {
  constructor() {
    this.refreshInterval = 30000; // 30 seconds
    this.currentErrorFilter = 'all';
    this.workflows = {};
    this.errorLogs = {};
    this.init();
  }

  async init() {
    await this.loadData();
    this.setupEventListeners();
    this.startAutoRefresh();
  }

  async loadData() {
    try {
      await Promise.all([
        this.loadWorkflows(),
        this.loadErrorLogs()
      ]);
      this.updateDashboard();
    } catch (error) {
      console.error('Failed to load data:', error);
      this.showError('Failed to load dashboard data');
    }
  }

  async loadWorkflows() {
    try {
      const response = await fetch('./data/workflows.json');
      console.log(response);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      this.workflows = await response.json();
    } catch (error) {
      console.error('Failed to load workflows:', error);
      throw error;
    }
  }

  async loadErrorLogs() {
    try {
      // Load error logs for the last 7 days
      const errorLogs = {};
      const today = new Date();
      
      for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateString = date.toISOString().split('T')[0];
        
        try {
          const response = await fetch(`./data/executions/${dateString}/errorLog.json`);
          if (response.ok) {
            const dayLogs = await response.json();
            // Merge the logs, using date as prefix to avoid conflicts
            Object.entries(dayLogs).forEach(([type, errors]) => {
              if (!errorLogs[type]) {
                errorLogs[type] = [];
              }
              if (Array.isArray(errors)) {
                errorLogs[type].push(...errors);
              }
            });
          }
        } catch (dayError) {
          console.warn(`Failed to load error logs for ${dateString}:`, dayError);
          // Continue loading other days even if one fails
        }
      }
      
      this.errorLogs = errorLogs;
    } catch (error) {
      console.error('Failed to load error logs:', error);
      // Don't throw error here, just set empty error logs
      this.errorLogs = {};
    }
  }

  updateDashboard() {
    this.updateOverallStatus();
    this.updateWorkflows();
    this.updateErrorLogs();
    this.updateLastUpdated();
  }

  updateOverallStatus() {
    const statusBadge = document.getElementById('overallStatus');
    const statusDot = statusBadge.querySelector('.status-dot');
    const statusText = statusBadge.querySelector('.status-text');
    
    const workflowEntries = Object.entries(this.workflows);
    const totalWorkflows = workflowEntries.length;
    const startedWorkflows = workflowEntries.filter(([_, wf]) => wf.started).length;
    const stoppedWorkflows = totalWorkflows - startedWorkflows;
    
    let status = 'operational';
    let message = 'All Workflows Running';
    
    if (stoppedWorkflows > 0) {
      if (stoppedWorkflows === totalWorkflows) {
        status = 'down';
        message = 'All Workflows Stopped';
      } else {
        status = 'degraded';
        message = `${stoppedWorkflows} Workflow${stoppedWorkflows > 1 ? 's' : ''} Stopped`;
      }
    }
    
    statusDot.className = `status-dot ${status === 'operational' ? '' : status}`;
    statusText.textContent = message;
  }

  updateWorkflows() {
    const container = document.getElementById('workflowsGrid');
    container.innerHTML = '';

    Object.entries(this.workflows).forEach(([type, workflow]) => {
      const card = this.createWorkflowCard(type, workflow);
      container.appendChild(card);
    });
  }

  createWorkflowCard(type, workflow) {
    const card = document.createElement('div');
    card.className = 'workflow-card';
    
    const status = workflow.started && workflow.id != null ? 'running' : 'stopped';
    const statusColor = workflow.started && workflow.id != null ? 'var(--color-success)' : 'var(--color-error)';
    
    const lastCheck = workflow.lastCheck ? new Date(workflow.lastCheck).toLocaleString() : 'Never';
    const lastExecution = workflow.lastExecution ? new Date(workflow.lastExecution).toLocaleString() : 'Never';
    const createdAt = workflow.createdAt ? new Date(workflow.createdAt).toLocaleString() : 'Unknown';
    
    card.innerHTML = `
      <div class="workflow-header">
        <div class="workflow-name">${workflow.name || type}</div>
        <div class="workflow-status" style="color: ${statusColor}">
          <div class="status-dot" style="background-color: ${statusColor}"></div>
          ${status.toUpperCase()}
        </div>
      </div>
      <div class="workflow-details">
        <div class="workflow-info">
          <div class="info-item">
            <span class="info-label">Type:</span>
            <span class="info-value">${type}</span>
          </div>
          <div class="info-item">
            <span class="info-label">State:</span>
            <span class="info-value">${workflow.state || 'Unknown'}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Workflow ID:</span>
            <span class="info-value execution-id" >
              <span class="copy-btn" onclick="navigator.clipboard.writeText('${workflow.id || ''}')" title="Copy ID" style="cursor: pointer;">
                <span class="copy-icon">📋</span>
                <span class="copy-text">Copy</span>
              </span>
              ${workflow.id || 'None'}
            </span>
          </div>
        </div>
        <div class="workflow-timestamps">
          <div class="timestamp-item">
            <span class="timestamp-label">Created:</span>
            <span class="timestamp-value">${createdAt}</span>
          </div>
          <div class="timestamp-item">
            <span class="timestamp-label">Last Check:</span>
            <span class="timestamp-value">${lastCheck}</span>
          </div>
          <div class="timestamp-item">
            <span class="timestamp-label">Last Execution:</span>
            <span class="timestamp-value">${lastExecution}</span>
          </div>
        </div>
      </div>
    `;
    
    return card;
  }

  updateErrorLogs() {
    const container = document.getElementById('errorsContainer');
    const allErrors = this.getAllErrors();
    
    if (allErrors.length === 0) {
      container.innerHTML = `
        <div class="no-errors">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">✅</div>
          <div>No errors found</div>
        </div>
      `;
      return;
    }

    // Filter errors based on current filter
    const filteredErrors = this.currentErrorFilter === 'all' 
      ? allErrors 
      : allErrors.filter(error => error.type === this.currentErrorFilter);

    container.innerHTML = '';
    
    if (filteredErrors.length === 0) {
      container.innerHTML = `
        <div class="no-errors">
          <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">🔍</div>
          <div>No errors found for ${this.currentErrorFilter}</div>
        </div>
      `;
      return;
    }

    filteredErrors.forEach(error => {
      const card = this.createErrorCard(error);
      container.appendChild(card);
    });
  }

  getAllErrors() {
    const allErrors = [];
    
    Object.entries(this.errorLogs).forEach(([type, errors]) => {
      if (Array.isArray(errors)) {
        errors.forEach(error => {
          allErrors.push({
            ...error,
            type: type
          });
        });
      }
    });
    
    // Sort by timestamp (most recent first)
    return allErrors.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  createErrorCard(error) {
    const card = document.createElement('div');
    card.className = 'error-card';
    
    const time = new Date(error.timestamp).toLocaleString();
    const typeColor = this.getTypeColor(error.type);
    card.style.borderLeftColor = typeColor;
    
    card.innerHTML = `
      <div class="error-header">
        <div class="error-type" style="color: ${typeColor}">${error.type}</div>
        <div class="error-time">${time}</div>
      </div>
      <div class="error-message">${error.message}</div>
      ${error.data ? `<div class="error-data">${this.formatErrorData(error.data)}</div>` : ''}
    `;
    
    return card;
  }

  getTypeColor(type) {
    const colors = {
      'BALANCE': 'var(--color-info)',
      'TRANSFER': 'var(--color-success)',
      'PRICE': 'var(--color-warning)',
      'STAKESTONE': 'var(--color-info)',
      'EVERY_PERIOD': 'var(--color-warning)',
      'SERVER': 'var(--color-error)'
    };
    return colors[type] || 'var(--color-text-secondary)';
  }

  formatErrorData(data) {
    if (!data || typeof data !== 'object') return '';
    
    const formatValue = (value) => {
      if (Array.isArray(value)) {
        return value.length > 5 
          ? `Array[${value.length}] (${value.slice(0, 3).join(', ')}...)`
          : `[${value.join(', ')}]`;
      }
      if (typeof value === 'object') {
        return JSON.stringify(value, null, 2);
      }
      return String(value);
    };
    
    return Object.entries(data)
      .map(([key, value]) => `<div class="data-item"><strong>${key}:</strong> ${formatValue(value)}</div>`)
      .join('');
  }

  setupEventListeners() {
    // Error filter buttons
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        // Remove active class from all buttons
        filterButtons.forEach(b => b.classList.remove('active'));
        // Add active class to clicked button
        e.target.classList.add('active');
        // Update filter
        this.currentErrorFilter = e.target.dataset.type;
        // Update error display
        this.updateErrorLogs();
      });
    });
  }

  updateLastUpdated() {
    const element = document.getElementById('lastUpdated');
    const time = new Date().toLocaleString();
    element.textContent = time;
  }

  startAutoRefresh() {
    setInterval(() => {
      this.loadData();
    }, this.refreshInterval);
  }

  showError(message) {
    // Update overall status to show error
    const statusBadge = document.getElementById('overallStatus');
    const statusText = statusBadge.querySelector('.status-text');
    statusText.textContent = message;
    
    // Show error in workflows grid
    const workflowsGrid = document.getElementById('workflowsGrid');
    workflowsGrid.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: var(--color-error);">
        <div style="font-size: 2rem; margin-bottom: 1rem;">⚠️</div>
        <div>${message}</div>
        <div style="margin-top: 0.5rem; font-size: 0.875rem; color: var(--color-text-secondary);">
          Retrying in ${this.refreshInterval / 1000} seconds...
        </div>
      </div>
    `;
  }
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
  new AdminDashboard();
}); 