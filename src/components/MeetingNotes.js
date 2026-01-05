import React, { useState, useEffect } from 'react';
import './MeetingNotes.css';

const MeetingNotes = ({ notes, onEdit, onDelete, onCreateFolder, onDeleteFolder, onMoveNote, onSelectedFolderChange }) => {
  const [expandedNote, setExpandedNote] = useState(null);
  const [filterLabel, setFilterLabel] = useState('');
  const [selectedFolder, setSelectedFolder] = useState('');
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [contextMenu, setContextMenu] = useState({ show: false, x: 0, y: 0, folderPath: '' });
  const [draggedNote, setDraggedNote] = useState(null);
  const [dragOverFolder, setDragOverFolder] = useState(null);

  const toggleExpand = (noteId) => {
    setExpandedNote(expandedNote === noteId ? null : noteId);
  };

  const toggleFolderTree = (folderPath) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderPath)) {
      newExpanded.delete(folderPath);
    } else {
      newExpanded.add(folderPath);
    }
    setExpandedFolders(newExpanded);
  };

  const selectFolder = (folderPath) => {
    setSelectedFolder(folderPath);
    // Notify parent of folder change
    if (onSelectedFolderChange) {
      onSelectedFolderChange(folderPath);
    }
  };

  // Get unique labels from notes
  const availableLabels = [...new Set(notes.map(note => note.label).filter(Boolean))].sort();

  // Filter notes by label (but always include .folder placeholder notes to preserve folder structure)
  const filteredNotes = filterLabel
    ? notes.filter(note => note.label === filterLabel || note.title === '.folder')
    : notes;

  // Build hierarchical folder structure
  // Always use all notes to build the folder tree so empty folders show up
  const buildFolderTree = (allNotes) => {
    const tree = { folders: {}, notes: [] };

    // Process all notes, including .folder placeholders
    allNotes.forEach(note => {
      const folderPath = note.folder || '';
      if (!folderPath) {
        // Only add non-folder notes to root
        if (note.title !== '.folder') {
          tree.notes.push(note);
        }
        return;
      }

      const parts = folderPath.split('/').filter(Boolean);
      let current = tree.folders;

      parts.forEach((part, index) => {
        const path = parts.slice(0, index + 1).join('/');
        if (!current[part]) {
          current[part] = { folders: {}, notes: [], path };
        }
        if (index === parts.length - 1) {
          // Last part - add note here (including .folder placeholders)
          current[part].notes.push(note);
        }
        current = current[part].folders;
      });
    });

    return tree;
  };

  // Sort folder tree
  const sortFolderTree = (tree) => {
    const sortedFolders = {};
    Object.keys(tree.folders).sort().forEach(key => {
      sortedFolders[key] = sortFolderTree(tree.folders[key]);
    });
    return {
      folders: sortedFolders,
      notes: tree.notes.sort((a, b) => {
        const dateA = new Date(a.date || a.createdAt);
        const dateB = new Date(b.date || b.createdAt);
        return dateB - dateA;
      }),
      path: tree.path
    };
  };

  // Build folder tree from all notes (to show all folders including empty ones)
  // But filter notes for display based on label filter
  const folderTree = sortFolderTree(buildFolderTree(notes));

  // Get notes and subfolders for the selected folder
  const getFolderContents = (tree, path) => {
    if (!path) {
      // Filter out .folder placeholder notes and apply label filter
      let displayNotes = tree.notes.filter(note => note.title !== '.folder');
      if (filterLabel) {
        displayNotes = displayNotes.filter(note => note.label === filterLabel);
      }
      return { notes: displayNotes, folders: Object.keys(tree.folders) };
    }

    const parts = path.split('/').filter(Boolean);
    let current = tree.folders;

    for (const part of parts) {
      if (!current[part]) {
        return { notes: [], folders: [] };
      }
      current = current[part].folders;
    }

    // Find the folder in the tree
    const folderName = parts[parts.length - 1];
    const parentParts = parts.slice(0, -1);
    let folderData = tree.folders;

    for (const part of parentParts) {
      folderData = folderData[part].folders;
    }

    if (folderData[folderName]) {
      // Filter out .folder placeholder notes and apply label filter
      let displayNotes = folderData[folderName].notes.filter(note => note.title !== '.folder');
      if (filterLabel) {
        displayNotes = displayNotes.filter(note => note.label === filterLabel);
      }
      return {
        notes: displayNotes,
        folders: Object.keys(folderData[folderName].folders)
      };
    }

    return { notes: [], folders: [] };
  };

  const currentFolderContents = getFolderContents(folderTree, selectedFolder);

  // Build breadcrumbs
  const breadcrumbs = selectedFolder
    ? ['', ...selectedFolder.split('/').filter(Boolean)]
    : [''];

  const navigateToPath = (index) => {
    let newPath = '';
    if (index > 0) {
      newPath = breadcrumbs.slice(1, index + 1).join('/');
    }
    setSelectedFolder(newPath);
    // Notify parent of folder change
    if (onSelectedFolderChange) {
      onSelectedFolderChange(newPath);
    }
  };

  // Handle folder creation
  const handleCreateFolder = () => {
    setNewFolderName('');
    setShowFolderModal(true);
  };

  const handleCreateFolderSubmit = async (e) => {
    e.preventDefault();
    if (!newFolderName.trim()) {
      alert('Folder name is required');
      return;
    }

    // Build full folder path
    const folderPath = selectedFolder
      ? `${selectedFolder}/${newFolderName.trim()}`
      : newFolderName.trim();

    if (onCreateFolder) {
      await onCreateFolder(folderPath);
    }
    setShowFolderModal(false);
    setNewFolderName('');
  };

  // Handle right-click context menu
  const handleContextMenu = (e, folderPath = '') => {
    e.preventDefault();
    setContextMenu({
      show: true,
      x: e.clientX,
      y: e.clientY,
      folderPath: folderPath,
    });
  };

  const handleContextMenuClose = () => {
    setContextMenu({ show: false, x: 0, y: 0, folderPath: '' });
  };

  const handleContextMenuCreateFolder = () => {
    setNewFolderName('');
    setShowFolderModal(true);
    handleContextMenuClose();
  };

  // Check if a folder is empty (only contains .folder placeholder notes)
  const isFolderEmpty = (folderPath) => {
    const folderContents = getFolderContents(folderTree, folderPath);
    // Check if folder has any real notes (excluding .folder placeholders)
    const hasNotes = folderContents.notes.length > 0;
    if (hasNotes) return false;

    // Check recursively if any subfolders have items
    const checkSubfolders = (path) => {
      const contents = getFolderContents(folderTree, path);
      // If this subfolder has notes, it's not empty
      if (contents.notes.length > 0) return true;
      // Check each subfolder recursively
      for (const subFolder of contents.folders) {
        const subFolderPath = path ? `${path}/${subFolder}` : subFolder;
        if (checkSubfolders(subFolderPath)) return true;
      }
      return false;
    };

    // Check if any subfolders have items
    return !checkSubfolders(folderPath);
  };

  const handleContextMenuDeleteFolder = async () => {
    const folderPath = contextMenu.folderPath;
    if (!folderPath) {
      alert('Cannot delete root folder');
      handleContextMenuClose();
      return;
    }

    // Check if folder is empty
    if (!isFolderEmpty(folderPath)) {
      alert('Cannot delete folder. Please remove all items and subfolders from the folder before deleting it.');
      handleContextMenuClose();
      return;
    }

    if (window.confirm(`Are you sure you want to delete the empty folder "${folderPath}"?`)) {
      if (onDeleteFolder) {
        await onDeleteFolder(folderPath);
      }
      handleContextMenuClose();
      // Navigate to parent folder or root
      const parts = folderPath.split('/').filter(Boolean);
      if (parts.length > 1) {
        setSelectedFolder(parts.slice(0, -1).join('/'));
      } else {
        setSelectedFolder('');
      }
    } else {
      handleContextMenuClose();
    }
  };

  // Close context menu on click outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu.show) {
        handleContextMenuClose();
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [contextMenu.show]);

  // Notify parent of selected folder changes
  useEffect(() => {
    if (onSelectedFolderChange) {
      onSelectedFolderChange(selectedFolder);
    }
  }, [selectedFolder, onSelectedFolderChange]);

  // Handle drag and drop
  const handleDragStart = (e, note) => {
    setDraggedNote(note);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', note.id);
    e.currentTarget.style.opacity = '0.5';
  };

  const handleDragEnd = (e) => {
    e.currentTarget.style.opacity = '1';
    setDraggedNote(null);
    setDragOverFolder(null);
  };

  const handleDragOver = (e, folderPath) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverFolder(folderPath);
  };

  const handleDragLeave = (e) => {
    // Only clear if we're actually leaving the drop zone
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverFolder(null);
    }
  };

  const handleDrop = async (e, targetFolderPath) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedNote) return;

    // Don't move if dropped on the same folder
    const currentFolder = draggedNote.folder || '';
    if (currentFolder === targetFolderPath) {
      setDragOverFolder(null);
      return;
    }

    // Move the note to the new folder
    if (onMoveNote) {
      await onMoveNote(draggedNote.id, targetFolderPath);
    }

    setDraggedNote(null);
    setDragOverFolder(null);
  };

  // Don't auto-expand folders - let users drill into them

  if (!notes || notes.length === 0) {
    return (
      <div className="meeting-notes-empty">
        <p>No notes yet. Create your first note to get started.</p>
      </div>
    );
  }

  return (
    <div className="notes-explorer">
      <div className="notes-explorer-sidebar">
        <div className="notes-explorer-header">
          <h3>Folders</h3>
          <button
            className="btn-new-folder"
            onClick={handleCreateFolder}
            title="Create New Folder"
          >
            + New Folder
          </button>
          {availableLabels.length > 0 && (
            <div className="notes-filter-inline">
              <select
                value={filterLabel}
                onChange={(e) => setFilterLabel(e.target.value)}
                className="notes-filter-select"
              >
                <option value="">All Types</option>
                {availableLabels.map(label => (
                  <option key={label} value={label}>{label}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="notes-folder-tree">
          <div
            className={`notes-folder-tree-item ${selectedFolder === '' ? 'selected' : ''} ${dragOverFolder === '' ? 'drag-over' : ''}`}
            onClick={() => selectFolder('')}
            onContextMenu={(e) => handleContextMenu(e, '')}
            onDragOver={(e) => handleDragOver(e, '')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, '')}
          >
            <span className="folder-icon">📁</span>
            <span className="folder-name">All Notes</span>
            <span className="folder-count">({filteredNotes.length})</span>
          </div>
          {Object.keys(folderTree.folders).map(folderName => (
            <FolderTreeItem
              key={folderName}
              folderName={folderName}
              folderData={folderTree.folders[folderName]}
              selectedFolder={selectedFolder}
              onSelect={selectFolder}
              onToggle={toggleFolderTree}
              expandedFolders={expandedFolders}
              level={0}
              onContextMenu={handleContextMenu}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              dragOverFolder={dragOverFolder}
            />
          ))}
        </div>
      </div>

      <div className="notes-explorer-content" onContextMenu={(e) => handleContextMenu(e, selectedFolder)}>
        {/* Breadcrumb navigation */}
        <div className="notes-breadcrumbs">
          {breadcrumbs.map((crumb, index) => (
            <React.Fragment key={index}>
              {index > 0 && <span className="breadcrumb-separator">/</span>}
              <button
                className={`breadcrumb-item ${index === breadcrumbs.length - 1 ? 'active' : ''}`}
                onClick={() => navigateToPath(index)}
              >
                {index === 0 ? 'All Notes' : crumb}
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* Current folder contents */}
        {currentFolderContents.notes.length === 0 && currentFolderContents.folders.length === 0 ? (
          <div className="meeting-notes-empty">
            <p>This folder is empty.</p>
          </div>
        ) : (
          <>
            {/* Subfolders */}
            {currentFolderContents.folders.length > 0 && (
              <div className="notes-folder-grid">
                {currentFolderContents.folders.map(folderName => {
                  const folderPath = selectedFolder
                    ? `${selectedFolder}/${folderName}`
                    : folderName;
                  // Get folder data to count items
                  const getFolderDataForCount = (path) => {
                    if (!path) return folderTree;
                    const parts = path.split('/').filter(Boolean);
                    let current = folderTree.folders;
                    for (const part of parts.slice(0, -1)) {
                      if (!current[part]) return { folders: {}, notes: [] };
                      current = current[part].folders;
                    }
                    return current[parts[parts.length - 1]] || { folders: {}, notes: [] };
                  };
                  const folderData = getFolderDataForCount(folderPath);
                  const totalCount = countItems(folderData, filterLabel);

                  return (
                    <div
                      key={folderName}
                      className={`notes-folder-card ${dragOverFolder === folderPath ? 'drag-over' : ''}`}
                      onClick={() => selectFolder(folderPath)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleContextMenu(e, folderPath);
                      }}
                      onDragOver={(e) => handleDragOver(e, folderPath)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, folderPath)}
                    >
                      <div className="folder-card-icon">📁</div>
                      <div className="folder-card-name">{folderName}</div>
                      <div className="folder-card-count">{totalCount} items</div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Notes in current folder */}
            {currentFolderContents.notes.length > 0 && (
              <div className="notes-list">
                {currentFolderContents.notes.map((note) => (
                  <div
                    key={note.id}
                    className="meeting-note-card"
                    draggable
                    onDragStart={(e) => handleDragStart(e, note)}
                    onDragEnd={handleDragEnd}
                  >
                    <div className="meeting-note-header" onClick={() => toggleExpand(note.id)}>
                      <div className="meeting-note-info">
                        <div className="meeting-note-title-row">
                          <h3 className="meeting-note-title">{note.title}</h3>
                          {note.label && (
                            <span className="note-label-badge">{note.label}</span>
                          )}
                        </div>
                        <p className="meeting-note-date">
                          {new Date(note.date || note.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </p>
                      </div>
                      <div className="meeting-note-actions">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit(note);
                          }}
                          className="btn-icon btn-edit"
                          title="Edit notes"
                        >
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M11.333 2.00004C11.5084 1.82468 11.7163 1.68605 11.9442 1.59231C12.1721 1.49857 12.4154 1.45166 12.6667 1.45471C12.9179 1.45776 13.1596 1.51069 13.3846 1.61004C13.6096 1.70939 13.8134 1.85314 13.9842 2.03337C14.155 2.2136 14.2894 2.4266 14.3799 2.65986C14.4704 2.89312 14.5151 3.14218 14.5113 3.39337C14.5075 3.64456 14.4553 3.8926 14.3578 4.12337C14.2603 4.35414 14.1195 4.56314 13.9427 4.73871L6.94267 11.7387L2.66667 13.3334L4.26133 9.05737L11.333 2.00004Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm('Are you sure you want to delete this note?')) {
                              onDelete(note.id);
                            }
                          }}
                          className="btn-icon btn-delete"
                          title="Delete note"
                        >
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M2 4H14M12.6667 4V13.3333C12.6667 13.687 12.5262 14.0262 12.2761 14.2762C12.0261 14.5263 11.6869 14.6667 11.3333 14.6667H4.66667C4.31305 14.6667 3.97391 14.5263 3.72386 14.2762C3.47381 14.0262 3.33333 13.687 3.33333 13.3333V4M5.33333 4V2.66667C5.33333 2.31305 5.47381 1.97391 5.72386 1.72386C5.97391 1.47381 6.31305 1.33333 6.66667 1.33333H9.33333C9.68696 1.33333 10.0261 1.47381 10.2761 1.72386C10.5262 1.97391 10.6667 2.31305 10.6667 2.66667V4M6.66667 7.33333V11.3333M9.33333 7.33333V11.3333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                    {expandedNote === note.id && (
                      <div className="meeting-note-content">
                        <div
                          className="meeting-note-text"
                          dangerouslySetInnerHTML={{ __html: note.content || '' }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu.show && (
        <div
          className="context-menu"
          style={{
            position: 'fixed',
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
            zIndex: 1000,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="context-menu-item"
            onClick={handleContextMenuCreateFolder}
          >
            New Folder
          </button>
          {contextMenu.folderPath && contextMenu.folderPath.trim() !== '' && (
            <button
              className="context-menu-item context-menu-item-danger"
              onClick={handleContextMenuDeleteFolder}
            >
              Delete Folder
            </button>
          )}
        </div>
      )}

      {/* Folder Creation Modal */}
      {showFolderModal && (
        <div className="modal-overlay" onClick={() => setShowFolderModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Create New Folder</h2>
            <form onSubmit={handleCreateFolderSubmit}>
              <div className="form-group">
                <label htmlFor="folderName">Folder Name</label>
                <input
                  type="text"
                  id="folderName"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Enter folder name"
                  autoFocus
                />
                {selectedFolder && (
                  <p className="folder-path-hint">
                    Will be created in: {selectedFolder || 'Root'}
                  </p>
                )}
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary">
                  Create
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowFolderModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Folder tree item component for sidebar
const FolderTreeItem = ({ folderName, folderData, selectedFolder, onSelect, onToggle, expandedFolders, level, onContextMenu, onDragOver, onDragLeave, onDrop, dragOverFolder }) => {
  const folderPath = folderData.path;
  const isExpanded = expandedFolders.has(folderPath);
  const isSelected = selectedFolder === folderPath;
  const hasSubfolders = Object.keys(folderData.folders).length > 0;
  const isDragOver = dragOverFolder === folderPath;

  return (
    <div className="notes-folder-tree-item-wrapper">
      <div
        className={`notes-folder-tree-item ${isSelected ? 'selected' : ''} ${isDragOver ? 'drag-over' : ''}`}
        style={{ paddingLeft: `${level * 1.25 + 0.75}rem` }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(folderPath);
        }}
        onContextMenu={(e) => {
          e.stopPropagation();
          if (onContextMenu) {
            onContextMenu(e, folderPath);
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (onDragOver) {
            onDragOver(e, folderPath);
          }
        }}
        onDragLeave={(e) => {
          e.stopPropagation();
          if (onDragLeave) {
            onDragLeave(e);
          }
        }}
        onDrop={(e) => {
          e.stopPropagation();
          if (onDrop) {
            onDrop(e, folderPath);
          }
        }}
      >
        {hasSubfolders && (
          <button
            className="folder-tree-toggle"
            onClick={(e) => {
              e.stopPropagation();
              onToggle(folderPath);
            }}
          >
            {isExpanded ? '▼' : '▶'}
          </button>
        )}
        {!hasSubfolders && <span className="folder-tree-spacer" />}
        <span className="folder-icon">📁</span>
        <span className="folder-name">{folderName}</span>
      </div>
      {isExpanded && hasSubfolders && (
        <div className="folder-tree-children">
          {Object.keys(folderData.folders).map(subFolderName => (
            <FolderTreeItem
              key={subFolderName}
              folderName={subFolderName}
              folderData={folderData.folders[subFolderName]}
              selectedFolder={selectedFolder}
              onSelect={onSelect}
              onToggle={onToggle}
              expandedFolders={expandedFolders}
              level={level + 1}
              onContextMenu={onContextMenu}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              dragOverFolder={dragOverFolder}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Helper function to count all items in a folder tree (excluding .folder placeholders)
const countItems = (folderData, labelFilter = '') => {
  let count = folderData.notes.filter(note => note.title !== '.folder').length;
  if (labelFilter) {
    count = folderData.notes.filter(note => note.title !== '.folder' && note.label === labelFilter).length;
  }
  Object.values(folderData.folders).forEach(subFolder => {
    count += countItems(subFolder, labelFilter);
  });
  return count;
};

// Recursive component for rendering nested folders
const FolderNode = ({ folderName, folderData, expandedFolders, toggleFolder, expandedNote, toggleExpand, onEdit, onDelete, level, parentPath = '' }) => {
  const folderPath = folderData.path;
  const isExpanded = expandedFolders.has(folderPath);
  const totalCount = countItems(folderData);
  const displayPath = parentPath ? `${parentPath} / ${folderName}` : folderName;

  return (
    <div className="notes-folder" style={{ marginLeft: `${level * 0.5}rem` }}>
      <div
        className="notes-folder-header"
        onClick={() => toggleFolder(folderPath)}
        title={displayPath}
      >
        <span className="folder-icon">
          {isExpanded ? '📂' : '📁'}
        </span>
        <span className="folder-name">{folderName}</span>
        <span className="folder-count">({totalCount})</span>
        <span className="folder-toggle">{isExpanded ? '▼' : '▶'}</span>
      </div>
      {isExpanded && (
        <div className="notes-folder-content">
          {/* Render notes in this folder */}
          {folderData.notes.map((note) => (
            <div key={note.id} className="meeting-note-card">
              <div className="meeting-note-header" onClick={() => toggleExpand(note.id)}>
                <div className="meeting-note-info">
                  <div className="meeting-note-title-row">
                    <h3 className="meeting-note-title">{note.title}</h3>
                    {note.label && (
                      <span className="note-label-badge">{note.label}</span>
                    )}
                  </div>
                  <p className="meeting-note-date">
                    {new Date(note.date || note.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
                <div className="meeting-note-actions">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(note);
                    }}
                    className="btn-icon btn-edit"
                    title="Edit notes"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M11.333 2.00004C11.5084 1.82468 11.7163 1.68605 11.9442 1.59231C12.1721 1.49857 12.4154 1.45166 12.6667 1.45471C12.9179 1.45776 13.1596 1.51069 13.3846 1.61004C13.6096 1.70939 13.8134 1.85314 13.9842 2.03337C14.155 2.2136 14.2894 2.4266 14.3799 2.65986C14.4704 2.89312 14.5151 3.14218 14.5113 3.39337C14.5075 3.64456 14.4553 3.8926 14.3578 4.12337C14.2603 4.35414 14.1195 4.56314 13.9427 4.73871L6.94267 11.7387L2.66667 13.3334L4.26133 9.05737L11.333 2.00004Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm('Are you sure you want to delete this note?')) {
                        onDelete(note.id);
                      }
                    }}
                    className="btn-icon btn-delete"
                    title="Delete note"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2 4H14M12.6667 4V13.3333C12.6667 13.687 12.5262 14.0262 12.2761 14.2762C12.0261 14.5263 11.6869 14.6667 11.3333 14.6667H4.66667C4.31305 14.6667 3.97391 14.5263 3.72386 14.2762C3.47381 14.0262 3.33333 13.687 3.33333 13.3333V4M5.33333 4V2.66667C5.33333 2.31305 5.47381 1.97391 5.72386 1.72386C5.97391 1.47381 6.31305 1.33333 6.66667 1.33333H9.33333C9.68696 1.33333 10.0261 1.47381 10.2761 1.72386C10.5262 1.97391 10.6667 2.31305 10.6667 2.66667V4M6.66667 7.33333V11.3333M9.33333 7.33333V11.3333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              </div>
              {expandedNote === note.id && (
                <div className="meeting-note-content">
                  <div
                    className="meeting-note-text"
                    dangerouslySetInnerHTML={{ __html: note.content || '' }}
                  />
                </div>
              )}
            </div>
          ))}

          {/* Recursively render subfolders */}
          {Object.keys(folderData.folders).map(subFolderName => (
            <FolderNode
              key={subFolderName}
              folderName={subFolderName}
              folderData={folderData.folders[subFolderName]}
              expandedFolders={expandedFolders}
              toggleFolder={toggleFolder}
              expandedNote={expandedNote}
              toggleExpand={toggleExpand}
              onEdit={onEdit}
              onDelete={onDelete}
              level={level + 1}
              parentPath={displayPath}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default MeetingNotes;

