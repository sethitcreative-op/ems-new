import React, { useState } from 'react';
import { Mail, X, Send, Paperclip, Type } from 'lucide-react';
import './FloatingEmail.css';

const FloatingEmail = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const toggleOpen = () => {
    setIsOpen(!isOpen);
    setIsMinimized(false);
  };

  const toggleMinimize = (e) => {
    e.stopPropagation();
    setIsMinimized(!isMinimized);
  };

  const closeWindow = (e) => {
    e.stopPropagation();
    setIsOpen(false);
  };

  return (
    <div className="floating-email-container">
      {isOpen && (
        <div className={`email-compose-window ${isMinimized ? 'minimized' : ''}`}>
          <div className="email-header" onClick={toggleMinimize}>
            <span className="email-title">New Message</span>
            <div className="email-actions">
              <button className="email-action-btn" onClick={toggleMinimize}>
                {isMinimized ? '+' : '-'}
              </button>
              <button className="email-action-btn" onClick={closeWindow}>
                <X size={16} />
              </button>
            </div>
          </div>
          
          {!isMinimized && (
            <div className="email-body">
              <div className="email-input-group">
                <input type="text" placeholder="Recipients" className="email-input" />
              </div>
              <div className="email-input-group">
                <input type="text" placeholder="Subject" className="email-input" />
              </div>
              <div className="email-textarea-group">
                <textarea 
                  className="email-textarea" 
                  placeholder="Placeholder for email content..."
                ></textarea>
              </div>
              
              <div className="email-footer">
                <button className="email-send-btn">
                  Send <Send size={14} style={{ marginLeft: '4px' }} />
                </button>
                <div className="email-footer-tools">
                  <button className="email-tool-btn"><Type size={16} /></button>
                  <button className="email-tool-btn"><Paperclip size={16} /></button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {!isOpen && (
        <button className="floating-email-btn" onClick={toggleOpen}>
          <Mail size={24} />
        </button>
      )}
    </div>
  );
};

export default FloatingEmail;
