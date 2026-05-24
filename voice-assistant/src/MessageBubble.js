import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Volume2, VolumeX, RefreshCw } from 'lucide-react';
import './MessageBubble.css';

const CodeBlock = ({ language, children }) => {
    const [copied, setCopied] = React.useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(children).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <div className="code-block-wrapper">
            <div className="code-block-header">
                <span className="code-lang">{language}</span>
                <button className="copy-btn" onClick={handleCopy}>
                    {copied ? (
                        <>
                            <span>✓</span> Copied
                        </>
                    ) : (
                        <>
                            <span>📋</span> Copy Code
                        </>
                    )}
                </button>
            </div>
            <SyntaxHighlighter
                language={language}
                style={vscDarkPlus}
                customStyle={{ margin: 0, borderBottomLeftRadius: '8px', borderBottomRightRadius: '8px', background: '#1e1e1e' }}
            >
                {children}
            </SyntaxHighlighter>
        </div>
    );
};

const MessageBubble = ({ message, isLast, onRegenerate }) => {
    const isUser = message.role === 'user';
    const [isSpeaking, setIsSpeaking] = React.useState(false);

    const handleSpeak = (text) => {
        if (isSpeaking) {
            window.speechSynthesis.cancel();
            setIsSpeaking(false);
        } else {
            // Stop any existing speech first
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            
            // Get voice preference
            const preferredLang = localStorage.getItem('voiceLang') || 'en-US';
            utterance.lang = preferredLang;
            
            utterance.onend = () => setIsSpeaking(false);
            window.speechSynthesis.speak(utterance);
            setIsSpeaking(true);
        }
    };

    // Clean up speech on unmount
    React.useEffect(() => {
        return () => {
            if (isSpeaking) {
                window.speechSynthesis.cancel();
            }
        };
    }, [isSpeaking]);

    return (
        <div className={`message-bubble-container ${isUser ? 'user-bubble-container' : 'ai-bubble-container'}`}>
            {!isUser && (
                <div className="ai-avatar">
                    <span className="ai-avatar-image" aria-label="AI Avatar">AI</span>
                </div>
            )}
            <div className={`message-bubble ${isUser ? 'user-bubble' : 'ai-bubble'}`}>
                {isUser ? (
                    <p>{message.content}</p>
                ) : (
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                            code({ node, inline, className, children, ...props }) {
                                const match = /language-(\w+)/.exec(className || '');
                                return !inline && match ? (
                                    <CodeBlock language={match[1]} children={String(children).replace(/\n$/, '')} />
                                ) : (
                                    <code className={className} {...props}>
                                        {children}
                                    </code>
                                );
                            }
                        }}
                    >
                        {message.content}
                    </ReactMarkdown>
                )}
            </div>
            
            {/* Text-to-Speech Button (Only for AI messages) */}
            {!isUser && (
                <div style={{ display: 'flex', alignItems: 'center', alignSelf: 'flex-end', marginTop: '-4px', marginBottom: '4px' }}>
                    <button 
                        onClick={() => handleSpeak(message.content)} 
                        className="tts-btn"
                        title={isSpeaking ? "Stop speaking" : "Read aloud"}
                        style={{ margin: 0 }}
                    >
                        {isSpeaking ? <VolumeX size={16} /> : <Volume2 size={16} />}
                    </button>
                    {isLast && onRegenerate && (
                        <button 
                            onClick={onRegenerate} 
                            className="tts-btn" 
                            title="Regenerate response"
                            style={{ margin: '0 0 0 4px' }}
                        >
                            <RefreshCw size={14} />
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default MessageBubble;
