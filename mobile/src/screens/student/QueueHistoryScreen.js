import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getQueueHistory } from '../../services/queue';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { showError } from '../../utils/errorHandler';
import { Colors } from '../../constants/colors';

/**
 * Queue History Screen
 * Shows user's queue history
 */
const QueueHistoryScreen = ({ navigation }) => {
  const [queues, setQueues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async (pageNum = 1) => {
    try {
      const response = await getQueueHistory(pageNum, 20);
      if (response.success) {
        if (pageNum === 1) {
          setQueues(response.data.queues || []);
        } else {
          setQueues((prev) => [...prev, ...(response.data.queues || [])]);
        }
        setHasMore(response.data.pagination.page < response.data.pagination.totalPages);
      } else {
        showError(response.error || { message: 'Failed to load queue history' });
      }
    } catch (error) {
      showError(error, 'Failed to Load History');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    setPage(1);
    loadHistory(1);
  };

  const loadMore = () => {
    if (!loading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadHistory(nextPage);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return '#28a745';
      case 'cancelled':
        return '#dc3545';
      case 'waiting':
        return '#ffc107';
      case 'called':
        return '#17a2b8';
      case 'serving':
        return Colors.primary;
      default:
        return '#6c757d';
    }
  };

  const renderQueueItem = ({ item }) => (
    <TouchableOpacity
      style={styles.queueItem}
      onPress={() => navigation.navigate('QueueStatus', { queueId: item.id })}
      activeOpacity={0.7}
    >
      <View style={styles.queueItemHeader}>
        <View style={styles.queueNumberContainer}>
          <Ionicons name="ticket-outline" size={20} color={Colors.primary} style={styles.queueIcon} />
          <Text style={styles.queueNumber}>{item.queueNumber}</Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(item.status) },
          ]}
        >
          <Text style={styles.statusText}>
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </Text>
        </View>
      </View>
      <Text style={styles.serviceName}>{item.serviceName}</Text>
      {item.requestedAt && (
        <View style={styles.dateContainer}>
          <Ionicons name="time-outline" size={14} color={Colors.gray} style={styles.dateIcon} />
          <Text style={styles.date}>
            {new Date(item.requestedAt).toLocaleString()}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  if (loading && queues.length === 0) {
    return <LoadingSpinner message="Loading queue history..." />;
  }

  return (
    <View style={styles.container}>
      {queues.length === 0 ? (
        <EmptyState
          iconName="document-text-outline"
          iconColor={Colors.gray}
          title="No Queue History"
          message="Your queue requests will appear here once you start requesting queues."
        />
      ) : (
        <FlatList
          data={queues}
          renderItem={renderQueueItem}
          keyExtractor={(item) => item.id.toString()}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loading ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : null
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.lightGray,
  },
  queueItem: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 24,
    marginHorizontal: 20,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
    position: 'relative',
    borderWidth: 1,
    borderColor: '#f5f5f5',
  },
  queueItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  queueNumberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  queueIcon: {
    marginRight: 8,
  },
  queueNumber: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.dark,
    letterSpacing: 1,
    lineHeight: 32,
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
  },
  statusText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  serviceName: {
    fontSize: 17,
    color: Colors.dark,
    marginBottom: 10,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateIcon: {
    marginRight: 6,
  },
  date: {
    fontSize: 13,
    color: Colors.gray,
    fontWeight: '400',
  },
});

export default QueueHistoryScreen;

