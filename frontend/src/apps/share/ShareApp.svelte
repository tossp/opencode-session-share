<script lang="ts">
  import { onMount } from 'svelte';
  import { loadShareState } from '../../shared/api/share';
  import { RawJsonDrawer } from './components';
  import ReaderShell from './ReaderShell.svelte';
  import { resolveShareID, shareViewStateFromLoadState, type ShareAppViewState } from './layout';

  const shareID = resolveShareID();
  const debugEnabled = new URLSearchParams(window.location.search).get('debug') === '1';

  let password = $state('');
  let debugOpen = $state(false);
  let appState = $state<ShareAppViewState>({ status: 'loading', title: '正在加载分享', message: '正在从服务器读取会话数据…' });

  const pageTitle = $derived(appState.status === 'ready' ? appState.view.meta.title : appState.title);

  onMount(() => {
    void loadData();
  });

  async function loadData(nextPassword?: string): Promise<void> {
    if (!shareID) {
      appState = { status: 'error', title: '分享不存在', message: '当前链接缺少分享 ID，请检查地址是否完整。' };
      return;
    }

    appState = { status: 'loading', title: '正在加载分享', message: '正在从服务器读取会话数据…' };
    appState = shareViewStateFromLoadState(await loadShareState(shareID, { password: nextPassword }));
  }

  function submitPassword(event: SubmitEvent): void {
    event.preventDefault();
    void loadData(password);
  }

  function openDebugDrawer(): void {
    debugOpen = true;
  }
</script>

<svelte:head>
  <title>{pageTitle}</title>
</svelte:head>

{#if appState.status === 'ready'}
  <ReaderShell view={appState.view} {shareID} {debugEnabled} onOpenDebug={openDebugDrawer} />

  {#if debugEnabled}
    <RawJsonDrawer bind:open={debugOpen} title="调试数据" value={appState.view.normalized} />
  {/if}
{:else if appState.status === 'password'}
  <main class="state-shell">
    <section class="state-card" aria-labelledby="password-title">
      <p class="eyebrow">Protected Share</p>
      <h1 id="password-title">需要访问密码</h1>
      <p>该分享已受保护，请输入密码后继续查看。</p>
      <form class="password-form" onsubmit={submitPassword}>
        <label for="share-password">访问密码</label>
        <input id="share-password" bind:value={password} type="password" autocomplete="current-password" />
        <button type="submit">查看分享</button>
      </form>
      {#if appState.isRetry}
        <p class="state-card__error">密码错误，请重试</p>
      {/if}
    </section>
  </main>
{:else}
  <main class="state-shell">
    <section class="state-card" aria-live="polite">
      <p class="eyebrow">OpenCode Session Share</p>
      <h1>{appState.title}</h1>
      <p>{appState.message}</p>
      {#if appState.status === 'empty'}
        <span class="state-card__hint">暂无消息</span>
      {:else if appState.status === 'error'}
        <span class="state-card__hint">请稍后重试或确认分享链接。</span>
      {/if}
    </section>
  </main>
{/if}

<style>
  @import '../../shared/styles/tokens.css';

  :global(html) {
    scroll-behavior: smooth;
  }

  :global(body) {
    margin: 0;
    background:
      radial-gradient(circle at 8% 0%, rgba(14, 165, 233, 0.1), transparent 30rem),
      linear-gradient(135deg, #f8fafc 0%, #f1f5f9 48%, #f8fafc 100%);
    color: #172033;
    font-family: Avenir Next, Trebuchet MS, Verdana, sans-serif;
  }

  .password-form button {
    border: 0;
    border-radius: 999px;
    background: #0f172a;
    color: #ecfeff;
    cursor: pointer;
    font-weight: 900;
    letter-spacing: 0.04em;
  }

  .eyebrow {
    margin: 0 0 10px;
    color: #0f766e;
    font-size: 0.72rem;
    font-weight: 900;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  .state-shell {
    display: grid;
    min-height: 100vh;
    place-items: center;
    padding: 24px;
  }

  .state-card {
    display: grid;
    gap: 16px;
    width: min(100%, 520px);
    padding: clamp(28px, 6vw, 52px);
    border: 1px solid rgba(100, 116, 139, 0.2);
    border-radius: 32px;
    background: rgba(255, 255, 255, 0.82);
    box-shadow: 0 28px 80px rgba(15, 23, 42, 0.12);
    backdrop-filter: blur(18px);
  }

  .state-card h1,
  .state-card p {
    margin: 0;
  }

  .state-card h1 {
    color: #0f172a;
    font-size: clamp(2.2rem, 8vw, 4.8rem);
    line-height: 0.95;
    letter-spacing: -0.08em;
  }

  .state-card p,
  .password-form label {
    color: #475569;
    line-height: 1.7;
  }

  .password-form {
    display: grid;
    gap: 12px;
  }

  .password-form input {
    box-sizing: border-box;
    width: 100%;
    padding: 14px 16px;
    border: 1px solid rgba(100, 116, 139, 0.3);
    border-radius: 18px;
    background: #f8fafc;
    color: #0f172a;
    font: inherit;
  }

  .password-form button {
    padding: 14px 18px;
  }

  .state-card__error {
    color: #b91c1c;
    font-weight: 800;
  }

  .state-card__hint {
    color: #0f766e;
    font-weight: 900;
  }

</style>
