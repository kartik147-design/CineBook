import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

function TicketCard({ ticket, onCancel }) {
  const [qrImage, setQrImage] = useState('');
  const [qrError, setQrError] = useState('');

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(ticket.ticketCode, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 192,
      color: { dark: '#131a22', light: '#ffffff' },
    })
      .then((dataUrl) => {
        if (active) setQrImage(dataUrl);
      })
      .catch((error) => {
        console.error('Could not generate ticket QR code:', error);
        if (active) setQrError('QR code could not be generated.');
      });
    return () => { active = false; };
  }, [ticket.ticketCode]);

  return (
    <article className={`ticket-card ${ticket.status === 'cancelled' ? 'ticket-cancelled' : ''}`}>
      <div className="ticket-main">
        <div className="ticket-topline">
          <span className="ticket-brand">CINEBOOK <i>✦</i></span>
          <span className={`ticket-state ${ticket.status === 'cancelled' ? 'cancelled' : ticket.paymentMethod === 'Pay at venue' ? 'reserved' : ''}`}>
            {ticket.status === 'cancelled' ? 'CANCELLED' : ticket.paymentMethod === 'Pay at venue' ? 'RESERVED · PAY AT VENUE' : 'CONFIRMED'}
          </span>
        </div>
        <h2>{ticket.movieTitle}</h2>
        <p className="ticket-cinema">{ticket.cinema} <span>·</span> {ticket.screen}</p>
        <div className="ticket-detail-grid">
          <div><span>Date</span><strong>{ticket.date}</strong></div>
          <div><span>Showtime</span><strong>{ticket.time}</strong></div>
          <div><span>Seats</span><strong>{ticket.seats.join(', ')}</strong></div>
          <div><span>Booking ref</span><strong>{ticket.id.slice(0, 8).toUpperCase()}</strong></div>
        </div>
        <div className="ticket-perforation"><span /></div>
        <p className="ticket-checkin">Present this QR at the cinema entrance. Keep it ready before the show.</p>
      </div>
      <div className="ticket-qr-area">
        {qrImage ? <img className="ticket-qr" src={qrImage} alt={`Entry QR code for ${ticket.movieTitle}`} /> : <span className="qr-placeholder">{qrError || 'Creating secure QR…'}</span>}
        <span className="qr-caption">ENTRY PASS</span>
        {ticket.status !== 'cancelled' && (
          <button className="button button-cancel" onClick={() => onCancel(ticket.id)}>Cancel ticket</button>
        )}
      </div>
    </article>
  );
}

export default TicketCard;
