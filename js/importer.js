/**
 * Apple Notes / Markdown Batch Parser & Importer
 * Parses batches of exported markdown notes (e.g., 171 Apple Notes),
 * extracting dates, titles, checkboxes/tasks, and tags.
 */

class MarkdownImporter {
  constructor() {
    this.parsedNotes = [];
    this.extractedTasks = [];
  }

  /**
   * Parse a single markdown note's text content
   */
  parseMarkdownContent(filename, text, fileModifiedTime = null) {
    const lines = text.split(/\r?\n/);
    let title = '';
    const todos = [];
    const tags = new Set();

    // 1. Extract title
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      if (line.startsWith('# ')) {
        title = line.replace(/^#+\s*/, '').trim();
        break;
      } else if (!title && !line.startsWith('---') && !line.startsWith('>') && !line.match(/^[-*]\s*\[/)) {
        title = line;
        break;
      }
    }
    if (!title) {
      title = filename.replace(/\.(md|markdown|txt)$/i, '');
    }

    // 2. Extract date
    // Look for explicit ISO dates like 2018-03-07 or 2018/03/07
    let date = null;
    const isoMatch = text.match(/\b(20\d\d[-/]\d\d[-/]\d\d)\b/);
    if (isoMatch) {
      date = isoMatch[1].replace(/\//g, '-');
    } else if (fileModifiedTime) {
      const d = new Date(fileModifiedTime);
      date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    } else {
      date = '2018-03-07'; // Inception fallback
    }

    // 3. Extract hashtags (#tag)
    const hashtagMatches = text.match(/#[a-zA-Z0-9_\-]+/g);
    if (hashtagMatches) {
      for (const h of hashtagMatches) {
        if (!h.startsWith('#http') && h.length > 2 && h.length < 25) {
          tags.add(h.substring(1).toLowerCase());
        }
      }
    }
    tags.add('apple-notes');

    // 4. Extract checkboxes & todo tasks
    for (const rawLine of lines) {
      const line = rawLine.trim();
      // Markdown: - [ ] or - [x] or * [ ] or * [x]
      const mdCheckMatch = line.match(/^[-*+]\s*\[([ xX])\]\s*(.+)$/);
      if (mdCheckMatch) {
        const isDone = mdCheckMatch[1].toLowerCase() === 'x';
        const taskText = mdCheckMatch[2].trim();
        todos.push({ text: taskText, done: isDone });
      } else if (line.startsWith('☐ ') || line.startsWith('☑ ')) {
        const isDone = line.startsWith('☑ ');
        const taskText = line.substring(2).trim();
        todos.push({ text: taskText, done: isDone });
      }
    }

    return {
      id: 'note-' + Math.abs(this.hashCode(filename + title + date)),
      filename,
      title,
      date,
      content: text,
      todos,
      tags: Array.from(tags)
    };
  }

  /**
   * Process a list of File objects (from directory upload or multiple file selection)
   */
  async processFiles(fileList, progressCallback = null) {
    this.parsedNotes = [];
    this.extractedTasks = [];

    const mdFiles = Array.from(fileList).filter(f => {
      const n = f.name.toLowerCase();
      return n.endsWith('.md') || n.endsWith('.markdown') || n.endsWith('.txt');
    });

    if (mdFiles.length === 0) {
      throw new Error('No markdown or text files found in the selected files/folder.');
    }

    const total = mdFiles.length;
    let completed = 0;

    for (const file of mdFiles) {
      const text = await this.readFileAsText(file);
      const parsed = this.parseMarkdownContent(file.name, text, file.lastModified);
      this.parsedNotes.push(parsed);

      // Collect any open tasks
      for (const todo of parsed.todos) {
        if (!todo.done) {
          this.extractedTasks.push({
            id: 't-imp-' + Math.abs(this.hashCode(todo.text + parsed.date)),
            title: todo.text,
            priority: 'medium',
            category: 'Imported',
            status: 'todo',
            due_date: null,
            created_at: parsed.date,
            source_note: parsed.title
          });
        }
      }

      completed++;
      if (progressCallback) {
        progressCallback(completed, total, file.name);
      }
    }

    // Sort notes chronologically
    this.parsedNotes.sort((a, b) => (a.date > b.date ? 1 : -1));

    return {
      totalNotes: this.parsedNotes.length,
      totalOpenTasks: this.extractedTasks.length,
      oldestDate: this.parsedNotes[0]?.date || '2018-03-07',
      newestDate: this.parsedNotes[this.parsedNotes.length - 1]?.date || '2026-11-09',
      notes: this.parsedNotes,
      tasks: this.extractedTasks
    };
  }

  readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
  }

  /**
   * Apply the parsed data into the application state
   */
  async applyToAppData({ addToArchive = true, extractTasks = true, uploadToDrive = false, driveProgressCallback = null }) {
    const data = window.App?.getPrivateData();
    if (!data) throw new Error('App state not loaded');

    if (!data.historical_notes) data.historical_notes = [];
    if (!data.active_tasks) data.active_tasks = [];

    let addedNotesCount = 0;
    let addedTasksCount = 0;

    if (addToArchive) {
      const existingIds = new Set(data.historical_notes.map(n => n.id));
      for (const note of this.parsedNotes) {
        if (!existingIds.has(note.id)) {
          data.historical_notes.push(note);
          existingIds.add(note.id);
          addedNotesCount++;
        }
      }
      data.historical_notes.sort((a, b) => (a.date < b.date ? 1 : -1));
    }

    if (extractTasks) {
      const existingTitles = new Set(data.active_tasks.map(t => t.title.toLowerCase().trim()));
      for (const task of this.extractedTasks) {
        if (!existingTitles.has(task.title.toLowerCase().trim())) {
          data.active_tasks.unshift(task);
          existingTitles.add(task.title.toLowerCase().trim());
          addedTasksCount++;
        }
      }
    }

    // Save locally
    window.App.saveLocalPrivateData();

    // Optionally upload individual markdown files to Google Drive 'import/' folder
    if (uploadToDrive && window.Auth?.isSignedIn() && window.Drive) {
      let uploadCount = 0;
      const totalUploads = this.parsedNotes.length;
      for (const note of this.parsedNotes) {
        try {
          await window.Drive.uploadMarkdownText(note.filename, note.content, true);
          uploadCount++;
          if (driveProgressCallback) {
            driveProgressCallback(uploadCount, totalUploads, note.filename);
          }
        } catch (e) {
          console.warn(`Failed to upload ${note.filename} to Drive:`, e);
        }
      }
    }

    // Save merged database to Drive
    await window.App.savePrivateData();
    window.App.renderAllViews();

    return { addedNotesCount, addedTasksCount };
  }

  hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
    }
    return hash;
  }
}

window.Importer = new MarkdownImporter();
