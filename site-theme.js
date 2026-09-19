(function () {
  const storageKey = 'ab-theme';
  const media = window.matchMedia('(prefers-color-scheme: dark)');

  function storedChoice() {
    const value = localStorage.getItem(storageKey);
    return value === 'light' || value === 'dark' ? value : 'auto';
  }

  function resolvedTheme(choice) {
    return choice === 'auto' ? (media.matches ? 'dark' : 'light') : choice;
  }

  function applyTheme(choice) {
    const safeChoice = choice === 'light' || choice === 'dark' ? choice : 'auto';
    document.documentElement.dataset.theme = resolvedTheme(safeChoice);
    document.documentElement.dataset.themeChoice = safeChoice;
    document.documentElement.style.colorScheme = resolvedTheme(safeChoice);

    document.querySelectorAll('[data-theme-choice]').forEach(function (button) {
      const active = button.dataset.themeChoice === safeChoice;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function setChoice(choice) {
    if (choice === 'auto') localStorage.removeItem(storageKey);
    else localStorage.setItem(storageKey, choice);
    applyTheme(choice);
  }

  applyTheme(storedChoice());

  document.addEventListener('DOMContentLoaded', function () {
    applyTheme(storedChoice());
    document.querySelectorAll('[data-theme-choice]').forEach(function (button) {
      button.addEventListener('click', function () {
        setChoice(button.dataset.themeChoice);
      });
    });
  });

  media.addEventListener('change', function () {
    if (storedChoice() === 'auto') applyTheme('auto');
  });
})();
