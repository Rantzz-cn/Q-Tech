import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { 
  FiUser, FiLogOut, FiLoader, FiSearch, FiFilter,
  FiClock, FiCheckCircle, FiXCircle, FiAlertCircle,
  FiRefreshCw, FiChevronLeft, FiChevronRight, FiEdit3, FiMoreVertical
} from 'react-icons/fi';
import { MdQueue, MdAccessTime } from 'react-icons/md';
import apiClient from '../../lib/api';
import { isAuthenticated, getStoredUser, logout } from '../../lib/auth';
import { toast } from '../../components/Toast';
import ConfirmModal from '../../components/ConfirmModal';

export default function QueueManagement() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [queues, setQueues] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '',
    service_id: '',
    search: '',
    start_date: '',
    end_date: '',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 1,
  });
  const [updatingQueueId, setUpdatingQueueId] = useState(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedQueue, setSelectedQueue] = useState(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }

    const currentUser = getStoredUser();
    if (currentUser?.role !== 'admin') {
      router.push('/login');
      return;
    }

    setUser(currentUser);
    loadServices();
    loadQueues();
  }, [router]);

  useEffect(() => {
    loadQueues();
  }, [pagination.page, filters]);

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

  const loadQueues = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      if (filters.status) params.append('status', filters.status);
      if (filters.service_id) params.append('service_id', filters.service_id);
      if (filters.search) params.append('search', filters.search);
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);
      params.append('page', pagination.page);
      params.append('limit', pagination.limit);

      const response = await apiClient.get(`/admin/queues?${params.toString()}`);
      if (response.success) {
        setQueues(response.data || []);
        if (response.pagination) {
          setPagination(prev => ({
            ...prev,
            total: response.pagination.total,
            totalPages: response.pagination.totalPages,
          }));
        }
      }
    } catch (error) {
      console.error('Error loading queues:', error);
      toast.error(error.error?.message || 'Failed to load queues');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, filters]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const handleStatusChange = (queue) => {
    setSelectedQueue(queue);
    setShowStatusModal(true);
  };

  const confirmStatusChange = async (newStatus) => {
    if (!selectedQueue) return;

    try {
      setUpdatingQueueId(selectedQueue.id);
      const response = await apiClient.put(`/admin/queues/${selectedQueue.id}/status`, {
        status: newStatus,
      });

      if (response.success) {
        toast.success(`Queue ${selectedQueue.queue_number} status updated to ${newStatus}`);
        setShowStatusModal(false);
        setSelectedQueue(null);
        loadQueues(); // Refresh the list
      }
    } catch (error) {
      toast.error(error.error?.message || 'Failed to update queue status');
    } finally {
      setUpdatingQueueId(null);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      waiting: { bg: '#fef3c7', text: '#92400e', border: '#f59e0b' },
      called: { bg: '#dbeafe', text: '#1e40af', border: '#3b82f6' },
      serving: { bg: '#d1fae5', text: '#065f46', border: '#10b981' },
      completed: { bg: '#d1fae5', text: '#065f46', border: '#10b981' },
      cancelled: { bg: '#fee2e2', text: '#991b1b', border: '#ef4444' },
    };
    return colors[status] || colors.waiting;
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'waiting':
        return <FiClock size={16} />;
      case 'called':
        return <FiAlertCircle size={16} />;
      case 'serving':
        return <MdAccessTime size={16} />;
      case 'completed':
        return <FiCheckCircle size={16} />;
      case 'cancelled':
        return <FiXCircle size={16} />;
      default:
        return <FiClock size={16} />;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (typeof window === 'undefined' || loading && queues.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingContainer}>
          <FiLoader style={styles.spinner} className="spin" />
          <p style={styles.loadingText}>Loading queues...</p>
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
              <h1 style={styles.headerTitle}>Queue Management</h1>
              <p style={styles.headerSubtitle}>QTech Management System</p>
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
              <span style={styles.userRole}>Administrator</span>
            </div>
          </div>
          <button onClick={handleLogout} style={styles.logoutButton}>
            <FiLogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </header>

      <main style={styles.main}>
        {/* Filters */}
        <div style={styles.filtersCard}>
          <div style={styles.filtersHeader}>
            <FiFilter size={20} />
            <h2 style={styles.filtersTitle}>Filters</h2>
            <button
              onClick={loadQueues}
              style={styles.refreshButton}
              title="Refresh"
            >
              <FiRefreshCw size={18} />
            </button>
          </div>
          
          <div style={styles.filtersGrid}>
            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>Status</label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                style={styles.filterSelect}
              >
                <option value="">All Statuses</option>
                <option value="waiting">Waiting</option>
                <option value="called">Called</option>
                <option value="serving">Serving</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>Service</label>
              <select
                value={filters.service_id}
                onChange={(e) => handleFilterChange('service_id', e.target.value)}
                style={styles.filterSelect}
              >
                <option value="">All Services</option>
                {services.map(service => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>Start Date</label>
              <input
                type="date"
                value={filters.start_date}
                onChange={(e) => handleFilterChange('start_date', e.target.value)}
                style={styles.filterInput}
              />
            </div>

            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>End Date</label>
              <input
                type="date"
                value={filters.end_date}
                onChange={(e) => handleFilterChange('end_date', e.target.value)}
                style={styles.filterInput}
              />
            </div>

            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>Search</label>
              <div style={styles.searchContainer}>
                <FiSearch size={18} style={styles.searchIcon} />
                <input
                  type="text"
                  placeholder="Queue number, name, email..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  style={styles.searchInput}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Queues Table */}
        <div style={styles.tableCard}>
          <div style={styles.tableHeader}>
            <h2 style={styles.tableTitle}>
              Queues ({pagination.total})
            </h2>
          </div>

          {queues.length === 0 ? (
            <div style={styles.emptyState}>
              <MdQueue size={64} color="#cbd5e0" />
              <h3 style={styles.emptyTitle}>No queues found</h3>
              <p style={styles.emptyMessage}>
                {Object.values(filters).some(f => f) 
                  ? 'Try adjusting your filters'
                  : 'No queue entries yet'}
              </p>
            </div>
          ) : (
            <>
              <div style={styles.tableContainer}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Queue Number</th>
                      <th style={styles.th}>User</th>
                      <th style={styles.th}>Service</th>
                      <th style={styles.th}>Status</th>
                      <th style={styles.th}>Counter</th>
                      <th style={styles.th}>Position</th>
                      <th style={styles.th}>Requested</th>
                      <th style={styles.th}>Completed</th>
                      <th style={styles.th}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queues.map((queue) => {
                      const statusStyle = getStatusColor(queue.status);
                      return (
                        <tr key={queue.id} style={styles.tr}>
                          <td style={styles.td}>
                            <span style={styles.queueNumber}>{queue.queue_number}</span>
                          </td>
                          <td style={styles.td}>
                            <div style={styles.userCell}>
                              <div style={styles.userNameCell}>
                                {queue.first_name} {queue.last_name}
                              </div>
                              <div style={styles.userEmailCell}>{queue.email}</div>
                            </div>
                          </td>
                          <td style={styles.td}>
                            <div>
                              <div style={styles.serviceName}>{queue.service_name}</div>
                              {queue.service_location && (
                                <div style={styles.serviceLocation}>{queue.service_location}</div>
                              )}
                            </div>
                          </td>
                          <td style={styles.td}>
                            <span
                              style={{
                                ...styles.statusBadge,
                                backgroundColor: statusStyle.bg,
                                color: statusStyle.text,
                                borderColor: statusStyle.border,
                              }}
                            >
                              {getStatusIcon(queue.status)}
                              {queue.status.charAt(0).toUpperCase() + queue.status.slice(1)}
                            </span>
                          </td>
                          <td style={styles.td}>
                            {queue.counter_name ? (
                              <span style={styles.counterInfo}>
                                Counter {queue.counter_number}
                              </span>
                            ) : (
                              <span style={styles.noCounter}>-</span>
                            )}
                          </td>
                          <td style={styles.td}>
                            <span style={styles.positionBadge}>
                              #{queue.queue_position}
                            </span>
                          </td>
                          <td style={styles.td}>
                            <span style={styles.dateText}>
                              {formatDate(queue.requested_at)}
                            </span>
                          </td>
                          <td style={styles.td}>
                            <span style={styles.dateText}>
                              {formatDate(queue.completed_at)}
                            </span>
                          </td>
                          <td style={styles.td}>
                            <div style={styles.actionsCell}>
                              <button
                                onClick={() => handleStatusChange(queue)}
                                disabled={updatingQueueId === queue.id}
                                style={{
                                  ...styles.actionButton,
                                  opacity: updatingQueueId === queue.id ? 0.6 : 1,
                                }}
                                title="Change Status"
                              >
                                {updatingQueueId === queue.id ? (
                                  <FiLoader className="spin" size={16} />
                                ) : (
                                  <FiEdit3 size={16} />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div style={styles.pagination}>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page === 1}
                    style={styles.paginationButton}
                  >
                    <FiChevronLeft size={20} />
                    Previous
                  </button>
                  <span style={styles.paginationInfo}>
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page >= pagination.totalPages}
                    style={styles.paginationButton}
                  >
                    Next
                    <FiChevronRight size={20} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Status Change Modal */}
      <ConfirmModal
        isOpen={showStatusModal}
        onClose={() => {
          setShowStatusModal(false);
          setSelectedQueue(null);
        }}
        title="Change Queue Status"
        message={
          selectedQueue ? (
            <div style={styles.statusModalContent}>
              <p style={styles.statusModalText}>
                Change status for queue <strong>{selectedQueue.queue_number}</strong>?
              </p>
              <p style={styles.statusModalSubtext}>
                Current status: <strong>{selectedQueue.status}</strong>
              </p>
              <div style={styles.statusOptions}>
                {['waiting', 'called', 'serving', 'completed', 'cancelled'].map((status) => (
                  <button
                    key={status}
                    onClick={() => {
                      confirmStatusChange(status);
                    }}
                    disabled={updatingQueueId === selectedQueue.id || status === selectedQueue.status}
                    style={{
                      ...styles.statusOptionButton,
                      ...(status === selectedQueue.status && styles.statusOptionButtonActive),
                      ...(updatingQueueId === selectedQueue.id && styles.statusOptionButtonDisabled),
                    }}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          ) : null
        }
        confirmText=""
        cancelText="Cancel"
        onConfirm={() => {}}
        showConfirm={false}
      />
    </div>
  );
}

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
  spinner: {
    color: '#dc2626',
    marginBottom: '24px',
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
  },
  logoImage: {
    width: '48px',
    height: '48px',
    objectFit: 'contain',
  },
  headerTitle: {
    fontSize: '28px',
    fontWeight: '800',
    color: '#1e293b',
    margin: 0,
    letterSpacing: '-0.5px',
  },
  headerSubtitle: {
    fontSize: '14px',
    color: '#64748b',
    margin: 0,
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
    maxWidth: '1600px',
    margin: '0 auto',
  },
  filtersCard: {
    backgroundColor: 'white',
    borderRadius: '16px',
    padding: '24px',
    marginBottom: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: '1px solid #e2e8f0',
  },
  filtersHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '20px',
  },
  filtersTitle: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#1e293b',
    margin: 0,
    flex: 1,
  },
  refreshButton: {
    padding: '8px',
    backgroundColor: '#f1f5f9',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
  },
  filtersGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
  },
  filterGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  filterLabel: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1e293b',
  },
  filterSelect: {
    padding: '10px 12px',
    border: '2px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '14px',
    backgroundColor: 'white',
    cursor: 'pointer',
  },
  filterInput: {
    padding: '10px 12px',
    border: '2px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '14px',
  },
  searchContainer: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  searchIcon: {
    position: 'absolute',
    left: '12px',
    color: '#64748b',
  },
  searchInput: {
    padding: '10px 12px 10px 40px',
    border: '2px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '14px',
    width: '100%',
  },
  tableCard: {
    backgroundColor: 'white',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: '1px solid #e2e8f0',
  },
  tableHeader: {
    marginBottom: '20px',
  },
  tableTitle: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#1e293b',
    margin: 0,
  },
  tableContainer: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    padding: '12px 16px',
    textAlign: 'left',
    fontSize: '12px',
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    borderBottom: '2px solid #e2e8f0',
  },
  tr: {
    borderBottom: '1px solid #f1f5f9',
    transition: 'background-color 0.2s',
  },
  td: {
    padding: '16px',
    fontSize: '14px',
    color: '#1e293b',
  },
  queueNumber: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#dc2626',
  },
  userCell: {
    display: 'flex',
    flexDirection: 'column',
  },
  userNameCell: {
    fontWeight: '600',
    color: '#1e293b',
  },
  userEmailCell: {
    fontSize: '12px',
    color: '#64748b',
    marginTop: '4px',
  },
  serviceName: {
    fontWeight: '600',
    color: '#1e293b',
  },
  serviceLocation: {
    fontSize: '12px',
    color: '#64748b',
    marginTop: '4px',
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: '600',
    border: '2px solid',
  },
  counterInfo: {
    fontSize: '14px',
    color: '#1e293b',
  },
  noCounter: {
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  positionBadge: {
    display: 'inline-block',
    padding: '4px 10px',
    backgroundColor: '#f1f5f9',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
    color: '#475569',
  },
  dateText: {
    fontSize: '13px',
    color: '#64748b',
  },
  emptyState: {
    textAlign: 'center',
    padding: '80px 40px',
  },
  emptyTitle: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#1e293b',
    margin: '24px 0 12px',
  },
  emptyMessage: {
    fontSize: '16px',
    color: '#64748b',
  },
  pagination: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    marginTop: '24px',
    paddingTop: '24px',
    borderTop: '1px solid #e2e8f0',
  },
  paginationButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 20px',
    backgroundColor: '#f1f5f9',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  paginationInfo: {
    fontSize: '14px',
    color: '#64748b',
    fontWeight: '500',
  },
  actionsCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  actionButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '8px',
    backgroundColor: '#f1f5f9',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    color: '#475569',
  },
  statusModalContent: {
    padding: '8px 0',
  },
  statusModalText: {
    fontSize: '16px',
    color: '#1e293b',
    marginBottom: '12px',
  },
  statusModalSubtext: {
    fontSize: '14px',
    color: '#64748b',
    marginBottom: '20px',
  },
  statusOptions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginTop: '16px',
  },
  statusOptionButton: {
    padding: '10px 16px',
    backgroundColor: '#f1f5f9',
    border: '2px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#475569',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  statusOptionButtonActive: {
    backgroundColor: '#dc2626',
    borderColor: '#dc2626',
    color: 'white',
    cursor: 'not-allowed',
  },
  statusOptionButtonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
};

// Add CSS animation for spinner
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .spin {
      animation: spin 1s linear infinite;
    }
  `;
  if (!document.head.querySelector('style[data-queues-spin]')) {
    style.setAttribute('data-queues-spin', 'true');
    document.head.appendChild(style);
  }
}

