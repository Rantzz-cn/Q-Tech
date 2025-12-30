import { FiAlertCircle, FiX } from 'react-icons/fi';

export default function ConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = 'Confirm Action',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'warning', // 'warning', 'danger', 'info'
  showConfirm = true // Show confirm button by default
}) {
  if (!isOpen) return null;

  const getTypeStyles = () => {
    switch (type) {
      case 'danger':
        return {
          iconColor: '#ef4444',
          buttonBg: '#dc2626',
          buttonHover: '#b91c1c',
        };
      case 'info':
        return {
          iconColor: '#3b82f6',
          buttonBg: '#2563eb',
          buttonHover: '#1d4ed8',
        };
      default: // warning
        return {
          iconColor: '#f59e0b',
          buttonBg: '#f59e0b',
          buttonHover: '#d97706',
        };
    }
  };

  const typeStyles = getTypeStyles();

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div style={backdropStyles} onClick={handleBackdropClick}>
      <div style={modalStyles}>
        <div style={headerStyles}>
          <div style={iconContainerStyles}>
            <FiAlertCircle size={24} color={typeStyles.iconColor} />
          </div>
          <h3 style={titleStyles}>{title}</h3>
          <button
            onClick={onClose}
            style={closeButtonStyles}
            aria-label="Close"
          >
            <FiX size={20} />
          </button>
        </div>
        
        <div style={contentStyles}>
          <p style={messageStyles}>{message}</p>
        </div>

        <div style={footerStyles}>
          <button
            onClick={onClose}
            style={cancelButtonStyles}
          >
            {cancelText}
          </button>
          {showConfirm && (
            <button
              onClick={onConfirm}
              style={{
                ...confirmButtonStyles,
                backgroundColor: typeStyles.buttonBg,
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = typeStyles.buttonHover;
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = typeStyles.buttonBg;
              }}
            >
              {confirmText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const backdropStyles = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 10000,
  padding: '20px',
};

const modalStyles = {
  backgroundColor: 'white',
  borderRadius: '16px',
  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  maxWidth: '400px',
  width: '100%',
  overflow: 'hidden',
  animation: 'modalSlideIn 0.3s ease-out',
};

const headerStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '20px 24px',
  borderBottom: '1px solid #e5e7eb',
  position: 'relative',
};

const iconContainerStyles = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const titleStyles = {
  fontSize: '18px',
  fontWeight: '600',
  color: '#111827',
  margin: 0,
  flex: 1,
};

const closeButtonStyles = {
  position: 'absolute',
  top: '16px',
  right: '16px',
  backgroundColor: 'transparent',
  border: 'none',
  cursor: 'pointer',
  padding: '4px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#6b7280',
  borderRadius: '6px',
  transition: 'all 0.2s',
};

const contentStyles = {
  padding: '24px',
};

const messageStyles = {
  fontSize: '15px',
  color: '#4b5563',
  lineHeight: '1.6',
  margin: 0,
};

const footerStyles = {
  display: 'flex',
  gap: '12px',
  padding: '20px 24px',
  borderTop: '1px solid #e5e7eb',
  justifyContent: 'flex-end',
};

const cancelButtonStyles = {
  padding: '10px 20px',
  backgroundColor: '#f3f4f6',
  color: '#374151',
  border: 'none',
  borderRadius: '8px',
  fontSize: '14px',
  fontWeight: '500',
  cursor: 'pointer',
  transition: 'all 0.2s',
};

const confirmButtonStyles = {
  padding: '10px 20px',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  fontSize: '14px',
  fontWeight: '600',
  cursor: 'pointer',
  transition: 'all 0.2s',
  boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
};

// Add CSS animation
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes modalSlideIn {
      from {
        transform: translateY(-20px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }
  `;
  if (!document.head.querySelector('style[data-modal-animation]')) {
    style.setAttribute('data-modal-animation', 'true');
    document.head.appendChild(style);
  }
}

