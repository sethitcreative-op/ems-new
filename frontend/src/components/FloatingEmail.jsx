import React, { useState, useRef, useEffect } from 'react';
import { Mail, X, Send, Paperclip, Type, Bold, Italic, Underline } from 'lucide-react';
import axios from 'axios';
import './FloatingEmail.css';
import API_BASE from '../config/api';

const FloatingEmail = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showFormatting, setShowFormatting] = useState(false);
  
  const fileInputRef = useRef(null);
  const editorRef = useRef(null);
  
  const user = JSON.parse(localStorage.getItem('user')) || {};
  const defaultEmail = user.email || 'admin@gmail.com';

  const [formData, setFormData] = useState({
    from_email: defaultEmail,
    recipient: '',
    subject: ''
  });
  const [attachment, setAttachment] = useState(null);
  const [senderEmails, setSenderEmails] = useState([]);

  useEffect(() => {
    const fetchSenders = async () => {
      try {
        const response = await axios.get(`${API_BASE}/mailer.php`);
        if (response.data.status === 'success' && response.data.emails) {
          setSenderEmails(response.data.emails);
          if (response.data.emails.length > 0) {
            // If the logged-in admin's email is in the list, auto-select it. Otherwise pick the first one.
            if (response.data.emails.includes(defaultEmail)) {
              setFormData(prev => ({ ...prev, from_email: defaultEmail }));
            } else {
              setFormData(prev => ({ ...prev, from_email: response.data.emails[0] }));
            }
          }
        }
      } catch (error) {
        console.error("Error fetching sender emails:", error);
      }
    };
    fetchSenders();
  }, [defaultEmail]);

  const toggleOpen = () => {
    setIsOpen(!isOpen);
  };

  const closeWindow = (e) => {
    e.stopPropagation();
    setIsOpen(false);
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif'];
      if (!allowedTypes.includes(file.type)) {
        alert("Only PDF and Images are allowed.");
        return;
      }
      setAttachment(file);
    }
  };

  const formatText = (command) => {
    document.execCommand(command, false, null);
    if (editorRef.current) {
      editorRef.current.focus();
    }
  };

  const sendEmail = async () => {
    const message = editorRef.current ? editorRef.current.innerHTML : '';
    
    if (!formData.recipient || !formData.subject || !message.trim()) {
      alert("Please fill in all fields.");
      return;
    }

    setLoading(true);

    const payload = new FormData();
    payload.append('from_email', formData.from_email);
    payload.append('recipient', formData.recipient);
    payload.append('subject', formData.subject);
    payload.append('message', message);
    if (attachment) {
      payload.append('attachment', attachment);
    }

    try {
      const response = await axios.post(`${API_BASE}/mailer.php`, payload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.status === 'success') {
        alert("Email sent successfully!");
        setIsOpen(false);
        const resetSender = senderEmails.length > 0 ? senderEmails[0] : defaultEmail;
        setFormData({ from_email: resetSender, recipient: '', subject: '' });
        setAttachment(null);
        if (editorRef.current) editorRef.current.innerHTML = '';
      } else {
        // Show the actual SMTP error from the backend
        alert("Failed to send email:\n" + (response.data.message || 'Unknown error'));
      }
    } catch (error) {
      console.error(error);
      // Try to surface the backend message if available, otherwise show network error
      const backendMsg = error?.response?.data?.message;
      alert(backendMsg ? `Failed to send email:\n${backendMsg}` : "Network error — could not reach the mail server. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  if (user.role !== 'admin') {
    return null;
  }

  return (
    <div className="floating-email-container">
      {isOpen && (
        <div className="email-compose-window">
          <div className="email-header">
            <span className="email-title">New Message</span>
            <div className="email-actions">
              <button className="email-action-btn" onClick={closeWindow}>
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="email-body">
            <div className="email-input-group" style={{ display: 'flex', alignItems: 'center', padding: '0 16px' }}>
              <span style={{ color: '#6b7280', fontSize: '0.85rem', marginRight: '8px', minWidth: '40px' }}>From:</span>
              <select 
                name="from_email" 
                className="email-input" 
                style={{ paddingLeft: '0' }}
                value={formData.from_email} 
                onChange={handleInputChange}
              >
                {senderEmails.length > 0 ? (
                  senderEmails.map((email, idx) => (
                    <option key={idx} value={email}>{email}</option>
                  ))
                ) : (
                  <option value={defaultEmail}>{defaultEmail}</option>
                )}
              </select>
            </div>
            <div className="email-input-group">
              <input 
                type="email" 
                name="recipient"
                placeholder="To (Recipient's Email)" 
                className="email-input"
                value={formData.recipient}
                onChange={handleInputChange}
              />
            </div>
            <div className="email-input-group">
              <input 
                type="text" 
                name="subject"
                placeholder="Subject" 
                className="email-input"
                value={formData.subject}
                onChange={handleInputChange}
              />
            </div>
            
            {showFormatting && (
              <div className="email-formatting-toolbar">
                <button onClick={() => formatText('bold')} title="Bold"><Bold size={14} /></button>
                <button onClick={() => formatText('italic')} title="Italic"><Italic size={14} /></button>
                <button onClick={() => formatText('underline')} title="Underline"><Underline size={14} /></button>
              </div>
            )}
            
            <div className="email-textarea-group">
              <div 
                className="email-textarea"
                contentEditable={true}
                ref={editorRef}
                style={{ minHeight: '150px', outline: 'none' }}
                data-placeholder="Description"
              ></div>
            </div>

            {attachment && (
              <div className="email-attachment-preview">
                <span className="attachment-name">📎 {attachment.name}</span>
                <button className="attachment-remove-btn" onClick={() => setAttachment(null)}><X size={14}/></button>
              </div>
            )}

            <div className="email-footer">
              <button className="email-send-btn" onClick={sendEmail} disabled={loading}>
                {loading ? 'Sending...' : 'Send'} <Send size={14} style={{ marginLeft: '4px' }} />
              </button>
              <div className="email-footer-tools">
                <input 
                  type="file" 
                  accept=".pdf, image/png, image/jpeg, image/gif" 
                  style={{ display: 'none' }} 
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />
                <button className="email-tool-btn" onClick={() => setShowFormatting(!showFormatting)} title="Format Text">
                  <Type size={16} />
                </button>
                <button className="email-tool-btn" onClick={() => fileInputRef.current.click()} title="Attach File">
                  <Paperclip size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {!isOpen && (
        <button className="floating-email-btn compose-btn" onClick={toggleOpen}>
          <Mail size={20} className="compose-icon" />
          <span className="compose-text">Compose Email</span>
        </button>
      )}
    </div>
  );
};

export default FloatingEmail;
