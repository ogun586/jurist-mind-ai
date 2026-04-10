self.onmessage = async (e) => {
  const { url, body } = e.data;
  try {
    const response = await fetch(url, {
      method: 'POST',
      body,
    });
    if (!response.ok || !response.body) {
      self.postMessage({ type: 'error', message: 'Stream failed' });
      return;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let done = false;
    while (!done) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading;
      if (value) {
        const chunk = decoder.decode(value, { stream: true });
        self.postMessage({ type: 'chunk', data: chunk });
      }
    }
    self.postMessage({ type: 'done' });
  } catch (err: any) {
    self.postMessage({ type: 'error', message: err.message });
  }
};
