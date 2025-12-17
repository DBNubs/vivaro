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

  return (
    <div className="client-list">
      {filteredClients.map((client) => (
        <div key={client.id} className="client-card">
          <div className="client-card-header">
            <div className="client-info" onClick={() => handleCardClick(client.id)}>
              <h3 className="client-name">{client.name}</h3>
              {client.contactName && (
                <p className="client-contact">{client.contactName}</p>
              )}
            </div>
            <div className="client-actions">
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
                      e.stopPropagation();
                      onArchive(client.id);
                    }}
                    className="btn-icon btn-archive"
                    title="Archive client"
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
        </div>
      ))}
    </div>
  );
};

export default ClientList;

