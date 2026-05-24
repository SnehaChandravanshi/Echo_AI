import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Moon, Sun } from 'lucide-react';
import { toast } from 'react-hot-toast';
import './Settings.css';

const Settings = () => {
    const navigate = useNavigate();
    const [nickname, setNickname] = useState('');
    const [isDarkMode, setIsDarkMode] = useState(true);
    const [voiceLang, setVoiceLang] = useState('en-US');

    useEffect(() => {
        const savedName = localStorage.getItem('userName') || '';
        setNickname(savedName);

        const savedTheme = localStorage.getItem('theme') || 'dark';
        setIsDarkMode(savedTheme === 'dark');
        document.documentElement.setAttribute('data-theme', savedTheme);

        const savedLang = localStorage.getItem('voiceLang') || 'en-US';
        setVoiceLang(savedLang);
    }, []);

    const handleSaveNickname = (e) => {
        e.preventDefault();
        localStorage.setItem('userName', nickname);
        toast.success('Nickname saved successfully!');
    };

    const toggleTheme = () => {
        const newTheme = isDarkMode ? 'light' : 'dark';
        setIsDarkMode(!isDarkMode);
        localStorage.setItem('theme', newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
    };

    const handleSaveLang = (e) => {
        const lang = e.target.value;
        setVoiceLang(lang);
        localStorage.setItem('voiceLang', lang);
        toast.success('Voice language updated!');
    };

    const handleClearHistory = () => {
        if (window.confirm('Are you sure you want to clear all chat history? This cannot be undone.')) {
            localStorage.removeItem(`chatHistory_${nickname}`);
            toast.success('Chat history cleared!');
        }
    };

    return (
        <div className="settings-container">
            <div className="settings-header">
                <button className="back-btn" onClick={() => navigate(-1)}>
                    <ArrowLeft size={24} />
                </button>
                <h1>Settings</h1>
            </div>

            <div className="settings-content">
                <div className="settings-section">
                    <h2><User size={20} /> Profile Information</h2>
                    <form className="settings-form" onSubmit={handleSaveNickname}>
                        <div className="form-group">
                            <label htmlFor="nickname">Nickname / Go by Name</label>
                            <p className="helper-text">This is the name Echo AI will call you in the chat.</p>
                            <input
                                type="text"
                                id="nickname"
                                value={nickname}
                                onChange={(e) => setNickname(e.target.value)}
                                placeholder="Enter your nickname"
                                required
                            />
                        </div>
                        <button type="submit" className="save-btn">Save Nickname</button>
                    </form>
                </div>

                <div className="settings-section">
                    <h2><Moon size={20} /> Appearance & Preferences</h2>
                    <div className="theme-toggle-container" style={{ marginBottom: '20px' }}>
                        <div className="theme-info">
                            <h3>Application Theme</h3>
                            <p className="helper-text">Switch between Dark and Light mode depending on your preference.</p>
                        </div>
                        <button className={`theme-toggle-btn ${isDarkMode ? 'dark' : 'light'}`} onClick={toggleTheme}>
                            {isDarkMode ? <Moon size={18} /> : <Sun size={18} />}
                            {isDarkMode ? 'Dark Mode' : 'Light Mode'}
                        </button>
                    </div>

                    <div className="theme-toggle-container" style={{ marginBottom: '20px' }}>
                        <div className="theme-info">
                            <h3>Voice Language</h3>
                            <p className="helper-text">Set the language used for Voice Input and AI speech output.</p>
                        </div>
                        <select 
                            value={voiceLang} 
                            onChange={handleSaveLang}
                            style={{ padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}
                        >
                            <option value="en-US">English (US)</option>
                            <option value="es-ES">Spanish</option>
                            <option value="fr-FR">French</option>
                            <option value="de-DE">German</option>
                            <option value="hi-IN">Hindi</option>
                        </select>
                    </div>

                    <div className="theme-toggle-container">
                        <div className="theme-info">
                            <h3>Data Management</h3>
                            <p className="helper-text">Manage your stored chat history and local data.</p>
                        </div>
                        <button 
                            onClick={handleClearHistory}
                            style={{ padding: '8px 16px', borderRadius: '8px', background: '#ff6b6b', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                            Clear All Chat History
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;
