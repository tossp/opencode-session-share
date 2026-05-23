<script lang="ts">
  import { onMount } from 'svelte';

  type AdminShare = {
    id: string;
    sessionID: string;
    clientIP?: string;
    items: number;
    hasPassword: boolean;
    usesDefaultPassword: boolean;
    updatedAt: string;
  };

  let shares = $state<AdminShare[]>([]);
  let passwords = $state<Record<string, string>>({});
  let status = $state('正在加载...');
  let busyID = $state('');

  onMount(() => {
    loadShares().catch((error: Error) => {
      status = error.message;
    });
  });

  async function loadShares(): Promise<void> {
    const response = await fetch('/api/admin/shares');
    if (!response.ok) {
      throw new Error('加载会话列表失败');
    }

    shares = (await response.json()) as AdminShare[];
    status = `共 ${shares.length} 个会话`;
  }

  function passwordText(share: AdminShare): string {
    if (!share.hasPassword) {
      return '公开';
    }
    return share.usesDefaultPassword ? '默认密码' : '自定义密码';
  }

  function formattedTime(value: string): string {
    return new Date(value).toLocaleString();
  }

  async function setPassword(id: string, password: string): Promise<void> {
    busyID = id;
    try {
      const response = await fetch(`/api/admin/share/${encodeURIComponent(id)}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      if (!response.ok) {
        throw new Error('设置密码失败');
      }
      await loadShares();
      passwords = { ...passwords, [id]: '' };
    } finally {
      busyID = '';
    }
  }

  function savePassword(id: string): void {
    setPassword(id, passwords[id] ?? '').catch((error: Error) => {
      status = error.message;
    });
  }

  function clearPassword(id: string): void {
    setPassword(id, '').catch((error: Error) => {
      status = error.message;
    });
  }
</script>

<svelte:head>
  <title>opencode-share 管理页</title>
</svelte:head>

<main class="admin-shell">
  <section class="hero" aria-labelledby="admin-title">
    <div>
      <p class="eyebrow">OpenCode Session Share</p>
      <h1 id="admin-title">opencode-share 管理页</h1>
      <p class="muted">将密码留空表示使用默认密码；如果未配置默认密码，则该会话为公开访问。</p>
    </div>
    <div id="status" class="status" aria-live="polite">{status}</div>
  </section>

  <section class="table-card" aria-label="会话列表">
    <table>
      <thead>
        <tr>
          <th>会话</th>
          <th>条目数</th>
          <th>访问密码</th>
          <th>更新时间</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        {#each shares as share (share.id)}
          <tr>
            <td>
              <strong>{share.id}</strong>
              <span class="muted">{share.sessionID}</span>
              {#if share.clientIP}
                <span class="muted">IP: {share.clientIP}</span>
              {/if}
            </td>
            <td>{share.items}</td>
            <td>{passwordText(share)}</td>
            <td>{formattedTime(share.updatedAt)}</td>
            <td>
              <div class="row-actions">
                <label class="sr-only" for={`password-${share.id}`}>输入新密码</label>
                <input id={`password-${share.id}`} bind:value={passwords[share.id]} type="password" placeholder="输入新密码" autocomplete="new-password" />
                <button type="button" disabled={busyID === share.id} onclick={() => savePassword(share.id)}>保存</button>
                <button type="button" disabled={busyID === share.id} onclick={() => clearPassword(share.id)}>清空</button>
                <a class="button" href={`/share/${encodeURIComponent(share.id)}`} target="_blank" rel="noreferrer">打开</a>
              </div>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </section>
</main>

<style>
  @import '../../shared/styles/tokens.css';

  :global(body) {
    margin: 0;
    background:
      radial-gradient(circle at 12% 0%, rgba(56, 189, 248, 0.16), transparent 30rem),
      linear-gradient(135deg, #020617 0%, #0f172a 52%, #111827 100%);
    color: var(--oc-color-text-inverse);
    font-family: Avenir Next, Trebuchet MS, Verdana, sans-serif;
  }

  .admin-shell {
    width: min(1100px, calc(100% - 40px));
    margin: 0 auto;
    padding: 32px 0;
  }

  .hero {
    display: flex;
    gap: 20px;
    align-items: end;
    justify-content: space-between;
    margin-bottom: 22px;
  }

  h1,
  p {
    margin: 0;
  }

  h1 {
    margin: 6px 0 10px;
    font-size: clamp(1.8rem, 4vw, 3rem);
    letter-spacing: -0.05em;
  }

  .eyebrow {
    color: #38bdf8;
    font-size: 0.72rem;
    font-weight: 900;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  .muted {
    display: block;
    color: #94a3b8;
  }

  .status {
    flex: 0 0 auto;
    padding: 10px 14px;
    border: 1px solid rgba(148, 163, 184, 0.25);
    border-radius: 999px;
    background: rgba(15, 23, 42, 0.76);
    color: #bae6fd;
    font-weight: 800;
  }

  .table-card {
    overflow-x: auto;
    border: 1px solid rgba(148, 163, 184, 0.26);
    border-radius: 18px;
    background: rgba(17, 24, 39, 0.9);
    box-shadow: 0 24px 70px rgba(0, 0, 0, 0.28);
  }

  table {
    width: 100%;
    min-width: 920px;
    border-collapse: collapse;
  }

  th,
  td {
    padding: 12px;
    border-bottom: 1px solid rgba(148, 163, 184, 0.22);
    text-align: left;
    vertical-align: top;
  }

  th {
    color: #cbd5e1;
    font-size: 0.78rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  tr:last-child td {
    border-bottom: 0;
  }

  strong {
    display: block;
    color: #f8fafc;
  }

  .row-actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  input {
    width: 220px;
    padding: 8px 10px;
    border: 1px solid #475569;
    border-radius: 10px;
    background: #020617;
    color: #e2e8f0;
  }

  button,
  .button {
    display: inline-block;
    padding: 8px 11px;
    border: 0;
    border-radius: 10px;
    background: #38bdf8;
    color: #082f49;
    cursor: pointer;
    font-weight: 900;
    text-decoration: none;
  }

  button:disabled {
    cursor: wait;
    opacity: 0.62;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  @media (max-width: 720px) {
    .hero {
      display: grid;
      align-items: start;
    }
  }
</style>
