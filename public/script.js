class StatusDashboard {
  constructor() {
    this.refreshInterval = 30000; // 30 seconds
    this.init();
  }

  async init() {
    await this.loadStatus();
    this.startAutoRefresh();
  }

  async loadStatus() {
    try {
      const response = await fetch('./data/status-report.json');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      this.updateDashboard(data);
    } catch (error) {
      console.error('Failed to load status:', error);
      this.showError('Failed to load status data');
    }
  }

  updateDashboard(data) {
    this.updateOverallStatus(data.overall);
    this.updateSummary(data.summary);
    this.updateServices(data.services);
    this.updateIncidents(data.services);
    this.updateLastUpdated(data.generatedAt);
  }

  updateOverallStatus(overall) {
    const statusBadge = document.getElementById('overallStatus');
    const statusDot = statusBadge.querySelector('.status-dot');
    const statusText = statusBadge.querySelector('.status-text');
    
    statusDot.className = `status-dot ${overall === 'operational' ? '' : overall}`;
    
    const statusMessages = {
      operational: 'All Systems Operational',
      degraded: 'Some Systems Degraded',
      down: 'Systems Down'
    };
    
    statusText.textContent = statusMessages[overall] || 'Unknown Status';
  }

  updateSummary(summary) {
    document.getElementById('totalServices').textContent = summary.totalServices;
    document.getElementById('operationalServices').textContent = summary.operationalServices;
    document.getElementById('degradedServices').textContent = summary.degradedServices;
    document.getElementById('downServices').textContent = summary.downServices;
  }

  updateServices(services) {
    const container = document.getElementById('servicesGrid');
    container.innerHTML = '';

    services.forEach(service => {
      const card = this.createServiceCard(service);
      container.appendChild(card);
    });
  }

  createServiceCard(service) {
    const card = document.createElement('div');
    card.className = 'service-card';
    
    const lastCheckTime = new Date(service.lastCheck).toLocaleString();
    
    card.innerHTML = `
      <div class="service-header">
        <div class="service-name">${service.name}</div>
        <div class="service-status ${service.status}">
          <div class="status-dot ${service.status}"></div>
          ${service.status.toUpperCase()}
        </div>
      </div>
      <div class="service-metrics">
        <div class="metric">
          <div class="metric-value">${service.uptime}%</div>
          <div class="metric-label">Uptime (24h)</div>
        </div>
        <div class="metric">
          <div class="metric-value">${service.responseTime}ms</div>
          <div class="metric-label">Avg Response</div>
        </div>
        <div class="metric">
          <div class="metric-value">${service.incidents.length}</div>
          <div class="metric-label">Recent Incidents</div>
        </div>
        <div class="metric">
          <div class="metric-value">${lastCheckTime}</div>
          <div class="metric-label">Last Check</div>
        </div>
      </div>
    `;
    
    return card;
  }

  updateIncidents(services) {
    const container = document.getElementById('incidentsContainer');
    container.innerHTML = '';
    
    // Collect all incidents from all services
    const allIncidents = [];
    services.forEach(service => {
      service.incidents.forEach(incident => {
        allIncidents.push({
          ...incident,
          serviceName: service.name
        });
      });
    });
    
    // Sort by timestamp (most recent first)
    allIncidents.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    if (allIncidents.length === 0) {
      container.innerHTML = `
        <div class="no-incidents">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">✅</div>
          <div>No recent incidents</div>
        </div>
      `;
      return;
    }
    
    // Show only the most recent 10 incidents
    allIncidents.slice(0, 10).forEach(incident => {
      const card = this.createIncidentCard(incident);
      container.appendChild(card);
    });
  }

  createIncidentCard(incident) {
    const card = document.createElement('div');
    card.className = 'incident-card';
    
    const time = new Date(incident.timestamp).toLocaleString();
    const statusColor = incident.status === 'down' ? 'var(--color-error)' : 'var(--color-warning)';
    card.style.borderLeftColor = statusColor;
    
    card.innerHTML = `
      <div class="incident-header">
        <div class="incident-service">${incident.serviceName}</div>
        <div class="incident-time">${time}</div>
      </div>
      <div class="incident-details">
        Status: ${incident.status.toUpperCase()} | 
        Response Time: ${incident.responseTime}ms
        ${incident.statusCode ? ` | Status Code: ${incident.statusCode}` : ''}
        ${incident.error ? ` | Error: ${incident.error}` : ''}
      </div>
    `;
    
    return card;
  }

  updateLastUpdated(timestamp) {
    const element = document.getElementById('lastUpdated');
    const time = new Date(timestamp).toLocaleString();
    element.textContent = time;
  }

  startAutoRefresh() {
    setInterval(() => {
      this.loadStatus();
    }, this.refreshInterval);
  }

  showError(message) {
    // Update overall status to show error
    const statusBadge = document.getElementById('overallStatus');
    const statusText = statusBadge.querySelector('.status-text');
    statusText.textContent = message;
    
    // Show error in services grid
    const servicesGrid = document.getElementById('servicesGrid');
    servicesGrid.innerHTML = `
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
  new StatusDashboard();
}); 