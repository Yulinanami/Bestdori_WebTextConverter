# CLAUDE.md

Users' questions must be answered in Chinese.

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A BanG Dream! (Bestdori) story text converter - a Flask + vanilla JavaScript web application that converts script text into Bestdori-compatible JSON format. The tool simplifies story editing by automating character assignments, Live2D layout generation, and motion/expression configuration.

## Development Commands

### Running the Application
```bash
# Activate virtual environment (Windows)
.\.venv\Scripts\activate

# Activate virtual environment (Unix/Mac)
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start development server (opens browser automatically at http://127.0.0.1:5000)
python run.py
```

### Dependencies
- Flask 2.3.3 + Waitress WSGI server
- PyYAML for configuration
- python-docx and markdown2 for file parsing

## Architecture Overview

### Backend (Python/Flask)

**Entry Point**: `run.py` - Initializes Waitress WSGI server with auto-browser launch

**Application Factory**: `src/app.py:create_app()` - Creates Flask app with blueprints and configuration managers

**Core Components**:
- `src/converter.py` - `ProjectConverter` class converts project files to Bestdori JSON format
  - Handles character ID mapping (special characters 229, 337-341 map to different avatar IDs)
  - Processes talk actions (dialogue with speaker assignments)
  - Processes layout actions (Live2D character positioning: appear/move/disappear)
  - `QuoteHandler` strips configured quote pairs from dialogue text
- `src/config.py` - `ConfigManager` loads `config.yaml` with character/costume/motion/expression mappings
- `src/utils.py` - `FileFormatConverter` handles .txt/.docx/.md file uploads
- `src/models.py` - Dataclasses for `ConversionResult`, `ActionItem`, `LayoutActionItem`

**API Routes** (Blueprints in `src/routes/`):
- `/api/convert` - POST: Convert project file to Bestdori JSON
- `/api/upload` - POST: Upload and parse text files
- `/api/download` - POST: Generate downloadable JSON
- `/api/segment-text` - POST: Split text into dialogue segments
- `/api/config/*` - GET/POST/DELETE: Manage character/costume/position configurations
- `/api/shutdown` - POST: Gracefully shut down server

### Frontend (Vanilla JavaScript ESM)

**Entry Point**: `static/js/app.js` - Initializes all managers and binds UI events

**Architecture Pattern**: Service-oriented with manager classes and mixins

**Core Managers**:
- `stateManager.js` - Global state store (current result, config, costumes, project file)
- `viewManager.js` - Switches between classic/editor/batch views
- `navigationManager.js` - Multi-step wizard navigation for editor workflow
- `projectManager.js` - Imports/exports project files with full editing state
- `configManager.js` - Manages character name mappings, quote configurations
- `costumeManager.js` - Per-character costume lists and defaults
- `positionManager.js` - Default Live2D positions and offsets per character

**Editor Modules** (all use mixins from `static/js/mixins/`):
- `speakerEditor.js` - Drag-and-drop speaker assignment to dialogue cards
- `live2dEditor.js` - Drag characters to create appear/move/disappear layout actions
- `motionExpressionEditor.js` - Drag motion/expression IDs onto character states
- `expressionEditor.js` - Manages global and per-character motion/expression lists

**Services** (`static/js/services/`):
- `EventBus.js` - Publish/subscribe event system for cross-module communication
- `StorageService.js` - LocalStorage wrapper with quota management
- `ModalService.js` - Modal dialog management
- `ApiService.js` - Centralized API calls to Flask backend

**Key Mixins** (`static/js/mixins/`):
- `BaseEditorMixin.js` - Common editor initialization and rendering
- `EventHandlerMixin.js` - Drag-and-drop event handlers
- `CharacterListMixin.js` - Character list filtering and pinning
- `LayoutPropertyMixin.js` - Layout action property management

### Data Flow

1. **Text Input** → Backend parses text into segments → Frontend renders as dialogue cards
2. **Speaker Assignment** → User drags characters onto cards → Stored in project state
3. **Layout Generation** → User drags characters to create Live2D actions → Inserted in sequence
4. **Motion/Expression** → User drags IDs onto character states → Attached to actions
5. **Conversion** → Project file sent to `/api/convert` → `ProjectConverter` generates Bestdori JSON

### Configuration System

`config.yaml` is the master data file containing:
- `character_mapping` - Character names to IDs (1-40, plus special 229, 337-341)
- `costume_mapping` - Available costume IDs per character
- `default_costumes` - Default costume per character
- `character_motions` - Valid motion IDs per character
- `character_expressions` - Valid expression IDs per character
- `avatar_mapping` - Special character ID to avatar ID conversions
- `quotes.quote_pairs` - Quote characters to strip from dialogue
- `parsing` - Text parsing patterns and narrator name

User configurations are stored in browser LocalStorage:
- Character name aliases and mappings
- Per-character costume lists and defaults
- Per-character position preferences
- Custom quote pairs
- Project editing state

### Editor Workflow

The application uses a multi-step wizard approach in editor mode:

1. **Text Input** - Paste or upload script files
2. **Speaker Editor** - Assign characters to dialogue via drag-and-drop
3. **Live2D Editor** - Create character appearance/movement/exit actions
4. **Motion/Expression Editor** - Set motion/expression for each action
5. **Preview** - Review generated JSON before export

Navigation between steps is managed by `navigationManager.js` which tracks completion state and validates before proceeding.

## Important Notes

### Character ID System
- Most characters use IDs 1-40 corresponding to their avatar IDs
- Special characters (229, 337-341) require mapping to different avatar IDs (defined in `avatar_mapping`)
- `ProjectConverter._get_output_id()` handles this translation when generating Bestdori JSON

### Drag-and-Drop System
All editors use SortableJS for drag-and-drop with a consistent pattern:
- Right panel: Character/motion/expression lists (draggable)
- Left panel: Dialogue/layout cards (drop targets)
- Event handlers in mixins handle validation and state updates

### State Persistence
- User configurations auto-save to LocalStorage on changes
- Project files can be exported/imported for resume editing
- `StorageService` handles quota exceeded errors gracefully

### Bestdori JSON Format
The converter generates JSON with this structure:
```javascript
{
  "server": 0,
  "background": "...",
  "bgm": "...",
  "actions": [
    // Talk actions
    { "characters": [1,2], "name": "...", "body": "...", "motions": [...] },
    // Layout actions
    { "layoutType": "appear", "character": 1, "costume": "...", "sideFrom": "...", ... }
  ]
}
```
