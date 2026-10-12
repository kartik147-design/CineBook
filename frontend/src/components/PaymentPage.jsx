import { useState } from 'react';

function PaymentPage({ movie, showtime, seats, user, busy, onBack, onSubmit }) {
  const [method, setMethod] = useState('Demo card');
  const [details, setDetails] = useState({
    fullName: user.fullName,
    email: user.email,
    phone: '',
    demoInput: '4242 4242 4242 4242',
  });
  const subtotal = seats.length * showtime.price;
  const fee = Math.round(subtotal * 0.05);
  const total = subtotal + fee;

  const update = (field, value) => setDetails((current) => ({ ...current, [field]: value }));
  const submit = (event) => {
    event.preventDefault();
    onSubmit(method, details);
  };

  let paymentInstructions = 'Demo card number: 4242 4242 4242 4242';
  if (method === 'Demo UPI') {
    paymentInstructions = 'Use any demo handle ending in @demo, such as cinebook@demo.';
  } else if (method === 'Demo net banking') {
    paymentInstructions = 'Choose a fictional bank below to simulate a successful payment.';
  } else if (method === 'Pay at venue') {
    paymentInstructions = 'Your seats will be reserved. Pay at the cinema counter before the show.';
  } else {
    paymentInstructions += ' Expiry: any future month/year. Demo CVV: 123.';
  }

  return (
    <section className="payment-page">
      <button className="back-link" onClick={onBack}>← Back to seat selection</button>
      <div className="payment-page-heading">
        <p className="section-kicker">One last step</p>
        <h1>Complete your booking</h1>
        <p>Your seats are not booked until this form is submitted.</p>
      </div>
      <div className="payment-layout">
        <form className="payment-form" onSubmit={submit}>
          <section className="payment-form-section">
            <span className="form-step">01</span>
            <div className="form-section-heading">
              <h2>Ticket holder</h2>
              <p>We’ll use these details for your ticket.</p>
            </div>
            <div className="payment-contact-grid">
              <label>
                Full name
                <input required minLength="2" maxLength="80" autoComplete="name" value={details.fullName} onChange={(event) => update('fullName', event.target.value)} />
              </label>
              <label>
                Email address
                <input required type="email" autoComplete="email" value={details.email} onChange={(event) => update('email', event.target.value)} />
              </label>
              <label className="phone-field">
                Phone number
                <input required type="tel" autoComplete="tel" minLength="10" maxLength="18" placeholder="+91 98765 43210" value={details.phone} onChange={(event) => update('phone', event.target.value)} />
              </label>
            </div>
          </section>
          <section className="payment-form-section">
            <span className="form-step">02</span>
            <div className="form-section-heading">
              <h2>Payment method</h2>
              <p>Demo only: never enter real card or bank details.</p>
            </div>
            <div className="payment-method-grid">
              {['Demo card', 'Demo UPI', 'Demo net banking', 'Pay at venue'].map((option) => (
                <button
                  className={method === option ? 'method-tile selected' : 'method-tile'}
                  key={option}
                  onClick={() => {
                    setMethod(option);
                    update('demoInput', option === 'Demo card' ? '4242 4242 4242 4242' : '');
                  }}
                  type="button"
                >
                  <span className="method-icon">
                    {option === 'Demo card' ? '▤' : option === 'Demo UPI' ? '⌁' : option === 'Demo net banking' ? '▥' : '⌂'}
                  </span>
                  <span>{option}</span>
                  <i>{method === option ? '✓' : ''}</i>
                </button>
              ))}
            </div>
            {method === 'Demo card' && (
              <div className="demo-card-fields">
                <label>
                  Demo card number
                  <input
                    required
                    inputMode="numeric"
                    autoComplete="off"
                    value={details.demoInput}
                    onChange={(event) => update('demoInput', event.target.value)}
                  />
                </label>
                <div className="demo-card-small-fields">
                  <label>
                    Expiry
                    <input required placeholder="MM/YY" inputMode="numeric" autoComplete="off" pattern="(0[1-9]|1[0-2])/[2-9][0-9]" />
                  </label>
                  <label>
                    Demo CVV
                    <input required placeholder="123" inputMode="numeric" minLength="3" maxLength="3" pattern="[0-9]{3}" autoComplete="off" />
                  </label>
                </div>
              </div>
            )}
            {method === 'Demo UPI' && (
              <label className="demo-method-input">
                Demo UPI ID
                <input required placeholder="cinebook@demo" value={details.demoInput} onChange={(event) => update('demoInput', event.target.value)} />
              </label>
            )}
            {method === 'Demo net banking' && (
              <label className="demo-method-input">
                Choose demo bank
                <select required value={details.demoInput} onChange={(event) => update('demoInput', event.target.value)}>
                  <option value="">Select a fictional bank</option>
                  <option>Demo National Bank</option>
                  <option>Demo City Bank</option>
                  <option>Demo Union Bank</option>
                </select>
              </label>
            )}
            <div className="demo-payment-notice">
              <span>ⓘ</span>
              <p>{paymentInstructions} Test values are checked by CineBook’s local payment simulator and are never stored.</p>
            </div>
          </section>
          <button className="button button-primary button-wide payment-submit" disabled={busy} type="submit">
            {busy ? 'Confirming your seats…' : method === 'Pay at venue' ? 'Reserve seats' : `Simulate payment · ₹${total}`}
          </button>
          <p className="payment-security-note">No external payment gateway is connected. This demo will never charge you.</p>
        </form>

        <aside className="payment-order">
          <p className="section-kicker">Your movie night</p>
          <h2>{movie.title}</h2>
          <p className="order-cinema">{showtime.cinema}</p>
          <div className="order-show-info">
            <span>{showtime.screen}</span>
            <span>{showtime.date} · {showtime.time}</span>
          </div>
          <div className="order-seats">
            <span>Your seats</span>
            <strong>{seats.join(' · ')}</strong>
          </div>
          <div className="order-price-row"><span>{seats.length} × ticket</span><strong>₹{subtotal}</strong></div>
          <div className="order-price-row"><span>Convenience fee</span><strong>₹{fee}</strong></div>
          <div className="order-grand-total"><span>Total</span><strong>₹{total}</strong></div>
          <div className="order-notice"><span>◷</span> Seats are finalized only after you submit checkout.</div>
        </aside>
      </div>
    </section>
  );
}

export default PaymentPage;
