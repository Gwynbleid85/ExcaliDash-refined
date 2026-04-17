import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutGrid, Folder, Plus, Trash2, Edit2, Archive, FolderOpen, Settings as SettingsIcon, User, LogOut, Shield, Users, Share2 } from 'lucide-react';
import type { Collection } from '../types';
import clsx from 'clsx';
import { ConfirmModal } from './ConfirmModal';
import { Logo } from './Logo';
import { useAuth } from '../context/AuthContext';
import { getInitialsFromName } from '../utils/user';

interface SidebarProps {
  collections: Collection[];
  selectedCollectionId: string | null | undefined;
  onSelectCollection: (id: string | null | undefined) => void;
  onCreateCollection: (name: string) => void;
  onEditCollection: (id: string, name: string) => void;
  onDeleteCollection: (id: string) => void;
  onDrop?: (e: React.DragEvent, collectionId: string | null) => void;
}

interface SidebarItemProps {
  id: string | null;
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
  onDoubleClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  extraAction?: React.ReactNode;
  isEditing?: boolean;
  editValue?: string;
  onEditChange?: (val: string) => void;
  onEditSubmit?: (e: React.FormEvent) => void;
  onEditBlur?: () => void;
  onDrop?: (e: React.DragEvent, collectionId: string | null) => void;
}

const SidebarItem: React.FC<SidebarItemProps> = ({
  id,
  icon,
  label,
  isActive,
  onClick,
  onDoubleClick,
  onContextMenu,
  extraAction,
  isEditing,
  editValue,
  onEditChange,
  onEditSubmit,
  onEditBlur,
  onDrop
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <div className="relative group/item px-2">
      {isEditing ? (
        <form onSubmit={onEditSubmit} className="py-1">
          <input
            autoFocus
            type="text"
            value={editValue}
            onChange={(e) => onEditChange?.(e.target.value)}
            className="ex-input"
            onBlur={onEditBlur}
          />
        </form>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={onClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onClick();
            }
          }}
          onDoubleClick={onDoubleClick}
          onContextMenu={onContextMenu}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            onDrop?.(e, id);
          }}
          data-active={isActive || isDragOver}
          className="ex-nav-item outline-none focus-visible:ring-2 focus-visible:ring-ex-primary"
        >
          <span className={clsx('flex-shrink-0', (isActive || isDragOver) ? 'text-ex-primary' : 'text-ex-text-subtle')}>
            {icon}
          </span>
          <span className="min-w-0 flex-1 text-left truncate">{label}</span>
          {extraAction && (
            <div className="opacity-0 group-hover/item:opacity-100 transition-opacity duration-150 flex items-center gap-1 flex-shrink-0">
              {extraAction}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({
  collections,
  selectedCollectionId,
  onSelectCollection,
  onCreateCollection,
  onEditCollection,
  onDeleteCollection,
  onDrop
}) => {
  const navigate = useNavigate();
  const { logout, user, authEnabled } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [isCreating, setIsCreating] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; type: 'item' | 'background'; id?: string } | null>(null);
  const [collectionToDelete, setCollectionToDelete] = useState<string | null>(null);
  const [isTrashDragOver, setIsTrashDragOver] = useState(false);
  const [shareToggleCollectionId, setShareToggleCollectionId] = useState<string | null>(null);

  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCollectionName.trim()) {
      onCreateCollection(newCollectionName);
      setNewCollectionName('');
      setIsCreating(false);
    }
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId && editName.trim()) {
      onEditCollection(editingId, editName);
      setEditingId(null);
    }
  };

  const handleItemContextMenu = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'item', id });
  };

  const handleBackgroundContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'background' });
  };

  return (
    <>
      <div className="w-full flex flex-col h-full bg-transparent">
        <div className="p-4 sm:p-5 pb-3">
          <h1 className="text-2xl flex items-center gap-3">
            <Logo className="w-9 h-9" />
            <span className="ex-brand mt-1">ExcaliDash</span>
            <span className="text-[10px] font-bold text-ex-danger mt-1.5 px-1.5 py-0.5 rounded-md bg-ex-danger-soft">BETA</span>
          </h1>
        </div>

        <div className="ex-divider mx-4" />

        <nav
          className="flex-1 overflow-y-auto py-3 space-y-5 custom-scrollbar"
          onContextMenu={handleBackgroundContextMenu}
        >
          <div className="space-y-0.5">
            <div className="px-5 pb-2 ex-section-label">Library</div>

            <div className="px-2">
              <button
                onClick={() => onSelectCollection(undefined)}
                data-active={selectedCollectionId === undefined}
                className="ex-nav-item"
              >
                <LayoutGrid size={18} className={clsx('flex-shrink-0', selectedCollectionId === undefined ? 'text-ex-primary' : 'text-ex-text-subtle')} />
                <span className="min-w-0 flex-1 text-left">All Drawings</span>
              </button>
            </div>

            <SidebarItem
              id={'shared'}
              icon={<Shield size={18} />}
              label="Shared with me"
              isActive={selectedCollectionId === 'shared'}
              onClick={() => onSelectCollection('shared')}
            />

            <SidebarItem
              id={null}
              icon={<Archive size={18} />}
              label="Unorganized"
              isActive={selectedCollectionId === null}
              onClick={() => onSelectCollection(null)}
              onDrop={onDrop}
            />
          </div>

          <div className="space-y-0.5">
            <div className="flex items-center justify-between px-5 pb-2 group/header">
              <span className="ex-section-label">Collections</span>
              <button
                onClick={(e) => { e.stopPropagation(); setIsCreating(true); }}
                className="p-1 text-ex-text-subtle hover:text-ex-primary hover:bg-ex-primary-soft rounded-md transition-colors opacity-0 group-hover/header:opacity-100"
                title="New Collection"
              >
                <Plus size={14} strokeWidth={2.5} />
              </button>
            </div>

            {isCreating && (
              <form onSubmit={handleCreateSubmit} className="mb-1 px-2" onClick={e => e.stopPropagation()}>
                <input
                  autoFocus
                  type="text"
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  placeholder="New collection..."
                  className="ex-input"
                  onBlur={() => !newCollectionName && setIsCreating(false)}
                />
              </form>
            )}

            {collections.filter(c => c.name !== 'Trash').map((collection) => (
              <SidebarItem
                key={collection.id}
                id={collection.id}
                icon={
                  collection.visibility === 'shared'
                    ? <Users size={18} />
                    : selectedCollectionId === collection.id
                      ? <FolderOpen size={18} />
                      : <Folder size={18} />
                }
                label={collection.name}
                isActive={selectedCollectionId === collection.id}
                onClick={() => onSelectCollection(collection.id)}
                onDoubleClick={() => {
                  if (collection.isOwner !== false) {
                    setEditingId(collection.id);
                    setEditName(collection.name);
                  }
                }}
                onContextMenu={(e) => handleItemContextMenu(e, collection.id)}
                isEditing={editingId === collection.id}
                editValue={editName}
                onEditChange={setEditName}
                onEditSubmit={handleEditSubmit}
                onEditBlur={() => setEditingId(null)}
                onDrop={onDrop}
              />
            ))}
          </div>
        </nav>

        <div className="px-2 pt-3 pb-3 border-t border-ex-divider space-y-0.5">
          <button
            onDragOver={(e) => {
              e.preventDefault();
              setIsTrashDragOver(true);
            }}
            onDragLeave={() => setIsTrashDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsTrashDragOver(false);
              onDrop?.(e, 'trash');
            }}
            onClick={() => {
              navigate('/collections?id=trash');
            }}
            data-active={selectedCollectionId === 'trash' || isTrashDragOver}
            className={clsx(
              'ex-nav-item',
              (selectedCollectionId === 'trash' || isTrashDragOver) && 'text-ex-danger bg-ex-danger-soft'
            )}
          >
            <Trash2 size={18} className={clsx('flex-shrink-0', (selectedCollectionId === 'trash' || isTrashDragOver) ? 'text-ex-danger' : 'text-ex-text-subtle')} />
            <span className="min-w-0 flex-1 text-left">Trash</span>
          </button>

          {authEnabled && (
            <button
              onClick={() => navigate('/profile')}
              className="ex-nav-item"
            >
              <User size={18} className="text-ex-text-subtle flex-shrink-0" />
              <span className="min-w-0 flex-1 text-left">Profile</span>
            </button>
          )}

          {authEnabled && isAdmin && (
            <button
              onClick={() => navigate('/admin')}
              className="ex-nav-item"
            >
              <Shield size={18} className="text-ex-text-subtle flex-shrink-0" />
              <span className="min-w-0 flex-1 text-left">Admin</span>
            </button>
          )}

          <button
            onClick={() => navigate('/settings')}
            className="ex-nav-item"
          >
            <SettingsIcon size={18} className="text-ex-text-subtle flex-shrink-0" />
            <span className="min-w-0 flex-1 text-left">Settings</span>
          </button>

          {authEnabled && (
            <div className="mt-3 pt-3 border-t border-ex-divider">
              {user && (
                <div className="px-2 pb-2 text-xs">
                  <div className="grid grid-cols-[auto_1fr] items-center gap-3">
                    <div className="w-9 h-9 rounded-ex bg-ex-primary text-ex-primary-contrast font-bold flex items-center justify-center shadow-ex-soft">
                      {getInitialsFromName(user.name)}
                    </div>
                    <div className="min-w-0 text-left">
                      <div className="font-semibold text-ex-text truncate leading-tight">{user.name}</div>
                      <div className="text-ex-text-muted truncate leading-tight">{user.email}</div>
                    </div>
                  </div>
                </div>
              )}
              <div className="px-2">
                <button
                  onClick={logout}
                  className="ex-nav-item w-full text-ex-text-muted hover:!text-ex-danger hover:!bg-ex-danger-soft"
                >
                  <LogOut size={18} className="flex-shrink-0" />
                  <span className="min-w-0 flex-1 text-left">Logout</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {contextMenu && (
        <div
          className="fixed inset-0 z-50"
          onClick={() => setContextMenu(null)}
          onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
        >
          <div
            className="absolute ex-menu min-w-[180px] ex-animate-in"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onClick={(e) => e.stopPropagation()}
          >
            {contextMenu.type === 'item' && contextMenu.id ? (
              <>
                {(() => {
                  const collection = collections.find(c => c.id === contextMenu.id);
                  const isOwner = collection?.isOwner !== false;
                  return (
                    <>
                      {isOwner && (
                        <button
                          onClick={() => {
                            const c = collections.find(c => c.id === contextMenu.id);
                            if (c) {
                              setEditingId(c.id);
                              setEditName(c.name);
                            }
                            setContextMenu(null);
                          }}
                          className="ex-menu-item"
                        >
                          <Edit2 size={14} /> Rename collection
                        </button>
                      )}

                      {isOwner && (
                        <button
                          onClick={() => {
                            setShareToggleCollectionId(contextMenu.id!);
                            setContextMenu(null);
                          }}
                          className="ex-menu-item"
                        >
                          <Share2 size={14} /> Share collection
                        </button>
                      )}

                      {isOwner && (
                        <button
                          onClick={() => {
                            setCollectionToDelete(contextMenu.id!);
                            setContextMenu(null);
                          }}
                          className="ex-menu-item"
                          data-variant="danger"
                        >
                          <Trash2 size={14} /> Delete collection
                        </button>
                      )}
                    </>
                  );
                })()}
              </>
            ) : (
              <button
                onClick={() => {
                  setIsCreating(true);
                  setContextMenu(null);
                }}
                className="ex-menu-item"
              >
                <Plus size={14} /> New collection
              </button>
            )}
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!collectionToDelete}
        title="Delete Collection"
        message="Are you sure you want to delete this collection? All drawings inside will be moved to Unorganized."
        confirmText="Delete Collection"
        onConfirm={() => {
          if (collectionToDelete) {
            onDeleteCollection(collectionToDelete);
            setCollectionToDelete(null);
          }
        }}
        onCancel={() => setCollectionToDelete(null)}
      />

      {/* Share collection toggle modal */}
      {shareToggleCollectionId && (() => {
        const collection = collections.find(c => c.id === shareToggleCollectionId);
        if (!collection) return null;
        const isCurrentlyShared = collection.visibility === 'shared';
        const currentPermission = collection.sharePermission || 'view';
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
            onClick={() => setShareToggleCollectionId(null)}
          >
            <div
              className="ex-island p-6 rounded-ex-xl w-[380px] space-y-5"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="ex-title text-xl">Share collection</h3>
              <p className="text-sm text-ex-text-muted">
                {isCurrentlyShared
                  ? 'This collection is visible to all authenticated users.'
                  : 'Make this collection visible to all authenticated users.'}
              </p>

              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isCurrentlyShared}
                    onChange={async () => {
                      try {
                        await (await import('../api')).updateCollectionShare(shareToggleCollectionId, {
                          visibility: isCurrentlyShared ? 'private' : 'shared',
                          sharePermission: currentPermission,
                        });
                        setShareToggleCollectionId(null);
                        window.location.reload();
                      } catch (err) {
                        console.error('Failed to toggle sharing:', err);
                      }
                    }}
                    className="w-4 h-4 rounded border-ex-border text-ex-primary focus:ring-ex-primary"
                  />
                  <span className="text-sm font-medium">Shared with everyone</span>
                </label>

                {isCurrentlyShared && (
                  <div className="space-y-2 pl-7">
                    <label className="text-xs font-medium text-ex-text-muted uppercase tracking-wide">Permission</label>
                    <div className="flex gap-2">
                      {(['view', 'edit'] as const).map((perm) => (
                        <button
                          key={perm}
                          onClick={async () => {
                            try {
                              await (await import('../api')).updateCollectionShare(shareToggleCollectionId, {
                                visibility: 'shared',
                                sharePermission: perm,
                              });
                              window.location.reload();
                            } catch (err) {
                              console.error('Failed to update permission:', err);
                            }
                          }}
                          className={clsx(
                            'px-3 py-1.5 rounded-ex-sm text-sm font-medium transition-colors',
                            currentPermission === perm
                              ? 'bg-ex-primary text-ex-primary-contrast'
                              : 'bg-ex-surface-muted text-ex-text hover:bg-ex-primary-soft'
                          )}
                        >
                          {perm === 'view' ? 'Can view' : 'Can edit'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setShareToggleCollectionId(null)}
                  className="ex-btn ex-btn-ghost"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
};
