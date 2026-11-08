/**
 * Tasks, Projects & Notes Module
 * Handles active tasks, email inbox trackers, project updates, and historical notes.
 */

class TasksManager {
  constructor() {
    this.currentFilter = 'all'; // 'all', 'active', 'done'
    this.notesSearch = '';
  }

  getDefaultData() {
    return {
      version: '1.0',
      last_sync: new Date().toISOString(),
      email_inbox: {
        waiting_count: 3,
        urgent_count: 1,
        last_reviewed: new Date().toISOString().split('T')[0],
        notes: 'Reply to server provider inquiry; finalize domain transfer.'
      },
      projects: [
        {
          id: 'proj-1',
          name: 'Home Infrastructure & Fiber Upgrade',
          needs_update: true,
          last_update: '2026-10-24',
          notes: 'Schedule ISP technician appointment for router replacement.',
          status: 'active'
        },
        {
          id: 'proj-2',
          name: 'Kreier GitHub Organization Clean-up',
          needs_update: true,
          last_update: '2026-10-18',
          notes: 'Review stale repositories, archive inactive 2019 repos.',
          status: 'active'
        },
        {
          id: 'proj-3',
          name: 'Tax & Annual Maintenance Audit',
          needs_update: false,
          last_update: '2026-11-02',
          notes: 'All receipts backed up to Google Drive folder.',
          status: 'active'
        }
      ],
      active_tasks: [
        {
          id: 't-1',
          title: 'Review November apartment maintenance receipt',
          priority: 'high',
          category: 'Finance',
          status: 'todo',
          due_date: '2026-11-10',
          created_at: '2026-11-06'
        },
        {
          id: 't-2',
          title: 'Answer outstanding partner emails',
          priority: 'high',
          category: 'Email',
          status: 'todo',
          due_date: '2026-11-08',
          created_at: '2026-11-07'
        },
        {
          id: 't-3',
          title: 'Sync iCloud notes archive to Google Drive',
          priority: 'medium',
          category: 'Organization',
          status: 'todo',
          due_date: '2026-11-15',
          created_at: '2026-11-05'
        },
        {
          id: 't-4',
          title: 'Automated GitHub Actions statistics test',
          priority: 'low',
          category: 'Code',
          status: 'done',
          due_date: '2026-11-08',
          created_at: '2026-11-08'
        }
      ],
      historical_notes: [
        {
          id: 'note-20180307',
          date: '2018-03-07',
          title: 'First iCloud To-Do Master List',
          content: 'Foundational checklist migrated from paper planner into Apple Notes. Focus areas: rent schedule, study goals, coding projects.',
          tags: ['origin', 'icloud', 'milestone']
        },
        {
          id: 'note-20200512',
          date: '2020-05-12',
          title: 'Remote Work & Recurring Bills Setup',
          content: 'Set up recurring monthly checklist for apartment internet, maintenance, and utility bills.',
          tags: ['recurring', 'bills']
        },
        {
          id: 'note-20230101',
          date: '2023-01-01',
          title: '5-Year Organization Retrospective',
          content: 'Reviewed 5 years of tracking tasks since 2018. Over 1,500 items completed.',
          tags: ['retrospective', 'milestone']
        }
      ]
    };
  }

  renderAll() {
    this.renderEmailInboxWidget();
    this.renderProjectsWidget();
    this.renderActiveTasks();
    this.renderHistoricalNotes();
  }

  // --- Email Inbox Tracker ---
  renderEmailInboxWidget() {
    const data = window.App?.getPrivateData()?.email_inbox;
    if (!data) return;

    const countEl = document.getElementById('email-waiting-count');
    const urgentEl = document.getElementById('email-urgent-count');
    const notesEl = document.getElementById('email-tracker-notes');
    const reviewedEl = document.getElementById('email-last-reviewed');

    if (countEl) countEl.textContent = data.waiting_count ?? 0;
    if (urgentEl) urgentEl.textContent = data.urgent_count ?? 0;
    if (notesEl) notesEl.value = data.notes || '';
    if (reviewedEl) reviewedEl.textContent = data.last_reviewed || 'Today';
  }

  adjustEmailCount(delta) {
    const data = window.App?.getPrivateData();
    if (!data || !data.email_inbox) return;

    data.email_inbox.waiting_count = Math.max(0, (data.email_inbox.waiting_count || 0) + delta);
    data.email_inbox.last_reviewed = new Date().toISOString().split('T')[0];
    window.App?.savePrivateData();
    this.renderEmailInboxWidget();
  }

  saveEmailNotes() {
    const data = window.App?.getPrivateData();
    if (!data || !data.email_inbox) return;

    const notesEl = document.getElementById('email-tracker-notes');
    if (notesEl) {
      data.email_inbox.notes = notesEl.value.trim();
      data.email_inbox.last_reviewed = new Date().toISOString().split('T')[0];
      window.App?.savePrivateData();
      window.App?.showToast('Email notes updated.', 'info');
    }
  }

  // --- Projects Needing Updates ---
  renderProjectsWidget() {
    const container = document.getElementById('projects-list-container');
    if (!container) return;

    const data = window.App?.getPrivateData();
    const projects = data?.projects || [];

    if (projects.length === 0) {
      container.innerHTML = `<div class="empty-state"><p>No projects registered yet.</p></div>`;
      return;
    }

    container.innerHTML = projects.map(p => {
      return `
        <div class="project-item ${p.needs_update ? 'needs-update' : ''}" data-id="${p.id}">
          <div class="project-header">
            <span class="project-name">${this.escapeHtml(p.name)}</span>
            <button class="badge-toggle ${p.needs_update ? 'badge-danger' : 'badge-subtle'}" 
                    onclick="Tasks.toggleProjectNeedsUpdate('${p.id}')">
              ${p.needs_update ? '⚠️ Needs Update' : '✓ Up to date'}
            </button>
          </div>
          <p class="project-notes">${this.escapeHtml(p.notes || 'No current notes')}</p>
          <div class="project-footer">
            <span class="text-muted">Last updated: ${p.last_update || 'N/A'}</span>
            <div class="btn-group-sm">
              <button class="btn btn-xs btn-ghost" onclick="Tasks.editProjectNotes('${p.id}')">Edit</button>
              <button class="btn btn-xs btn-ghost text-danger" onclick="Tasks.deleteProject('${p.id}')">Delete</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  toggleProjectNeedsUpdate(projId) {
    const data = window.App?.getPrivateData();
    const proj = data?.projects?.find(p => p.id === projId);
    if (!proj) return;

    proj.needs_update = !proj.needs_update;
    if (!proj.needs_update) {
      proj.last_update = new Date().toISOString().split('T')[0];
    }
    window.App?.savePrivateData();
    this.renderProjectsWidget();
  }

  addNewProject() {
    const name = prompt('Enter project name:');
    if (!name || !name.trim()) return;

    const notes = prompt('Enter notes / tasks needed for this project:') || '';
    const data = window.App?.getPrivateData();
    if (!data.projects) data.projects = [];

    data.projects.push({
      id: 'proj-' + Date.now(),
      name: name.trim(),
      needs_update: true,
      last_update: new Date().toISOString().split('T')[0],
      notes: notes.trim(),
      status: 'active'
    });

    window.App?.savePrivateData();
    this.renderProjectsWidget();
    window.App?.showToast('Project added.', 'success');
  }

  editProjectNotes(projId) {
    const data = window.App?.getPrivateData();
    const proj = data?.projects?.find(p => p.id === projId);
    if (!proj) return;

    const newNotes = prompt(`Update notes for "${proj.name}":`, proj.notes);
    if (newNotes !== null) {
      proj.notes = newNotes.trim();
      proj.last_update = new Date().toISOString().split('T')[0];
      window.App?.savePrivateData();
      this.renderProjectsWidget();
    }
  }

  deleteProject(projId) {
    if (!confirm('Delete this project?')) return;
    const data = window.App?.getPrivateData();
    if (!data || !data.projects) return;

    data.projects = data.projects.filter(p => p.id !== projId);
    window.App?.savePrivateData();
    this.renderProjectsWidget();
  }

  // --- Active Tasks List ---
  renderActiveTasks() {
    const container = document.getElementById('active-tasks-container');
    if (!container) return;

    const data = window.App?.getPrivateData();
    const tasks = data?.active_tasks || [];

    const filtered = tasks.filter(t => {
      if (this.currentFilter === 'active') return t.status !== 'done';
      if (this.currentFilter === 'done') return t.status === 'done';
      return true;
    });

    if (filtered.length === 0) {
      container.innerHTML = `<div class="empty-state"><p>No tasks found in this view.</p></div>`;
      return;
    }

    container.innerHTML = filtered.map(t => {
      const isDone = t.status === 'done';
      return `
        <div class="task-row ${isDone ? 'is-done' : ''}" data-id="${t.id}">
          <input type="checkbox" class="task-checkbox" ${isDone ? 'checked' : ''} onchange="Tasks.toggleTaskStatus('${t.id}')">
          <div class="task-info">
            <span class="task-text">${this.escapeHtml(t.title)}</span>
            <div class="task-badges">
              ${t.category ? `<span class="badge badge-subtle">${this.escapeHtml(t.category)}</span>` : ''}
              ${t.priority ? `<span class="badge badge-priority-${t.priority}">${t.priority}</span>` : ''}
              ${t.due_date ? `<span class="task-due-date">📅 Due ${t.due_date}</span>` : ''}
            </div>
          </div>
          <button class="btn btn-xs btn-ghost text-danger" onclick="Tasks.deleteTask('${t.id}')" title="Delete">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      `;
    }).join('');
  }

  toggleTaskStatus(taskId) {
    const data = window.App?.getPrivateData();
    const task = data?.active_tasks?.find(t => t.id === taskId);
    if (!task) return;

    task.status = task.status === 'done' ? 'todo' : 'done';
    window.App?.savePrivateData();
    this.renderActiveTasks();
  }

  addNewTaskFromForm() {
    const input = document.getElementById('new-task-input');
    const prioritySelect = document.getElementById('new-task-priority');
    const categoryInput = document.getElementById('new-task-category');
    const dueDateInput = document.getElementById('new-task-duedate');

    if (!input || !input.value.trim()) return;

    const data = window.App?.getPrivateData();
    if (!data.active_tasks) data.active_tasks = [];

    data.active_tasks.unshift({
      id: 't-' + Date.now(),
      title: input.value.trim(),
      priority: prioritySelect?.value || 'medium',
      category: categoryInput?.value.trim() || 'General',
      status: 'todo',
      due_date: dueDateInput?.value || null,
      created_at: new Date().toISOString().split('T')[0]
    });

    input.value = '';
    window.App?.savePrivateData();
    this.renderActiveTasks();
    window.App?.showToast('Task added.', 'success');
  }

  deleteTask(taskId) {
    const data = window.App?.getPrivateData();
    if (!data || !data.active_tasks) return;

    data.active_tasks = data.active_tasks.filter(t => t.id !== taskId);
    window.App?.savePrivateData();
    this.renderActiveTasks();
  }

  setTaskFilter(filter) {
    this.currentFilter = filter;
    document.querySelectorAll('.task-filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    this.renderActiveTasks();
  }

  // --- Historical Notes Archive (since 2018-03-07) ---
  renderHistoricalNotes() {
    const container = document.getElementById('notes-archive-container');
    if (!container) return;

    const data = window.App?.getPrivateData();
    const notes = data?.historical_notes || [];

    const q = this.notesSearch.toLowerCase();
    const filtered = notes.filter(n => {
      if (!q) return true;
      return (n.title && n.title.toLowerCase().includes(q)) ||
             (n.content && n.content.toLowerCase().includes(q)) ||
             (n.tags && n.tags.some(t => t.toLowerCase().includes(q)));
    });

    if (filtered.length === 0) {
      container.innerHTML = `<div class="empty-state"><p>No notes matching "${this.escapeHtml(this.notesSearch)}".</p></div>`;
      return;
    }

    container.innerHTML = filtered.map(n => `
      <div class="note-card">
        <div class="note-header">
          <span class="note-date">🗓️ ${n.date || '2018-03-07'}</span>
          <div class="note-tags">
            ${(n.tags || []).map(t => `<span class="badge badge-subtle">#${this.escapeHtml(t)}</span>`).join('')}
          </div>
        </div>
        <h4 class="note-title">${this.escapeHtml(n.title)}</h4>
        <div class="note-content">${this.escapeHtml(n.content)}</div>
      </div>
    `).join('');
  }

  filterNotes(query) {
    this.notesSearch = query;
    this.renderHistoricalNotes();
  }

  addNewNote() {
    const title = prompt('Note title:');
    if (!title || !title.trim()) return;

    const date = prompt('Date (YYYY-MM-DD):', new Date().toISOString().split('T')[0]) || new Date().toISOString().split('T')[0];
    const content = prompt('Content / details:') || '';
    const tagsStr = prompt('Tags (comma-separated):', 'general') || 'general';

    const data = window.App?.getPrivateData();
    if (!data.historical_notes) data.historical_notes = [];

    data.historical_notes.unshift({
      id: 'note-' + Date.now(),
      date,
      title: title.trim(),
      content: content.trim(),
      tags: tagsStr.split(',').map(s => s.trim()).filter(Boolean)
    });

    window.App?.savePrivateData();
    this.renderHistoricalNotes();
    window.App?.showToast('Note saved.', 'success');
  }

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

window.Tasks = new TasksManager();
