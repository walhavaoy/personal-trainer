document.addEventListener('DOMContentLoaded', function () {
  fetch('/api/health')
    .then(function (res) { return res.json(); })
    .then(function (data) {
      var el = document.createElement('p');
      el.textContent = 'API status: ' + data.status;
      document.getElementById('app').appendChild(el);
    })
    .catch(function (err) {
      console.error('Health check failed', err);
    });
});
