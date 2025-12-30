import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { FiRefreshCw, FiMonitor } from 'react-icons/fi';
import { MdQueue, MdAccessTime, MdCheckCircle } from 'react-icons/md';
import { HiOutlineClock } from 'react-icons/hi';
import apiClient from '../../lib/api';
import { isAuthenticated, getStoredUser } from '../../lib/auth';

export default function DisplayBoard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [displayData, setDisplayData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState('');
  const [services, setServices] = useState([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const currentUser = getStoredUser();
    if (currentUser) {
      setUser(currentUser);
    }

    loadServices();
    loadDisplayData();

    // Update time every second
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    // Auto-refresh data every 5 seconds
    const dataInterval = setInterval(() => {
      loadDisplayData();
    }, 5000);

    return () => {
      clearInterval(timeInterval);
      clearInterval(dataInterval);
    };
  }, [selectedService]);

  const loadServices = async () => {
    try {
      const response = await apiClient.get('/admin/services');
      if (response.success) {
        setServices(response.data.filter(s => s.is_active));
      }
    } catch (error) {
      console.error('Error loading services:', error);
    }
  };

  const loadDisplayData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedService) params.append('service_id', selectedService);

      const response = await apiClient.get(`/admin/display-board?${params.toString()}`);
      if (response.success) {
        setDisplayData(response.data);
      }
    } catch (error) {
      console.error('Error loading display data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        setIsFullscreen(true);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      });
    }
  };

  if (loading && !displayData) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingContainer}>
          <div style={styles.loadingSpinner}></div>
          <p style={styles.loadingText}>Loading display board...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Control Bar (hidden in fullscreen) */}
      {!isFullscreen && (
        <div style={styles.controlBar}>
          <div style={styles.controlLeft}>
            <div style={styles.logoSection}>
              <img src="/logo.png" alt="QTech" style={styles.logoImage} />
              <h1 style={styles.controlTitle}>Display Board</h1>
            </div>
          </div>
          <div style={styles.controlRight}>
            <select
              value={selectedService}
              onChange={(e) => setSelectedService(e.target.value)}
              style={styles.serviceSelect}
            >
              <option value="">All Services</option>
              {services.map(service => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </select>
            <button onClick={loadDisplayData} style={styles.refreshButton}>
              <FiRefreshCw size={18} />
              Refresh
            </button>
            <button onClick={toggleFullscreen} style={styles.fullscreenButton}>
              <FiMonitor size={18} />
              Fullscreen
            </button>
          </div>
        </div>
      )}

      {/* Display Board Content */}
      <div style={styles.displayContent}>
        {/* Professional Header */}
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <div style={styles.logoContainer}>
              <img src="/logo.png" alt="QTech" style={styles.headerLogo} />
            </div>
            <div style={styles.titleSection}>
              <h1 style={styles.headerTitle}>QTech Queue Management System</h1>
              <p style={styles.headerSubtitle}>
                {selectedService 
                  ? services.find(s => s.id === parseInt(selectedService))?.name || 'Service'
                  : 'All Services'}
              </p>
            </div>
          </div>
          <div style={styles.headerRight}>
            <div style={styles.timeCard}>
              <HiOutlineClock size={28} style={styles.clockIcon} />
              <div style={styles.timeContent}>
                <div style={styles.timeDisplay}>
                  {currentTime.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </div>
                <div style={styles.dateDisplay}>
                  {currentTime.toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div style={styles.mainGrid}>
          {/* Currently Serving - Prominent Section */}
          <div style={styles.servingColumn}>
            <div style={styles.servingSection}>
              <div style={styles.sectionHeader}>
                <div style={styles.sectionIconWrapper}>
                  <MdCheckCircle size={28} />
                </div>
                <h2 style={styles.sectionTitle}>Currently Serving</h2>
              </div>
              <div style={styles.servingContent}>
                {displayData?.serving && displayData.serving.length > 0 ? (
                  <div style={styles.servingGrid}>
                    {displayData.serving.map((queue, index) => (
                      <div 
                        key={queue.id} 
                        style={{
                          ...styles.servingCard,
                          animationDelay: `${index * 0.15}s`
                        }}
                        className="serving-card"
                      >
                        <div style={styles.queueNumberContainer}>
                          <div style={styles.queueNumberLarge}>{queue.queue_number}</div>
                          <div style={styles.queueBadge}>NOW SERVING</div>
                        </div>
                        <div style={styles.queueDetails}>
                          <div style={styles.serviceNameLarge}>{queue.service_name}</div>
                          {queue.counter_name && (
                            <div style={styles.counterBadge}>
                              <span style={styles.counterIcon}>📍</span>
                              Counter {queue.counter_number} • {queue.counter_name}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={styles.emptyState}>
                    <MdQueue size={64} style={styles.emptyIcon} />
                    <p style={styles.emptyText}>No queues currently being served</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Next in Line & Waiting */}
          <div style={styles.rightColumn}>
            {/* Next in Line */}
            <div style={styles.calledSection}>
              <div style={styles.sectionHeaderSmall}>
                <div style={styles.sectionIconSmall}>
                  <MdAccessTime size={20} />
                </div>
                <h3 style={styles.sectionTitleSmall}>Next in Line</h3>
              </div>
              <div style={styles.calledContent} className="called-content">
                {displayData?.called && displayData.called.length > 0 ? (
                  <div style={styles.calledList}>
                    {displayData.called.map((queue, index) => (
                      <div 
                        key={queue.id} 
                        style={{
                          ...styles.calledCard,
                          animationDelay: `${index * 0.1}s`
                        }}
                        className="called-card"
                      >
                        <div style={styles.queueNumberMedium}>{queue.queue_number}</div>
                        <div style={styles.queueInfoSmall}>
                          <div style={styles.serviceNameMedium}>{queue.service_name}</div>
                          {queue.counter_name && (
                            <div style={styles.counterInfoSmall}>
                              Counter {queue.counter_number}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={styles.emptyStateSmall}>
                    <p style={styles.emptyTextSmall}>No queues called</p>
                  </div>
                )}
              </div>
            </div>

            {/* Waiting Counts */}
            <div style={styles.waitingSection}>
              <div style={styles.sectionHeaderSmall}>
                <div style={styles.sectionIconSmall}>
                  <MdQueue size={20} />
                </div>
                <h3 style={styles.sectionTitleSmall}>Waiting</h3>
              </div>
              <div style={styles.waitingContent}>
                {displayData?.waiting && displayData.waiting.length > 0 ? (
                  <div style={styles.waitingGrid}>
                    {displayData.waiting.map((service) => (
                      <div key={service.service_id} style={styles.waitingCard}>
                        <div style={styles.waitingServiceName}>{service.service_name}</div>
                        <div style={styles.waitingCount}>{service.waiting_count}</div>
                        <div style={styles.waitingLabel}>in queue</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={styles.emptyStateSmall}>
                    <p style={styles.emptyTextSmall}>No waiting queues</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Professional Running Banner */}
        <div style={styles.bannerContainer}>
          <div style={styles.bannerContent}>
            <div style={styles.bannerLogo}>
              <img src="/logo.png" alt="QTech" style={styles.bannerLogoImg} />
            </div>
            <div style={styles.bannerText}>
              Welcome to QTech Queue Management System • Experience smart queue management • Get your queue number from the mobile app • Track your position in real-time • Receive notifications when it's your turn • Thank you for using our modern queue system
            </div>
            <div style={styles.bannerLogo}>
              <img src="/logo.png" alt="QTech" style={styles.bannerLogoImg} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#0a0f1a',
    color: '#ffffff',
    overflow: 'hidden',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    gap: '20px',
  },
  loadingSpinner: {
    width: '50px',
    height: '50px',
    border: '3px solid rgba(220, 38, 38, 0.2)',
    borderTop: '3px solid #dc2626',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: '18px',
    fontWeight: '500',
  },
  controlBar: {
    backgroundColor: '#1a1f2e',
    padding: '12px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #2a3441',
    zIndex: 1000,
  },
  controlLeft: {
    display: 'flex',
    alignItems: 'center',
  },
  logoSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  logoImage: {
    width: '28px',
    height: '28px',
    objectFit: 'contain',
  },
  controlTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: 'white',
    margin: 0,
  },
  controlRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  serviceSelect: {
    padding: '6px 12px',
    backgroundColor: '#2a3441',
    border: '1px solid #3a4551',
    borderRadius: '6px',
    color: 'white',
    fontSize: '13px',
    cursor: 'pointer',
  },
  refreshButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    backgroundColor: '#2a3441',
    border: '1px solid #3a4551',
    borderRadius: '6px',
    color: 'white',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  fullscreenButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    backgroundColor: '#dc2626',
    border: 'none',
    borderRadius: '6px',
    color: 'white',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  displayContent: {
    padding: '20px 24px',
    maxWidth: '1920px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 'calc(100vh - 57px)',
    gap: '16px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 20px',
    backgroundColor: '#1a1f2e',
    borderRadius: '10px',
    border: '1px solid #2a3441',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  logoContainer: {
    width: '52px',
    height: '52px',
    borderRadius: '10px',
    backgroundColor: '#0a0f1a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '6px',
    border: '1px solid #2a3441',
  },
  headerLogo: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    filter: 'drop-shadow(0 0 6px rgba(220, 38, 38, 0.4))',
  },
  titleSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  headerTitle: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#ffffff',
    margin: 0,
    letterSpacing: '-0.3px',
  },
  headerSubtitle: {
    fontSize: '13px',
    color: '#94a3b8',
    margin: 0,
    fontWeight: '500',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
  },
  timeCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 16px',
    backgroundColor: '#0a0f1a',
    borderRadius: '8px',
    border: '1px solid #2a3441',
  },
  clockIcon: {
    color: '#10b981',
  },
  timeContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  timeDisplay: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#10b981',
    fontFamily: 'monospace',
    lineHeight: '1',
  },
  dateDisplay: {
    fontSize: '11px',
    color: '#94a3b8',
    fontWeight: '500',
  },
  mainGrid: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr',
    gap: '16px',
    flex: 1,
  },
  servingColumn: {
    display: 'flex',
    flexDirection: 'column',
  },
  servingSection: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#1a1f2e',
    borderRadius: '12px',
    padding: '20px',
    border: '1px solid #2a3441',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '18px',
    paddingBottom: '14px',
    borderBottom: '2px solid #2a3441',
  },
  sectionIconWrapper: {
    width: '44px',
    height: '44px',
    borderRadius: '8px',
    backgroundColor: '#dc2626',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    boxShadow: '0 2px 6px rgba(220, 38, 38, 0.3)',
  },
  sectionTitle: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#ffffff',
    margin: 0,
    letterSpacing: '-0.2px',
  },
  servingContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  servingGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '14px',
  },
  servingCard: {
    backgroundColor: '#0a0f1a',
    borderRadius: '10px',
    padding: '20px',
    border: '3px solid #dc2626',
    boxShadow: '0 4px 12px rgba(220, 38, 38, 0.35)',
    textAlign: 'center',
    animation: 'fadeInUp 0.5s ease-out',
    transition: 'all 0.3s ease',
  },
  queueNumberContainer: {
    marginBottom: '14px',
  },
  queueNumberLarge: {
    fontSize: '80px',
    fontWeight: '900',
    color: '#dc2626',
    lineHeight: '1',
    marginBottom: '6px',
    fontFamily: 'monospace',
    letterSpacing: '2px',
    textShadow: '0 2px 8px rgba(220, 38, 38, 0.4)',
  },
  queueBadge: {
    display: 'inline-block',
    padding: '3px 10px',
    backgroundColor: '#dc2626',
    color: 'white',
    borderRadius: '12px',
    fontSize: '10px',
    fontWeight: '700',
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
  },
  queueDetails: {
    marginTop: '10px',
  },
  serviceNameLarge: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: '6px',
  },
  counterBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '5px 10px',
    backgroundColor: '#1a1f2e',
    borderRadius: '6px',
    fontSize: '11px',
    color: '#94a3b8',
    fontWeight: '500',
  },
  counterIcon: {
    fontSize: '12px',
  },
  rightColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  calledSection: {
    backgroundColor: '#1a1f2e',
    borderRadius: '10px',
    padding: '18px',
    border: '1px solid #2a3441',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)',
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
  },
  sectionHeaderSmall: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '14px',
    paddingBottom: '12px',
    borderBottom: '1px solid #2a3441',
  },
  sectionIconSmall: {
    width: '32px',
    height: '32px',
    borderRadius: '6px',
    backgroundColor: '#3b82f6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
  },
  sectionTitleSmall: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#ffffff',
    margin: 0,
  },
  calledContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
    maxHeight: '400px',
  },
  calledList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  calledCard: {
    backgroundColor: '#0a0f1a',
    borderRadius: '8px',
    padding: '14px',
    border: '2px solid #3b82f6',
    textAlign: 'center',
    animation: 'fadeInRight 0.4s ease-out',
    transition: 'all 0.2s ease',
  },
  queueNumberMedium: {
    fontSize: '36px',
    fontWeight: '800',
    color: '#3b82f6',
    lineHeight: '1',
    marginBottom: '6px',
    fontFamily: 'monospace',
  },
  queueInfoSmall: {
    marginTop: '4px',
  },
  serviceNameMedium: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: '3px',
  },
  counterInfoSmall: {
    fontSize: '11px',
    color: '#94a3b8',
  },
  waitingSection: {
    backgroundColor: '#1a1f2e',
    borderRadius: '10px',
    padding: '18px',
    border: '1px solid #2a3441',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)',
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
  },
  waitingContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  waitingGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '8px',
  },
  waitingCard: {
    backgroundColor: '#0a0f1a',
    borderRadius: '8px',
    padding: '14px',
    border: '1px solid #3a4551',
    textAlign: 'center',
  },
  waitingServiceName: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: '8px',
  },
  waitingCount: {
    fontSize: '28px',
    fontWeight: '800',
    color: '#f59e0b',
    lineHeight: '1',
    margin: '4px 0',
  },
  waitingLabel: {
    fontSize: '10px',
    color: '#64748b',
    marginTop: '2px',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    padding: '40px',
    gap: '16px',
  },
  emptyIcon: {
    color: '#475569',
    opacity: 0.4,
  },
  emptyText: {
    fontSize: '16px',
    color: '#64748b',
    fontWeight: '500',
  },
  emptyStateSmall: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    padding: '30px',
  },
  emptyTextSmall: {
    fontSize: '14px',
    color: '#64748b',
    fontWeight: '500',
  },
  bannerContainer: {
    backgroundColor: '#dc2626',
    padding: '12px 0',
    borderRadius: '8px',
    overflow: 'hidden',
    border: '1px solid #991b1b',
    boxShadow: '0 2px 8px rgba(220, 38, 38, 0.25)',
  },
  bannerContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    whiteSpace: 'nowrap',
    animation: 'scrollBanner 35s linear infinite',
  },
  bannerLogo: {
    width: '28px',
    height: '28px',
    flexShrink: 0,
  },
  bannerLogoImg: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    filter: 'brightness(0) invert(1)',
  },
  bannerText: {
    fontSize: '14px',
    fontWeight: '600',
    color: 'white',
    letterSpacing: '0.2px',
  },
};

// Add CSS animations
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    @keyframes fadeInRight {
      from {
        opacity: 0;
        transform: translateX(-15px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }
    @keyframes scrollBanner {
      0% {
        transform: translateX(100%);
      }
      100% {
        transform: translateX(-100%);
      }
    }
    .serving-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(220, 38, 38, 0.45) !important;
    }
    .called-card:hover {
      transform: translateX(2px);
      border-color: #60a5fa;
    }
    .called-content::-webkit-scrollbar {
      width: 6px;
    }
    .called-content::-webkit-scrollbar-track {
      background: #0a0f1a;
      border-radius: 3px;
    }
    .called-content::-webkit-scrollbar-thumb {
      background: #3a4551;
      border-radius: 3px;
    }
    .called-content::-webkit-scrollbar-thumb:hover {
      background: #4a5568;
    }
  `;
  if (!document.head.querySelector('style[data-display-board-animations]')) {
    style.setAttribute('data-display-board-animations', 'true');
    document.head.appendChild(style);
  }
}
