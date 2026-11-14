/**
 * AI-Powered Smart Spending Assistant UI Controller.
 *
 * Provides real-time financial health scores, proactive alerts,
 * actionable savings recommendations, and an interactive conversational assistant.
 */

import { API_BASE } from './storage.js';
import { escapeHTML, formatCurrency, formatMonthLabel } from './transactions.js';

let isAssistantInitialized = false;
let currentMonth = '';
const chatHistory = [];

/**
 * Renders simple markdown formatting (bold, bullets, line breaks) safely into HTML.
 */
function renderMarkdownText(text) {
  if (!text) return '';
  const escaped = escapeHTML(text);

  return escaped
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>');
}

/**
 * Fetches smart insights for the specified month.
 */
export async function fetchSmartInsights(monthKey) {
  try {
    const res = await fetch(`${API_BASE}/assistant/insights?month=${monthKey}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to fetch insights');
    return json.data;
  } catch (err) {
    console.error('[AI Assistant] Error fetching insights:', err);
    return null;
  }
}

/**
 * Sends a message to the AI assistant.
 */
export async function sendChatMessage(message, monthKey) {
  try {
    const res = await fetch(`${API_BASE}/assistant/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, month: monthKey }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Chat request failed');
    return json.data;
  } catch (err) {
    console.error('[AI Assistant] Error sending chat message:', err);
    throw err;
  }
}

/**
 * Appends a message bubble to the chat conversation.
 */
function appendChatMessage(sender, text, isError = false) {
  const container = document.getElementById('assistant-chat-messages');
  if (!container) return;

  const bubble = document.createElement('div');
  bubble.className = `assistant-bubble is-${sender} ${isError ? 'is-error' : ''}`;

  const avatar = document.createElement('div');
  avatar.className = 'assistant-avatar';
  avatar.innerHTML = sender === 'user'
    ? '<i data-lucide="user" class="icon-xs" aria-hidden="true"></i>'
    : '<i data-lucide="sparkles" class="icon-xs" aria-hidden="true"></i>';

  const content = document.createElement('div');
  content.className = 'assistant-bubble-content';
  content.innerHTML = renderMarkdownText(text);

  bubble.appendChild(avatar);
  bubble.appendChild(content);
  container.appendChild(bubble);

  // Scroll to bottom
  container.scrollTop = container.scrollHeight;

  if (window.lucide?.createIcons) {
    window.lucide.createIcons();
  }
}

/**
 * Shows or hides the assistant typing indicator.
 */
function setTypingIndicator(visible) {
  const typingEl = document.getElementById('assistant-typing-indicator');
  if (!typingEl) return;
  typingEl.classList.toggle('is-hidden', !visible);

  const container = document.getElementById('assistant-chat-messages');
  if (container && visible) {
    container.scrollTop = container.scrollHeight;
  }
}

/**
 * Handles sending a user inquiry.
 */
async function handleUserSubmit(userText) {
  const query = (userText || '').trim();
  if (!query) return;

  const inputEl = document.getElementById('assistant-chat-input');
  if (inputEl) inputEl.value = '';

  appendChatMessage('user', query);
  setTypingIndicator(true);

  try {
    const response = await sendChatMessage(query, currentMonth);
    setTypingIndicator(false);
    appendChatMessage('assistant', response.reply);
  } catch (err) {
    setTypingIndicator(false);
    appendChatMessage(
      'assistant',
      'Sorry, I could not process your inquiry right now. Please ensure the server is connected and try again.',
      true
    );
  }
}

/**
 * Renders the AI Spending Assistant view.
 */
export async function renderAssistantView(monthKey) {
  currentMonth = monthKey || new Date().toISOString().slice(0, 7);

  const monthLabel = formatMonthLabel(currentMonth);
  const subtitleEl = document.getElementById('assistant-view-subtitle');
  if (subtitleEl) {
    subtitleEl.textContent = `Real-time intelligence and advice for ${monthLabel}`;
  }

  const data = await fetchSmartInsights(currentMonth);
  if (!data) return;

  // 1. Render Financial Health Score
  const scoreValEl = document.getElementById('assistant-health-score');
  const scoreBadgeEl = document.getElementById('assistant-health-badge');
  const scoreDescEl = document.getElementById('assistant-health-desc');

  if (scoreValEl) scoreValEl.textContent = `${data.healthScore}/100`;

  let badgeClass = 'is-nominal';
  let badgeText = 'Excellent';
  if (data.healthScore < 50) {
    badgeClass = 'is-exceeded';
    badgeText = 'Needs Attention';
  } else if (data.healthScore < 75) {
    badgeClass = 'is-warning';
    badgeText = 'Fair';
  }

  if (scoreBadgeEl) {
    scoreBadgeEl.className = `status-text ${badgeClass}`;
    scoreBadgeEl.textContent = badgeText;
  }

  if (scoreDescEl) {
    scoreDescEl.textContent = data.aiNarrative || 'Balanced cash flow with healthy reserve allocations.';
  }

  // 2. Render Smart Insights List
  const insightsListEl = document.getElementById('assistant-insights-list');
  if (insightsListEl) {
    if (data.insights.length === 0) {
      insightsListEl.innerHTML = '<p class="empty-desc">No specific alerts detected for this month.</p>';
    } else {
      insightsListEl.innerHTML = data.insights
        .map((item) => {
          let iconName = 'info';
          let borderClass = 'is-info';
          if (item.type === 'positive') {
            iconName = 'check-circle-2';
            borderClass = 'is-nominal';
          } else if (item.type === 'warning') {
            iconName = 'alert-triangle';
            borderClass = 'is-warning';
          } else if (item.type === 'danger') {
            iconName = 'alert-octagon';
            borderClass = 'is-exceeded';
          }

          return `
            <div class="assistant-insight-card ${borderClass}">
              <div class="insight-header">
                <i data-lucide="${iconName}" class="icon-xs" aria-hidden="true"></i>
                <strong class="insight-title">${escapeHTML(item.title)}</strong>
              </div>
              <p class="insight-body">${escapeHTML(item.description)}</p>
            </div>
          `;
        })
        .join('');
    }
  }

  // 3. Render Actionable Recommendations
  const recsListEl = document.getElementById('assistant-recommendations-list');
  if (recsListEl) {
    recsListEl.innerHTML = data.recommendations
      .map(
        (rec) => `
        <li class="assistant-rec-item">
          <i data-lucide="check" class="icon-xs text-income" aria-hidden="true"></i>
          <span>${escapeHTML(rec)}</span>
        </li>
      `
      )
      .join('');
  }

  // 4. Initial welcome message in chat if empty
  const chatMessagesEl = document.getElementById('assistant-chat-messages');
  if (chatMessagesEl && chatMessagesEl.children.length === 0) {
    appendChatMessage(
      'assistant',
      `👋 Hi! I'm your AI Spending Assistant. I've analyzed your records for **${monthLabel}**.\n\n` +
      `Your current Health Score is **${data.healthScore}/100** with **$${data.summary.expenses.toFixed(2)}** in expenses and **$${data.summary.netSavings.toFixed(2)}** in net savings.\n\n` +
      `Feel free to click any suggestion below or type your question!`
    );
  }

  if (window.lucide?.createIcons) {
    window.lucide.createIcons();
  }
}

/**
 * Initializes the AI assistant event listeners.
 */
export function initAssistantUI() {
  if (isAssistantInitialized) return;
  isAssistantInitialized = true;

  const form = document.getElementById('assistant-chat-form');
  const input = document.getElementById('assistant-chat-input');

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (input && input.value.trim()) {
      handleUserSubmit(input.value);
    }
  });

  // Suggestion prompt chips
  document.querySelectorAll('[data-prompt]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const promptText = chip.dataset.prompt;
      if (promptText) {
        handleUserSubmit(promptText);
      }
    });
  });
}

