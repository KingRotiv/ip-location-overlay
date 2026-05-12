chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'fetch-api' || !message.url) {
    return false;
  }

  fetch(message.url, {
    method: 'GET',
    headers: { 'Accept': 'application/json' }
  })
    .then(async (response) => {
      const text = await response.text();
      let body;

      try {
        body = JSON.parse(text);
      } catch (error) {
        body = text;
      }

      sendResponse({
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        body
      });
    })
    .catch((error) => {
      sendResponse({
        ok: false,
        status: 0,
        statusText: error.message,
        body: null,
        error: error.message
      });
    });

  return true; // keep the message channel open for async response
});
