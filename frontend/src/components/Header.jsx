function Header({
  user,
  currentView,
  onHome,
  onTickets,
  onAdmin,
  onLogin,
  onSignup,
  onAdminLogin,
  onLogout,
}) {
  return (
    <header className="topbar">
      <button className="brand" type="button" onClick={onHome} aria-label="CineBook home">
        <span className="brand-mark">C</span>
        <span className="brand-copy">
          <strong>CineBook</strong>
          <small>Your next scene starts here</small>
        </span>
      </button>

      <nav className="main-nav" aria-label="Main navigation">
        <button className={currentView === 'home' ? 'nav-link active' : 'nav-link'} onClick={onHome}>
          Discover
        </button>
        {user?.role !== 'admin' && (
          <button
            className={currentView === 'tickets' ? 'nav-link active' : 'nav-link'}
            onClick={onTickets}
          >
            My tickets
          </button>
        )}
        {user?.role === 'admin' ? (
          <button
            className={currentView === 'admin' ? 'nav-link active' : 'nav-link'}
            onClick={onAdmin}
          >
            Admin
          </button>
        ) : (
          <button className="nav-link admin-entry" onClick={onAdminLogin}>
            Admin
          </button>
        )}
      </nav>

      <div className="account-actions">
        {user ? (
          <>
            <span className="account-name">Hi, {user.fullName.split(' ')[0]}</span>
            <button className="button button-quiet" onClick={onLogout}>Log out</button>
          </>
        ) : (
          <>
            <button className="button button-quiet desktop-signup" onClick={onSignup}>Sign up</button>
            <button className="button button-primary" onClick={onLogin}>Log in</button>
          </>
        )}
      </div>
    </header>
  );
}

export default Header;
