import React from 'react';
import { useNavigate } from 'react-router-dom';
import './ClientList.css';

const ClientList = ({ clients, onEdit, onView, onArchive, onUnarchive, showArchived }) => {
  const navigate = useNavigate();

  const filteredClients = clients.filter((client) =>
    showArchived ? client.status === 'archived' : client.status === 'active'
  );

  const handleCardClick = (clientId) => {
    if (onView) {
      onView(clientId);
    } else {
      navigate(`/client/${clientId}`);
    }
  };

  if (filteredClients.length === 0) {
    return (
      <div className="empty-state">
        <p>No {showArchived ? 'archived' : 'active'} clients found.</p>
      </div>
    );
  }

  const getPrimaryContact = (client) => {
    if (client.contacts && client.contacts.length > 0) {
      return client.contacts.find(c => c.primary) || client.contacts[0];
    }
    return null;
  };

  const getCurrentSow = (client) => {
    if (client.sows && client.sows.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // First try to find a current SOW
      const currentSow = client.sows.find(sow => sow.current);
      if (currentSow) return currentSow;

      // Then find an active SOW
      return client.sows.find(sow => {
        if (!sow.startDate) return false;
        const startDate = new Date(sow.startDate);
        startDate.setHours(0, 0, 0, 0);
        const endDate = sow.endDate ? new Date(sow.endDate) : null;
        if (endDate) endDate.setHours(0, 0, 0, 0);

        return startDate <= today && (!endDate || endDate >= today);
      });
    }
    return null;
  };

  const formatCurrency = (amount) => {
    if (!amount) return null;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(parseFloat(amount) || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="client-list">
      {filteredClients.map((client) => {
        const primaryContact = getPrimaryContact(client);
        const currentSow = getCurrentSow(client);

        return (
          <div key={client.id} className="client-card">
            <div className="client-card-content" onClick={() => handleCardClick(client.id)}>
              <div className="client-card-header-section">
                <div className="client-header-main">
                  <div className="client-icon-wrapper">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M12 11C14.2091 11 16 9.20914 16 7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7C8 9.20914 9.79086 11 12 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div className="client-info">
                    <h3 className="client-name">{client.name}</h3>
                    {primaryContact && (
                      <div className="client-contact-info">
                        <span className="client-contact-name">{primaryContact.name}</span>
                        {primaryContact.title && (
                          <span className="client-contact-title"> • {primaryContact.title}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="client-actions" onClick={(e) => e.stopPropagation()}>
                  {!showArchived && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(client);
                        }}
                        className="btn-icon btn-edit"
                        title="Edit client"
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M11.333 2.00004C11.5084 1.82468 11.7163 1.68605 11.9442 1.59231C12.1721 1.49857 12.4154 1.45166 12.6667 1.45471C12.9179 1.45776 13.1596 1.51069 13.3846 1.61004C13.6096 1.70939 13.8134 1.85314 13.9842 2.03337C14.155 2.2136 14.2894 2.4266 14.3799 2.65986C14.4704 2.89312 14.5151 3.14218 14.5113 3.39337C14.5075 3.64456 14.4553 3.8926 14.3578 4.12337C14.2603 4.35414 14.1195 4.56314 13.9427 4.73871L6.94267 11.7387L2.66667 13.3334L4.26133 9.05737L11.333 2.00004Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log('Archive button clicked in ClientList for client:', client.id);
                          if (onArchive) {
                            onArchive(client.id);
                          } else {
                            console.error('onArchive handler is not defined!');
                          }
                        }}
                        className="btn-icon btn-archive"
                        title="Archive client"
                        type="button"
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M2.66667 4.00004H13.3333M2.66667 4.00004L2.66667 13.3334C2.66667 13.687 2.80714 14.0262 3.05719 14.2762C3.30724 14.5263 3.64638 14.6667 4.00001 14.6667H12C12.3536 14.6667 12.6928 14.5263 12.9428 14.2762C13.1929 14.0262 13.3333 13.687 13.3333 13.3334V4.00004M2.66667 4.00004L4.00001 1.33337H12L13.3333 4.00004M6.66667 7.33337H9.33334" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </>
                  )}
                  {showArchived && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUnarchive(client.id);
                      }}
                      className="btn-icon btn-unarchive"
                      title="Unarchive client"
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2.66667 4.00004H13.3333M2.66667 4.00004L2.66667 13.3334C2.66667 13.687 2.80714 14.0262 3.05719 14.2762C3.30724 14.5263 3.64638 14.6667 4.00001 14.6667H12C12.3536 14.6667 12.6928 14.5263 12.9428 14.2762C13.1929 14.0262 13.3333 13.687 13.3333 13.3334V4.00004M2.66667 4.00004L4.00001 1.33337H12L13.3333 4.00004M6.66667 7.33337L8.00001 8.66671L9.33334 7.33337" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {currentSow && (
                <div className="client-card-footer">
                  <div className="client-sow-info">
                    <div className="sow-amount">
                      {formatCurrency(currentSow.amount)}
                    </div>
                    <div className="sow-dates">
                      {currentSow.startDate && (
                        <span className="sow-date">
                          {formatDate(currentSow.startDate)}
                        </span>
                      )}
                      {currentSow.endDate && (
                        <>
                          <span className="sow-date-separator">→</span>
                          <span className="sow-date">
                            {formatDate(currentSow.endDate)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ClientList;

