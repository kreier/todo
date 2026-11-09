#!/usr/bin/env python3
"""
import_icloud_notes.py
Utility script to import and parse exported Apple / iCloud notes (Markdown, HTML, or text)
dating back to 2018-03-07 into the structured format for Google Drive / ToDo browser app.
"""

import os
import sys
import json
import re
from datetime import datetime

def parse_note_file(file_path):
    filename = os.path.basename(file_path)
    with open(file_path, "r", encoding="utf-8", errors="replace") as f:
        content = f.read()

    lines = content.splitlines()
    title = ""

    # Detect title from first heading or line
    for raw_line in lines:
        line = raw_line.strip()
        if not line:
            continue
        if line.startswith("# "):
            title = re.sub(r"^#+\s*", "", line).strip()
            break
        elif not title and not line.startswith("---") and not line.startswith(">") and not re.match(r"^[-*]\s*\[", line):
            title = line
            break

    if not title:
        title = os.path.splitext(filename)[0]

    # Try to detect date from content or filename (e.g. YYYY-MM-DD)
    date_match = re.search(r'\b(20\d\d[-/]\d\d[-/]\d\d)\b', content)
    if not date_match:
        date_match = re.search(r'\b(20\d\d[-/]\d\d[-/]\d\d)\b', filename)
    
    note_date = date_match.group(1).replace('/', '-') if date_match else "2018-03-07"
    
    # Extract checkboxes or todo items if any
    todos = []
    tags = set()
    for line in lines:
        stripped = line.strip()
        # Markdown checkbox format: - [ ] or - [x]
        m = re.match(r'^[-*+]\s*\[([ xX])\]\s*(.+)$', stripped)
        if m:
            is_done = m.group(1).lower() == 'x'
            todos.append({"text": m.group(2).strip(), "done": is_done})
        elif stripped.startswith("☐ ") or stripped.startswith("☑ "):
            is_done = stripped.startswith("☑ ")
            todos.append({"text": stripped[2:].strip(), "done": is_done})

    # Hashtags
    for h in re.findall(r'#[a-zA-Z0-9_\-]+', content):
        if not h.startswith('#http') and 2 < len(h) < 25:
            tags.add(h[1:].lower())
    tags.add("apple-notes")

    return {
        "id": f"note-{abs(hash(filename + title + note_date)) % 100000000}",
        "filename": filename,
        "title": title,
        "date": note_date,
        "content": content,
        "todos": todos,
        "tags": list(tags)
    }

def process_directory(dir_path):
    notes = []
    supported_exts = ('.txt', '.md', '.markdown', '.html', '.htm')
    
    for root, _, files in os.walk(dir_path):
        for f in sorted(files):
            if f.lower().endswith(supported_exts):
                full_path = os.path.join(root, f)
                try:
                    parsed = parse_note_file(full_path)
                    notes.append(parsed)
                except Exception as e:
                    print(f"Error parsing {f}: {e}", file=sys.stderr)
                    
    # Sort notes by date ascending
    notes.sort(key=lambda x: x.get("date", "2018-03-07"))
    return notes

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 import_icloud_notes.py <directory_of_notes_or_file> [output_file.json]")
        print("Example: python3 import_icloud_notes.py ~/Downloads/171_Apple_Notes kreier_todo_data.json")
        sys.exit(0)

    input_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else "notes_archive.json"

    if os.path.isfile(input_path):
        notes = [parse_note_file(input_path)]
    elif os.path.isdir(input_path):
        notes = process_directory(input_path)
    else:
        print(f"Path does not exist: {input_path}")
        sys.exit(1)

    # Extract open tasks from notes
    open_tasks = []
    for note in notes:
        for todo in note.get("todos", []):
            if not todo.get("done"):
                open_tasks.append({
                    "id": f"t-imp-{abs(hash(todo['text'] + note['date'])) % 100000000}",
                    "title": todo["text"],
                    "priority": "medium",
                    "category": "Imported",
                    "status": "todo",
                    "due_date": None,
                    "created_at": note["date"],
                    "source_note": note["title"]
                })

    payload = {
        "version": "1.0",
        "last_sync": datetime.now().isoformat(),
        "notes_count": len(notes),
        "open_tasks_count": len(open_tasks),
        "historical_notes": notes,
        "active_tasks": open_tasks
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)

    print(f"✓ Successfully processed {len(notes)} notes and extracted {len(open_tasks)} open tasks into {output_path}")

if __name__ == "__main__":
    main()
