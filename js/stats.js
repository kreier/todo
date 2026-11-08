/**
 * Public Statistics Module
 * Loads and visualizes aggregated statistics and GitHub data.
 */

class StatsManager {
  constructor() {
    this.data = null;
    this.chartInstance = null;
    this.categoryChartInstance = null;
    this.timeFilter = 'all'; // 'all', '1y', '3y'
  }

  async loadPublicStats() {
    try {
      const res = await fetch(window.CONFIG.PUBLIC_STATS_URL + '?v=' + Date.now());
      if (res.ok) {
        this.data = await res.json();
      } else {
        console.warn('Could not load public stats, using fallback.');
        this.data = this.getFallbackStats();
      }
    } catch (e) {
      console.warn('Error loading public stats:', e);
      this.data = this.getFallbackStats();
    }
    this.renderKPIs();
    this.renderCharts();
    this.renderGithubRepos();
    this.renderTimelineMilestones();
  }

  getFallbackStats() {
    return {
      updated_at: new Date().toISOString(),
      historical_start_date: "2018-03-07",
      metrics: {
        total_tasks_completed": 2393,
        average_tasks_per_month: 22.8,
        github_public_repos: 215,
        emails_answered_this_month: 58,
        current_open_emails: 3,
        active_projects: 6,
        projects_needing_update: 2
      },
      monthly_task_history: [],
      github_stats: {
        user: "kreier",
        public_repos: 215,
        total_stars: 45,
        followers: 12,
        recent_active_repos: []
      },
      categories_distribution: {
        "Recurring & Bills": 340,
        "Code & GitHub Projects": 520,
        "Email & Correspondence": 410,
        "Home & Maintenance": 210
      }
    };
  }

  renderKPIs() {
    if (!this.data || !this.data.metrics) return;
    const m = this.data.metrics;

    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = typeof val === 'number' ? val.toLocaleString() : val;
    };

    setVal('kpi-total-tasks', m.total_tasks_completed || '2,393');
    setVal('kpi-avg-tasks', m.average_tasks_per_month || '22.8');
    setVal('kpi-github-repos', m.github_public_repos || this.data.github_stats?.public_repos || '215');
    setVal('kpi-emails-answered', m.emails_answered_this_month || '58');
    setVal('kpi-open-emails', m.current_open_emails ?? '3');
    setVal('kpi-projects-update', m.projects_needing_update ?? '2');

    const updateTimeEl = document.getElementById('stats-updated-time');
    if (updateTimeEl && this.data.updated_at) {
      const dt = new Date(this.data.updated_at);
      updateTimeEl.textContent = `Updated: ${dt.toLocaleDateString()} ${dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
  }

  renderCharts() {
    if (typeof Chart === 'undefined') return;
    this.renderMonthlyChart();
    this.renderCategoryChart();
  }

  renderMonthlyChart() {
    const canvas = document.getElementById('monthlyTasksChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let history = this.data.monthly_task_history || [];
    if (history.length === 0) return;

    if (this.timeFilter === '1y') {
      history = history.slice(-12);
    } else if (this.timeFilter === '3y') {
      history = history.slice(-36);
    }

    const labels = history.map(h => h.year_month);
    const dataValues = history.map(h => h.completed);

    if (this.chartInstance) {
      this.chartInstance.destroy();
    }

    // Chart.js gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.45)');
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0.02)');

    this.chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Completed Tasks / Month',
          data: dataValues,
          borderColor: '#3b82f6',
          backgroundColor: gradient,
          fill: true,
          tension: 0.35,
          pointRadius: history.length > 40 ? 0 : 3,
          pointHoverRadius: 6,
          pointBackgroundColor: '#2563eb',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              label: (context) => ` ${context.raw} tasks finished`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              maxTicksLimit: 12,
              font: { size: 11 }
            }
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(156, 163, 175, 0.15)' },
            ticks: { font: { size: 11 } }
          }
        }
      }
    });
  }

  renderCategoryChart() {
    const canvas = document.getElementById('categoryChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const catData = this.data.categories_distribution || {
      "Recurring / Bills": 340,
      "Projects / Code": 520,
      "Emails & Communication": 410,
      "Personal & Chores": 210
    };

    const labels = Object.keys(catData);
    const values = Object.values(catData);

    if (this.categoryChartInstance) {
      this.categoryChartInstance.destroy();
    }

    this.categoryChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: [
            '#10b981', // emerald
            '#3b82f6', // blue
            '#f59e0b', // amber
            '#8b5cf6'  // purple
          ],
          borderWidth: 2,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 12,
              padding: 12,
              font: { size: 11 }
            }
          }
        },
        cutout: '68%'
      }
    });
  }

  renderGithubRepos() {
    const container = document.getElementById('github-repos-container');
    if (!container) return;

    const gh = this.data.github_stats;
    const repos = gh?.recent_active_repos || [];

    if (repos.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No active GitHub repositories loaded. Check back after GitHub Actions run.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = repos.slice(0, 6).map(r => `
      <a href="${r.html_url}" target="_blank" rel="noopener noreferrer" class="repo-card">
        <div class="repo-header">
          <span class="repo-name">
            <svg class="icon-inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"></path></svg>
            ${r.name}
          </span>
          <span class="repo-lang-badge">${r.language || 'Code'}</span>
        </div>
        <p class="repo-desc">${r.description || 'Public repository'}</p>
        <div class="repo-footer">
          <span>★ ${r.stars || 0}</span>
          <span>Updated ${r.updated_at ? new Date(r.updated_at).toLocaleDateString() : 'recently'}</span>
        </div>
      </a>
    `).join('');
  }

  renderTimelineMilestones() {
    const container = document.getElementById('history-milestones');
    if (!container) return;

    const startYear = 2018;
    const currentYear = new Date().getFullYear();
    const yearsActive = currentYear - startYear;

    container.innerHTML = `
      <div class="milestone-item">
        <div class="milestone-dot"></div>
        <div class="milestone-content">
          <h4>2018-03-07 • The Beginning</h4>
          <p>First recorded to-do entries started in iCloud Notes. Personal task tracking framework established.</p>
        </div>
      </div>
      <div class="milestone-item">
        <div class="milestone-dot"></div>
        <div class="milestone-content">
          <h4>2020-2023 • Expansion & Codebases</h4>
          <p>Crossed over 1,000 completed tasks. Scaled up GitHub open-source repositories and infrastructure tracking.</p>
        </div>
      </div>
      <div class="milestone-item">
        <div class="milestone-dot highlight"></div>
        <div class="milestone-content">
          <h4>${currentYear} • Full Google Drive & Web Integration</h4>
          <p>${yearsActive}+ continuous years of organized productivity. Secure browser portal with Google Drive subfolder integration and calming public metrics.</p>
        </div>
      </div>
    `;
  }

  setTimeFilter(filter) {
    this.timeFilter = filter;
    this.renderMonthlyChart();
  }
}

window.Stats = new StatsManager();
