// A container to hold all our notes
const notesContainer = document.createElement('div');
notesContainer.id = 'notes-container';
document.body.appendChild(notesContainer);

// Main button to show/hide notes
const viewNotesBtn = document.createElement('button');
viewNotesBtn.textContent = '🗒️';
viewNotesBtn.style.cssText = 'position: fixed; bottom: 20px; left: 20px; z-index: 10001; background-color: #f9e1a8; color: white; border: none; border-radius: 50%; width: 50px; height: 50px; font-size: 24px; cursor: pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.2);';
document.body.appendChild(viewNotesBtn);

// "Plus" button to create a new note
const addNoteBtn = document.createElement('button');
addNoteBtn.id = 'add-note-btn';
addNoteBtn.textContent = '+';
document.body.appendChild(addNoteBtn);

// Colours
const pastelColors = ['#f9e1a8', '#d6e5bd', '#ffcbe1', '#bcd8ec', '#dcccec', '#ffdab4'];
const defaultColor = pastelColors[0];

function darkenColor(hex, percent) {
    hex = hex.replace('#', '');
    let r = parseInt(hex.substring(0, 2), 16);
    let g = parseInt(hex.substring(2, 4), 16);
    let b = parseInt(hex.substring(4, 6), 16);
    r = Math.floor(r * (1 - percent / 100));
    g = Math.floor(g * (1 - percent / 100));
    b = Math.floor(b * (1 - percent / 100));
    const toHex = c => ('0' + c.toString(16)).slice(-2);
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}


// CORE FUNCTIONS

const createStickyNoteElement = (noteId, noteData) => {
    const stickyNote = document.createElement('div');
    stickyNote.className = 'sticky-note';
    stickyNote.dataset.noteId = noteId;

    const noteColor = noteData.color || defaultColor;
    stickyNote.dataset.color = noteColor;
    stickyNote.style.backgroundColor = noteColor;

    stickyNote.style.display = 'block';
    stickyNote.innerHTML = `
        <div class="sticky-note-header">
            <div class="color-palette"></div>
            <span class="close-sticky-note">×</span>
        </div>
        <div class="sticky-note-content">
            <textarea class="sticky-note-text" placeholder="Your note...">${noteData.text || ''}</textarea>
            <input type="text" class="sticky-note-tags" placeholder="#add #tags" value="${(noteData.tags || []).join(' ')}">
        </div>
    `;

    const header = stickyNote.querySelector('.sticky-note-header');
    header.style.backgroundColor = darkenColor(noteColor, 10);

    const paletteContainer = stickyNote.querySelector('.color-palette');
    pastelColors.forEach(color => {
        const swatch = document.createElement('div');
        swatch.className = 'color-swatch';
        swatch.style.backgroundColor = color;
        swatch.dataset.hex = color;
        if (color === noteColor) {
            swatch.classList.add('selected');
        }
        paletteContainer.appendChild(swatch);
    });

    stickyNote.style.top = noteData.top || `${Math.floor(Math.random() * 20) + 20}px`;
    stickyNote.style.left = noteData.left || `${Math.floor(Math.random() * 20) + 20}px`;

    notesContainer.appendChild(stickyNote);
    addNoteEventListeners(stickyNote);
};

const addNoteEventListeners = (stickyNote) => {
    const noteId = stickyNote.dataset.noteId;
    const noteText = stickyNote.querySelector('.sticky-note-text');
    const noteTags = stickyNote.querySelector('.sticky-note-tags');
    const header = stickyNote.querySelector('.sticky-note-header');
    const closeButton = stickyNote.querySelector('.close-sticky-note');

    // Helper function for AI
    const handleAiCommand = (command) => {
        noteText.value = `🤖 Thinking about "${command}"...`;
        noteText.disabled = true;

        chrome.runtime.sendMessage({
            action: 'getAiResponse',
            command: command
        }, (response) => {
            if (chrome.runtime.lastError || !response) {
                noteText.value = 'Error: Could not get a response.';
            } else {
                noteText.value = response.text;
            }
            noteText.disabled = false;
            noteText.dispatchEvent(new Event('input', { bubbles: true }));
        });
    };

    noteText.addEventListener('keyup', (e) => {
        const text = noteText.value;
        if (!text.startsWith('/')) {
            return;
        }

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const command = text.substring(1).trim();
            if (command) {
                handleAiCommand(command);
            }
        }
    });

    // Event listeners
    stickyNote.querySelectorAll('.color-swatch').forEach(swatch => {
        swatch.addEventListener('click', (e) => {
            e.stopPropagation();
            const newColor = e.currentTarget.dataset.hex;
            stickyNote.style.backgroundColor = newColor;
            header.style.backgroundColor = darkenColor(newColor, 10);
            stickyNote.dataset.color = newColor;

            if (stickyNote.querySelector('.color-swatch.selected')) {
               stickyNote.querySelector('.color-swatch.selected').classList.remove('selected');
            }
            e.currentTarget.classList.add('selected');
            autoSave(false);
        });
    });

    let saveTimeout;
    const autoSave = (isPositionChange = false) => {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            if (!chrome.runtime?.id) return;
            const text = noteText.value.trim();
            if (!text && !isPositionChange) {
                chrome.storage.local.remove(noteId, () => {
                    if (chrome.runtime.lastError) return;
                    chrome.runtime.sendMessage({ action: 'noteSaved' });
                    stickyNote.remove();
                });
                return;
            }
            chrome.storage.local.get(noteId, (result) => {
                if (chrome.runtime.lastError) return;
                const noteData = {
                    text: noteText.value.trim(),
                    tags: noteTags.value.trim().toLowerCase().split(/\s+/).filter(tag => tag.startsWith('#') && tag.length > 1),
                    url: window.location.href,
                    top: stickyNote.style.top,
                    left: stickyNote.style.left,
                    color: stickyNote.dataset.color || defaultColor,
                };
                chrome.storage.local.set({ [noteId]: noteData }, () => {
                    if (chrome.runtime.lastError) return;
                    chrome.runtime.sendMessage({ action: 'noteSaved' });
                });
            });
        }, isPositionChange ? 100 : 750);
    };
    noteText.addEventListener('input', () => autoSave(false));
    noteTags.addEventListener('input', () => autoSave(false));

    closeButton.addEventListener('click', () => {
        if (!chrome.runtime?.id) {
            stickyNote.remove();
            return;
        }
        chrome.storage.local.remove(noteId, () => {
            if (chrome.runtime.lastError) return;
            stickyNote.remove();
            chrome.runtime.sendMessage({ action: 'noteSaved' });
        });
    });

    let isDragging = false;
    let offsetX, offsetY;
    header.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('color-swatch')) return;
        isDragging = true;
        offsetX = e.clientX - stickyNote.offsetLeft;
        offsetY = e.clientY - stickyNote.offsetTop;
        stickyNote.style.zIndex = 10001;
        document.body.style.userSelect = 'none';
    });
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        stickyNote.style.left = `${e.clientX - offsetX}px`;
        stickyNote.style.top = `${e.clientY - offsetY}px`;
    });
    document.addEventListener('mouseup', () => {
        if (!isDragging) return;
        isDragging = false;
        stickyNote.style.zIndex = 10000;
        document.body.style.userSelect = 'auto';
        autoSave(true);
    });
};

addNoteBtn.addEventListener('click', () => {
    const noteId = `note_${Date.now()}`;
    createStickyNoteElement(noteId, {});
});

viewNotesBtn.addEventListener('click', () => {
    const isVisible = notesContainer.classList.toggle('visible');
    addNoteBtn.classList.toggle('visible', isVisible);

    if (isVisible) {
        notesContainer.innerHTML = '';
        chrome.storage.local.get(null, (items) => {
            for (const [key, note] of Object.entries(items)) {
                if (key.startsWith('note_') && note.url === window.location.href) {
                    createStickyNoteElement(key, note);
                }
            }
        });
    }
});
