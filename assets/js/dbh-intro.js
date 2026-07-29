/* Detroit: Become Human -- style talking "android" intro.
 * Zooms the childhood hero photo into an android portrait, flaps the mouth
 * with a two-layer jaw animation on the real photo pixels, and speaks a
 * welcome line via the Web Speech API (browsers require one user gesture
 * before audio can play, hence the ACTIVATE prompt / first-interaction boot).
 *
 * Exposes window.DBH.mount(target, opts) so the effect can be calibrated in
 * isolation, and auto-mounts into the site header on DOMContentLoaded.
 */
(function () {
    'use strict';

    var IMG = 'assets/img/ZhuodiaoKuang_Home.png';
    var IMGSIZE = 817;

    // Face landmarks measured on the 817x817 source (pixels).
    var SRC = {
        cx: 437,       // face centre x
        cy: 138,       // face centre y (between eyes and chin)
        faceH: 128,    // face height to fit inside the circle
        splitY: 153,   // jaw split line (just above the lips)
        mouthCX: 440,  // mouth centre x
        mouthW: 40     // mouth width
    };

    var LINES = [
        'Hello. I am Jordy — biostatistics android, model J K, twenty oh one.',
        'Welcome to my homepage.',
        'Please, make yourself at home.'
    ];

    function el(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }

    // Build one android-portrait avatar and wire its animation controller.
    function mount(target, opts) {
        opts = opts || {};
        var D = opts.diameter || 132;
        var JAWMAX = opts.jawMax || 7;        // max jaw drop, screen px
        var k = D * 0.80 / SRC.faceH;         // scale so the face fills ~80% of the circle
        var imgW = IMGSIZE * k;
        var L = D / 2 - SRC.cx * k;
        var T = D / 2 - SRC.cy * k;
        var splitScreenY = SRC.splitY * k + T;
        var mouthScreenX = SRC.mouthCX * k + L;
        var mouthWpx = SRC.mouthW * k;

        var face = el('div', 'dbh-face');
        face.style.width = D + 'px';
        face.style.height = D + 'px';

        function makeImg() {
            var im = el('img');
            im.src = IMG;
            im.alt = '';
            im.style.width = imgW + 'px';
            im.style.left = L + 'px';
            im.style.top = T + 'px';
            return im;
        }

        var base = makeImg();

        var mouth = el('div', 'dbh-mouth');
        var mh = Math.max(6, JAWMAX + 3);
        mouth.style.width = mouthWpx + 'px';
        mouth.style.height = mh + 'px';
        mouth.style.left = (mouthScreenX - mouthWpx / 2) + 'px';
        mouth.style.top = (splitScreenY - 2) + 'px';

        var jaw = el('div', 'dbh-jaw');
        // show only the lower face (from the split line down)
        jaw.style.clipPath = jaw.style.webkitClipPath = 'inset(' + splitScreenY + 'px 0 0 0)';
        jaw.appendChild(makeImg());

        var tint = el('div', 'dbh-tint');
        var scan = el('div', 'dbh-scan');

        face.appendChild(base);
        face.appendChild(mouth);
        face.appendChild(jaw);
        face.appendChild(tint);
        face.appendChild(scan);
        target.appendChild(face);

        // --- mouth animation loop ---
        var speaking = false, level = 0, raf = null;
        function frame() {
            var t = performance.now();
            var target2 = speaking
                ? (0.30 + 0.70 * Math.abs(Math.sin(t / 68)) * (0.6 + 0.4 * Math.random()))
                : 0;
            level += (target2 - level) * 0.45;
            if (level < 0.001 && !speaking) { level = 0; jaw.style.transform = 'translateY(0)'; mouth.style.opacity = 0; raf = null; return; }
            jaw.style.transform = 'translateY(' + (level * JAWMAX).toFixed(2) + 'px)';
            mouth.style.opacity = Math.min(1, level * 1.7);
            raf = requestAnimationFrame(frame);
        }
        return {
            face: face,
            setJaw: function (v) { jaw.style.transform = 'translateY(' + (v * JAWMAX) + 'px)'; mouth.style.opacity = Math.min(1, v * 1.7); },
            start: function () { if (!speaking) { speaking = true; if (!raf) raf = requestAnimationFrame(frame); } },
            stop: function () { speaking = false; if (!raf) raf = requestAnimationFrame(frame); }
        };
    }

    // --- voice selection ---
    function pickVoice() {
        var vs = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
        if (!vs.length) return null;
        var pref = ['Google US English', 'Samantha', 'Microsoft Aria', 'Microsoft Zira', 'Daniel', 'Alex'];
        for (var i = 0; i < pref.length; i++) {
            for (var j = 0; j < vs.length; j++) if (vs[j].name === pref[i]) return vs[j];
        }
        for (var m = 0; m < vs.length; m++) if (/^en(-|_)/i.test(vs[m].lang)) return vs[m];
        return vs[0];
    }

    function initHomepage() {
        var header = document.querySelector('header.intro-img');
        if (!header || document.getElementById('dbh-assistant')) return;
        if (getComputedStyle(header).position === 'static') header.style.position = 'relative';

        var root = el('div', 'dbh-assistant is-idle');
        root.id = 'dbh-assistant';
        root.setAttribute('aria-live', 'polite');

        var portrait = el('div', 'dbh-portrait');
        var led = el('div', 'dbh-led');
        portrait.appendChild(led);

        var model = el('div', 'dbh-model'); model.textContent = 'CyberLife • Model JK-2001';
        var caption = el('div', 'dbh-caption');
        var capText = el('span', 'dbh-caption-text');
        var cursor = el('span', 'dbh-cursor'); cursor.textContent = '▌';
        caption.appendChild(capText); caption.appendChild(cursor);

        var btn = el('button', 'dbh-activate'); btn.type = 'button';
        btn.appendChild(document.createTextNode('Activate'));

        root.appendChild(portrait);
        root.appendChild(model);
        root.appendChild(caption);
        root.appendChild(btn);
        header.appendChild(root);

        var ctrl = mount(portrait, { diameter: 132, jawMax: 6 });

        function setState(s) { root.className = 'dbh-assistant is-' + s; }

        function typeInto(text, done) {
            capText.textContent = '';
            var i = 0;
            (function step() {
                if (i <= text.length) { capText.textContent = text.slice(0, i); i++; setTimeout(step, 26); }
                else if (done) done();
            })();
        }

        var booted = false;
        function boot() {
            if (booted) return; booted = true;
            setState('processing');
            capText.textContent = '';
            btn.textContent = 'Booting…';

            var canSpeak = 'speechSynthesis' in window;
            var voice = canSpeak ? pickVoice() : null;

            setTimeout(function () { runLine(0); }, 900);

            function finish() {
                setState('idle');
                btn.style.display = 'inline-flex';
                btn.textContent = 'Replay';
                booted = false;
            }

            function runLine(idx) {
                if (idx >= LINES.length) { ctrl.stop(); finish(); return; }
                var line = LINES[idx];
                setState('speaking');
                ctrl.start();
                typeInto(line);

                if (canSpeak) {
                    var u = new SpeechSynthesisUtterance(line);
                    if (voice) u.voice = voice;
                    u.rate = 0.94; u.pitch = 0.85; u.volume = 1;
                    u.onend = function () { setTimeout(function () { runLine(idx + 1); }, 260); };
                    u.onerror = function () { setTimeout(function () { runLine(idx + 1); }, 260); };
                    try { window.speechSynthesis.speak(u); }
                    catch (e) { timedLine(line, idx); }
                } else {
                    timedLine(line, idx);
                }
            }
            // fallback timing when speech synthesis is unavailable
            function timedLine(line, idx) {
                setTimeout(function () { runLine(idx + 1); }, 900 + line.length * 55);
            }
        }

        // Boot only on a deliberate click (of the button or the portrait) so the
        // voice never surprises someone who is merely scrolling past the hero.
        btn.addEventListener('click', boot);
        portrait.addEventListener('click', boot);
        portrait.style.cursor = 'pointer';
        portrait.title = 'Activate';

        // Some browsers load voices asynchronously.
        if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = function () {};
    }

    window.DBH = { mount: mount, SRC: SRC };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initHomepage);
    else initHomepage();
})();
