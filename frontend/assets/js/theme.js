(function () {
  const STORAGE_KEY = 'nyx-theme';

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
    document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
      btn.textContent = theme === 'dark' ? '\u2600' : '\u25D1'; // sun / half-circle moon-ish
      btn.title = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
    });
  }

  function currentTheme() {
    return localStorage.getItem(STORAGE_KEY) || 'dark';
  }

  function initTheme() {
    applyTheme(currentTheme());
  }

  function toggleTheme() {
    applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
  }

  // Apply immediately (before paint) to avoid a flash of the wrong theme.
  initTheme();

  window.NyxTheme = { applyTheme, currentTheme, toggleTheme, initTheme };
})();
