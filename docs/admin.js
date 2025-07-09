class AdminDashboard {
  constructor() {
    this.refreshInterval = 30000; // 30 seconds
    this.currentErrorFilter = 'all';
    this.currentTab = 'errorLog';
    this.workflows = {};
    this.errorLogs = {};
    this.comparisonData = {};
    this.executionData = {};
    // Track collapsed state per tab
    this.collapsedDays = {
      errorLog: new Set(),
      comparisonData: new Set(),
      executions: new Set()
    };
    this.collapsedWorkflows = {
      errorLog: new Set(),
      comparisonData: new Set(),
      executions: new Set()
    };
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
        this.loadErrorLogs(),
        this.loadComparisonData(),
        this.loadExecutionData()
      ]);
      this.updateDashboard();
    } catch (error) {
      console.error('Failed to load data:', error);
      this.showError('Failed to load dashboard data');
    }
  }

  async loadWorkflows() {
    try {
      const response = await fetch('./workflows.json');
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
      // Load error logs for the last 7 days, organized by date
      const errorLogsByDate = {};
      const today = new Date();
      
      for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateString = date.toISOString().split('T')[0];
        
        try {
          const response = await fetch(`./executions/${dateString}/errorLog.json`);
          if (response.ok) {
            const dayLogs = await response.json();
            
            // Only add if there are actual errors for this day
            if (Object.keys(dayLogs).length > 0) {
              errorLogsByDate[dateString] = {
                date: dateString,
                displayDate: date.toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                }),
                logs: dayLogs
              };
            }
          }
        } catch (dayError) {
          console.warn(`Failed to load error logs for ${dateString}:`, dayError);
          // Continue loading other days even if one fails
        }
      }
      
      this.errorLogs = errorLogsByDate;
    } catch (error) {
      console.error('Failed to load error logs:', error);
      // Don't throw error here, just set empty error logs
      this.errorLogs = {};
    }
  }

  async loadComparisonData() {
    try {
      const comparisonDataByDate = {};
      const today = new Date();
      
      for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateString = date.toISOString().split('T')[0];
        
        try {
          const response = await fetch(`./executions/${dateString}/comparisonData.json`);
          if (response.ok) {
            const dayData = await response.json();
            
            if (Object.keys(dayData).length > 0) {
              comparisonDataByDate[dateString] = {
                date: dateString,
                displayDate: date.toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                }),
                data: dayData
              };
            }
          }
        } catch (dayError) {
          console.warn(`Failed to load comparison data for ${dateString}:`, dayError);
        }
      }
      
      this.comparisonData = comparisonDataByDate;
    } catch (error) {
      console.error('Failed to load comparison data:', error);
      this.comparisonData = {};
    }
  }

  async loadExecutionData() {
    try {
      const executionDataByDate = {};
      const today = new Date();
      
      for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateString = date.toISOString().split('T')[0];
        
        try {
          const response = await fetch(`./executions/${dateString}/executions.json`);
          if (response.ok) {
            const dayData = await response.json();
            
            if (Object.keys(dayData).length > 0) {
              executionDataByDate[dateString] = {
                date: dateString,
                displayDate: date.toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                }),
                data: dayData
              };
            }
          }
        } catch (dayError) {
          console.warn(`Failed to load execution data for ${dateString}:`, dayError);
        }
      }
      
      this.executionData = executionDataByDate;
    } catch (error) {
      console.error('Failed to load execution data:', error);
      this.executionData = {};
    }
  }

  updateDashboard() {
    this.updateOverallStatus();
    this.updateWorkflows();
    this.updateDataTabs();
    this.updateDownloadDates();
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

  updateDataTabs() {
    this.updateErrorLogs();
    this.updateComparisonData();
    this.updateExecutionData();
  }

  updateErrorLogs() {
    const container = document.getElementById('errorsContainer');
    const allErrors = this.getAllErrors();
    
    if (allErrors.length === 0) {
      container.innerHTML = `
        <div class="no-errors">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">✅</div>
          <div>No errors found in the last 7 days</div>
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
          <div>No errors found for ${this.currentErrorFilter} in the last 7 days</div>
        </div>
      `;
      return;
    }

    // Group errors by date
    const errorsByDate = this.groupErrorsByDate(filteredErrors);
    
    // Create day sections
    Object.entries(errorsByDate).forEach(([date, dayData]) => {
      const daySection = this.createDaySection(date, dayData.displayDate, dayData.errors, 'errorLog');
      container.appendChild(daySection);
    });
  }

  updateComparisonData() {
    const container = document.getElementById('comparisonDataContainer');
    
    if (Object.keys(this.comparisonData).length === 0) {
      container.innerHTML = `
        <div class="no-errors">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">📊</div>
          <div>No comparison data found in the last 7 days</div>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    
    // Create day sections for comparison data
    Object.entries(this.comparisonData).forEach(([date, dayData]) => {
      const daySection = this.createDataSection(date, dayData.displayDate, dayData.data, 'comparison', 'comparisonData');
      container.appendChild(daySection);
    });
  }

  updateExecutionData() {
    const container = document.getElementById('executionsContainer');
    
    if (Object.keys(this.executionData).length === 0) {
      container.innerHTML = `
        <div class="no-errors">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">⚙️</div>
          <div>No execution data found in the last 7 days</div>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    
    // Create day sections for execution data
    Object.entries(this.executionData).forEach(([date, dayData]) => {
      const daySection = this.createDataSection(date, dayData.displayDate, dayData.data, 'execution', 'executions');
      container.appendChild(daySection);
    });
  }

  getAllErrors() {
    const allErrors = [];
    
    Object.entries(this.errorLogs).forEach(([date, dayData]) => {
      Object.entries(dayData.logs).forEach(([type, errors]) => {
        if (Array.isArray(errors)) {
          errors.forEach(error => {
            allErrors.push({
              ...error,
              type: type,
              date: date,
              displayDate: dayData.displayDate
            });
          });
        }
      });
    });
    
    // Sort by timestamp (most recent first)
    return allErrors.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  groupErrorsByDate(errors) {
    const grouped = {};
    
    errors.forEach(error => {
      if (!grouped[error.date]) {
        grouped[error.date] = {
          displayDate: error.displayDate,
          errors: []
        };
      }
      grouped[error.date].errors.push(error);
    });
    
    // Sort dates (most recent first)
    const sortedEntries = Object.entries(grouped).sort(([a], [b]) => new Date(b) - new Date(a));
    return Object.fromEntries(sortedEntries);
  }

  createDaySection(date, displayDate, errors, tabName) {
    const section = document.createElement('div');
    section.className = 'day-section';
    section.dataset.date = date;
    section.dataset.tab = tabName; // Add tab info for debugging
    
    // Create day header
    const header = document.createElement('div');
    header.className = 'day-header';
    header.style.cursor = 'pointer';
    
    const isToday = date === new Date().toISOString().split('T')[0];
    const isYesterday = date === new Date(Date.now() - 24*60*60*1000).toISOString().split('T')[0];
    
    let dayLabel = displayDate;
    if (isToday) dayLabel = `Today (${displayDate})`;
    else if (isYesterday) dayLabel = `Yesterday (${displayDate})`;
    
    const isCollapsed = this.collapsedDays[tabName].has(date);
    
    header.innerHTML = `
      <div class="day-header-content">
        <span class="collapse-icon" style="transform: ${isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)'}">▼</span>
        <h3 class="day-title">${dayLabel}</h3>
      </div>
      <span class="error-count">${errors.length} error${errors.length !== 1 ? 's' : ''}</span>
    `;
    
    // Add click handler for collapse/expand
    header.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('Day header clicked for date:', date, 'tab:', tabName);
      this.toggleDaySection(date, tabName);
    });
    
    section.appendChild(header);
    
    // Create errors container for this day
    const errorsContainer = document.createElement('div');
    errorsContainer.className = 'day-errors';
    
    if (isCollapsed) {
      errorsContainer.style.display = 'none';
      section.classList.add('collapsed');
    }
    
    errors.forEach(error => {
      const card = this.createErrorCard(error);
      errorsContainer.appendChild(card);
    });
    
    section.appendChild(errorsContainer);
    return section;
  }

  createDataSection(date, displayDate, data, type, tabName) {
    const section = document.createElement('div');
    section.className = 'day-section';
    section.dataset.date = date;
    section.dataset.tab = tabName; // Add tab info for debugging
    
    // Create day header
    const header = document.createElement('div');
    header.className = 'day-header';
    header.style.cursor = 'pointer';
    
    const isToday = date === new Date().toISOString().split('T')[0];
    const isYesterday = date === new Date(Date.now() - 24*60*60*1000).toISOString().split('T')[0];
    
    let dayLabel = displayDate;
    if (isToday) dayLabel = `Today (${displayDate})`;
    else if (isYesterday) dayLabel = `Yesterday (${displayDate})`;
    
    const isCollapsed = this.collapsedDays[tabName].has(date);
    const dataCount = Object.keys(data).length;
    
    header.innerHTML = `
      <div class="day-header-content">
        <span class="collapse-icon" style="transform: ${isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)'}">▼</span>
        <h3 class="day-title">${dayLabel}</h3>
      </div>
      <span class="error-count">${dataCount} workflow${dataCount !== 1 ? 's' : ''}</span>
    `;
    
    // Add click handler for collapse/expand
    header.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('Data day header clicked for date:', date, 'tab:', tabName);
      this.toggleDaySection(date, tabName);
    });
    
    section.appendChild(header);
    
    // Create data container for this day
    const dataContainer = document.createElement('div');
    dataContainer.className = 'day-errors';
    
    if (isCollapsed) {
      dataContainer.style.display = 'none';
      section.classList.add('collapsed');
    }
    
    // Group data by workflow type and create collapsible sections
    Object.entries(data).forEach(([key, value]) => {
      const workflowSection = this.createWorkflowSection(key, value, type, date, tabName);
      dataContainer.appendChild(workflowSection);
    });
    
    section.appendChild(dataContainer);
    return section;
  }

  createWorkflowSection(workflowType, value, type, date, tabName) {
    const section = document.createElement('div');
    section.className = 'workflow-section';
    
    // Create workflow header
    const header = document.createElement('div');
    header.className = 'workflow-header';
    header.style.cursor = 'pointer';
    
    const workflowId = `${tabName}-${date}-${workflowType}`;
    const isCollapsed = this.collapsedWorkflows[tabName].has(workflowId);
    const typeColor = this.getTypeColor(workflowType);
    
    // Calculate item count
    let itemCount = 0;
    if (Array.isArray(value)) {
      itemCount = value.length;
    } else if (value !== null && value !== undefined) {
      itemCount = 1;
    }
    
    header.setAttribute('data-workflow-id', workflowId);
    header.innerHTML = `
      <div class="workflow-header-content">
        <span class="collapse-icon" style="transform: ${isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)'}">▼</span>
        <h4 class="workflow-title" style="color: ${typeColor}">${workflowType}</h4>
      </div>
      <span class="item-count">${itemCount} item${itemCount !== 1 ? 's' : ''}</span>
    `;
    
    // Add click handler for collapse/expand
    header.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation(); // Prevent bubbling to day header
      console.log('Workflow header clicked for workflowId:', workflowId, 'tab:', tabName);
      this.toggleWorkflowSection(workflowId, tabName);
    });
    
    section.appendChild(header);
    
    // Create items container for this workflow
    const itemsContainer = document.createElement('div');
    itemsContainer.className = 'workflow-items';
    
    if (isCollapsed) {
      itemsContainer.style.display = 'none';
      section.classList.add('collapsed');
    }
    
    // Create individual cards for each item
    if (Array.isArray(value) && value.length > 0) {
      // Sort items by dateCreated/dateModified in descending order (newest first)
      const sortedItems = [...value].sort((a, b) => {
        // Try dateModified first (for execution data), then dateCreated
        const dateA = a?.dateModified || a?.dateCreated;
        const dateB = b?.dateModified || b?.dateCreated;
        
        // Handle missing dates
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;  // Items without dates go to the end
        if (!dateB) return -1;
        
        // Parse dates and sort newest first
        const parsedDateA = new Date(dateA);
        const parsedDateB = new Date(dateB);
        
        // Handle invalid dates
        if (isNaN(parsedDateA.getTime()) && isNaN(parsedDateB.getTime())) return 0;
        if (isNaN(parsedDateA.getTime())) return 1;
        if (isNaN(parsedDateB.getTime())) return -1;
        
        return parsedDateB - parsedDateA;
      });
      
      console.log(`Sorted ${workflowType} items by timestamp:`, sortedItems.map(item => ({
        id: item.id || 'no-id',
        date: item?.dateModified || item?.dateCreated || 'no-date'
      })));
      
      sortedItems.forEach((item, index) => {
        const card = this.createDataCard(workflowType, item, type, index);
        itemsContainer.appendChild(card);
      });
    } else if (value !== null && value !== undefined) {
      const card = this.createDataCard(workflowType, value, type);
      itemsContainer.appendChild(card);
    }
    
    section.appendChild(itemsContainer);
    return section;
  }

  toggleDaySection(date, tabName = 'errorLog') {
    console.log('toggleDaySection called with date:', date, 'tab:', tabName); // Debug log
    
    // Find the section for this specific tab and date
    const section = document.querySelector(`[data-date="${date}"][data-tab="${tabName}"]`) || 
                   document.querySelector(`[data-date="${date}"]`);
    
    if (!section) {
      console.log('No section found for date:', date, 'tab:', tabName);
      return;
    }
    
    const dataContainer = section.querySelector('.day-errors');
    const collapseIcon = section.querySelector('.day-header .collapse-icon');
    
    if (!dataContainer || !collapseIcon) {
      console.log('Missing dataContainer or collapseIcon:', { dataContainer: !!dataContainer, collapseIcon: !!collapseIcon });
      return;
    }
    
    console.log('Current collapsed state:', this.collapsedDays[tabName].has(date));
    
    if (this.collapsedDays[tabName].has(date)) {
      // Expand
      this.collapsedDays[tabName].delete(date);
      dataContainer.style.display = 'block';
      section.classList.remove('collapsed');
      collapseIcon.style.transform = 'rotate(0deg)';
      console.log('Expanded day section');
    } else {
      // Collapse
      this.collapsedDays[tabName].add(date);
      dataContainer.style.display = 'none';
      section.classList.add('collapsed');
      collapseIcon.style.transform = 'rotate(-90deg)';
      console.log('Collapsed day section');
    }
  }

  toggleWorkflowSection(workflowId, tabName = 'errorLog') {
    console.log('toggleWorkflowSection called with workflowId:', workflowId, 'tab:', tabName); // Debug log
    const header = document.querySelector(`[data-workflow-id="${workflowId}"]`);
    if (!header) {
      console.log('No header found for workflowId:', workflowId);
      return;
    }
    
    const section = header.closest('.workflow-section');
    if (!section) {
      console.log('No section found for workflowId:', workflowId);
      return;
    }
    
    const itemsContainer = section.querySelector('.workflow-items');
    const collapseIcon = section.querySelector('.collapse-icon');
    
    if (!itemsContainer || !collapseIcon) {
      console.log('Missing itemsContainer or collapseIcon:', { itemsContainer: !!itemsContainer, collapseIcon: !!collapseIcon });
      return;
    }
    
    console.log('Current workflow collapsed state:', this.collapsedWorkflows[tabName].has(workflowId));
    
    if (this.collapsedWorkflows[tabName].has(workflowId)) {
      // Expand
      this.collapsedWorkflows[tabName].delete(workflowId);
      itemsContainer.style.display = 'block';
      section.classList.remove('collapsed');
      collapseIcon.style.transform = 'rotate(0deg)';
      console.log('Expanded workflow section');
    } else {
      // Collapse
      this.collapsedWorkflows[tabName].add(workflowId);
      itemsContainer.style.display = 'none';
      section.classList.add('collapsed');
      collapseIcon.style.transform = 'rotate(-90deg)';
      console.log('Collapsed workflow section');
    }
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

  createDataCard(key, value, type, index = null) {
    const card = document.createElement('div');
    card.className = 'error-card';
    
    // Use workflow-specific colors based on the key (workflow type)
    const typeColor = this.getTypeColor(key);
    card.style.borderLeftColor = typeColor;
    
    // Create title with index if it's from an array
    const title = index !== null ? `${key} #${index + 1}` : key;
    
    // Get timestamp for display
    const timestamp = value?.dateModified || value?.dateCreated;
    const timeDisplay = timestamp ? new Date(timestamp).toLocaleString() : `${type === 'comparison' ? 'Comparison' : 'Execution'}`;
    
    // Format the data - for individual array items, use the detailed formatting
    const formattedData = this.formatIndividualDataItem(value);
    
    card.innerHTML = `
      <div class="error-header">
        <div class="error-type" style="color: ${typeColor}">${title}</div>
        <div class="error-time">${timeDisplay}</div>
      </div>
      <div class="error-data">${formattedData}</div>
    `;
    
    return card;
  }

  getTypeColor(type) {
    const colors = {
      // Error log types
      'BALANCE': 'var(--color-info)',
      'TRANSFER': 'var(--color-success)',
      'PRICE': 'var(--color-warning)',
      'STAKESTONE': 'var(--color-info)',
      'EVERY_PERIOD': 'var(--color-warning)',
      'SERVER': 'var(--color-error)',
      
      // Workflow types (handle various naming conventions)
      'balance': 'var(--color-info)',
      'transfer': 'var(--color-success)',
      'price': 'var(--color-warning)',
      'stakestone': 'var(--color-info)',
      'every_period': 'var(--color-warning)',
      'everyPeriod': 'var(--color-warning)',
      'server': 'var(--color-error)',
      
      // Template workflow types
      'wf_balance': 'var(--color-info)',
      'wf_transfer': 'var(--color-success)',
      'wf_price': 'var(--color-warning)',
      'wf_stakestone': 'var(--color-info)',
      'wf_every_period': 'var(--color-warning)',
      
      // Additional workflow variations
      'Balance': 'var(--color-info)',
      'Transfer': 'var(--color-success)',
      'Price': 'var(--color-warning)',
      'StakeStone': 'var(--color-info)',
      'EveryPeriod': 'var(--color-warning)',
      'Server': 'var(--color-error)'
    };
    
    // If exact match found, return it
    if (colors[type]) {
      return colors[type];
    }
    
    // Try to match by checking if the type contains known workflow keywords
    const lowerType = type.toLowerCase();
    if (lowerType.includes('balance')) return 'var(--color-info)';
    if (lowerType.includes('transfer')) return 'var(--color-success)';
    if (lowerType.includes('price')) return 'var(--color-warning)';
    if (lowerType.includes('stakestone') || lowerType.includes('stake')) return 'var(--color-info)';
    if (lowerType.includes('period')) return 'var(--color-warning)';
    if (lowerType.includes('server')) return 'var(--color-error)';
    
    // Default color for unknown types
    return 'var(--color-text-secondary)';
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

  formatDataValue(value) {
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return `<div class="data-item">Empty array []</div>`;
      }
      
      // Handle array of objects
      if (value.length > 0 && typeof value[0] === 'object' && value[0] !== null) {
        if (value.length > 3) {
          return `<div class="data-item">Array of ${value.length} objects:</div>
                  <pre class="data-item">${JSON.stringify(value.slice(0, 2), null, 2)}</pre>
                  <div class="data-item">... and ${value.length - 2} more objects</div>`;
        } else {
          return `<div class="data-item">Array of ${value.length} objects:</div>
                  <pre class="data-item">${JSON.stringify(value, null, 2)}</pre>`;
        }
      }
      
      // Handle array of primitives
      if (value.length > 10) {
        return `<div class="data-item">Array[${value.length}]: [${value.slice(0, 5).join(', ')}...]</div>`;
      } else {
        return `<div class="data-item">[${value.join(', ')}]</div>`;
      }
    }
    
    if (typeof value === 'object' && value !== null) {
      return `<pre class="data-item">${JSON.stringify(value, null, 2)}</pre>`;
    }
    
    return `<div class="data-item">${String(value)}</div>`;
  }

  formatIndividualDataItem(value) {
    if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        // Handle arrays within individual items
        if (value.length === 0) {
          return `<div class="data-item">Empty array []</div>`;
        }
        return `<div class="data-item">Array (${value.length} items):</div>
                <pre class="data-item">${JSON.stringify(value, null, 2)}</pre>`;
      }
      
      // Handle objects - format like error log data
      return Object.entries(value)
        .map(([key, val]) => {
          let formattedValue;
          if (typeof val === 'object' && val !== null) {
            formattedValue = JSON.stringify(val, null, 2);
          } else {
            formattedValue = String(val);
          }
          return `<div class="data-item"><strong>${key}:</strong> ${formattedValue}</div>`;
        })
        .join('');
    }
    
    // For primitive values
    return `<div class="data-item">${String(value)}</div>`;
  }

  updateDownloadDates() {
    const dateFilter = document.getElementById('dateFilter');
    const currentValue = dateFilter.value;
    
    // Clear existing options except "All dates"
    dateFilter.innerHTML = '<option value="">All dates</option>';
    
    // Get available dates from all data types
    const allDates = new Set([
      ...Object.keys(this.errorLogs),
      ...Object.keys(this.comparisonData),
      ...Object.keys(this.executionData)
    ]);
    
    const dates = Array.from(allDates).sort().reverse();
    
    dates.forEach(date => {
      const option = document.createElement('option');
      option.value = date;
      option.textContent = new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      dateFilter.appendChild(option);
    });
    
    // Restore previous selection if it still exists
    if (currentValue && dates.includes(currentValue)) {
      dateFilter.value = currentValue;
    }
  }

  setupDownloadEventListeners() {
    const downloadBtn = document.getElementById('downloadBtn');
    const downloadAllBtn = document.getElementById('downloadAllBtn');
    const downloadTodayBtn = document.getElementById('downloadTodayBtn');
    const dateFilter = document.getElementById('dateFilter');
    const typeFilter = document.getElementById('typeFilter');

    // Custom download with filters
    downloadBtn.addEventListener('click', () => {
      const date = dateFilter.value;
      const type = typeFilter.value;
      this.downloadData(date, type);
    });

    // Download all data
    downloadAllBtn.addEventListener('click', () => {
      this.downloadData('', '');
    });

    // Download today's data
    downloadTodayBtn.addEventListener('click', () => {
      const today = new Date().toISOString().split('T')[0];
      this.downloadData(today, '');
    });
  }

  async downloadData(date, type) {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (type) params.append('type', type);
    
    const url = `/api/download${params.toString() ? '?' + params.toString() : ''}`;
    
    try {
      // First check if the endpoint is reachable
      const response = await fetch(url, { method: 'HEAD' });
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }
      
      // Create a temporary anchor element and trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = ''; // Let the server decide the filename
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Show success feedback
      this.showDownloadFeedback(date, type, true);
    } catch (error) {
      console.error('Download error:', error);
      this.showDownloadFeedback(date, type, false, error.message);
    }
  }

  showDownloadFeedback(date, type, success = true, errorMessage = '') {
    const downloadBtn = document.getElementById('downloadBtn');
    const originalText = downloadBtn.innerHTML;
    
    if (success) {
      // Show success feedback
      downloadBtn.innerHTML = '<span class="download-icon">✅</span> Downloaded!';
      downloadBtn.style.backgroundColor = 'var(--color-success)';
      downloadBtn.disabled = true;
    } else {
      // Show error feedback
      downloadBtn.innerHTML = '<span class="download-icon">❌</span> Error!';
      downloadBtn.style.backgroundColor = 'var(--color-error)';
      downloadBtn.disabled = true;
      
      // Show error message in console and optional user notification
      console.error('Download failed:', errorMessage);
      
      // You could also show a toast notification here
      this.showErrorToast(`Download failed: ${errorMessage}`);
    }
    
    // Reset after 3 seconds
    setTimeout(() => {
      downloadBtn.innerHTML = originalText;
      downloadBtn.style.backgroundColor = 'var(--color-info)';
      downloadBtn.disabled = false;
    }, 3000);
  }

  showErrorToast(message) {
    // Create a simple toast notification
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background-color: var(--color-error);
      color: white;
      padding: 1rem 1.5rem;
      border-radius: 6px;
      box-shadow: var(--shadow);
      z-index: 1000;
      font-size: 0.875rem;
      max-width: 300px;
      word-wrap: break-word;
    `;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // Remove toast after 5 seconds
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 5000);
  }

  showTabContent(tabId) {
    // Hide all tab contents
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(content => {
      content.classList.remove('active');
    });
    
    // Show selected tab content
    const selectedTab = document.getElementById(tabId + 'Tab');
    if (selectedTab) {
      selectedTab.classList.add('active');
    }
  }

  setupEventListeners() {
    // Tab buttons
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        // Remove active class from all tab buttons
        tabButtons.forEach(b => b.classList.remove('active'));
        // Add active class to clicked button
        e.target.classList.add('active');
        // Update current tab
        this.currentTab = e.target.dataset.tab;
        // Show/hide tab content
        this.showTabContent(this.currentTab);
      });
    });

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

    // Download buttons
    this.setupDownloadEventListeners();
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