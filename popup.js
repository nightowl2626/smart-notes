document.addEventListener('DOMContentLoaded', () => {
    const folderView = document.getElementById('folder-view');
    const notesView = document.getElementById('notes-view');
    const folderContainer = document.getElementById('folder-container');
    const notesContainer = document.getElementById('notes-list');
    const notesViewTitle = document.getElementById('notes-view-title');
    const backButton = document.getElementById('back-to-folders');

    const pastelColors = ['#fff1f1', '#f0f8ff', '#f0fff0', '#fffacd', '#ffe4e1', '#e6e6fa'];
    const defaultColor = pastelColors[0];

    let allNotes = [];

    const initialize = () => {
        chrome.storage.local.get(null, (items) => {
            const notes = [];
            for (const [key, value] of Object.entries(items)) {
                if (key.startsWith('note_') && typeof value === 'object' && value.hasOwnProperty('tags')) {
                    const sanitizedNote = {
                        id: key,
                        ...value,
                        color: value.color || defaultColor,
                        tags: (Array.isArray(value.tags) ? value.tags : [])
                            .map(tag => typeof tag === 'string' ? tag.trim() : '')
                            .filter(tag => tag.startsWith('#') && tag.length > 1)
                    };
                    notes.push(sanitizedNote);
                }
            }
            allNotes = notes;
            displayFolderView();
        });
    };

    const displayFolderView = () => {
        folderContainer.innerHTML = '';
        const tags = new Set(allNotes.flatMap(note => note.tags || []));

        if (tags.size === 0) {
            folderContainer.innerHTML = '<p class="text-gray-500">No folders yet. Tag a note to begin.</p>';
        } else {
            tags.forEach(tag => {
                const folderElement = document.createElement('div');
                folderElement.className = 'bg-white p-3 rounded-lg shadow cursor-pointer flex items-center justify-between hover:bg-gray-50';

                const firstNoteForTag = allNotes.find(note => (note.tags || []).map(t=>t.toLowerCase()).includes(tag.toLowerCase()));
                const folderColor = firstNoteForTag ? firstNoteForTag.color : '#A9A9A9';

                folderElement.innerHTML = `
                    <div class="flex items-center flex-grow">
                        <svg class="w-6 h-6 mr-3" style="color: ${folderColor}" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"></path></svg>
                        <span class="font-semibold text-gray-700">${tag}</span>
                    </div>
                    <button class="delete-folder-btn text-gray-400 hover:text-red-600 font-bold text-lg p-1" title="Delete Folder">&times;</button>
                `;

                folderElement.querySelector('.flex-grow').addEventListener('click', () => displayNotesForTag(tag));

                folderElement.querySelector('.delete-folder-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (confirm(`Delete the "${tag}" folder?\n\nThis will remove the tag from all associated notes. The notes themselves will not be deleted.`)) {
                        removeTagFromNotes(tag);
                    }
                });

                folderContainer.appendChild(folderElement);
            });
        }

        folderView.classList.remove('hidden');
        notesView.classList.add('hidden');
    };

    const displayNotesForTag = (tag) => {
        notesContainer.innerHTML = '';
        notesViewTitle.textContent = `Notes for ${tag}`;

        const notesForTag = allNotes.filter(note => {
            const noteTags = (note.tags || []).map(t => t.trim().toLowerCase());
            return noteTags.includes(tag.trim().toLowerCase());
        });

        if (notesForTag.length === 0) {
             notesContainer.innerHTML = '<p class="text-gray-500">No notes found for this tag.</p>';
        } else {
            notesForTag.forEach(note => {
                const noteElement = document.createElement('div');
                noteElement.className = 'bg-white p-4 rounded-lg shadow-sm';
                noteElement.style.borderLeft = `5px solid ${note.color || defaultColor}`;

                noteElement.innerHTML = `
                    <div class="flex justify-between items-start">
                        <p class="text-gray-800 mb-2 flex-grow pr-2 whitespace-pre-wrap">${note.text}</p>
                        <button class="delete-note-btn text-gray-400 hover:text-red-600 font-bold text-lg" title="Delete Note">&times;</button>
                    </div>
                    <div class="text-xs text-gray-500 border-t pt-2 mt-2">
                        <span class="font-semibold">Source:</span>
                        <a href="${note.url}" target="_blank" class="text-blue-600 hover:underline" title="${note.url}">
                            ${new URL(note.url).hostname.replace('www.', '')}
                        </a>
                    </div>
                `;

                noteElement.querySelector('.delete-note-btn').addEventListener('click', () => {
                    if (confirm('Are you sure you want to delete this note?')) {
                        chrome.storage.local.remove(note.id, () => {
                            initialize();
                            displayFolderView();
                        });
                    }
                });
                notesContainer.appendChild(noteElement);
            });
        }

        folderView.classList.add('hidden');
        notesView.classList.remove('hidden');
    };

    const removeTagFromNotes = (tagToRemove) => {
        const lowerCaseTagToRemove = tagToRemove.trim().toLowerCase();

        const updates = allNotes.map(note => {
            const originalTags = note.tags || [];
            const newTags = originalTags.filter(t => t.trim().toLowerCase() !== lowerCaseTagToRemove);

            if (newTags.length < originalTags.length) {
                const { id, ...noteValue } = note;
                noteValue.tags = newTags;
                return chrome.storage.local.set({ [id]: noteValue });
            }
            return Promise.resolve();
        });

        Promise.all(updates).then(() => {
            initialize();
        });
    };

    backButton.addEventListener('click', displayFolderView);

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'noteSaved') {
            initialize();
        }
    });

    initialize();
});
