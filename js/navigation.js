/* ============================================================
   WEST YANGON TECHNOLOGICAL UNIVERSITY (WYTU)
   NAVIGATION JAVASCRIPT (js/navigation.js)
   ============================================================ */

const MOBILE_NAV_BREAKPOINT = 992; // must match the media query in css/responsive.css

document.addEventListener('DOMContentLoaded', () => {
  initMobileNavigation();
  highlightActiveNavLink();
});

function initMobileNavigation() {
  const hamburger = document.querySelector('.hamburger');
  const navMenu = document.querySelector('.nav-menu');

  if (!hamburger || !navMenu) return;

  // Create mobile overlay backdrop if missing
  let mobileOverlay = document.querySelector('.mobile-nav-overlay');
  if (!mobileOverlay) {
    mobileOverlay = document.createElement('div');
    mobileOverlay.className = 'mobile-nav-overlay';
    document.body.appendChild(mobileOverlay);
  }

  // Create mobile menu close button inside menu if missing
  let closeBtn = navMenu.querySelector('.mobile-menu-close');
  if (!closeBtn) {
    closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'mobile-menu-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.setAttribute('aria-label', 'Close Menu');
    navMenu.prepend(closeBtn);
  }

  function openMenu() {
    navMenu.classList.add('active');
    mobileOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    hamburger.setAttribute('aria-expanded', 'true');
  }

  function closeMenu() {
    navMenu.classList.remove('active');
    mobileOverlay.classList.remove('active');
    document.body.style.overflow = '';
    hamburger.setAttribute('aria-expanded', 'false');
  }

  function toggleMobileMenu() {
    if (navMenu.classList.contains('active')) {
      closeMenu();
    } else {
      openMenu();
    }
  }

  hamburger.setAttribute('aria-expanded', 'false');
  hamburger.addEventListener('click', toggleMobileMenu);
  closeBtn.addEventListener('click', closeMenu);
  mobileOverlay.addEventListener('click', closeMenu);

  // Close with the Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });

  // Reset everything if the window is resized back to desktop width
  window.addEventListener('resize', () => {
    if (window.innerWidth > MOBILE_NAV_BREAKPOINT) {
      closeMenu();
      document.querySelectorAll('.dropdown.mobile-open').forEach(d => d.classList.remove('mobile-open'));
    }
  });

  // Mobile accordion for "Departments"
  const dropdownToggleLinks = document.querySelectorAll('.dropdown > .nav-link');
  dropdownToggleLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      if (window.innerWidth <= MOBILE_NAV_BREAKPOINT) {
        e.preventDefault();
        link.closest('.dropdown').classList.toggle('mobile-open');
      }
    });
  });

  // Close the drawer when a real link inside it is tapped
  navMenu.querySelectorAll('a').forEach(a => {
    const isDropdownToggle = a.matches('.dropdown > .nav-link');
    if (isDropdownToggle) return;
    a.addEventListener('click', () => {
      if (window.innerWidth <= MOBILE_NAV_BREAKPOINT) closeMenu();
    });
  });
}

function highlightActiveNavLink() {
  const currentPath = window.location.pathname;
  const navLinks = document.querySelectorAll('.nav-link, .dropdown-item');

  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (!href) return;

    // Check match
    if (currentPath.endsWith(href) || (href === 'index.html' && (currentPath.endsWith('/') || currentPath.endsWith('/WYTU/')))) {
      link.classList.add('active');
      const dropdownParent = link.closest('.dropdown');
      if (dropdownParent) {
        const parentLink = dropdownParent.querySelector('.nav-link');
        if (parentLink) parentLink.classList.add('active');
      }
    }
  });
}