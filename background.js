chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
  chrome.contextMenus.create({
    id: 'explainCode',
    title: 'Объяснить код',
    contexts: ['selection']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  console.log('Context menu clicked', info, tab);
  if (info.menuItemId === 'explainCode') {
    chrome.scripting.insertCSS({
      target: { tabId: tab.id },
      files: ['styles.css']
    }, () => {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['marked.min.js', 'highlight.min.js'],
      }, () => {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          function: explainSelectedCode,
          args: [info.selectionText]
        });
      });
    });
  }
});

async function explainSelectedCode(selectedText) {
  console.log('Executing explainSelectedCode with text:', selectedText);

  const modal = document.createElement('div');
  modal.style.position = 'fixed';
  modal.style.top = '50%';
  modal.style.left = '50%';
  modal.style.transform = 'translate(-50%, -50%)';
  modal.style.padding = '20px';
  modal.style.background = '#f8f9fa';
  modal.style.color = '#333';
  modal.style.border = '1px solid #d1d5db';
  modal.style.borderRadius = '0.5rem';
  modal.style.zIndex = '9999';
  modal.style.width = '800px';
  modal.style.height = '500px';
  modal.style.overflow = 'auto';
  modal.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
  modal.style.fontFamily = 'Arial, sans-serif';

  const closeButtonContainer = document.createElement('div');
  closeButtonContainer.style.position = 'fixed';
  closeButtonContainer.style.top = 'calc(50% - 270px)';
  closeButtonContainer.style.left = 'calc(50% + 330px)';
  closeButtonContainer.style.transform = 'translateX(-50%)';
  closeButtonContainer.style.zIndex = '10000';

  const closeButton = document.createElement('button');
  closeButton.textContent = 'Закрыть';
  closeButton.style.padding = '5px 10px';
  closeButton.style.background = '#ffffff';
  closeButton.style.color = '#333333';
  closeButton.style.border = '1px solid #cccccc';
  closeButton.style.borderRadius = '0.25rem';
  closeButton.style.cursor = 'pointer';
  closeButton.addEventListener('click', () => {
    document.body.removeChild(modal);
    document.body.removeChild(closeButtonContainer);
  });

  const disclaimerText = document.createElement('div');
  disclaimerText.textContent = 'Ответы от LLM могут быть ошибочны и неточны';
  disclaimerText.style.color = 'rgba(128, 128, 128, 0.5)';
  disclaimerText.style.textAlign = 'center';
  disclaimerText.style.fontSize = '12px';
  disclaimerText.style.marginBottom = '6px';

  const explanationText = document.createElement('div');
  explanationText.style.marginTop = '30px';
  explanationText.style.lineHeight = '1.5';
  explanationText.style.fontSize = '16px';

  modal.appendChild(disclaimerText);
  modal.appendChild(explanationText);
  closeButtonContainer.appendChild(closeButton);
  document.body.appendChild(modal);
  document.body.appendChild(closeButtonContainer);

  try {
    console.log('Sending request to AI');
    const response = await fetch('https://ai.muravskiy.com/ollama/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImQyZDA3YThkLWMyY2UtNGVhOC05NjJiLWQ4ODViNDM2OWMzNiJ9.ApRN8XLUtTtYQToU4b3gTYdEqTOnyD1iXyu1VicB7rI'
      },
      body: JSON.stringify({
        model: 'codestral',
        prompt: `Я системный аналитик среднего уровня, разбираюсь в основных концепциях программирования и алгоритмах. Объясни этот код ясно и понятно на русском языке с учетом моего уровня знаний.

  Используй форматирование markdown для структурирования объяснения по разделам:
  ### Общее описание 
  ### Входные данные
  ### Выходные данные
  ### Пошаговый алгоритм
  ### Важные нюансы реализации

  Добавь блоки кода для иллюстрации ключевых моментов. После объяснения предложи возможные улучшения кода с точки зрения читаемости, эффективности и поддерживаемости, если это уместно. Не надо никаких приветствий, сразу приступай к объяснению.

  Вот код для анализа:

  ${selectedText}

  Пожалуйста, дай развернутый ответ на русском языке, без фраз на английском. Спасибо!`,
        stream: true
      })
    });

    console.log('Response status:', response.status);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let explanation = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      console.log('Received chunk:', done, value);

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (line.trim() === '') continue;

        try {
          const data = JSON.parse(line);

          if (data.response) {
            explanation += data.response;
          }
        } catch (error) {
          console.warn('Invalid JSON:', line);
        }
      }

      const md = marked.parse(explanation);
      explanationText.innerHTML = md;
      hljs.highlightAll();
    }

    console.log('Stream finished');
  } catch (error) {
    console.error('Error:', error);
    explanationText.textContent = 'Ошибка при объяснении кода: ' + error.message;
  }
}