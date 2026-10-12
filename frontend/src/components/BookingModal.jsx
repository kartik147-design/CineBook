import { useState } from 'react';

const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const columns = Array.from({ length: 10 }, (_, index) => index + 1);

function BookingModal({ movie, showtime, bookedSeats, onClose, onCheckout }) {
  const [selectedSeats, setSelectedSeats] = useState([]);
  const total = selectedSeats.length * showtime.price;

  const toggleSeat = (seatId) => {
    if (bookedSeats.includes(seatId)) return;
    setSelectedSeats((current) =>
      current.includes(seatId)
        ? current.filter((seat) => seat !== seatId)
        : current.length < 8
          ? [...current, seatId]
          : current,
    );
  };

  return (
    <div className="modal-backdrop booking-backdrop" onMouseDown={onClose}>
      <section
        className="booking-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="booking-heading">
          <div>
            <p className="section-kicker">Choose your seats</p>
            <h2 id="booking-title">{movie.title}</h2>
            <p>{showtime.cinema} · {showtime.screen} · {showtime.date}, {showtime.time}</p>
          </div>
          <button className="modal-close inline-close" onClick={onClose} aria-label="Close seat selection">×</button>
        </div>
        <div className="booking-layout">
          <div className="seat-area">
            <div className="screen-arch"><span>SCREEN</span></div>
            <div className="seat-map">
              {rows.map((row) => (
                <div className="seat-row" key={row}>
                  <span className="row-label">{row}</span>
                  {columns.map((column) => {
                    const seat = `${row}${column}`;
                    const isBooked = bookedSeats.includes(seat);
                    const isSelected = selectedSeats.includes(seat);
                    return (
                      <button
                        aria-label={`${seat} ${isBooked ? 'booked' : isSelected ? 'selected' : 'available'}`}
                        aria-pressed={isSelected}
                        className={`seat ${isBooked ? 'booked' : ''} ${isSelected ? 'selected' : ''}`}
                        disabled={isBooked}
                        key={seat}
                        onClick={() => toggleSeat(seat)}
                        title={isBooked ? 'Already booked' : `Seat ${seat}`}
                      />
                    );
                  })}
                  <span className="row-label">{row}</span>
                </div>
              ))}
            </div>
            <div className="seat-legend">
              <span><i className="legend-seat available" />Available</span>
              <span><i className="legend-seat chosen" />Selected</span>
              <span><i className="legend-seat sold" />Booked</span>
            </div>
            <p className="availability-note">Seat availability refreshes automatically. Up to 8 seats per booking.</p>
          </div>
          <aside className="checkout-summary">
            <p className="section-kicker">Your order</p>
            <h3>Booking summary</h3>
            <div className="checkout-row"><span>Seats</span><strong>{selectedSeats.length ? selectedSeats.join(', ') : 'Select seats'}</strong></div>
            <div className="checkout-row"><span>Ticket price</span><strong>₹{showtime.price} / seat</strong></div>
            <div className="checkout-row checkout-total"><span>Total</span><strong>₹{total}</strong></div>
            <button
              className="button button-primary button-wide confirm-booking"
              disabled={!selectedSeats.length}
              onClick={() => onCheckout(selectedSeats)}
            >
              Continue to checkout · ₹{total}
            </button>
            <p className="demo-note">Choose your payment or pay-at-venue option on the next page.</p>
          </aside>
        </div>
      </section>
    </div>
  );
}

export default BookingModal;
