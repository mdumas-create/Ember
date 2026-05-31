import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import api from '../../services/api';
import { useThemeMode } from '../../context/ThemeContext';
import { Shield, CheckCircle, XCircle, AlertTriangle, ChevronLeft } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

interface Report {
  id: string;
  targetType: 'POST' | 'COMMENT' | 'USER';
  targetId: string;
  reason: string;
  status: 'OPEN' | 'REVIEWED' | 'ACTIONED';
  createdAt: string;
  reporter: { username: string };
}

const AdminScreen = () => {
  const { colors } = useThemeMode();
  const navigation = useNavigation<any>();
  const styles = createStyles(colors);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await api.get('mod/reports');
      setReports(res.data.reports);
    } catch (e) {
      console.error('Error fetching reports:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleAction = async (reportId: string, action: string) => {
    try {
      await api.post(`/mod/reports/${reportId}/review`, { action });
      Alert.alert('Éxito', 'Acción realizada correctamente');
      fetchReports();
    } catch (e) {
      Alert.alert('Error', 'No se pudo realizar la acción');
    }
  };

  const renderReport = ({ item }: { item: Report }) => (
    <View style={styles.reportCard}>
      <View style={styles.reportHeader}>
        <AlertTriangle size={16} color={colors.community} />
        <Text style={styles.targetType}>{item.targetType}</Text>
        <Text style={styles.reportStatus}>{item.status}</Text>
      </View>
      <Text style={styles.reason}>{item.reason}</Text>
      <Text style={styles.reporter}>Reportado por: @{item.reporter.username}</Text>
      <Text style={styles.date}>{new Date(item.createdAt).toLocaleDateString()}</Text>

      {item.status === 'OPEN' && (
        <View style={styles.actions}>
          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            onPress={() => handleAction(item.id, item.targetType === 'USER' ? 'SUSPEND_USER' : item.targetType === 'POST' ? 'HIDE_POST' : 'HIDE_COMMENT')}
          >
            <CheckCircle size={16} color={colors.white} />
            <Text style={styles.actionText}>Aplicar Sanción</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: colors.gray }]}
            onPress={() => handleAction(item.id, 'NO_ACTION')}
          >
            <XCircle size={16} color={colors.white} />
            <Text style={styles.actionText}>Ignorar</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={24} color={'#1F2937'} />
        </TouchableOpacity>
        <Text style={styles.title}>Panel de Moderación</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(item) => item.id}
          renderItem={renderReport}
          contentContainerStyle={{ paddingVertical: 16 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No hay reportes pendientes</Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDF4E3' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FDF4E3',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    ...Platform.select({
      web: {
        maxWidth: 640,
        alignSelf: 'center',
        width: '100%',
      } as any
    })
  },
  backBtn: {
    marginRight: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  title: { fontSize: 18, fontWeight: '800', color: '#1F2937' },
  reportCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    ...Platform.select({
      web: {
        maxWidth: 640,
        alignSelf: 'center',
        width: 'calc(100% - 32px)',
      } as any
    })
  },
  reportHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  targetType: { fontWeight: '700', fontSize: 12, color: colors.community, textTransform: 'uppercase' },
  reportStatus: { 
    fontSize: 10, 
    backgroundColor: '#F3F4F6', 
    paddingHorizontal: 6, 
    paddingVertical: 2, 
    borderRadius: 4,
    color: colors.gray,
    marginLeft: 'auto'
  },
  reason: { fontSize: 14, color: '#1F2937', marginBottom: 8 },
  reporter: { fontSize: 13, color: '#6B7280', fontWeight: '600' },
  date: { fontSize: 11, color: '#9CA3AF', marginTop: 4 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 15 },
  actionBtn: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: 10, 
    borderRadius: 12,
    gap: 6
  },
  actionText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  emptyText: { color: '#6B7280', fontSize: 16 }
});

export default AdminScreen;

