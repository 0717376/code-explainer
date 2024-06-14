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
    chrome.storage.sync.get(['bearerToken'], (result) => {
      const bearerToken = result.bearerToken || '';
      chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ['styles.css']
      }, () => {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['highlight.min.js', 'marked.min.js']
        }, () => {
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: explainSelectedCode,
            args: [info.selectionText, bearerToken]
          });
        });
      });
    });
  }
});

async function explainSelectedCode(selectedText, bearerToken) {
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

  modal.appendChild(closeButtonContainer);
  closeButtonContainer.appendChild(closeButton);
  document.body.appendChild(modal);
  document.body.appendChild(closeButtonContainer);

  if (!bearerToken) {
    const tokenInputLabel = document.createElement('label');
    tokenInputLabel.textContent = 'Введите Bearer Token:';
    tokenInputLabel.style.display = 'block';
    tokenInputLabel.style.marginBottom = '10px';

    const tokenInput = document.createElement('input');
    tokenInput.type = 'text';
    tokenInput.style.width = '100%';
    tokenInput.style.padding = '10px';
    tokenInput.style.border = '1px solid #ddd';
    tokenInput.style.borderRadius = '4px';
    tokenInput.style.marginBottom = '20px';
    tokenInput.style.fontSize = '14px';

    const saveButton = document.createElement('button');
    saveButton.textContent = 'Сохранить';
    saveButton.style.padding = '10px 20px';
    saveButton.style.background = '#007bff';
    saveButton.style.color = '#ffffff';
    saveButton.style.border = 'none';
    saveButton.style.borderRadius = '4px';
    saveButton.style.cursor = 'pointer';
    saveButton.style.fontSize = '14px';
    saveButton.style.marginRight = '10px';
    saveButton.addEventListener('click', async () => {
      const token = tokenInput.value;
      if (token) {
        try {
          const testResponse = await fetch('https://ai.muravskiy.com/ollama/api/tags', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (!testResponse.ok) {
            throw new Error('Токен некорректный');
          }
          chrome.storage.sync.set({ bearerToken: token }, () => {
            alert('Token сохранен! Попробуйте снова.');
            document.body.removeChild(modal);
            document.body.removeChild(closeButtonContainer);
          });
        } catch (error) {
          alert('Пожалуйста, введите валидный Bearer Token.');
        }
      } else {
        alert('Пожалуйста, введите Bearer Token.');
      }
    });


    modal.appendChild(tokenInputLabel);
    modal.appendChild(tokenInput);
    modal.appendChild(saveButton);
    modal.appendChild(retryButton);

    return;
  }

  const disclaimerText = document.createElement('div');
  disclaimerText.textContent = 'Ответы LLM могут быть ошибочны и неточны';
  disclaimerText.style.color = 'rgba(128, 128, 128, 0.5)';
  disclaimerText.style.textAlign = 'center';
  disclaimerText.style.fontSize = '12px';
  disclaimerText.style.marginBottom = '6px';

  const explanationText = document.createElement('div');
  explanationText.style.marginTop = '30px';
  explanationText.style.lineHeight = '1.5';
  explanationText.style.fontSize = '16px';
  explanationText.classList.add('custom-explanation');

  modal.appendChild(disclaimerText);
  modal.appendChild(explanationText);

  try {
    console.log('Sending request to AI');
    const response = await fetch('https://ai.muravskiy.com/ollama/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${bearerToken}`
      },
      body: JSON.stringify({
        model: 'codestral',
        prompt: `Я системный аналитик, который хочет научиться хорошо читать и понимать код. Мой текущий уровень - базовые знания основных концепций программирования и алгоритмов. 

Объясни предоставленный код (или его часть) ясно и понятно на русском языке с учетом моего уровня знаний. Приводи по ходу объяснений как можно больше релевантных фрагментов из анализируемого кода, снабжая их подробными комментариями, чтобы со временем я смог читать код самостоятельно.

Используй форматирование markdown для структурирования объяснения по следующим разделам:

#### Общее описание
- Кратко опиши назначение и функциональность кода в целом.

#### Входные данные
- Укажи, какие входные данные принимает код, и в каком формате.

#### Выходные данные
- Поясни, какие выходные данные или результат возвращает код.

#### Пошаговый алгоритм
- Разбери алгоритм работы кода по шагам, уделяя внимание ключевым моментам.
- Снабди каждый шаг примерами фрагментов кода с подробными комментариями.

#### Важные нюансы реализации  
- Укажи на важные особенности и нюансы реализации, которые надо учитывать.
- Поясни назначение нетривиальных конструкций кода, если они есть.

Избегай предположений и неуверенных выводов. Если какой-то части кода не хватает контекста для полного объяснения, укажи это явно. Уделяй внимание деталям, чтобы минимизировать вероятность ошибок или неправильных интерпретаций. 

Вот код (или фрагмент кода) на C# для анализа:

${selectedText}

Пожалуйста, дай развернутый ответ на русском языке, не используя фраз на английском. Не надо никаких приветствий, сразу приступай к объяснению. Спасибо!`,
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

      document.querySelectorAll('.custom-explanation pre code').forEach((block) => {
        hljs.highlightBlock(block);
      });
    }

    console.log('Stream finished');
  } catch (error) {
    console.error('Error:', error);
    explanationText.textContent = 'Ошибка при объяснении кода: ' + error.message;
  }
}