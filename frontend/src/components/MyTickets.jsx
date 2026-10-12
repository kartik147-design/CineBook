import TicketCard from './TicketCard.jsx';

function MyTickets({ tickets, notifications, onCancel }) {
  const activeCount = tickets.filter((ticket) => ticket.status !== 'cancelled').length;

  return (
    <section className="dashboard-section">
      <div className="section-title-row">
        <div>
          <p className="section-kicker">Your movie plans</p>
          <h1>My tickets</h1>
        </div>
        <span className="count-pill">{activeCount} active</span>
      </div>
      {notifications.length > 0 && (
        <div className="notification-panel">
          <h2>Booking updates</h2>
          {notifications.slice().reverse().slice(0, 4).map((notification) => (
            <p key={notification.id}>
              <span>✦</span>{notification.message}
              <small>{new Date(notification.createdAt).toLocaleString()}</small>
            </p>
          ))}
        </div>
      )}
      {!tickets.length ? (
        <div className="empty-state booking-empty">
          <span className="empty-icon">▣</span>
          <h3>Your next night out starts here</h3>
          <p>Tickets you book, complete with entry QR codes, will appear here.</p>
        </div>
      ) : (
        <div className="ticket-list">
          {tickets.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} onCancel={onCancel} />
          ))}
        </div>
      )}
    </section>
  );
}

export default MyTickets;
