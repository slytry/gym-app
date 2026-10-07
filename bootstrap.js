import('./app.js?v=21').catch((error) => {
  const warning = document.querySelector('#storage-warning');
  warning.textContent = `Не удалось запустить приложение: ${error.message}. Данные сайта не очищайте. Проверьте program.json и перезагрузите страницу.`;
  warning.hidden = false;
});
