/**
 * Recurring Tasks & Monthly Bills Manager
 * Handles recurring obligations: Rent, Maintenance Fee, Internet, etc.
 */

class RecurringManager {
  constructor() {
    this.selectedYearMonth = this.getCurrentYearMonth();
  }

  getCurrentYearMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  setSelectedMonth(ym) {
    this.selectedYearMonth = ym;
    this.render();
  }

  getDefaultRecurringTasks() {
    return [
      {
        id: 'rec-rent',
        title: 'Apartment Rent',
        category: 'Living',
        amount: '1,200 €',
        due_day: 1,
        frequency: 'monthly',
        recipient: 'Landlord / Property Manager',
        history: {
          '2026-11': { status: 'paid', date: '2026-11-01', note: 'Bank transfer confirmed #TRX8921' },
          '2026-10': { status: 'paid', date: '2026-10-01', note: 'Paid on schedule' },
          '2026-09': { status: 'paid', date: '2026-09-01', note: 'Paid on schedule' }
        }
      },
      {
        id: 'rec-maintenance',
        title: 'Building Maintenance Fee',
        category: 'Living',
        amount: '150 €',
        due_day: 5,
        frequency: 'monthly',
        recipient: 'HOA / Building Admin',
        history: {
          '2026-11': { status: 'pending', date: null, note: '' },
          '2026-10': { status: 'paid', date: '2026-10-04', note: 'Direct debit' }
        }
      },
      {
        id: 'rec-internet',
        title: 'High-Speed Internet & Fiber',
        category: 'Utilities',
        amount: '39.99 €',
        due_day: 15,
        frequency: 'monthly',
        recipient: 'ISP Provider',
        history: {
          '2026-11': { status: 'pending', date: null, note: '' },
          '2026-10': { status: 'paid', date: '2026-10-14', note: 'Auto-charged' }
        }
      },
      {
        id: 'rec-electricity',
        title: 'Electricity & Utilities',
        category: 'Utilities',
        amount: '85 €',
        due_day: 20,
        frequency: 'monthly',
        recipient: 'Power Company',
        history: {
          '2026-11': { status: 'pending', date: null, note: '' }
        }
      }
    ];
  }

  render() {
    const container = document.getElementById('recurring-tasks-container');
    const monthDisplay = document.getElementById('recurring-month-display');
    const progressFill = document.getElementById('recurring-progress-fill');
    const progressText = document.getElementById('recurring-progress-text');
    if (!container) return;

    const data = window.App?.getPrivateData();
    const tasks = data?.recurring_tasks || this.getDefaultRecurringTasks();
    const currentYM = this.selectedYearMonth;

    if (monthDisplay) {
      const [year, month] = currentYM.split('-');
      const dateObj = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
      monthDisplay.textContent = dateObj.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    }

    let paidCount = 0;
    const totalCount = tasks.length;

    container.innerHTML = tasks.map((task) => {
      const record = task.history?.[currentYM] || { status: 'pending', date: null, note: '' };
      const isPaid = record.status === 'paid';
      if (isPaid) paidCount++;

      const [year, month] = currentYM.split('-');
      const today = new Date();
      const isCurrentMonthView = today.getFullYear() === parseInt(year, 10) && (today.getMonth() + 1) === parseInt(month, 10);
      const isOverdue = !isPaid && isCurrentMonthView && (today.getDate() > task.due_day);

      return `
        <div class="recurring-card ${isPaid ? 'is-paid' : (isOverdue ? 'is-overdue' : '')}" data-id="${task.id}">
          <div class="recurring-main">
            <button class="status-toggle-btn ${isPaid ? 'btn-paid' : 'btn-pending'}" 
                    title="${isPaid ? 'Click to mark pending' : 'Click to mark paid'}"
                    onclick="Recurring.togglePaidStatus('${task.id}')">
              ${isPaid 
                ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>' 
                : '<div class="circle-indicator"></div>'}
            </button>
            <div class="recurring-details">
              <div class="recurring-title-row">
                <span class="recurring-title">${this.escapeHtml(task.title)}</span>
                <span class="badge ${isPaid ? 'badge-success' : (isOverdue ? 'badge-danger' : 'badge-warning')}">
                  ${isPaid ? 'Paid' : (isOverdue ? 'Overdue' : 'Pending')}
                </span>
                ${task.category ? `<span class="badge badge-subtle">${this.escapeHtml(task.category)}</span>` : ''}
              </div>
              <div class="recurring-meta">
                <span><strong>Due:</strong> Day ${task.due_day} of month</span>
                ${task.amount ? `<span>• <strong>Amount:</strong> ${this.escapeHtml(task.amount)}</span>` : ''}
                ${task.recipient ? `<span>• <strong>Pay to:</strong> ${this.escapeHtml(task.recipient)}</span>` : ''}
              </div>
              ${isPaid && record.date ? `
                <div class="payment-receipt-info">
                  <svg class="icon-inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  <span>Paid on ${record.date} ${record.note ? `— <em>${this.escapeHtml(record.note)}</em>` : ''}</span>
                </div>
              ` : ''}
            </div>
          </div>
          <div class="recurring-actions">
            <button class="btn btn-sm btn-ghost" onclick="Recurring.openDetailsModal('${task.id}')" title="Edit details & payment note">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
            <button class="btn btn-sm btn-ghost text-danger" onclick="Recurring.deleteTask('${task.id}')" title="Delete task">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Update progress summary
    const pct = totalCount > 0 ? Math.round((paidCount / totalCount) * 100) : 0;
    if (progressFill) progressFill.style.width = `${pct}%`;
    if (progressText) progressText.textContent = `${paidCount} of ${totalCount} bills confirmed paid (${pct}%)`;
  }

  togglePaidStatus(taskId) {
    const data = window.App?.getPrivateData();
    if (!data || !data.recurring_tasks) return;

    const task = data.recurring_tasks.find(t => t.id === taskId);
    if (!task) return;

    if (!task.history) task.history = {};
    const currentYM = this.selectedYearMonth;
    const current = task.history[currentYM] || { status: 'pending', date: null, note: '' };

    if (current.status === 'paid') {
      task.history[currentYM] = { status: 'pending', date: null, note: '' };
      window.App?.showToast(`Marked "${task.title}" as pending.`, 'info');
    } else {
      const todayIso = new Date().toISOString().split('T')[0];
      task.history[currentYM] = {
        status: 'paid',
        date: todayIso,
        note: current.note || 'Confirmed paid in browser'
      };
      window.App?.showToast(`✓ Marked "${task.title}" as paid!`, 'success');
    }

    window.App?.savePrivateData();
    this.render();
  }

  openDetailsModal(taskId) {
    const data = window.App?.getPrivateData();
    const task = data?.recurring_tasks?.find(t => t.id === taskId);
    if (!task) return;

    const currentYM = this.selectedYearMonth;
    const record = task.history?.[currentYM] || { status: 'pending', date: '', note: '' };

    const modal = document.getElementById('recurring-modal');
    if (!modal) return;

    document.getElementById('edit-rec-id').value = task.id;
    document.getElementById('edit-rec-title').value = task.title;
    document.getElementById('edit-rec-category').value = task.category || '';
    document.getElementById('edit-rec-amount').value = task.amount || '';
    document.getElementById('edit-rec-due-day').value = task.due_day || 1;
    document.getElementById('edit-rec-recipient').value = task.recipient || '';
    document.getElementById('edit-rec-status').value = record.status || 'pending';
    document.getElementById('edit-rec-date').value = record.date || new Date().toISOString().split('T')[0];
    document.getElementById('edit-rec-note').value = record.note || '';

    modal.classList.add('active');
  }

  saveDetailsModal() {
    const id = document.getElementById('edit-rec-id').value;
    const data = window.App?.getPrivateData();
    const task = data?.recurring_tasks?.find(t => t.id === id);
    if (!task) return;

    task.title = document.getElementById('edit-rec-title').value.trim();
    task.category = document.getElementById('edit-rec-category').value.trim();
    task.amount = document.getElementById('edit-rec-amount').value.trim();
    task.due_day = parseInt(document.getElementById('edit-rec-due-day').value, 10) || 1;
    task.recipient = document.getElementById('edit-rec-recipient').value.trim();

    const status = document.getElementById('edit-rec-status').value;
    const date = document.getElementById('edit-rec-date').value;
    const note = document.getElementById('edit-rec-note').value.trim();

    if (!task.history) task.history = {};
    task.history[this.selectedYearMonth] = {
      status,
      date: status === 'paid' ? (date || new Date().toISOString().split('T')[0]) : null,
      note
    };

    window.App?.savePrivateData();
    this.closeModal();
    this.render();
    window.App?.showToast('Recurring task updated successfully.', 'success');
  }

  addNewTask(title, category, amount, dueDay, recipient) {
    const data = window.App?.getPrivateData();
    if (!data) return;

    if (!data.recurring_tasks) data.recurring_tasks = [];
    const newTask = {
      id: 'rec-' + Date.now(),
      title,
      category: category || 'Living',
      amount: amount || '',
      due_day: parseInt(dueDay, 10) || 1,
      frequency: 'monthly',
      recipient: recipient || '',
      history: {
        [this.selectedYearMonth]: { status: 'pending', date: null, note: '' }
      }
    };

    data.recurring_tasks.push(newTask);
    window.App?.savePrivateData();
    this.render();
    window.App?.showToast(`Added recurring task: ${title}`, 'success');
  }

  deleteTask(taskId) {
    if (!confirm('Are you sure you want to remove this recurring task?')) return;
    const data = window.App?.getPrivateData();
    if (!data || !data.recurring_tasks) return;

    data.recurring_tasks = data.recurring_tasks.filter(t => t.id !== taskId);
    window.App?.savePrivateData();
    this.render();
    window.App?.showToast('Recurring task removed.', 'info');
  }

  prevMonth() {
    const [year, month] = this.selectedYearMonth.split('-').map(Number);
    const d = new Date(year, month - 2, 1);
    this.setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  nextMonth() {
    const [year, month] = this.selectedYearMonth.split('-').map(Number);
    const d = new Date(year, month, 1);
    this.setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  closeModal() {
    const modal = document.getElementById('recurring-modal');
    if (modal) modal.classList.remove('active');
  }

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

window.Recurring = new RecurringManager();
