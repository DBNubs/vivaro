import React, { useState, useEffect } from 'react';
import './Resources.css';
import { handleExternalLinkClick } from '../utils/browser';

const Resources = ({ resources, onAddLink, onAddFile, onEdit, onDelete, onCreateFolder, onDeleteFolder, onMoveResource, onSelectedFolderChange }) => {
  const [showAddLinkForm, setShowAddLinkForm] = useState(false);
  const [showAddFileForm, setShowAddFileForm] = useState(false);
  const [newLink, setNewLink] = useState({
    title: '',
    url: '',
    description: '',
  });
  const [newFile, setNewFile] = useState({
    file: null,
    title: '',
    description: '',
  });
  const [uploading, setUploading] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderNameModal, setNewFolderNameModal] = useState('');
  const [contextMenu, setContextMenu] = useState({ show: false, x: 0, y: 0, folderPath: '' });
  const [draggedResource, setDraggedResource] = useState(null);
  const [dragOverFolder, setDragOverFolder] = useState(null);

  // Get unique folders from existing resources
  const existingFolders = [...new Set(resources.map(r => r.folder).filter(Boolean))].sort();

  const handleLinkSubmit = (e) => {
    e.preventDefault();
    if (!newLink.title.trim() || !newLink.url.trim()) {
      alert('Title and URL are required');
      return;
    }
    onAddLink(newLink);
    setNewLink({ title: '', url: '', description: '' });
    setShowAddLinkForm(false);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setNewFile({
        ...newFile,
        file: file,
        title: newFile.title || file.name, // Default to filename if no title set
      });
      setShowAddFileForm(true);
    }
  };

  const handleFileSubmit = async (e) => {
    e.preventDefault();
    if (!newFile.file) {
      alert('Please select a file');
      return;
    }
    if (!newFile.title.trim()) {
      alert('Title is required');
      return;
    }

    setUploading(true);
    try {
      await onAddFile(newFile.file, newFile.title, newFile.description, '');
      setNewFile({ file: null, title: '', description: '' });
      setShowAddFileForm(false);
    } catch (error) {
      alert('Failed to upload file. Please try again.');
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [selectedFolder, setSelectedFolder] = useState('');

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

  // Build hierarchical folder structure
  const buildFolderTree = (resources) => {
    const tree = { folders: {}, links: [], files: [] };

    resources.forEach(resource => {
      const folderPath = resource.folder || '';
      if (!folderPath) {
        if (resource.type === 'link') {
          tree.links.push(resource);
        } else if (resource.type === 'file') {
          tree.files.push(resource);
        }
        return;
      }

      const parts = folderPath.split('/').filter(Boolean);
      let current = tree.folders;

      parts.forEach((part, index) => {
        const path = parts.slice(0, index + 1).join('/');
        if (!current[part]) {
          current[part] = { folders: {}, links: [], files: [], path };
        }
        if (index === parts.length - 1) {
          // Last part - add resource here
          if (resource.type === 'link') {
            current[part].links.push(resource);
          } else if (resource.type === 'file') {
            current[part].files.push(resource);
          }
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
      links: tree.links,
      files: tree.files,
      path: tree.path
    };
  };

  const folderTree = sortFolderTree(buildFolderTree(resources));

  // Get resources and subfolders for the selected folder
  const getFolderContents = (tree, path) => {
    if (!path) {
      // Filter out .folder placeholder resources from display
      const displayLinks = tree.links.filter(resource => resource.title !== '.folder');
      const displayFiles = tree.files.filter(resource => resource.title !== '.folder');
      return { links: displayLinks, files: displayFiles, folders: Object.keys(tree.folders) };
    }

    const parts = path.split('/').filter(Boolean);
    let current = tree.folders;

    for (const part of parts) {
      if (!current[part]) {
        return { links: [], files: [], folders: [] };
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
      // Filter out .folder placeholder resources from display
      const displayLinks = folderData[folderName].links.filter(resource => resource.title !== '.folder');
      const displayFiles = folderData[folderName].files.filter(resource => resource.title !== '.folder');
      return {
        links: displayLinks,
        files: displayFiles,
        folders: Object.keys(folderData[folderName].folders)
      };
    }

    return { links: [], files: [], folders: [] };
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
    setNewFolderNameModal('');
    setShowFolderModal(true);
  };

  const handleCreateFolderSubmit = async (e) => {
    e.preventDefault();
    if (!newFolderNameModal.trim()) {
      alert('Folder name is required');
      return;
    }

    // Build full folder path
    const folderPath = selectedFolder
      ? `${selectedFolder}/${newFolderNameModal.trim()}`
      : newFolderNameModal.trim();

    if (onCreateFolder) {
      await onCreateFolder(folderPath);
    }
    setShowFolderModal(false);
    setNewFolderNameModal('');
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
    setNewFolderNameModal('');
    setShowFolderModal(true);
    handleContextMenuClose();
  };

  // Check if a folder is empty (only contains .folder placeholder resources)
  const isFolderEmpty = (folderPath) => {
    const folderContents = getFolderContents(folderTree, folderPath);
    // Check if folder has any real resources (excluding .folder placeholders)
    const hasLinks = folderContents.links.length > 0;
    const hasFiles = folderContents.files.length > 0;
    if (hasLinks || hasFiles) return false;

    // Check recursively if any subfolders have items
    const checkSubfolders = (path) => {
      const contents = getFolderContents(folderTree, path);
      // If this subfolder has links or files, it's not empty
      if (contents.links.length > 0 || contents.files.length > 0) return true;
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
  const handleDragStart = (e, resource) => {
    setDraggedResource(resource);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', resource.id);
    e.currentTarget.style.opacity = '0.5';
  };

  const handleDragEnd = (e) => {
    e.currentTarget.style.opacity = '1';
    setDraggedResource(null);
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

    if (!draggedResource) return;

    // Don't move if dropped on the same folder
    const currentFolder = draggedResource.folder || '';
    if (currentFolder === targetFolderPath) {
      setDragOverFolder(null);
      return;
    }

    // Move the resource to the new folder
    if (onMoveResource) {
      await onMoveResource(draggedResource.id, targetFolderPath);
    }

    setDraggedResource(null);
    setDragOverFolder(null);
  };

  // Don't auto-expand folders - let users drill into them

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="resources-section">
      <div className="resources-header">
        <div className="resources-actions">
          <button
            onClick={() => {
              setShowAddLinkForm(true);
              setShowAddFileForm(false);
            }}
            className="btn btn-small btn-primary"
          >
            + Add Link
          </button>
          <label className="btn btn-small btn-secondary" style={{ cursor: 'pointer' }}>
            + Upload File
            <input
              type="file"
              onChange={handleFileSelect}
              disabled={uploading}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      </div>

      {showAddLinkForm && (
        <form onSubmit={handleLinkSubmit} className="resource-form">
          <input
            type="text"
            value={newLink.title}
            onChange={(e) => setNewLink({ ...newLink, title: e.target.value })}
            placeholder="Link title *"
            className="resource-input"
            autoFocus
            required
          />
          <input
            type="url"
            value={newLink.url}
            onChange={(e) => setNewLink({ ...newLink, url: e.target.value })}
            placeholder="URL *"
            className="resource-input"
            required
          />
          <input
            type="text"
            value={newLink.description}
            onChange={(e) => setNewLink({ ...newLink, description: e.target.value })}
            placeholder="Description (optional)"
            className="resource-input"
          />
          <div className="resource-form-actions">
            <button type="submit" className="btn btn-small btn-primary">Add</button>
            <button
              type="button"
              onClick={() => {
                setShowAddLinkForm(false);
                setNewLink({ title: '', url: '', description: '' });
              }}
              className="btn btn-small btn-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {showAddFileForm && (
        <form onSubmit={handleFileSubmit} className="resource-form">
          <div className="resource-file-input-wrapper">
            <label className="resource-file-label">
              Selected File: {newFile.file ? newFile.file.name : 'None'}
            </label>
            <label className="btn btn-small btn-secondary" style={{ cursor: 'pointer', display: 'inline-block' }}>
              Choose File
              <input
                type="file"
                onChange={handleFileSelect}
                disabled={uploading}
                style={{ display: 'none' }}
              />
            </label>
          </div>
          <input
            type="text"
            value={newFile.title}
            onChange={(e) => setNewFile({ ...newFile, title: e.target.value })}
            placeholder="File title *"
            className="resource-input"
            autoFocus
            required
          />
          <input
            type="text"
            value={newFile.description}
            onChange={(e) => setNewFile({ ...newFile, description: e.target.value })}
            placeholder="Description (optional)"
            className="resource-input"
          />
          <div className="resource-form-actions">
            <button type="submit" className="btn btn-small btn-primary" disabled={uploading}>
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAddFileForm(false);
                setNewFile({ file: null, title: '', description: '' });
              }}
              className="btn btn-small btn-secondary"
              disabled={uploading}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {resources.length === 0 ? (
        <div className="resources-empty">
          <p>No resources yet. Add a link or upload a file to get started!</p>
        </div>
      ) : (
        <div className="resources-explorer">
          <div className="resources-explorer-sidebar">
            <div className="resources-explorer-header">
              <h3>Folders</h3>
              <button
                className="btn-new-folder"
                onClick={handleCreateFolder}
                title="Create New Folder"
              >
                + New Folder
              </button>
            </div>
            <div className="resources-folder-tree">
              <div
                className={`resources-folder-tree-item ${selectedFolder === '' ? 'selected' : ''} ${dragOverFolder === '' ? 'drag-over' : ''}`}
                onClick={() => selectFolder('')}
                onContextMenu={(e) => handleContextMenu(e, '')}
                onDragOver={(e) => handleDragOver(e, '')}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, '')}
              >
                <span className="folder-icon">📁</span>
                <span className="folder-name">All Resources</span>
                <span className="folder-count">({resources.filter(resource => resource.title !== '.folder').length})</span>
              </div>
              {Object.keys(folderTree.folders).map(folderName => (
                <ResourceFolderTreeItem
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

          <div className="resources-explorer-content" onContextMenu={(e) => handleContextMenu(e, selectedFolder)}>
            {/* Breadcrumb navigation */}
            <div className="resources-breadcrumbs">
              {breadcrumbs.map((crumb, index) => (
                <React.Fragment key={index}>
                  {index > 0 && <span className="breadcrumb-separator">/</span>}
                  <button
                    className={`breadcrumb-item ${index === breadcrumbs.length - 1 ? 'active' : ''}`}
                    onClick={() => navigateToPath(index)}
                  >
                    {index === 0 ? 'All Resources' : crumb}
                  </button>
                </React.Fragment>
              ))}
            </div>

            {/* Current folder contents */}
            {currentFolderContents.links.length === 0 && currentFolderContents.files.length === 0 && currentFolderContents.folders.length === 0 ? (
              <div className="resources-empty">
                <p>This folder is empty.</p>
              </div>
            ) : (
              <>
                {/* Subfolders */}
                {currentFolderContents.folders.length > 0 && (
                  <div className="resources-folder-grid">
                    {currentFolderContents.folders.map(folderName => {
                      const folderPath = selectedFolder
                        ? `${selectedFolder}/${folderName}`
                        : folderName;
                      const getFolderDataForCount = (path) => {
                        if (!path) return folderTree;
                        const parts = path.split('/').filter(Boolean);
                        let current = folderTree.folders;
                        for (const part of parts.slice(0, -1)) {
                          if (!current[part]) return { folders: {}, links: [], files: [] };
                          current = current[part].folders;
                        }
                        return current[parts[parts.length - 1]] || { folders: {}, links: [], files: [] };
                      };
                      const folderData = getFolderDataForCount(folderPath);
                      const totalCount = countResourceItems(folderData);

                      return (
                        <div
                          key={folderName}
                          className={`resources-folder-card ${dragOverFolder === folderPath ? 'drag-over' : ''}`}
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

                {/* Links in current folder */}
                {currentFolderContents.links.length > 0 && (
                  <div className="resources-group">
                    <h4 className="resources-group-title">Links</h4>
                    <div className="resources-list">
                      {currentFolderContents.links.map((resource) => (
              <div
                key={resource.id}
                className="resource-item resource-link"
                draggable
                onDragStart={(e) => handleDragStart(e, resource)}
                onDragEnd={handleDragEnd}
              >
                <div className="resource-content">
                  <div className="resource-icon">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M10 13L13 10L10 7M7 10H13M16 10C16 13.3137 13.3137 16 10 16C6.68629 16 4 13.3137 4 10C4 6.68629 6.68629 4 10 4C13.3137 4 16 6.68629 16 10Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div className="resource-info">
                    <a
                      href={resource.url}
                      onClick={(e) => handleExternalLinkClick(e, resource.url)}
                      className="resource-title"
                      style={{ cursor: 'pointer' }}
                    >
                      {resource.title}
                    </a>
                    {resource.description && (
                      <p className="resource-description">{resource.description}</p>
                    )}
                    <span className="resource-url">{resource.url}</span>
                  </div>
                </div>
                <div className="resource-actions">
                  <button
                    onClick={() => onEdit(resource)}
                    className="btn-icon btn-edit"
                    title="Edit resource"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M11.3333 2.00001C11.5084 1.8249 11.7163 1.68603 11.9447 1.59129C12.1731 1.49655 12.4173 1.44775 12.6637 1.44775C12.9101 1.44775 13.1543 1.49655 13.3827 1.59129C13.6111 1.68603 13.819 1.8249 13.9941 2.00001C14.1692 2.17512 14.3081 2.38304 14.4028 2.61143C14.4976 2.83982 14.5464 3.08401 14.5464 3.33043C14.5464 3.57685 14.4976 3.82104 14.4028 4.04943C14.3081 4.27782 14.1692 4.48574 13.9941 4.66085L5.05733 13.5975L1.33333 14.6642L2.4 10.9402L11.3333 2.00001Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm('Delete this resource?')) {
                        onDelete(resource.id);
                      }
                    }}
                    className="btn-icon btn-delete"
                    title="Delete resource"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2 4H14M12.6667 4V13.3333C12.6667 13.687 12.5262 14.0262 12.2761 14.2762C12.0261 14.5263 11.6869 14.6667 11.3333 14.6667H4.66667C4.31305 14.6667 3.97391 14.5263 3.72386 14.2762C3.47381 14.0262 3.33333 13.687 3.33333 13.3333V4M5.33333 4V2.66667C5.33333 2.31305 5.47381 1.97391 5.72386 1.72386C5.97391 1.47381 6.31305 1.33333 6.66667 1.33333H9.33333C9.68696 1.33333 10.0261 1.47381 10.2761 1.72386C10.5262 1.97391 10.6667 2.31305 10.6667 2.66667V4M6.66667 7.33333V11.3333M9.33333 7.33333V11.3333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
                      </div>
                    ))}
                    </div>
                  </div>
                )}

                {/* Files in current folder */}
                {currentFolderContents.files.length > 0 && (
                  <div className="resources-group">
                    <h4 className="resources-group-title">Files</h4>
                    <div className="resources-list">
                      {currentFolderContents.files.map((resource) => (
                        <div
                          key={resource.id}
                          className="resource-item resource-file"
                          draggable
                          onDragStart={(e) => handleDragStart(e, resource)}
                          onDragEnd={handleDragEnd}
                        >
                          <div className="resource-content">
                            <div className="resource-icon">
                              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M5 3H11.6667L15 6.33333V15.6667C15 16.403 14.403 17 13.6667 17H5.33333C4.59695 17 4 16.403 4 15.6667V4.33333C4 3.59695 4.59695 3 5.33333 3H5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M11 3V6.33333H14.3333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </div>
                            <div className="resource-info">
                              <a
                                href={resource.url}
                                download={resource.fileName}
                                className="resource-title"
                              >
                                {resource.title || resource.fileName}
                              </a>
                              {resource.description && (
                                <p className="resource-description">{resource.description}</p>
                              )}
                              <span className="resource-meta">
                                {resource.fileSize && formatFileSize(resource.fileSize)}
                                {resource.fileSize && resource.uploadedAt && ' • '}
                                {resource.uploadedAt && new Date(resource.uploadedAt).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric'
                                })}
                              </span>
                            </div>
                          </div>
                          <div className="resource-actions">
                            <button
                              onClick={() => onEdit(resource)}
                              className="btn-icon btn-edit"
                              title="Edit file"
                            >
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M11.3333 2.00001C11.5084 1.8249 11.7163 1.68603 11.9447 1.59129C12.1731 1.49655 12.4173 1.44775 12.6637 1.44775C12.9101 1.44775 13.1543 1.49655 13.3827 1.59129C13.6111 1.68603 13.819 1.8249 13.9941 2.00001C14.1692 2.17512 14.3081 2.38304 14.4028 2.61143C14.4976 2.83982 14.5464 3.08401 14.5464 3.33043C14.5464 3.57685 14.4976 3.82104 14.4028 4.04943C14.3081 4.27782 14.1692 4.48574 13.9941 4.66085L5.05733 13.5975L1.33333 14.6642L2.4 10.9402L11.3333 2.00001Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </button>
                            <button
                              onClick={() => {
                                if (window.confirm('Delete this file?')) {
                                  onDelete(resource.id);
                                }
                              }}
                              className="btn-icon btn-delete"
                              title="Delete file"
                            >
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M2 4H14M12.6667 4V13.3333C12.6667 13.687 12.5262 14.0262 12.2761 14.2762C12.0261 14.5263 11.6869 14.6667 11.3333 14.6667H4.66667C4.31305 14.6667 3.97391 14.5263 3.72386 14.2762C3.47381 14.0262 3.33333 13.687 3.33333 13.3333V4M5.33333 4V2.66667C5.33333 2.31305 5.47381 1.97391 5.72386 1.72386C5.97391 1.47381 6.31305 1.33333 6.66667 1.33333H9.33333C9.68696 1.33333 10.0261 1.47381 10.2761 1.72386C10.5262 1.97391 10.6667 2.31305 10.6667 2.66667V4M6.66667 7.33333V11.3333M9.33333 7.33333V11.3333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

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
                  value={newFolderNameModal}
                  onChange={(e) => setNewFolderNameModal(e.target.value)}
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

// Helper function to count all items in a folder tree (excluding .folder placeholders)
const countResourceItems = (folderData) => {
  let count = folderData.links.filter(resource => resource.title !== '.folder').length +
              folderData.files.filter(resource => resource.title !== '.folder').length;
  Object.values(folderData.folders).forEach(subFolder => {
    count += countResourceItems(subFolder);
  });
  return count;
};

// Folder tree item component for sidebar
const ResourceFolderTreeItem = ({ folderName, folderData, selectedFolder, onSelect, onToggle, expandedFolders, level, onContextMenu, onDragOver, onDragLeave, onDrop, dragOverFolder }) => {
  const folderPath = folderData.path;
  const isExpanded = expandedFolders.has(folderPath);
  const isSelected = selectedFolder === folderPath;
  const hasSubfolders = Object.keys(folderData.folders).length > 0;
  const isDragOver = dragOverFolder === folderPath;

  return (
    <div className="resources-folder-tree-item-wrapper">
      <div
        className={`resources-folder-tree-item ${isSelected ? 'selected' : ''} ${isDragOver ? 'drag-over' : ''}`}
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
            <ResourceFolderTreeItem
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

export default Resources;

