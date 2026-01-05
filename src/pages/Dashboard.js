import React, { useState, useEffect } from 'react';
import ClientList from '../components/ClientList';
import ClientForm from '../components/ClientForm';
import { getClients, createClient, updateClient, archiveClient, unarchiveClient, getReminders } from '../utils/storage';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

function Dashboard() {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [showArchived, setShowArchived] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [remindersSummary, setRemindersSummary] = useState({ total: 0, overdue: 0, dueToday: 0, clientsWithReminders: [] });

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    if (clients.length > 0 && !showArchived) {
      loadRemindersSummary();
    }
  }, [clients, showArchived]);

  const loadClients = async () => {
    try {
      setLoading(true);
      setError(null);
      const savedClients = await getClients();
      setClients(savedClients);
    } catch (err) {
      setError('Failed to load clients. Make sure the server is running.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddClient = () => {
    setEditingClient(null);
    setShowForm(true);
  };

  const handleEditClient = (client) => {
    setEditingClient(client);
    setShowForm(true);
  };

  const handleViewClient = (clientId) => {
    navigate(`/client/${clientId}`);
  };

  const handleSaveClient = async (clientData) => {
    try {
      setError(null);
      if (editingClient) {
        await updateClient(editingClient.id, clientData);
      } else {
        await createClient(clientData);
      }
      await loadClients();
      setShowForm(false);
      setEditingClient(null);
    } catch (err) {
      setError(err.message || 'Failed to save client. Please try again.');
      console.error(err);
    }
  };

  const handleArchiveClient = async (clientId) => {
    if (window.confirm('Are you sure you want to archive this client?')) {
      try {
        setError(null);
        await archiveClient(clientId);
        await loadClients();
      } catch (err) {
        setError('Failed to archive client. Please try again.');
        console.error(err);
      }
    }
  };

  const handleUnarchiveClient = async (clientId) => {
    try {
      setError(null);
      await unarchiveClient(clientId);
      await loadClients();
    } catch (err) {
      setError('Failed to unarchive client. Please try again.');
      console.error(err);
    }
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingClient(null);
  };

  const loadRemindersSummary = async () => {
    try {
      const activeClients = clients.filter((c) => c.status === 'active');
      let totalReminders = 0;
      let overdueCount = 0;
      let dueTodayCount = 0;
      const clientsWithReminders = [];

      for (const client of activeClients) {
        try {
          const reminders = await getReminders(client.id);
          const incompleteReminders = reminders.filter((r) => !r.completed);

          if (incompleteReminders.length > 0) {
            totalReminders += incompleteReminders.length;

            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            incompleteReminders.forEach((reminder) => {
              if (reminder.dueDate) {
                const dueDate = new Date(reminder.dueDate);
                const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());

                if (dueDateOnly < today) {
                  overdueCount++;
                } else if (dueDateOnly.getTime() === today.getTime()) {
                  dueTodayCount++;
                }
              }
            });

            clientsWithReminders.push({
              clientId: client.id,
              clientName: client.name,
              reminderCount: incompleteReminders.length,
              overdueCount: incompleteReminders.filter((r) => {
                if (!r.dueDate) return false;
                const dueDate = new Date(r.dueDate);
                const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
                return dueDateOnly < today;
              }).length,
            });
          }
        } catch (err) {
          console.error(`Error loading reminders for ${client.name}:`, err);
        }
      }

      setRemindersSummary({
        total: totalReminders,
        overdue: overdueCount,
        dueToday: dueTodayCount,
        clientsWithReminders: clientsWithReminders.sort((a, b) => b.reminderCount - a.reminderCount),
      });
    } catch (err) {
      console.error('Error loading reminders summary:', err);
    }
  };

  const activeClientsCount = clients.filter((c) => c.status === 'active').length;
  const archivedClientsCount = clients.filter((c) => c.status === 'archived').length;

  return (
    <>
      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)} className="error-close">×</button>
        </div>
      )}

      {!showArchived && remindersSummary.total > 0 && (
        <div className={`reminders-alert ${remindersSummary.overdue > 0 ? 'alert-overdue' : remindersSummary.dueToday > 0 ? 'alert-due-today' : ''}`}>
          <div className="reminders-alert-content">
            <div className="reminders-alert-icon">
              {remindersSummary.overdue > 0 ? '⚠️' : '📋'}
            </div>
            <div className="reminders-alert-text">
              <strong>
                {remindersSummary.overdue > 0
                  ? `${remindersSummary.overdue} overdue reminder${remindersSummary.overdue !== 1 ? 's' : ''}`
                  : remindersSummary.dueToday > 0
                  ? `${remindersSummary.dueToday} reminder${remindersSummary.dueToday !== 1 ? 's' : ''} due today`
                  : `${remindersSummary.total} outstanding reminder${remindersSummary.total !== 1 ? 's' : ''}`}
              </strong>
              {remindersSummary.clientsWithReminders.length > 0 && (
                <span className="reminders-alert-details">
                  {' '}across {remindersSummary.clientsWithReminders.length} project{remindersSummary.clientsWithReminders.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
          {remindersSummary.clientsWithReminders.length > 0 && remindersSummary.clientsWithReminders.length <= 5 && (
            <div className="reminders-alert-projects">
              {remindersSummary.clientsWithReminders.map((item) => (
                <button
                  key={item.clientId}
                  onClick={() => navigate(`/client/${item.clientId}`)}
                  className="reminder-project-link"
                >
                  {item.clientName}
                  {item.overdueCount > 0 && (
                    <span className="overdue-badge">{item.overdueCount} overdue</span>
                  )}
                  <span className="reminder-count">({item.reminderCount})</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="dashboard-controls">
        <div className="view-toggle">
          <button
            onClick={() => setShowArchived(false)}
            className={`toggle-btn ${!showArchived ? 'active' : ''}`}
          >
            Active ({activeClientsCount})
          </button>
          <button
            onClick={() => setShowArchived(true)}
            className={`toggle-btn ${showArchived ? 'active' : ''}`}
          >
            Archived ({archivedClientsCount})
          </button>
        </div>
        {!showArchived && (
          <button onClick={handleAddClient} className="btn-add">
            + Add New Client
          </button>
        )}
      </div>

      {loading ? (
        <div className="loading-state">
          <p>Loading clients...</p>
        </div>
      ) : (
        <ClientList
          clients={clients}
          onEdit={handleEditClient}
          onView={handleViewClient}
          onArchive={handleArchiveClient}
          onUnarchive={handleUnarchiveClient}
          showArchived={showArchived}
        />
      )}

      {showForm && (
        <ClientForm
          client={editingClient}
          onSave={handleSaveClient}
          onCancel={handleCancelForm}
        />
      )}
    </>
  );
}

export default Dashboard;

