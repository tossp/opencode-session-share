const statusEl = document.getElementById('status');
const sharesEl = document.getElementById('shares');

function escapeHTML(value) {
  const div = document.createElement('div');
  div.textContent = value == null ? '' : String(value);
  return div.innerHTML;
}

async function loadShares() {
  const response = await fetch('/api/admin/shares');
  if (!response.ok) {
    throw new Error('加载会话列表失败');
  }

  const shares = await response.json();
  sharesEl.innerHTML = shares.map(share => {
    const passwordText = share.hasPassword ? (share.usesDefaultPassword ? '默认密码' : '自定义密码') : '公开';
    const clientIP = share.clientIP ? '<br><span class="muted">IP: ' + escapeHTML(share.clientIP) + '</span>' : '';
    return '<tr>' +
      '<td><strong>' + escapeHTML(share.id) + '</strong><br><span class="muted">' + escapeHTML(share.sessionID) + '</span>' + clientIP + '</td>' +
      '<td>' + share.items + '</td>' +
      '<td>' + escapeHTML(passwordText) + '</td>' +
      '<td>' + escapeHTML(new Date(share.updatedAt).toLocaleString()) + '</td>' +
      '<td><div class="row-actions"><input type="password" placeholder="输入新密码" data-id="' + escapeHTML(share.id) + '">' +
      '<button data-set="' + escapeHTML(share.id) + '">保存</button>' +
      '<button data-clear="' + escapeHTML(share.id) + '">清空</button>' +
      '<a class="button" href="/share/' + encodeURIComponent(share.id) + '" target="_blank">打开</a></div></td>' +
      '</tr>';
  }).join('');
  statusEl.textContent = '共 ' + shares.length + ' 个会话';
}

async function setPassword(id, password) {
  const response = await fetch('/api/admin/share/' + encodeURIComponent(id) + '/password', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  });
  if (!response.ok) {
    throw new Error('设置密码失败');
  }
  await loadShares();
}

document.addEventListener('click', event => {
  const setID = event.target.getAttribute('data-set');
  const clearID = event.target.getAttribute('data-clear');

  if (setID) {
    const input = document.querySelector('input[data-id="' + CSS.escape(setID) + '"]');
    setPassword(setID, input ? input.value : '').catch(error => {
      statusEl.textContent = error.message;
    });
  }

  if (clearID) {
    setPassword(clearID, '').catch(error => {
      statusEl.textContent = error.message;
    });
  }
});

loadShares().catch(error => {
  statusEl.textContent = error.message;
});
