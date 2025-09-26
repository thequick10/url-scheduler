(async function() {
  // Step 1: Load HTML
  const resp = await fetch('/components/navbar/navbar.html');
  const html = await resp.text();
  const root = document.getElementById('navbar-root');
  if (!root) return;
  root.innerHTML = html;

  // Step 2: Load CSS
  const cssId = 'navbar-css';
  if (!document.getElementById(cssId)) {
    const link = document.createElement('link');
    link.id = cssId;
    link.rel = 'stylesheet';
    link.href = '/components/navbar/navbar.css';
    document.head.appendChild(link);
  }

  // Step 3: Hamburger logic
  const hamburger = document.getElementById('navbar-hamburger');
  const flyout = document.getElementById('navbar-flyout');
  let open = false;

  function closeMenu() {
    flyout.style.display = 'none';
    open = false;
  }
  function openMenu() {
    flyout.style.display = 'block';
    open = true;
  }

  hamburger.addEventListener('click', (e) => {
    e.stopPropagation();
    if (open) closeMenu();
    else openMenu();
  });

  document.addEventListener('click', (e) => {
    if (open && !flyout.contains(e.target) && !hamburger.contains(e.target)) {
      closeMenu();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });

  // ✅ Step 4: Role-based link visibility (now that DOM elements exist)
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    const user = data?.user;
    const role = data?.user?.role;
    const name = user?.name || user?.username || 'there';

    // 👋 Insert greeting as first menu item
    const ul = document.querySelector('#navbar-flyout ul');
    if (ul) {
      const li = document.createElement('li');
      li.className = 'navbar-user-greeting';
      li.textContent = `👋 Hi ${name}`;
      ul.insertBefore(li, ul.firstChild);
    }

    const links = {
        'link-activity': ['Admin', 'Subscriber'],
        'link-analytics': ['Admin', 'Analytics'],
        'link-resolutions': ['Admin'],
        'link-time': ['Admin'],
        'admin-users-link': ['Admin'],
        'link-signup-requests': ['Admin'],
        'schedule-link': ['Admin', 'Coordinator'],
        'scheduled-results-link': ['Admin', 'Coordinator'],
        'user-account': ['Admin', 'Subscriber']
    };

    for (const id in links) {
        const link = document.getElementById(id);
        if (link) {
            const listItem = link.parentElement;
            if (links[id].includes(role)) {
                listItem.style.display = 'list-item';
            } else {
                listItem.style.display = 'none';
            }
        }
    }
  } catch (err) {
    console.error('Error checking user role:', err);
  }
})();
