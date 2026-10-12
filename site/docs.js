// Copy buttons for the code blocks on the documentation pages. Without this script the buttons stay hidden.
(function () {
    var status = document.createElement('div');
    status.setAttribute('role', 'status');
    status.className = 'visually-hidden';
    document.body.appendChild(status);

    function announce(text) {
        // Clearing first makes a repeat of the same message be read again.
        status.textContent = '';
        window.setTimeout(function () {
            status.textContent = text;
        }, 50);
    }

    function copy(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
        return Promise.reject(new Error('Clipboard unavailable'));
    }

    document.querySelectorAll('.code').forEach(function (block) {
        var button = block.querySelector('.copy');
        var pre = block.querySelector('pre');
        if (!button || !pre) return;
        button.hidden = false;
        var timer = 0;

        button.addEventListener('click', function () {
            var done = function (label, message) {
                button.textContent = label;
                announce(message);
                window.clearTimeout(timer);
                timer = window.setTimeout(function () {
                    button.textContent = 'Copy';
                }, 2000);
            };
            copy(pre.textContent).then(
                function () {
                    done('Copied', 'Code copied to the clipboard');
                },
                function () {
                    done('Copy failed', 'Copying failed. Select the code and copy it by hand.');
                },
            );
        });
    });
})();
