import React, { useState, useEffect, useRef } from 'react';
import './ChatInterface.css';
import MessageBubble from './MessageBubble';
import Sidebar from './Sidebar';
import AnimatedBackground from './AnimatedBackground';
import { Mic, Send, Paperclip, Menu, X, FileText, Sun, Moon, Share, MoreHorizontal, Pin, Archive, Trash2, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useTranscript } from './TranscriptContext';
import { io } from 'socket.io-client';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';
// socket will be initialized inside the component

const ChatInterface = () => {
    const socket = React.useMemo(() => io(API_BASE), []);
    const userName = localStorage.getItem('userName') || 'User';

    const [input, setInput] = useState('');
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('Thinking...');
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [currentChatId, setCurrentChatId] = useState(null);
    const currentChatIdRef = useRef(currentChatId);
    useEffect(() => { currentChatIdRef.current = currentChatId; }, [currentChatId]);

    const [history, setHistory] = useState([]);
    const [activeMode, setActiveMode] = useState('chat');
    const [uploadedFiles, setUploadedFiles] = useState([]);
    const [viewingFile, setViewingFile] = useState(null);
    const [isDarkMode, setIsDarkMode] = useState(true);
    const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState(false);
    const [isHistoryLoaded, setIsHistoryLoaded] = useState(false);

    const { transcript, setTranscript } = useTranscript();

    const messagesEndRef = useRef(null);
    const textareaRef = useRef(null);
    const navigate = useNavigate();

    // Theme initialization
    useEffect(() => {
        const savedTheme = localStorage.getItem('theme') || 'dark';
        setIsDarkMode(savedTheme === 'dark');
        document.documentElement.setAttribute('data-theme', savedTheme);
    }, []);

    const toggleTheme = () => {
        const newTheme = isDarkMode ? 'light' : 'dark';
        setIsDarkMode(!isDarkMode);
        localStorage.setItem('theme', newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
    };


    const handleShareChat = () => {
        if (!currentChatId || messages.length === 0) {
            toast.error('Start a chat before sharing.');
            return;
        }
        const url = window.location.origin + '/share/' + currentChatId;
        navigator.clipboard.writeText(url);
        toast.success('Chat link copied to clipboard!');
    };

    const togglePinChat = () => {
        setIsOptionsMenuOpen(false);
        if (!currentChatId || messages.length === 0) return;
        
        setHistory(prev => {
            const newHistory = prev.map(chat =>
                chat.id === currentChatId ? { ...chat, isPinned: !chat.isPinned } : chat
            );
            const updatedChat = newHistory.find(c => c.id === currentChatId);
            const token = localStorage.getItem('token');
            if (token && updatedChat) {
                fetch(`${API_BASE}/api/chats/sync`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(updatedChat)
                }).catch(err => console.error('Error syncing chat:', err));
            }
            return newHistory;
        });
    };

    const toggleArchiveChat = () => {
        setIsOptionsMenuOpen(false);
        if (!currentChatId || messages.length === 0) return;
        
        setHistory(prev => {
            const newHistory = prev.map(chat =>
                chat.id === currentChatId ? { ...chat, isArchived: true } : chat
            );
            const updatedChat = newHistory.find(c => c.id === currentChatId);
            const token = localStorage.getItem('token');
            if (token && updatedChat) {
                fetch(`${API_BASE}/api/chats/sync`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(updatedChat)
                }).catch(err => console.error('Error syncing chat:', err));
            }
            return newHistory;
        });
        handleNewChat();
    };

    const handleDownloadChat = () => {
        setIsOptionsMenuOpen(false);
        if (messages.length === 0) {
            toast.error("No messages to download.");
            return;
        }

        // Format the chat into a readable text document
        const chatTitle = history.find(c => c.id === currentChatId)?.title || "Echo AI Chat";
        const dateStr = new Date().toLocaleString();

        let fileContent = `--- ${chatTitle} ---\n`;
        fileContent += `Date: ${dateStr}\n\n`;

        messages.forEach(msg => {
            const roleName = msg.role === 'user' ? userName : 'Echo AI';
            fileContent += `[${roleName}]:\n${msg.content}\n\n`;
        });

        // Create a Blob from the content
        const blob = new Blob([fileContent], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);

        // Create an invisible anchor to trigger the download
        const link = document.createElement("a");
        link.href = url;
        const sanitizedTitle = chatTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        link.download = `chat_${sanitizedTitle}.txt`;
        document.body.appendChild(link);
        link.click();

        // Cleanup
        setTimeout(() => {
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        }, 100);
    };

    const handleDeleteCurrentChat = () => {
        setIsOptionsMenuOpen(false);
        if (!currentChatId || messages.length === 0) return;
        
        toast((t) => (
            <div>
                <p>Are you sure you want to delete this chat?</p>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
                    <button onClick={() => toast.dismiss(t.id)} style={{ padding: '4px 8px', borderRadius: '4px', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}>Cancel</button>
                    <button onClick={() => {
                        handleDeleteChat(currentChatId);
                        toast.dismiss(t.id);
                        toast.success('Chat deleted');
                    }} style={{ padding: '4px 8px', borderRadius: '4px', background: '#ff6b6b', border: 'none', color: '#fff' }}>Delete</button>
                </div>
            </div>
        ), { duration: Infinity });
    };

    // Fetch history on mount
    useEffect(() => {
        const fetchChats = async () => {
            const token = localStorage.getItem('token');
            if (!token) {
                handleNewChat();
                setIsHistoryLoaded(true);
                return;
            }
            try {
                const response = await fetch(`${API_BASE}/api/chats`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) {
                    const data = await response.json();
                    setHistory(data);
                    
                    const savedActiveId = sessionStorage.getItem('activeChatId');
                    if (savedActiveId) {
                        const existingChat = data.find(c => c.id === savedActiveId);
                        if (existingChat) {
                            setCurrentChatId(savedActiveId);
                            setMessages(existingChat.messages);
                            setUploadedFiles(existingChat.files || []);
                            if (existingChat.mode) setActiveMode(existingChat.mode);
                            setIsHistoryLoaded(true);
                            return;
                        }
                    }
                }
                handleNewChat();
                setIsHistoryLoaded(true);
            } catch (error) {
                console.error("Failed to fetch history:", error);
                handleNewChat();
                setIsHistoryLoaded(true);
            }
        };
        fetchChats();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    // Scroll to bottom on new messages
    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleNewChat = () => {
        const newId = Date.now().toString();
        setCurrentChatId(newId);
        sessionStorage.setItem('activeChatId', newId);
        setMessages([]);
        setUploadedFiles([]);
        setViewingFile(null);
        // Do NOT reset mode here, keep current mode!
    };

    const handleSelectChat = (chatId) => {
        const chat = history.find(c => c.id === chatId);
        if (chat) {
            setCurrentChatId(chatId);
            sessionStorage.setItem('activeChatId', chatId);
            setMessages(chat.messages);
            setUploadedFiles(chat.files || []); // Restore files from history
            setViewingFile(null);
            if (chat.mode) {
                setActiveMode(chat.mode);
            } else {
                setActiveMode('chat'); // Legacy chats default to chat
            }
        }
    };

    const handleDeleteChat = async (chatId) => {
        const newHistory = history.filter(c => c.id !== chatId);
        setHistory(newHistory);
        if (currentChatId === chatId) {
            handleNewChat();
        }
        
        // Delete from backend
        const token = localStorage.getItem('token');
        if (token) {
            try {
                await fetch(`${API_BASE}/api/chats/${chatId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
            } catch (err) {
                console.error('Error deleting chat:', err);
            }
        }
    };

    const updateHistory = (newMessages = messages, mode = activeMode, currentFiles = uploadedFiles, folder = null) => {
        setHistory(prevHistory => {
            const activeId = currentChatIdRef.current;
            const existingChatIndex = prevHistory.findIndex(c => c.id === activeId);

            // Determine title based on first user message
            let title = "New Chat";
            const firstUserMsg = newMessages.find(m => m.role === 'user');
            if (firstUserMsg) {
                title = firstUserMsg.content.slice(0, 30) + (firstUserMsg.content.length > 30 ? '...' : '');
            } else if (currentFiles.length > 0) {
                title = currentFiles[0].name.slice(0, 30) + (currentFiles[0].name.length > 30 ? '...' : '');
            }

            const updatedChat = {
                id: activeId,
                title: title,
                timestamp: Date.now(),
                messages: newMessages,
                mode: mode || activeMode,
                folder: folder !== null ? folder : (existingChatIndex >= 0 ? prevHistory[existingChatIndex].folder : null),
                files: currentFiles,
                isPinned: existingChatIndex >= 0 ? prevHistory[existingChatIndex].isPinned : false,
                isArchived: existingChatIndex >= 0 ? prevHistory[existingChatIndex].isArchived : false
            };

            // Sync to backend asynchronously
            const token = localStorage.getItem('token');
            if (token) {
                fetch(`${API_BASE}/api/chats/sync`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(updatedChat)
                }).catch(err => console.error('Error syncing chat:', err));
            }

            if (existingChatIndex >= 0) {
                const newHistory = [...prevHistory];
                newHistory[existingChatIndex] = updatedChat;
                return newHistory;
            } else {
                return [updatedChat, ...prevHistory];
            }
        });
    };

    const activeModeRef = useRef(activeMode);
    useEffect(() => { activeModeRef.current = activeMode; }, [activeMode]);

    const messagesRef = useRef(messages);
    useEffect(() => { messagesRef.current = messages; }, [messages]);

    const uploadedFilesRef = useRef(uploadedFiles);
    useEffect(() => { uploadedFilesRef.current = uploadedFiles; }, [uploadedFiles]);



    useEffect(() => {
        let interval;
        if (isLoading) {
            const msgs = ['Searching...', 'Refining...', 'Analyzing...', 'Almost done...'];
            let i = 0;
            setLoadingMessage(msgs[0]);
            interval = setInterval(() => {
                i = (i + 1) % msgs.length;
                setLoadingMessage(msgs[i]);
            }, 2500);
        }
        return () => clearInterval(interval);
    }, [isLoading]);

    useEffect(() => {
        const handleChatChunk = (data) => {
            setMessages(prev => {
                if (prev.length === 0) return prev;
                const newMessages = [...prev];
                const lastMsg = { ...newMessages[newMessages.length - 1] };
                if (lastMsg.role === 'ai') {
                    lastMsg.content += data.content;
                    newMessages[newMessages.length - 1] = lastMsg;
                }
                return newMessages;
            });
        };

        const handleChatComplete = () => {
            setIsLoading(false);
            updateHistory(messagesRef.current, activeModeRef.current, uploadedFilesRef.current);
        };

        const handleChatError = (data) => {
            setMessages(prev => {
                const newMessages = [...prev];
                const lastMsg = newMessages[newMessages.length - 1];
                if (lastMsg && lastMsg.role === 'ai') {
                    lastMsg.content = `**Error:** ${data.error || 'Failed to fetch'}`;
                }
                return newMessages;
            });
            setIsLoading(false);
        };

        socket.on('chatChunk', handleChatChunk);
        socket.on('chatComplete', handleChatComplete);
        socket.on('chatError', handleChatError);

        return () => {
            socket.off('chatChunk', handleChatChunk);
            socket.off('chatComplete', handleChatComplete);
            socket.off('chatError', handleChatError);
        };
    }, []);

    // Auto-send voice transcript
    useEffect(() => {
        if (!isHistoryLoaded) return;

        if (transcript && transcript.trim() !== '' && transcript !== 'Listening...') {
            setInput(transcript);
            handleSend(transcript);
            setTranscript(''); // Clear so it doesn't repeatedly send
        } else if (transcript === '' || transcript === 'Listening...') {
            setTranscript(''); // Clear placeholder without sending
        }
    }, [transcript, isHistoryLoaded]);

    // Auto-detect mode while typing
    useEffect(() => {
        if (!input.trim() || activeMode === 'files') return;

        const text = input.toLowerCase();
        
        const codingKeywords = ['code', 'function', 'debug', 'java', 'js', 'python', 'script', 'algorithm', 'api', 'react', 'node', 'css', 'html', 'program', 'variable', 'class', 'import', 'export', 'const', 'let', 'var', 'sql', 'database'];
        const writingKeywords = ['summarize', 'paraphrase', 'rewrite', 'grammar', 'check', 'humanizer', 'translate', 'cover letter', 'post', 'plagiarism', 'citation', 'write', 'compose', 'proofread', 'essay', 'blog', 'email'];
        const searchKeywords = ['weather', 'news', 'today', 'current', 'latest', 'who won', 'score', 'live', 'time is it'];

        const isSearch = searchKeywords.some(k => text.includes(k));
        const isCoding = codingKeywords.some(k => text.includes(k));
        const isWriting = writingKeywords.some(k => text.includes(k));

        let suggestedMode = activeMode;
        if (isSearch) suggestedMode = 'search';
        else if (isCoding) suggestedMode = 'coding';
        else if (isWriting) suggestedMode = 'summarization';
        
        if (suggestedMode !== activeMode) {
            setActiveMode(suggestedMode);
            // Update the URL hash or state to reflect the mode visually
            const modeIcons = { search: '🌐', coding: '🧑‍💻', summarization: '📝' };
            if (modeIcons[suggestedMode]) {
                toast.success(`Switched to ${suggestedMode.charAt(0).toUpperCase() + suggestedMode.slice(1)} Mode`, { icon: modeIcons[suggestedMode], id: 'mode-switch' });
            }
        }
    }, [input, activeMode]);

    const handleSend = async (overrideInput = null) => {
        const textToSend = overrideInput !== null && typeof overrideInput === 'string' ? overrideInput : input;

        if (!textToSend.trim()) return;

        let modeToSend = activeMode;

        const userMessage = { role: 'user', content: textToSend };
        const updatedMessages = [...messages, userMessage];
        setMessages(updatedMessages);
        updateHistory(updatedMessages, modeToSend); // Pass the CORRECT mode immediately

        setInput('');
        setIsLoading(true);

        // Streaming Chat Logic
        const messagesWithBlankAI = [...updatedMessages, { role: 'ai', content: '' }];
        setMessages(messagesWithBlankAI);

        socket.emit('chatMessage', {
            messages: updatedMessages,
            mode: modeToSend,
            files: modeToSend === 'files' ? uploadedFilesRef.current.map(f => ({ name: f.name, content: f.content, chunks: f.chunks })) : []
        });
    };

    const handleRegenerate = async () => {
        if (messages.length < 2) return;
        
        // Remove the last AI message
        const prevMessages = [...messages];
        if (prevMessages[prevMessages.length - 1].role === 'ai') {
            prevMessages.pop();
        }
        
        // Find the last user message to ensure we have context
        const lastUserMsg = [...prevMessages].reverse().find(m => m.role === 'user');
        if (!lastUserMsg) return;
        
        setMessages(prevMessages);
        setIsLoading(true);

        const messagesWithBlankAI = [...prevMessages, { role: 'ai', content: '' }];
        setMessages(messagesWithBlankAI);

        socket.emit('chatMessage', {
            messages: prevMessages,
            mode: activeMode,
            files: activeMode === 'files' ? uploadedFilesRef.current.map(f => ({ name: f.name, content: f.content, chunks: f.chunks })) : []
        });
    };

    const fileInputRef = useRef(null);

    const handleFileSelect = (e) => {
        const files = Array.from(e.target.files);
        if (files && files.length > 0) {
            handleBatchUpload(files);
        }
    };

    const handleBatchUpload = async (files) => {
        for (const file of files) {
            await handleFileUpload(file);
        }
    };

    const handleFileUpload = async (file) => {
        const formData = new FormData();
        formData.append('file', file);

        setIsLoading(true);
        try {
            const response = await fetch(`${API_BASE}/api/upload`, {
                method: 'POST',
                body: formData,
            });
            const data = await response.json();

            if (data.text) {
                const newFile = {
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 5), // Ensure unique IDs in tight loop
                    name: file.name,
                    content: data.text,
                    chunks: data.chunks || []
                };

                setUploadedFiles(prev => {
                    const newFiles = [...prev, newFile]; // Append as each finishes
                    updateHistory(messages, 'files', newFiles); // Save to history immediately
                    return newFiles;
                });

                // Auto-switch to files mode so they can see the uploaded image/document
                if (activeMode !== 'files') {
                    setActiveMode('files');
                }
            } else {
                toast.error(`Upload failed: ${data.error}${data.details ? `\nDetails: ${data.details}` : ''}`);
            }
        } catch (error) {
            console.error('Error uploading file:', error);
            toast.error(`Error uploading file: ${error.message}`);
        } finally {
            setIsLoading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };



    return (
        <div className={`app-container ${activeMode === 'coding' ? 'coding-mode' : ''} ${activeMode === 'files' ? 'files-mode' : ''} ${isSidebarOpen ? 'sidebar-is-open' : ''}`}>
            <AnimatedBackground activeMode={activeMode} isDarkMode={isDarkMode} />
            {isSidebarOpen && (
                <div
                    className="sidebar-overlay"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}
            <Sidebar
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
                onNewChat={handleNewChat}
                history={history}
                onSelectChat={handleSelectChat}
                currentChatId={currentChatId}
                onDeleteChat={handleDeleteChat}
                activeMode={activeMode}
                onSelectMode={(mode) => {
                    setActiveMode(mode);
                    if (mode !== 'files') {
                        handleNewChat(); // Clear chat when switching modes, but avoid for files since files mode is generic
                    }
                }}
            />

            <div className="chat-interface">
                <header className="chat-header">
                    <div className="header-left">
                        <button className="menu-btn" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
                            <Menu size={24} />
                        </button>
                        <div className="logo-section">
                            <span className="app-brand-text">Echo AI</span>
                            {activeMode !== 'chat' && (
                                <span className="mode-badge">{activeMode} Mode</span>
                            )}
                        </div>
                    </div>

                    <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '16px', position: 'relative' }}>

                        {/* Share Button */}
                        <button
                            className="header-action-btn"
                            onClick={handleShareChat}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-main)',
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                                fontWeight: '500'
                            }}
                            title="Share Chat"
                        >
                            <Share size={18} />
                            Share
                        </button>

                        {/* More Options Menu */}
                        <div style={{ position: 'relative' }}>
                            <button
                                className="header-action-btn"
                                onClick={() => setIsOptionsMenuOpen(!isOptionsMenuOpen)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: isOptionsMenuOpen ? 'var(--glass-border)' : 'transparent',
                                    border: 'none',
                                    color: 'var(--text-main)',
                                    cursor: 'pointer',
                                    padding: '8px',
                                    borderRadius: '8px'
                                }}
                                title="More Options"
                            >
                                <MoreHorizontal size={20} />
                            </button>

                            {isOptionsMenuOpen && (
                                <div className="options-dropdown" style={{
                                    position: 'absolute',
                                    top: '100%',
                                    right: '0',
                                    marginTop: '8px',
                                    backgroundColor: 'var(--bg-card)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '12px',
                                    padding: '8px 0',
                                    width: '200px',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                                    zIndex: 1000,
                                    display: 'flex',
                                    flexDirection: 'column'
                                }}>
                                    <button onClick={togglePinChat} className="options-dropdown-item">
                                        <Pin size={16} /> Pin chat
                                    </button>
                                    <button onClick={toggleArchiveChat} className="options-dropdown-item">
                                        <Archive size={16} /> Archive
                                    </button>
                                    <button onClick={handleDownloadChat} className="options-dropdown-item">
                                        <Download size={16} /> Download chat
                                    </button>
                                    <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '4px 0' }} />
                                    <button
                                        onClick={handleDeleteCurrentChat}
                                        className="options-dropdown-item"
                                        style={{ color: '#ff6b6b' }}
                                    >
                                        <Trash2 size={16} color="#ff6b6b" /> Delete
                                    </button>
                                </div>
                            )}
                        </div>

                        <button
                            className="theme-toggle-header-btn"
                            onClick={toggleTheme}
                            style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', display: 'flex' }}
                            title="Toggle Theme"
                        >
                            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
                        </button>
                    </div>
                </header>

                <div className="chat-messages">
                    {activeMode === 'files' && (
                        <div className="files-dashboard" style={{ flex: 'none', padding: '20px', minHeight: 'auto' }}>
                            <div className="files-dashboard-header" style={{ marginBottom: '15px' }}>
                                <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Current File</h2>
                                <p style={{ fontSize: '0.9rem' }}>Chat with your most recently uploaded document below.</p>
                            </div>

                            {uploadedFiles.length === 0 ? (
                                <div className="empty-files-state" style={{ padding: '20px', marginTop: 0 }}>
                                    <FileText size={32} className="empty-file-icon" style={{ marginBottom: '10px' }} />
                                    <p style={{ fontSize: '1rem', margin: 0 }}>No files uploaded yet.</p>
                                </div>
                            ) : (
                                <div className="files-grid" style={{ paddingBottom: '10px' }}>
                                    {uploadedFiles.map(file => (
                                        <div key={file.id} className="file-card" onClick={() => setViewingFile(file)} style={{ cursor: 'pointer', padding: '15px' }}>
                                            <div className="file-card-header" style={{ marginBottom: 0 }}>
                                                <FileText className="file-card-icon" />
                                                <h3 className="file-card-title" title={file.name}>{file.name}</h3>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {messages.length === 0 ? (
                        <div className="empty-state">
                            <h1>{activeMode === 'files' ? 'What should I do with your files?' : `How can I help you ${userName}?`}</h1>
                        </div>
                    ) : (
                        messages.map((msg, index) => (
                            <MessageBubble 
                                key={index} 
                                message={msg} 
                                isLast={index === messages.length - 1}
                                onRegenerate={handleRegenerate}
                            />
                        ))
                    )}
                    {isLoading && (
                        <div className="loading-indicator-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 24px', color: 'var(--text-muted)' }}>
                            <div className="loading-indicator" style={{ display: 'flex', padding: 0, margin: 0, background: 'transparent' }}>
                                <div className="dot"></div>
                                <div className="dot"></div>
                                <div className="dot"></div>
                            </div>
                            <span style={{ fontSize: '0.9rem', fontStyle: 'italic', opacity: 0.8, transition: 'opacity 0.3s ease' }}>{loadingMessage}</span>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <div className="chat-input-area">
                    <div className="input-wrapper">
                        <input
                            type="file"
                            multiple
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                            onChange={handleFileSelect}
                            accept=".txt,.js,.py,.java,.cpp,.html,.css,.json,.md,.pdf,.docx,image/*"
                        />
                        <button className="attach-btn" onClick={() => fileInputRef.current?.click()}>
                            <Paperclip size={20} />
                        </button>
                        <button className="attach-btn" onClick={() => navigate('/voicesphere')}>
                            <Mic size={20} />
                        </button>
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={(e) => {
                                setInput(e.target.value);
                                if (textareaRef.current) {
                                    textareaRef.current.style.height = 'auto';
                                    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
                                }
                            }}
                            onKeyDown={handleKeyDown}
                            placeholder="Message Echo AI..."
                            rows={1}
                            style={{ resize: 'none', overflowY: 'auto' }}
                        />
                        <button
                            className={`send-btn ${input.trim() ? 'active' : ''}`}
                            onClick={handleSend}
                            disabled={!input.trim()}
                        >
                            <Send size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {viewingFile && (
                <div className="file-viewer-modal" onClick={() => setViewingFile(null)}>
                    <div className="file-viewer-content" onClick={e => e.stopPropagation()}>
                        <div className="file-viewer-header">
                            <h3>{viewingFile.name}</h3>
                            <button className="close-viewer-btn" onClick={() => setViewingFile(null)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="file-viewer-body">
                            <pre>{viewingFile.content}</pre>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChatInterface;
