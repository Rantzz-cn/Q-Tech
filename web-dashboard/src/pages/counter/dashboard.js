import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import { 
  FiClock, FiTarget, FiPhone, FiAlertCircle, 
  FiInfo, FiMapPin, FiTrendingUp, FiUsers, FiCheckCircle,
  FiLoader, FiXCircle, FiUser, FiLogOut, FiRefreshCw
} from 'react-icons/fi';
import { MdQueue, MdCheckCircle, MdAccessTime, MdBusiness, MdLocationOn } from 'react-icons/md';
import { HiOutlineQueueList, HiOutlineUsers } from 'react-icons/hi2';
import apiClient from '../../lib/api';
import { isAuthenticated, getStoredUser, logout } from '../../lib/auth';
import { toast } from '../../components/Toast';
import ConfirmModal from '../../components/ConfirmModal';

export default function CounterDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [counters, setCounters] = useState([]);
  const [selectedCounter, setSelectedCounter] = useState(null);
  const [currentQueue, setCurrentQueue] = useState(null);
  const [queueStatus, setQueueStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [calling, setCalling] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }

    const currentUser = getStoredUser();
    if (currentUser?.role !== 'counter_staff') {
      router.push('/login');
      return;
    }

    setUser(currentUser);
    loadCounters();
  }, [router]);

  // Use ref to store latest selectedCounter to avoid closure issues
  const selectedCounterRef = useRef(selectedCounter);
  useEffect(() => {
    selectedCounterRef.current = selectedCounter;
  }, [selectedCounter]);

  const loadCounterData = async (counterId) => {
    try {
      const response = await apiClient.get(`/counters/${counterId}`);
      if (response.success && response.data) {
        setCurrentQueue(response.data.currentServing || null);
        setQueueStatus(response.data.queueStatus || null);
      } else {
        setCurrentQueue(null);
        setQueueStatus(null);
      }
    } catch (error) {
      setCurrentQueue(null);
      setQueueStatus(null);
    }
  };

  const loadCounters = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/counters/my-counters');
      
      if (response.success && response.data.length > 0) {
        setCounters(response.data);
        
        // Preserve selected counter if it still exists, otherwise select first
        const currentCounterId = selectedCounterRef.current?.id;
        let counterToSelect = null;
        
        if (currentCounterId) {
          // Check if current selected counter is still in the list
          counterToSelect = response.data.find(c => c.id === currentCounterId);
        }
        
        // If current counter not found or no counter selected, use first one
        if (!counterToSelect) {
          counterToSelect = response.data[0];
        }
        
        // Only update selected counter if it changed
        if (counterToSelect && counterToSelect.id !== selectedCounterRef.current?.id) {
          setSelectedCounter(counterToSelect);
          // Load data for newly selected counter
          if (counterToSelect.id) {
            try {
              await loadCounterData(counterToSelect.id);
            } catch (err) {
              setCurrentQueue(null);
              setQueueStatus(null);
            }
          }
        }
      } else if (response.success && response.data.length === 0) {
        // No counters available
        setCounters([]);
        setSelectedCounter(null);
        setCurrentQueue(null);
        setQueueStatus(null);
      }
    } catch (error) {
      console.error('Error loading counters:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Auto-refresh counters list every 60 seconds to pick up new counters
    // (Counters don't change frequently, so we can refresh less often)
    const countersInterval = setInterval(() => {
      loadCounters();
    }, 60000); // Refresh every 60 seconds

    // Refresh when window regains focus (user switches back to tab)
    const handleFocus = () => {
      loadCounters();
    };
    window.addEventListener('focus', handleFocus);

    // Refresh when page becomes visible
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadCounters();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(countersInterval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadCounters]);

  useEffect(() => {
    // Auto-refresh counter data every 30 seconds when counter is selected
    // (Queue status changes more frequently, but 30s is sufficient for real-time feel)
    if (!selectedCounter?.id) return;

    const interval = setInterval(() => {
      loadCounterData(selectedCounter.id);
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [selectedCounter?.id]);

  const handleCounterChange = async (counterId) => {
    console.log('handleCounterChange called with:', counterId, 'Type:', typeof counterId);
    console.log('Current counters:', counters);
    
    const counterIdNum = parseInt(counterId, 10);
    console.log('Parsed counter ID:', counterIdNum);
    
    const counter = counters.find(c => {
      const cId = typeof c.id === 'string' ? parseInt(c.id, 10) : Number(c.id);
      const match = cId === counterIdNum;
      console.log(`Comparing counter ${c.name}: ${cId} (${typeof c.id}) === ${counterIdNum} -> ${match}`);
      return match;
    });
    
    console.log('Found counter:', counter);
    
    if (counter) {
      console.log('Setting selected counter to:', counter);
      setSelectedCounter(counter);
      setCurrentQueue(null);
      setQueueStatus(null);
      await loadCounterData(counter.id);
    } else {
      console.error('Counter not found! CounterId:', counterIdNum, 'Available:', counters.map(c => ({ id: c.id, type: typeof c.id, name: c.name })));
    }
  };

  const handleCallNext = async () => {
    if (!selectedCounter) return;

    setCalling(true);
    try {
      const response = await apiClient.post(`/counters/${selectedCounter.id}/call-next`);
      if (response.success && response.data) {
        setCurrentQueue({
          id: response.data.queueId,
          queueNumber: response.data.queueNumber,
          status: 'called',
        });
        await loadCounterData(selectedCounter.id);
      }
    } catch (error) {
      toast.error(error.error?.message || 'Failed to call next queue');
    } finally {
      setCalling(false);
    }
  };

  const handleStartServing = async () => {
    if (!selectedCounter || !currentQueue) return;

    setCompleting(true);
    try {
      const response = await apiClient.post(`/counters/${selectedCounter.id}/start-serving/${currentQueue.id}`);
      if (response.success) {
        await loadCounterData(selectedCounter.id);
      }
    } catch (error) {
      toast.error(error.error?.message || 'Failed to start serving');
    } finally {
      setCompleting(false);
    }
  };

  const handleComplete = () => {
    if (!selectedCounter || !currentQueue) return;
    setShowCompleteConfirm(true);
  };

  const handleCompleteConfirm = async () => {
    if (!selectedCounter || !currentQueue) return;
    
    setShowCompleteConfirm(false);
    setCompleting(true);
    try {
      const response = await apiClient.post(`/counters/${selectedCounter.id}/complete/${currentQueue.id}`);
      if (response.success) {
        setCurrentQueue(null);
        await loadCounterData(selectedCounter.id);
        toast.success('Service completed successfully');
      } else {
        toast.error(response.error?.message || 'Failed to complete queue');
      }
    } catch (error) {
      toast.error(error.error?.message || 'Failed to complete queue');
    } finally {
      setCompleting(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  if (typeof window === 'undefined' || loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingContainer}>
          <div style={styles.spinnerWrapper}>
            <FiLoader style={styles.spinner} className="spin" />
          </div>
          <p style={styles.loadingText}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.logoSection}>
            <div style={styles.logo}>
              <img 
                src="/logo.png" 
                alt="QTech Logo" 
                style={styles.logoImage}
              />
            </div>
            <div>
              <h1 style={styles.headerTitle}>Counter Dashboard</h1>
              <p style={styles.headerSubtitle}>QTech Queue Management System</p>
            </div>
          </div>
        </div>
        <div style={styles.headerRight}>
          <div style={styles.userInfo}>
            <div style={styles.userIcon}>
              <FiUser size={20} />
            </div>
            <div style={styles.userDetails}>
              <span style={styles.userName}>{user?.first_name} {user?.last_name}</span>
              <span style={styles.userRole}>Counter Staff</span>
            </div>
          </div>
          <button onClick={handleLogout} style={styles.logoutButton}>
            <FiLogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </header>

      <main style={styles.main}>
        {counters.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIconWrapper}>
              <MdBusiness size={96} color="#cbd5e0" />
            </div>
            <h2 style={styles.emptyTitle}>No Counters Assigned</h2>
            <p style={styles.emptyMessage}>
              You don't have any counters assigned to you. Please contact your administrator to get access.
            </p>
          </div>
        ) : (
          <>
            {/* Counter Selection */}
            <div style={styles.section}>
              <div style={styles.sectionHeaderWithButton}>
                <label style={styles.label}>
                  <MdBusiness size={20} style={{ marginRight: '10px', verticalAlign: 'middle' }} />
                  Select Counter
                </label>
                <button
                  onClick={loadCounters}
                  disabled={loading}
                  style={styles.refreshButton}
                  title="Refresh counters list"
                >
                  <FiRefreshCw size={18} className={loading ? "spin" : ""} />
                  <span>Refresh</span>
                </button>
              </div>
              <select
                value={selectedCounter ? String(selectedCounter.id) : ''}
                onChange={(e) => {
                  const newCounterId = e.target.value;
                  console.log('Select onChange - new value:', newCounterId, 'Current selected:', selectedCounter?.id);
                  handleCounterChange(newCounterId);
                }}
                style={styles.select}
              >
                {counters.map((counter) => {
                  const optionValue = String(counter.id);
                  return (
                    <option key={counter.id} value={optionValue}>
                      {counter.name} - {counter.service_name}
                    </option>
                  );
                })}
              </select>
            </div>

            {selectedCounter && (
              <>
                {/* Queue Statistics */}
                {queueStatus && (
                  <div style={styles.statsSection}>
                    <div style={styles.sectionHeader}>
                      <FiTrendingUp size={24} style={{ marginRight: '12px' }} />
                      <h2 style={styles.sectionTitle}>Queue Overview</h2>
                    </div>
                    <div style={styles.statsGrid}>
                      <div style={{...styles.statCard, ...styles.statWaiting}}>
                        <div style={styles.statIconWrapper}>
                          <HiOutlineQueueList size={32} color="#f59e0b" />
                        </div>
                        <div style={styles.statContent}>
                          <span style={styles.statValue}>{queueStatus.waitingCount}</span>
                          <span style={styles.statLabel}>Waiting</span>
                        </div>
                      </div>
                      <div style={{...styles.statCard, ...styles.statCalled}}>
                        <div style={styles.statIconWrapper}>
                          <FiClock size={32} color="#dc2626" />
                        </div>
                        <div style={styles.statContent}>
                          <span style={styles.statValue}>{queueStatus.calledCount}</span>
                          <span style={styles.statLabel}>Called</span>
                        </div>
                      </div>
                      <div style={{...styles.statCard, ...styles.statServing}}>
                        <div style={styles.statIconWrapper}>
                          <FiCheckCircle size={32} color="#10b981" />
                        </div>
                        <div style={styles.statContent}>
                          <span style={styles.statValue}>{queueStatus.servingCount}</span>
                          <span style={styles.statLabel}>Serving</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Counter Information Card */}
                <div style={styles.counterCard}>
                  <div style={styles.counterHeader}>
                    <div style={styles.counterInfo}>
                      <h2 style={styles.counterTitle}>{selectedCounter.name}</h2>
                      <div style={styles.counterMeta}>
                        <MdLocationOn size={18} color="#64748b" />
                        <span style={styles.serviceName}>{selectedCounter.service_name}</span>
                        <span style={styles.separator}>•</span>
                        <span style={getStatusStyle(selectedCounter.status)}>
                          {selectedCounter.status.charAt(0).toUpperCase() + selectedCounter.status.slice(1)}
                        </span>
                      </div>
                    </div>
                    <div style={getStatusBadgeStyle(selectedCounter.status)}>
                      {getStatusIcon(selectedCounter.status)}
                      <span>{selectedCounter.status.toUpperCase()}</span>
                    </div>
                  </div>

                  {/* Current Queue Section */}
                  {currentQueue && currentQueue.queueNumber ? (
                    <div style={styles.currentQueueSection}>
                      <div style={styles.currentQueueHeader}>
                        <div style={styles.currentQueueTitleWrapper}>
                          <FiTarget size={24} color="#dc2626" />
                          <h3 style={styles.currentQueueTitle}>Currently Serving</h3>
                        </div>
                      </div>
                      <div style={styles.queueDisplay}>
                        <div style={styles.queueNumberLarge}>
                          {currentQueue.queueNumber}
                        </div>
                        <div style={styles.queueStatusBadge}>
                          {currentQueue.status === 'called' && (
                            <>
                              <FiClock size={16} />
                              <span>Called</span>
                            </>
                          )}
                          {currentQueue.status === 'serving' && (
                            <>
                              <FiLoader size={16} className="spin" />
                              <span>Serving</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div style={styles.queueActions}>
                        {currentQueue.status === 'called' && (
                          <>
                            <button
                              onClick={handleStartServing}
                              disabled={completing}
                              style={styles.primaryButton}
                            >
                              <FiCheckCircle size={20} />
                              <span>Start Serving</span>
                            </button>
                            <button
                              onClick={handleComplete}
                              disabled={completing}
                              style={styles.successButton}
                            >
                              {completing ? (
                                <>
                                  <FiLoader size={20} className="spin" />
                                  <span>Completing...</span>
                                </>
                              ) : (
                                <>
                                  <MdCheckCircle size={20} />
                                  <span>Complete Service</span>
                                </>
                              )}
                            </button>
                          </>
                        )}
                        {currentQueue.status === 'serving' && (
                          <button
                            onClick={handleComplete}
                            disabled={completing}
                            style={{...styles.successButton, width: '100%'}}
                          >
                            {completing ? (
                              <>
                                <FiLoader size={20} className="spin" />
                                <span>Completing...</span>
                              </>
                            ) : (
                              <>
                                <MdCheckCircle size={20} />
                                <span>Complete Service</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div style={styles.noQueueSection}>
                      <div style={styles.noQueueIcon}>
                        <FiClock size={64} color="#cbd5e0" />
                      </div>
                      <h3 style={styles.noQueueTitle}>No Active Queue</h3>
                      <p style={styles.noQueueMessage}>
                        There is no queue currently being served. Click "Call Next Queue" to get started.
                      </p>
                    </div>
                  )}

                  {/* Call Next Button */}
                  <div style={styles.actionSection}>
                    <button
                      onClick={handleCallNext}
                      disabled={calling || selectedCounter.status === 'closed' || currentQueue !== null}
                      style={{
                        ...styles.callButton,
                        opacity: (calling || selectedCounter.status === 'closed' || currentQueue !== null) ? 0.6 : 1,
                        cursor: (calling || selectedCounter.status === 'closed' || currentQueue !== null) ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {calling ? (
                        <>
                          <FiLoader size={24} className="spin" />
                          <span>Calling Next Queue...</span>
                        </>
                      ) : (
                        <>
                          <FiPhone size={24} />
                          <span>Call Next Queue</span>
                        </>
                      )}
                    </button>
                    {currentQueue && (
                      <div style={styles.alertInfo}>
                        <FiInfo size={18} />
                        <span>Complete the current queue before calling the next one.</span>
                      </div>
                    )}
                    {selectedCounter.status === 'closed' && (
                      <div style={styles.alertWarning}>
                        <FiAlertCircle size={18} />
                        <span>Counter is closed. Please open the counter to call queues.</span>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </main>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={showCompleteConfirm}
        onClose={() => setShowCompleteConfirm(false)}
        onConfirm={handleCompleteConfirm}
        title="Complete Service"
        message={`Complete service for queue ${currentQueue?.queueNumber}?`}
        confirmText="Complete"
        cancelText="Cancel"
        type="warning"
      />
    </div>
  );
}

const getStatusIcon = (status) => {
  const icons = {
    open: <FiCheckCircle size={16} />,
    busy: <FiLoader size={16} className="spin" />,
    closed: <FiXCircle size={16} />,
    break: <FiClock size={16} />,
  };
  return icons[status] || icons.open;
};

const getStatusStyle = (status) => {
  const colors = {
    open: { color: '#10b981', fontWeight: '600' },
    busy: { color: '#f59e0b', fontWeight: '600' },
    closed: { color: '#ef4444', fontWeight: '600' },
    break: { color: '#6b7280', fontWeight: '600' },
  };
  return colors[status] || colors.open;
};

const getStatusBadgeStyle = (status) => {
  const styles = {
    open: {
      backgroundColor: '#d1fae5',
      color: '#065f46',
      borderColor: '#10b981',
    },
    busy: {
      backgroundColor: '#fef3c7',
      color: '#92400e',
      borderColor: '#f59e0b',
    },
    closed: {
      backgroundColor: '#fee2e2',
      color: '#991b1b',
      borderColor: '#ef4444',
    },
    break: {
      backgroundColor: '#f3f4f6',
      color: '#374151',
      borderColor: '#6b7280',
    },
  };
  const style = styles[status] || styles.open;
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '600',
    border: `1px solid ${style.borderColor}`,
    backgroundColor: style.backgroundColor,
    color: style.color,
  };
};

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
  },
  spinnerWrapper: {
    marginBottom: '24px',
  },
  spinner: {
    color: '#dc2626',
  },
  loadingText: {
    color: '#64748b',
    fontSize: '16px',
    fontWeight: '500',
  },
  header: {
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e2e8f0',
    padding: '20px 40px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
  },
  logoSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  logo: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    backgroundColor: 'transparent',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImage: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    display: 'block',
  },
  headerTitle: {
    margin: 0,
    fontSize: '24px',
    fontWeight: '700',
    color: '#1e293b',
    letterSpacing: '-0.5px',
  },
  headerSubtitle: {
    margin: '4px 0 0 0',
    fontSize: '14px',
    color: '#64748b',
    fontWeight: '400',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  userIcon: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: '#f1f5f9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#475569',
  },
  userDetails: {
    display: 'flex',
    flexDirection: 'column',
  },
  userName: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1e293b',
    lineHeight: '1.4',
  },
  userRole: {
    fontSize: '12px',
    color: '#64748b',
    lineHeight: '1.4',
  },
  logoutButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 20px',
    backgroundColor: '#f1f5f9',
    color: '#475569',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  main: {
    padding: '32px',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  section: {
    marginBottom: '24px',
  },
  sectionHeaderWithButton: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '600',
    color: '#1e293b',
    margin: 0,
  },
  refreshButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    backgroundColor: '#f1f5f9',
    color: '#475569',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  select: {
    width: '100%',
    padding: '12px 16px',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    fontSize: '15px',
    backgroundColor: 'white',
    color: '#1e293b',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  statsSection: {
    marginBottom: '32px',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '20px',
  },
  sectionTitle: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#1e293b',
    margin: 0,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '20px',
  },
  statCard: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '24px',
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: '1px solid #e2e8f0',
    transition: 'all 0.2s',
  },
  statWaiting: {
    borderLeft: '4px solid #f59e0b',
  },
  statCalled: {
    borderLeft: '4px solid #dc2626',
  },
  statServing: {
    borderLeft: '4px solid #10b981',
  },
  statIconWrapper: {
    width: '56px',
    height: '56px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  statContent: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
  },
  statValue: {
    fontSize: '32px',
    fontWeight: '700',
    color: '#1e293b',
    lineHeight: '1.2',
  },
  statLabel: {
    fontSize: '14px',
    color: '#64748b',
    fontWeight: '500',
    marginTop: '4px',
  },
  counterCard: {
    backgroundColor: 'white',
    borderRadius: '16px',
    padding: '32px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.07)',
    border: '1px solid #e2e8f0',
  },
  counterHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '32px',
    paddingBottom: '24px',
    borderBottom: '2px solid #f1f5f9',
  },
  counterInfo: {
    flex: 1,
  },
  counterTitle: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#1e293b',
    margin: '0 0 12px 0',
    letterSpacing: '-0.5px',
  },
  counterMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    fontSize: '15px',
    color: '#64748b',
  },
  serviceName: {
    fontWeight: '500',
    color: '#475569',
  },
  separator: {
    color: '#cbd5e0',
  },
  currentQueueSection: {
    backgroundColor: '#fef2f2',
    border: '2px solid #dc2626',
    borderRadius: '16px',
    padding: '32px',
    marginBottom: '32px',
  },
  currentQueueHeader: {
    marginBottom: '24px',
  },
  currentQueueTitleWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  currentQueueTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#991b1b',
    margin: 0,
  },
  queueDisplay: {
    textAlign: 'center',
    marginBottom: '32px',
  },
  queueNumberLarge: {
    fontSize: '72px',
    fontWeight: '800',
    color: '#1e293b',
    letterSpacing: '-2px',
    marginBottom: '16px',
    lineHeight: '1',
  },
  queueStatusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 20px',
    backgroundColor: '#dc2626',
    color: 'white',
    borderRadius: '20px',
    fontSize: '14px',
    fontWeight: '600',
  },
  queueActions: {
    display: 'flex',
    gap: '12px',
  },
  noQueueSection: {
    backgroundColor: '#f8fafc',
    border: '2px dashed #cbd5e0',
    borderRadius: '16px',
    padding: '64px 32px',
    textAlign: 'center',
    marginBottom: '32px',
  },
  noQueueIcon: {
    marginBottom: '24px',
    display: 'inline-block',
  },
  noQueueTitle: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#1e293b',
    margin: '0 0 12px 0',
  },
  noQueueMessage: {
    fontSize: '15px',
    color: '#64748b',
    margin: 0,
    maxWidth: '400px',
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  actionSection: {
    marginTop: '32px',
  },
  callButton: {
    width: '100%',
    padding: '18px 24px',
    backgroundColor: '#dc2626',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    fontSize: '18px',
    fontWeight: '700',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    boxShadow: '0 4px 6px rgba(220, 38, 38, 0.3)',
  },
  primaryButton: {
    flex: 1,
    padding: '14px 24px',
    backgroundColor: '#dc2626',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    fontSize: '16px',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  successButton: {
    flex: 1,
    padding: '14px 24px',
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    fontSize: '16px',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  alertInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginTop: '16px',
    padding: '12px 16px',
    backgroundColor: '#fee2e2',
    color: '#991b1b',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
  },
  alertWarning: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginTop: '16px',
    padding: '12px 16px',
    backgroundColor: '#fef3c7',
    color: '#92400e',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
  },
  emptyState: {
    backgroundColor: 'white',
    borderRadius: '16px',
    padding: '80px 40px',
    textAlign: 'center',
    boxShadow: '0 4px 6px rgba(0,0,0,0.07)',
    border: '1px solid #e2e8f0',
  },
  emptyIconWrapper: {
    marginBottom: '32px',
    display: 'inline-block',
  },
  emptyTitle: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#1e293b',
    margin: '0 0 16px 0',
  },
  emptyMessage: {
    fontSize: '16px',
    color: '#64748b',
    maxWidth: '500px',
    margin: '0 auto',
    lineHeight: '1.6',
  },
};
