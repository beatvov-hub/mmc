/* AI学習室: the source question bank remains unchanged. */
(() => {
  const root = document.querySelector('[data-learning-quiz]');
  if (!root) return;
  const qualification = root.dataset.qualification;
  let bank = [], questions = [], index = 0, score = 0, answered = false, mode = '';
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const day = () => new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Tokyo', year:'numeric', month:'2-digit', day:'2-digit'}).format(new Date());
  function seeded(seed) {
    let n = 2166136261;
    for (const c of seed) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
    return () => { n += 0x6D2B79F5; let t = n; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  function choose(list, count, random) {
    const result = [...list];
    for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
    return result.slice(0, Math.min(count, result.length));
  }
  function start(selected) {
    mode = selected; index = 0; score = 0; answered = false;
    questions = choose(bank, mode === 'daily' ? 5 : 10, mode === 'daily' ? seeded(`${qualification}:${day()}`) : Math.random);
    show();
  }
  function show() {
    if (index === questions.length) {
      root.innerHTML = `<div class="learning-result" role="status"><h3>学習おつかれさまでした</h3><p>${questions.length}問中 ${score}問正解（正答率 ${Math.round(score / questions.length * 100)}%）</p><button type="button" data-action="retry">もう一度挑戦</button> <button type="button" data-action="menu">モードを選ぶ</button></div>`;
      return;
    }
    answered = false;
    const q = questions[index];
    root.innerHTML = `<p>問題 ${index + 1} / ${questions.length}</p><form><fieldset><legend>${escape(q.question)}</legend>${q.choices.map(c => `<label class="learning-choice"><input type="radio" name="answer" value="${escape(c.id)}" required> <span>${escape(c.id)}. ${escape(c.text)}</span></label>`).join('')}</fieldset><button type="submit">回答を確定</button></form><div data-feedback aria-live="polite"></div>`;
  }
  function menu() {
    root.innerHTML = '<p>途中でページを更新すると最初からになります。</p><button type="button" data-action="daily">今日の5問</button> <button type="button" data-action="random">ランダム10問</button>';
  }
  root.addEventListener('click', event => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'daily' || action === 'random') start(action);
    else if (action === 'retry') start(mode);
    else if (action === 'menu') menu();
    else if (action === 'next') { index++; show(); }
  });
  root.addEventListener('submit', event => {
    event.preventDefault();
    if (answered) return;
    const form = event.target, chosen = new FormData(form).get('answer');
    if (!chosen) return;
    answered = true;
    const q = questions[index], correct = chosen === q.correctAnswer;
    if (correct) score++;
    form.querySelectorAll('input, button').forEach(el => { el.disabled = true; });
    root.querySelector('[data-feedback]').innerHTML = `<h3>${correct ? '正解' : '不正解'}：正解は ${escape(q.correctAnswer)}</h3><p>${escape(q.explanation.correct)}</p><h4>選択肢の解説</h4><ul>${q.choices.map(c => `<li><strong>${escape(c.id)}. ${escape(c.text)}</strong>：${escape(q.explanation.choices[c.id])}</li>`).join('')}</ul><p>参考：<a href="${escape(q.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escape(q.sourceName)}</a></p><button type="button" data-action="next">${index + 1 === questions.length ? '結果を見る' : '次の問題へ'}</button>`;
  });
  fetch(root.dataset.source).then(response => { if (!response.ok) throw new Error('fetch'); return response.json(); }).then(data => {
    bank = data.questions.filter(q => q.qualification === qualification).sort((a,b) => a.id.localeCompare(b.id));
    if (!bank.length) throw new Error('empty');
    menu();
  }).catch(() => { root.textContent = '問題を読み込めませんでした。ページを再読み込みしてください。'; });
})();
