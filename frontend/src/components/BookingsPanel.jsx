function BookingsPanel({ bookings, onCancel }) {
  return (
    <section className="dashboard-section">
      <div className="section-title-row">
        <div>
          <p className="section-kicker">Your movie plans</p>
          <h1>My bookings</h1>
        </div>
        <span className="count-pill">{bookings.length} booking{bookings.length === 1 ? '' : 's'}</span>
      </div>
      {!bookings.length ? (
        <div className="empty-state booking-empty">
          <span className="empty-icon">▣</span>
          <h3>Your next night out starts here</h3>
          <p>Your movie bookings and cancellations will show up here.</p>
        </div>
      ) : (
        <div className="booking-list">
          {bookings.map((booking) => (
            <article className="booking-history-card" key={booking.id}>
              <div className="booking-ticket-mark">CB</div>
              <div className="booking-history-main">
                <div className="booking-history-heading">
                  <div>
                    <p className="section-kicker">{booking.city} · {booking.date} · {booking.time}</p>
                    <h3>{booking.movieTitle}</h3>
                  </div>
                  <span className={booking.status === 'cancelled' ? 'status-pill cancelled' : booking.paymentMethod === 'Pay at venue' ? 'status-pill pending' : 'status-pill'}>
                    {booking.status === 'cancelled'
                      ? 'Cancelled'
                      : booking.paymentMethod === 'Pay at venue'
                        ? 'Reserved · pay at venue'
                        : 'Confirmed'}
                  </span>
                </div>
                <p>{booking.cinema} · {booking.screen}</p>
                <div className="booking-meta">
                  <span>Seats: <strong>{booking.seats.join(', ')}</strong></span>
                  <span>Amount: <strong>₹{booking.total}</strong></span>
                  <span>Payment: <strong>{booking.paymentMethod}</strong></span>
                </div>
              </div>
              {booking.status !== 'cancelled' && (
                <button className="button button-cancel" onClick={() => onCancel(booking.id)}>
                  Cancel
                </button>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default BookingsPanel;
