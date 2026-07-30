/* "Ask about me" AI chat widget for Jordy Kuang's site.
 *
 * Answers questions about Jordy at zero cost and with no API keys:
 *   - Primary: a small open model (Llama-3.2-1B) downloaded and run entirely in
 *     the visitor's browser via WebLLM + WebGPU. Nothing is sent to any server;
 *     it costs the site owner nothing.
 *   - Fallback: a keyword FAQ built from the CV, so the widget always answers
 *     even on browsers without WebGPU (most phones) or before the model loads.
 *
 * A single static android portrait is shown (no fake lip-sync); the LED conveys
 * thinking / speaking. Optional text-to-speech can be toggled on.
 */
(function () {
    'use strict';

    /* ---------------------------------------------------------------- facts */
    var BIO = [
        'Full name: Zhuodiao (Jordy) Kuang. Based in Pittsburgh, PA, USA.',
        'Current position: PhD student in Biostatistics at the University of Pittsburgh (since August 2025), working in Prof. Ying Ding\'s lab; also a Visiting Student at Carnegie Mellon University\'s School of Computer Science.',
        'Education: M.S. in Biostatistics, Columbia University Mailman School of Public Health (2023-2025, GPA 4.11/4.0); B.S. in Statistics, Renmin University of China (2019-2023, WES GPA 3.85) with a minor in Big Data & Data Science; summer school in Data Science at University College London (2021).',
        'Research interests: survival analysis, transfer learning, deep learning, conformal prediction, and data integration, applied to biomedical and health data.',
        'Selected work: conformal inference of individualized treatment rules under distributional shift (Biostatistics, under review); a deep-learning-for-survival-analysis tutorial (Lifetime Data Analysis, under review); blood-pressure estimation from PPG signals with deep learning (arXiv:2607.23406, 2026); fastCOMMUTE, a transfer-learning method using multi-source and synthetic data for risk prediction; an Alzheimer\'s disease moderators meta-analysis; and modeling 24-hour rest-activity rhythms and their link to cognition in older adults.',
        'Conference: presented first-author work at the International Conference on Health Policy Statistics (ICHPS) 2025 in San Diego.',
        'Technical skills: R, Python, C, C++, SAS, Stata, MATLAB, SQL/MySQL, MongoDB, Git, LaTeX. Spoken languages: English, Mandarin, Tujia, and Spanish.',
        'Awards: University of Pittsburgh Travel Fund Award (2026), Columbia Mailman Chair\'s Award (2025, top 1%), Columbia SCALE Travel Fund Award (2024), and undergraduate scholarships.',
        'Contact: zhk22@pitt.edu, jordyk@andrew.cmu.edu, or kuangzhuodiao@gmail.com. Links: GitHub github.com/zk2275 and Google Scholar.'
    ].join('\n- ');

    var SYSTEM = 'You are "Jordy-Bot", a friendly, concise assistant on the personal website of Zhuodiao "Jordy" Kuang. '
        + 'Visitors ask you questions about Jordy. Answer ONLY using the facts below, in the third person. '
        + 'If a question is not covered by the facts, say you do not have that information and suggest emailing Jordy at zhk22@pitt.edu. '
        + 'Keep answers to 1-4 short sentences. Never invent details.\n\nFACTS ABOUT JORDY:\n- ' + BIO;

    /* keyword FAQ used before/without the model */
    var FAQ = [
        { k: ['who', 'about', 'yourself', 'introduce', 'jordy', 'zhuodiao', 'bio'], a: 'Zhuodiao "Jordy" Kuang is a PhD student in Biostatistics at the University of Pittsburgh (in Prof. Ying Ding\'s lab) and a Visiting Student at Carnegie Mellon University. His work focuses on survival analysis, transfer learning, deep learning, and conformal prediction for biomedical data.' },
        { k: ['research', 'interest', 'work on', 'study', 'topic', 'focus', 'field'], a: 'Jordy\'s research interests are survival analysis, transfer learning, deep learning, conformal prediction, and data integration, applied to biomedical and health data.' },
        { k: ['phd', 'pitt', 'pittsburgh', 'current', 'now', 'doing', 'position', 'cmu', 'carnegie'], a: 'He is currently a PhD student in Biostatistics at the University of Pittsburgh (since Aug 2025), working in Prof. Ying Ding\'s lab, and a Visiting Student at Carnegie Mellon University\'s School of Computer Science.' },
        { k: ['education', 'school', 'degree', 'columbia', 'renmin', 'master', 'bachelor', 'undergrad', 'gpa', 'ucl', 'where', 'studied', 'study', 'university', 'college'], a: 'Education: M.S. in Biostatistics from Columbia University (2023-2025, GPA 4.11/4.0) and B.S. in Statistics from Renmin University of China (2019-2023) with a minor in Big Data & Data Science, plus a 2021 data science summer school at University College London.' },
        { k: ['publication', 'paper', 'publish', 'arxiv', 'preprint', 'author', 'manuscript'], a: 'Selected work includes conformal inference of individualized treatment rules (Biostatistics, under review), a deep-learning-for-survival-analysis tutorial (Lifetime Data Analysis, under review), blood-pressure estimation from PPG (arXiv:2607.23406, 2026), and fastCOMMUTE for transfer-learning risk prediction. See the Publications section for the full list.' },
        { k: ['skill', 'language', 'programming', 'code', 'coding', 'tool', 'python', 'software'], a: 'Technical skills: R, Python, C/C++, SAS, Stata, MATLAB, SQL/MySQL, MongoDB, Git, and LaTeX. Spoken languages: English, Mandarin, Tujia, and Spanish.' },
        { k: ['award', 'honor', 'scholarship', 'prize'], a: 'Awards include the University of Pittsburgh Travel Fund (2026), the Columbia Mailman Chair\'s Award (2025, top 1%), the Columbia SCALE Travel Fund (2024), and several undergraduate scholarships.' },
        { k: ['contact', 'email', 'reach', 'hire', 'collaborate', 'get in touch', 'connect'], a: 'You can reach Jordy at zhk22@pitt.edu, jordyk@andrew.cmu.edu, or kuangzhuodiao@gmail.com. He\'s also on GitHub (github.com/zk2275) and Google Scholar.' },
        { k: ['advisor', 'ding', 'lab', 'supervisor', 'mentor'], a: 'At the University of Pittsburgh, Jordy works in Prof. Ying Ding\'s lab. He has also collaborated with Prof. Yuanjia Wang and Prof. Tian Gu at Columbia.' },
        { k: ['project', 'ppg', 'blood pressure', 'alzheimer', 'covid', 'brain tumor', 'fastcommute'], a: 'Projects span blood-pressure estimation from PPG signals (deep learning, CMU), fastCOMMUTE for multi-source risk prediction, an Alzheimer\'s disease meta-analysis, 24-hour rest-activity vs. cognition in older adults, brain-tumor detection (MIT), and COVID-19 policy/market analysis.' }
    ];

    function faqAnswer(q) {
        var s = (' ' + q.toLowerCase() + ' '), best = null, bestScore = 0;
        for (var i = 0; i < FAQ.length; i++) {
            var score = 0;
            for (var j = 0; j < FAQ[i].k.length; j++) if (s.indexOf(FAQ[i].k[j]) !== -1) score++;
            if (score > bestScore) { bestScore = score; best = FAQ[i]; }
        }
        if (best) return best.a;
        return 'I can tell you about Jordy\'s research, education, publications, skills, awards, or how to contact him — what would you like to know?';
    }

    /* ---------------------------------------------------- portrait geometry */
    var IMG = 'assets/img/ZhuodiaoKuang_Home.png', IMGSIZE = 817;
    var SRC = { cx: 437, cy: 138, faceH: 128 };
    function buildFace(D) {
        var k = D * 0.80 / SRC.faceH;
        var face = document.createElement('div'); face.className = 'dbh-face';
        face.style.width = face.style.height = D + 'px';
        var im = document.createElement('img'); im.src = IMG; im.alt = '';
        im.style.width = (IMGSIZE * k) + 'px';
        im.style.left = (D / 2 - SRC.cx * k) + 'px';
        im.style.top = (D / 2 - SRC.cy * k) + 'px';
        var tint = document.createElement('div'); tint.className = 'dbh-tint';
        var led = document.createElement('div'); led.className = 'dbh-led';
        face.appendChild(im); face.appendChild(tint); face.appendChild(led);
        return face;
    }

    function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

    /* -------------------------------------------------------------- WebLLM */
    var MODEL = 'Llama-3.2-1B-Instruct-q4f16_1-MLC';
    var MODEL_ALT = ['Llama-3.2-1B-Instruct-q4f32_1-MLC', 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC'];
    var engine = null, engineLoading = false;

    function webgpuOK() { return typeof navigator !== 'undefined' && !!navigator.gpu; }

    async function loadEngine(onProgress) {
        if (engine || engineLoading) return engine;
        engineLoading = true;
        var webllm = await import('https://esm.run/@mlc-ai/web-llm');
        var ids = [MODEL].concat(MODEL_ALT), lastErr = null;
        for (var i = 0; i < ids.length; i++) {
            try {
                engine = await webllm.CreateMLCEngine(ids[i], { initProgressCallback: onProgress });
                engineLoading = false;
                return engine;
            } catch (e) { lastErr = e; }
        }
        engineLoading = false;
        throw lastErr || new Error('model load failed');
    }

    /* --------------------------------------------------------------- speech */
    function speak(text, enabled, led) {
        if (!enabled || !('speechSynthesis' in window)) return;
        try {
            window.speechSynthesis.cancel();
            var u = new SpeechSynthesisUtterance(text.replace(/\s+/g, ' ').slice(0, 400));
            u.rate = 0.98; u.pitch = 0.9;
            if (led) { u.onstart = function () { led.classList.add('dbh-speaking'); }; u.onend = u.onerror = function () { led.classList.remove('dbh-speaking'); }; }
            window.speechSynthesis.speak(u);
        } catch (e) {}
    }

    /* ----------------------------------------------------------------- init */
    function init() {
        if (document.getElementById('dbh-widget')) return;

        var widget = el('div'); widget.id = 'dbh-widget';

        // launcher
        var launcher = el('button', 'dbh-launcher'); launcher.type = 'button';
        launcher.setAttribute('aria-label', 'Ask about Jordy');
        launcher.appendChild(buildFace(58));
        launcher.appendChild(el('span', 'dbh-badge', 'Ask&nbsp;me'));

        // panel
        var panel = el('div', 'dbh-panel');

        var head = el('div', 'dbh-head');
        head.appendChild(buildFace(40));
        var htxt = el('div', 'dbh-head-txt');
        htxt.appendChild(el('div', 'dbh-name', 'Ask about Jordy'));
        var sub = el('div', 'dbh-sub', 'FAQ mode');
        htxt.appendChild(sub);
        head.appendChild(htxt);
        var sndBtn = el('button', 'dbh-head-btn'); sndBtn.type = 'button'; sndBtn.title = 'Toggle voice'; sndBtn.innerHTML = '&#128263;';
        var closeBtn = el('button', 'dbh-head-btn', '&times;'); closeBtn.type = 'button'; closeBtn.title = 'Close';
        head.appendChild(sndBtn); head.appendChild(closeBtn);

        var msgs = el('div', 'dbh-msgs');
        var headLed = head.querySelector('.dbh-led');

        var chips = el('div', 'dbh-chips');
        ['What is his research?', 'Where did he study?', 'How can I contact him?'].forEach(function (q) {
            var c = el('button', 'dbh-chip', q); c.type = 'button';
            c.addEventListener('click', function () { ask(q); });
            chips.appendChild(c);
        });

        // load-model area
        var load = el('div', 'dbh-load');
        var loadBtn = el('button', 'dbh-load-btn'); loadBtn.type = 'button';
        var bar = el('div', 'dbh-bar'); var barFill = el('i'); bar.appendChild(barFill);
        var note = el('div', 'dbh-load-note');
        load.appendChild(loadBtn); load.appendChild(bar); load.appendChild(note);
        if (webgpuOK()) {
            loadBtn.textContent = '⚡ Load full AI (runs in your browser)';
            note.innerHTML = 'Free & private: downloads a small model (~0.9&nbsp;GB, once) and runs on your device. Until then, I answer from a built-in FAQ.';
        } else {
            load.style.display = 'none';
        }

        var inputRow = el('div', 'dbh-input');
        var ta = el('textarea'); ta.rows = 1; ta.placeholder = 'Ask me anything about Jordy…';
        var send = el('button', 'dbh-send', '&#10148;'); send.type = 'button';
        inputRow.appendChild(ta); inputRow.appendChild(send);

        var foot = el('div', 'dbh-foot', 'Runs free in your browser • not affiliated with Detroit');

        panel.appendChild(head);
        panel.appendChild(msgs);
        panel.appendChild(chips);
        panel.appendChild(load);
        panel.appendChild(inputRow);
        panel.appendChild(foot);

        widget.appendChild(launcher);
        widget.appendChild(panel);
        document.body.appendChild(widget);

        /* ---- state & helpers ---- */
        var history = [];      // {role, content} for the model
        var voiceOn = false;
        var busy = false;

        function addMsg(role, text) {
            var m = el('div', 'dbh-msg ' + role);
            m.textContent = text;
            msgs.appendChild(m);
            msgs.scrollTop = msgs.scrollHeight;
            return m;
        }
        function open() { widget.classList.add('is-open'); if (!msgs.childElementCount) addMsg('bot', 'Hi! I\'m Jordy-Bot. Ask me anything about Jordy — his research, background, publications, or how to reach him.'); setTimeout(function () { ta.focus(); }, 60); }
        function close() { widget.classList.remove('is-open'); }

        launcher.addEventListener('click', open);
        closeBtn.addEventListener('click', close);
        sndBtn.addEventListener('click', function () {
            voiceOn = !voiceOn;
            sndBtn.innerHTML = voiceOn ? '&#128266;' : '&#128263;';
            sndBtn.classList.toggle('is-on', voiceOn);
            if (!voiceOn && 'speechSynthesis' in window) window.speechSynthesis.cancel();
        });

        function setBusy(b) {
            busy = b; send.disabled = b; ta.disabled = b;
            head.classList.toggle('dbh-thinking', b);
        }

        async function ask(q) {
            q = (q || '').trim();
            if (!q || busy) return;
            addMsg('user', q);
            ta.value = ''; autosize();
            setBusy(true);

            // typing indicator
            var typing = el('div', 'dbh-msg bot dbh-typing', '<span></span><span></span><span></span>');
            msgs.appendChild(typing); msgs.scrollTop = msgs.scrollHeight;

            if (engine) {
                try {
                    var msgList = [{ role: 'system', content: SYSTEM }]
                        .concat(history.slice(-4))
                        .concat([{ role: 'user', content: q }]);
                    var stream = await engine.chat.completions.create({ messages: msgList, temperature: 0.3, max_tokens: 320, stream: true });
                    typing.remove();
                    var bubble = addMsg('bot', ''); var text = '';
                    for await (var chunk of stream) {
                        var d = (chunk.choices && chunk.choices[0] && chunk.choices[0].delta && chunk.choices[0].delta.content) || '';
                        text += d; bubble.textContent = text; msgs.scrollTop = msgs.scrollHeight;
                    }
                    history.push({ role: 'user', content: q }, { role: 'assistant', content: text });
                    speak(text, voiceOn, headLed);
                } catch (e) {
                    typing.remove();
                    var a = faqAnswer(q); addMsg('bot', a); speak(a, voiceOn, headLed);
                }
            } else {
                setTimeout(function () {
                    typing.remove();
                    var a = faqAnswer(q);
                    addMsg('bot', a); speak(a, voiceOn, headLed);
                }, 350);
            }
            setBusy(false);
            setTimeout(function () { if (widget.classList.contains('is-open')) ta.focus(); }, 20);
        }

        // load-model button
        loadBtn.addEventListener('click', async function () {
            if (engine || engineLoading) return;
            loadBtn.disabled = true; bar.style.display = 'block';
            loadBtn.textContent = 'Loading model…';
            try {
                await loadEngine(function (p) {
                    var pct = Math.round((p && p.progress ? p.progress : 0) * 100);
                    barFill.style.width = pct + '%';
                    loadBtn.textContent = 'Loading model… ' + pct + '%';
                    if (p && p.text) note.textContent = p.text;
                });
                sub.textContent = 'AI mode • Llama-3.2';
                load.style.display = 'none';
                addMsg('sys', '✓ Full AI ready — running privately in your browser.');
            } catch (e) {
                loadBtn.disabled = false; bar.style.display = 'none';
                loadBtn.textContent = '⚡ Retry loading AI';
                note.textContent = 'Could not load the in-browser model (needs a recent Chrome/Edge and a good connection). The FAQ still works.';
            }
        });

        // input behaviour
        function autosize() { ta.style.height = '38px'; ta.style.height = Math.min(96, ta.scrollHeight) + 'px'; }
        ta.addEventListener('input', autosize);
        ta.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(ta.value); }
        });
        send.addEventListener('click', function () { ask(ta.value); });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
