import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Sparkles, Linkedin } from 'lucide-react';
import './DeveloperInfo.css';

const DeveloperInfo = () => {
    const navigate = useNavigate();

    useEffect(() => {
        const savedTheme = localStorage.getItem('theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);
    }, []);

    return (
        <div className="dev-page-container">
            <div className="dev-page-header">
                <button className="back-btn" onClick={() => navigate(-1)}>
                    <ArrowLeft size={24} />
                </button>
                <h1>Developer Info</h1>
            </div>

            <div className="dev-page-content">
                <div className="dev-intro-card">
                    <Sparkles size={32} className="sparkle-icon" />
                    <h2>Meet the Creators</h2>
                    <p>
                        We are passionate creators dedicated to building Echo AI, a next-generation intelligent conversational experience that merges voice and chat seamlessly.
                    </p>
                </div>

                <div className="dev-cards-container">
                    <div className="dev-profile-card">
                        <img src="/kushal.png" alt="Kushal Zanzari" className="dev-avatar-img" />
                        <h3>Kushal Zanzari</h3>
                        <div className="dev-actions">
                            <a href="mailto:zanzarikushal@gmail.com" className="dev-btn email-btn">
                                <Mail size={16} /> Email
                            </a>
                            <a href="https://www.linkedin.com/in/kushal-z-a96535255" target="_blank" rel="noopener noreferrer" className="dev-btn linkedin-btn">
                                <Linkedin size={16} /> LinkedIn
                            </a>
                        </div>
                    </div>

                    <div className="dev-profile-card">
                        <img src="/sneha.png" alt="Sneha Chandravanshi" className="dev-avatar-img" />
                        <h3>Sneha Chandravanshi</h3>
                        <div className="dev-actions">
                            <a href="mailto:chandravanshisneha102@gmail.com" className="dev-btn email-btn">
                                <Mail size={16} /> Email
                            </a>
                            <a href="https://www.linkedin.com/in/sneha-chandravanshi-374082252" target="_blank" rel="noopener noreferrer" className="dev-btn linkedin-btn">
                                <Linkedin size={16} /> LinkedIn
                            </a>
                        </div>
                    </div>
                </div>

                <div className="dev-suggestions-footer">
                    <p>Have any cool ideas, questions, or suggestions for Echo AI?</p>
                    <p className="sub-prompt">We'd love to collaborate! Get in touch with us at our links above.</p>
                </div>
            </div>
        </div>
    );
};

export default DeveloperInfo;
