#!/usr/bin/env python3
"""
import_icloud_notes.py
Utility script to import and parse exported iCloud notes (HTML, Markdown, or text)
dating back to 2018-03-07 into the structured format for Google Drive / ToDo browser app.
"""

import os
import sys
import json
import re
from datetime import datetime

def parse_note_file(file_path):
    filename = os.path.basename(file_path)
    title = os.path.splitext(filename)[0]
    
    with open(file_path, "r", encoding="utf-8", errors="replace") as f:
        content = f.read()

    # Try to detect date from content or filename (e.g. YYYY-MM-DD)
    date_match = re.search(r'\b(20\d\d[-/]\d\d[-/]\d\d)\b', content)
    if not date_match:
        date_match = re.search(r'\b(20\d\d[-/]\d\d[-/]\d\d)\b', filename)
    
    note_date = date_match.group(1).replace('/', '-') if date_match else "2018-03-07"
    
    # Extract checkboxes or todo items if any
    todos = []
    lines = content.splitlines()
    for line in lines:
        stripped = line.strip()
        # Markdown checkbox format: - [ ] or - [x]
        m = re.match(r'^[-\*]\s*\[([ xX])\]\s*(.+)$', stripped)
        if m:
            is_done = m.group(1).lower() == 'x'
            todos.append({"text": m.group(2).strip(), "done": is_done})
        elif stripped.startswith("☐ ") or stripped.startswith("☑ "):
            is_done = stripped.startswith("☑ ")
            todos.append({"text": stripped[2:].strip(), "done": is_done})

    return {
        "id": f"note-{abs(hash(filename + note_date)) % 100000000}",
        "title": title,
        "date": note_date,
        "content": content[:5000],  # sample text preview
        "todos": todos,
        "tags": ["icloud", "archive"]
    }

def process_directory(dir_path):
    notes = []
    supported_exts = ('.txt', '.md', '.html', '.htm')
    
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
        print("Example: python3 import_icloud_notes.py ~/Downloads/iCloudNotes notes_archive.json")
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

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump({"imported_at": datetime.now().isoformat(), "count": len(notes), "notes": notes}, f, indent=2, ensure_ascii=False)

    print(f"Imported {len(notes)} notes into {output_path}")

if __name__ == "__main__":
    main()
