import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Sidebar.css';
import { MessageSquarePlus, Search, Code, FileText, FolderOpen, Trash2, Settings, LogOut, Pin, Archive, ChevronDown, ChevronRight, Globe, Users } from 'lucide-react';

const Sidebar = ({ isOpen, onClose, onNewChat, history, onSelectChat, currentChatId, onDeleteChat, activeMode, onSelectMode }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
    const [isArchivedExpanded, setIsArchivedExpanded] = useState(false);
    const [isDevInfoOpen, setIsDevInfoOpen] = useState(false);
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('userName');
        localStorage.removeItem('isAuthenticated');
        navigate('/signin');
    };

    // Get user details
    const userName = localStorage.getItem('userName') || 'User';
    const userInitials = userName.charAt(0).toUpperCase() || 'U';

    const visibleChats = history.filter(chat => {
        // If mode is 'chat', show 'chat' OR undefined (legacy chats)
        const modeMatch = activeMode === 'chat' ? (!chat.mode || chat.mode === 'chat') : chat.mode === activeMode;
        // Search match
        const searchMatch = chat.title ? chat.title.toLowerCase().includes(searchQuery.toLowerCase()) : false;

        return modeMatch && searchMatch;
    });

    const pinnedChats = visibleChats.filter(c => c.isPinned && !c.isArchived);
    const recentChats = visibleChats.filter(c => !c.isPinned && !c.isArchived);
    const archivedChats = visibleChats.filter(c => c.isArchived);

    const renderChatItem = (chat) => (
        <div
            key={chat.id}
            className={`history-item ${chat.id === currentChatId ? 'active' : ''}`}
            onClick={() => onSelectChat(chat.id)}
        >
            <span className="history-title">{chat.title}</span>
            <button
                className="delete-chat-btn"
                onClick={(e) => {
                    e.stopPropagation();
                    onDeleteChat(chat.id);
                }}
            >
                <Trash2 size={14} />
            </button>
        </div>
    );

    return (
        <div className={`sidebar ${isOpen ? 'open' : 'closed'}`}>
            <div className="sidebar-header">
                <button className="new-chat-btn" onClick={onNewChat}>
                    <MessageSquarePlus size={20} />
                    <span>New chat</span>
                </button>
            </div>

            <div className="sidebar-section">
                <div className="sidebar-search">
                    <Search size={16} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search chats..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            <div className="sidebar-section modes-section">
                <h3 className="section-title">Modes</h3>
                <button
                    className={`mode-btn ${activeMode === 'chat' ? 'active' : ''}`}
                    onClick={() => onSelectMode('chat')}
                >
                    <MessageSquarePlus size={18} /> <span>Chat</span>
                </button>
                <button
                    className={`mode-btn ${activeMode === 'coding' ? 'active' : ''}`}
                    onClick={() => onSelectMode('coding')}
                >
                    <Code size={18} /> <span>Coding</span>
                </button>
                <button
                    className={`mode-btn ${activeMode === 'summarization' ? 'active' : ''}`}
                    onClick={() => onSelectMode('summarization')}
                >
                    <FileText size={18} /> <span>Summarization</span>
                </button>
                <button
                    className={`mode-btn ${activeMode === 'files' ? 'active' : ''}`}
                    onClick={() => onSelectMode('files')}
                >
                    <FolderOpen size={18} /> <span>Files</span>
                </button>
                <button
                    className={`mode-btn ${activeMode === 'search' ? 'active' : ''}`}
                    onClick={() => onSelectMode('search')}
                >
                    <Globe size={18} /> <span>Web Search</span>
                </button>
            </div>

            <div className="sidebar-section archived-section" style={{ marginBottom: archivedChats.length > 0 ? '10px' : '0' }}>
                {archivedChats.length > 0 && (
                    <div className="history-group" style={{ opacity: 0.8 }}>
                        <h4
                            onClick={() => setIsArchivedExpanded(!isArchivedExpanded)}
                            style={{
                                fontSize: '0.75rem',
                                color: 'var(--text-muted)',
                                margin: '0 0 5px 12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                                cursor: 'pointer'
                            }}
                        >
                            <Archive size={12} /> Archived
                            {isArchivedExpanded ?
                                <ChevronDown size={12} style={{ marginLeft: 'auto', marginRight: '12px' }} /> :
                                <ChevronRight size={12} style={{ marginLeft: 'auto', marginRight: '12px' }} />
                            }
                        </h4>
                        {isArchivedExpanded && archivedChats.map(renderChatItem)}
                    </div>
                )}
            </div>

            <div className="sidebar-section history-section">
                <h3 className="section-title">History</h3>
                <div className="history-list">
                    <>
                        {pinnedChats.length > 0 && (
                            <div className="history-group">
                                <h4 style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '10px 0 5px 12px', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    <Pin size={12} /> Pinned
                                </h4>
                                {pinnedChats.map(renderChatItem)}
                            </div>
                        )}

                        {recentChats.length > 0 && (
                            <div className="history-group">
                                {pinnedChats.length > 0 && <h4 style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '15px 0 5px 12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Recent</h4>}
                                {recentChats.map(renderChatItem)}
                            </div>
                        )}

                        {visibleChats.length === 0 && <p className="no-history">No visible history</p>}
                    </>
                </div>
            </div>

            <div className="sidebar-footer">
                <div
                    className="user-profile"
                    onClick={() => {
                        setIsProfileDropdownOpen(!isProfileDropdownOpen);
                        if (isProfileDropdownOpen) {
                            setIsDevInfoOpen(false); // Close dev info when closing dropdown
                        }
                    }}
                >
                    <div className="user-avatar-small" style={{ backgroundColor: '#e74c3c' }}>{userInitials}</div>
                    <div className="user-info">
                        <span className="user-name">{userName}</span>
                    </div>
                </div>

                {isProfileDropdownOpen && (
                    <div className="profile-dropdown">
                        <div className="dropdown-header">
                            <div className="user-avatar-small" style={{ backgroundColor: '#e74c3c' }}>{userInitials}</div>
                            <div className="dropdown-user-info">
                                <span className="dropdown-name">{userName}</span>
                                <span className="dropdown-username">@{userName.toLowerCase().replace(/\s/g, '')}</span>
                            </div>
                        </div>
                        <div className="dropdown-divider"></div>
                        <button className="dropdown-item" onClick={() => navigate('/settings')}>
                            <Settings size={16} /> Settings
                        </button>
                        <div className="dropdown-divider"></div>
                        <button className="dropdown-item" onClick={handleLogout}>
                            <LogOut size={16} /> Log out
                        </button>
                        <div className="dropdown-divider"></div>
                        <button 
                            className="dropdown-item" 
                            onClick={() => {
                                setIsProfileDropdownOpen(false);
                                navigate('/developers');
                            }}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
                        >
                            <Users size={16} /> Developer Info
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Sidebar;
