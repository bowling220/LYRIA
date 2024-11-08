// DOM Elements
const closeSettingsButton = document.querySelector('.close-settings');
const settingsCategories = document.querySelectorAll('.settings-categories li');
const settingsSections = document.querySelectorAll('.settings-section');

// Close settings and return to chat
closeSettingsButton.addEventListener('click', () => {
  window.location.href = 'home.html';
});

// Toggle active settings section
settingsCategories.forEach((category, index) => {
  category.addEventListener('click', () => {
    // Update active category
    settingsCategories.forEach(cat => cat.classList.remove('active'));
    category.classList.add('active');

    // Show the corresponding section and hide others
    settingsSections.forEach(section => section.classList.add('hidden'));
    const sectionToShow = settingsSections[index];
    if (sectionToShow) {
      sectionToShow.classList.remove('hidden');
    }
  });
});

// Additional functionality as needed for your settings options
