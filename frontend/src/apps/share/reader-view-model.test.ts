import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { realShareFixture } from '../../shared/domain/fixtures/realShareFixture';
import { convertOpenCodeShare } from '../../shared/domain/opencode';
import { buildOpenCodeReaderPlan } from '../../shared/domain/opencode-reader';
import type { OpenCodeDocument } from '../../shared/domain/opencode-types';
import type { OpenCodeReaderPlan } from '../../shared/domain/opencode-reader-types';
import type { RawShareItem } from '../../shared/domain/types';
import { createReaderViewModel } from './reader-view-model';

function buildViewModel(items: readonly RawShareItem[]) {
  const document = convertOpenCodeShare(items);
  const reader = buildOpenCodeReaderPlan(document);
  return { document, reader, viewModel: createReaderViewModel(document, reader) };
}

describe('createReaderViewModel', () => {
  it('groups reader narrative into sections and derives nav without legacy demo turns', () => {
    const { viewModel } = buildViewModel([
      { type: 'session', data: { id: 'ses_sections' } },
      { type: 'message', data: { id: 'msg_user_1', sessionID: 'ses_sections', role: 'user', content: 'First request' } },
      { type: 'message', data: { id: 'msg_assistant_1', sessionID: 'ses_sections', role: 'assistant', parentID: 'msg_user_1' } },
      { type: 'part', data: { id: 'text_1', sessionID: 'ses_sections', messageID: 'msg_assistant_1', type: 'text', text: 'First answer' } },
      { type: 'message', data: { id: 'msg_assistant_2', sessionID: 'ses_sections', role: 'assistant', parentID: 'msg_user_1' } },
      { type: 'part', data: { id: 'text_2', sessionID: 'ses_sections', messageID: 'msg_assistant_2', type: 'text', text: 'Follow-up answer' } },
      { type: 'message', data: { id: 'msg_user_2', sessionID: 'ses_sections', role: 'user', content: 'Second request' } },
    ]);

    expect(viewModel.sections).toHaveLength(2);
    expect(viewModel.sections.map((section) => section.id)).toEqual(['turn-msg-user-1', 'turn-msg-user-2']);
    expect(viewModel.sections[0].items.map((item) => item.id)).toEqual(['msg_user_1', 'msg_assistant_1', 'msg_assistant_2']);
    expect(viewModel.sections[0].assistants.map((item) => item.id)).toEqual(['msg_assistant_1', 'msg_assistant_2']);
    expect(viewModel.navSections).toEqual([
      { id: 'turn-msg-user-1', label: '1. First request', meta: '用户 → 助手 × 2', tone: 'real_user_input' },
      { id: 'turn-msg-user-2', label: '2. Second request', meta: '用户', tone: 'real_user_input' },
    ]);
    expect(viewModel).not.toHaveProperty('turns');
  });

  it('keeps assistant-before-user narrative visible in an assistant-only section', () => {
    const { viewModel } = buildViewModel([
      { type: 'session', data: { id: 'ses_assistant_only' } },
      { type: 'message', data: { id: 'msg_orphan_assistant', sessionID: 'ses_assistant_only', role: 'assistant' } },
      { type: 'part', data: { id: 'text_orphan', sessionID: 'ses_assistant_only', messageID: 'msg_orphan_assistant', type: 'text', text: 'Orphan assistant answer' } },
      { type: 'message', data: { id: 'msg_user', sessionID: 'ses_assistant_only', role: 'user', content: 'Now a user asks' } },
    ]);

    expect(viewModel.sections).toHaveLength(2);
    expect(viewModel.sections[0].id).toBe('turn-msg-orphan-assistant');
    expect(viewModel.sections[0].user).toBeUndefined();
    expect(viewModel.sections[0].assistants.map((item) => item.id)).toEqual(['msg_orphan_assistant']);
    expect(viewModel.navSections[0]).toEqual({
      id: 'turn-msg-orphan-assistant',
      label: '1. Orphan assistant answer',
      meta: '助手 × 1',
      tone: 'assistant_response',
    });
  });

  it('exposes narrative render items, side/debug data, tools, file summaries, and provenance', () => {
    const { reader, viewModel } = buildViewModel(realShareFixture);

    expect(viewModel.mainNarrative).toHaveLength(reader.mainNarrative.length);
    expect(viewModel.mainNarrative[0].renderItems).toEqual(reader.mainNarrative[0].renderItems);
    expect(viewModel.mainNarrative[0].sourceIndexes).toEqual(reader.mainNarrative[0].sourceIndexes);
    expect(viewModel.toolRuns[0]).toMatchObject({ tool: 'bash', callID: 'call_fixture_summary', narrativeMessageID: 'msg_assistant_001' });
    expect(viewModel.fileSummaries.map((file) => file.file)).toContain('frontend/src/shared/domain/fixtures/realShareFixture.ts');
    expect(viewModel.meta.totalRawItems).toBe(realShareFixture.length);
    expect(viewModel.provenance.byNarrativeID.msg_user_001).toEqual(reader.provenance.byNarrativeID.msg_user_001);
    expect(viewModel.rawDebug).toEqual(reader.rawDebug);
  });

  it('keeps injected OMO reminders out of narrative while exposing them in side/debug surfaces', () => {
    const reminder = '<system-reminder>Use background_output</system-reminder><!-- OMO_INTERNAL_INITIATOR -->';
    const { reader, viewModel } = buildViewModel([
      { type: 'session', data: { id: 'ses_injected' } },
      { type: 'message', data: { id: 'msg_real', sessionID: 'ses_injected', role: 'user', content: '继续' } },
      { type: 'message', data: { id: 'msg_reply', sessionID: 'ses_injected', role: 'assistant', parentID: 'msg_real' } },
      { type: 'part', data: { id: 'part_reply', sessionID: 'ses_injected', messageID: 'msg_reply', type: 'text', text: '好的' } },
      { type: 'message', data: { id: 'msg_injected', sessionID: 'ses_injected', role: 'user' } },
      { type: 'part', data: { id: 'part_injected', sessionID: 'ses_injected', messageID: 'msg_injected', type: 'text', text: reminder } },
      { type: 'message', data: { id: 'msg_after_injection', sessionID: 'ses_injected', role: 'assistant', parentID: 'msg_injected' } },
      { type: 'part', data: { id: 'part_after', sessionID: 'ses_injected', messageID: 'msg_after_injection', type: 'text', text: 'background result' } },
    ]);

    const injectedMessage = reader.injectedMessages.find((message) => message.id === 'msg_injected');
    const injectedSideItem = viewModel.sideItems.find((item) => item.id === 'msg_injected');
    const injectedDebugItem = viewModel.debugItems.find((item) => item.id === 'injected:msg_injected');
    const assistantSideEvent = reader.sideEvents.find((event) => event.id === 'msg_after_injection');

    expect(JSON.stringify(viewModel.mainNarrative)).not.toContain('OMO_INTERNAL_INITIATOR');
    expect(JSON.stringify(viewModel.mainNarrative)).not.toContain('background result');
    expect(JSON.stringify(viewModel.sections)).not.toContain('OMO_INTERNAL_INITIATOR');
    expect(JSON.stringify(viewModel.sections)).not.toContain('background result');
    const sectionItemIDs = viewModel.sections.reduce<string[]>((ids, section) => ids.concat(section.items.map((item) => item.id)), []);

    expect(sectionItemIDs).toEqual(['msg_real', 'msg_reply']);
    expect(JSON.stringify(viewModel.sideItems)).toContain('OMO_INTERNAL_INITIATOR');
    expect(JSON.stringify(viewModel.debugItems)).toContain('OMO_INTERNAL_INITIATOR');
    expect(viewModel.sideItems.map((item) => item.kind)).toEqual(['injected_message', 'assistant_after_injection']);
    expect(injectedMessage?.detection).toMatchObject({ isInjected: true, kinds: ['system_reminder', 'omo_internal'] });
    expect(injectedMessage?.detection.markers).toContain('OMO_INTERNAL_INITIATOR');
    expect(injectedMessage?.sourceIndexes.length).toBeGreaterThan(0);
    expect(injectedSideItem?.sourceIndexes).toEqual(injectedMessage?.sourceIndexes);
    expect(injectedDebugItem?.sourceIndexes).toEqual(injectedMessage?.sourceIndexes);
    expect(assistantSideEvent?.sourceIndexes.length).toBeGreaterThan(0);
    expect(viewModel.provenance.bySideEventID.msg_after_injection).toEqual(assistantSideEvent?.sourceIndexes);
  });

  it('resolves patch render data from message summary, then latest session diffs, then explicit empty state', () => {
    const { viewModel } = buildViewModel([
      { type: 'session', data: { id: 'ses_patches' } },
      { type: 'message', data: { id: 'msg_user', sessionID: 'ses_patches', role: 'user', content: 'patches' } },
      {
        type: 'message',
        data: {
          id: 'msg_assistant',
          sessionID: 'ses_patches',
          role: 'assistant',
          parentID: 'msg_user',
          summary: { diffs: [{ file: 'from-summary.ts', patch: 'summary patch' }] },
        },
      },
      { type: 'part', data: { id: 'patch_summary', sessionID: 'ses_patches', messageID: 'msg_assistant', type: 'patch', files: ['from-summary.ts'] } },
      { type: 'part', data: { id: 'patch_latest', sessionID: 'ses_patches', messageID: 'msg_assistant', type: 'patch', files: ['from-latest.ts'] } },
      { type: 'part', data: { id: 'patch_empty', sessionID: 'ses_patches', messageID: 'msg_assistant', type: 'patch', files: ['missing.ts'] } },
      { type: 'session_diff', data: [{ file: 'from-latest.ts', patch: 'latest patch' }] },
    ]);

    const patchItems = viewModel.mainNarrative.reduce<typeof viewModel.mainNarrative[number]['patchItems']>((items, item) => items.concat(item.patchItems), []);

    expect(patchItems).toEqual([
      expect.objectContaining({ partID: 'patch_summary', file: 'from-summary.ts', patch: 'summary patch', state: 'resolved', source: 'message_summary' }),
      expect.objectContaining({ partID: 'patch_latest', file: 'from-latest.ts', patch: 'latest patch', state: 'resolved', source: 'session_diff' }),
      expect.objectContaining({ partID: 'patch_empty', file: 'missing.ts', patch: '', state: 'empty', source: 'empty' }),
    ]);

    const assistant = viewModel.mainNarrative.find((item) => item.id === 'msg_assistant');
    expect(assistant?.renderItems).toEqual([
      expect.objectContaining({ type: 'single', part: expect.objectContaining({ id: 'patch_summary' }), patch: 'summary patch' }),
      expect.objectContaining({ type: 'single', part: expect.objectContaining({ id: 'patch_latest' }), patch: 'latest patch' }),
      expect.objectContaining({ type: 'single', part: expect.objectContaining({ id: 'patch_empty' }), patch: '' }),
    ]);
  });

  it('exposes unknown top-level items in debug data without affecting narrative', () => {
    const items = [
      { type: 'session', data: { id: 'ses_unknown_top' } },
      { type: 'message', data: { id: 'msg_user', sessionID: 'ses_unknown_top', role: 'user', content: 'test' } },
      { type: 'message', data: { id: 'msg_assistant', sessionID: 'ses_unknown_top', role: 'assistant', parentID: 'msg_user' } },
      { type: 'part', data: { id: 'text_1', sessionID: 'ses_unknown_top', messageID: 'msg_assistant', type: 'text', text: 'response' } },
      { type: 'unknown_item', data: { id: 'unknown_001', note: 'Future top-level item type' } },
      { type: 'another_unknown', data: { custom: 'data for future resilience' } },
    ] satisfies RawShareItem[];

    const { document, viewModel } = buildViewModel(items);

    expect(viewModel.mainNarrative.length).toBe(2);
    expect(viewModel.mainNarrative[0].id).toBe('msg_user');
    expect(viewModel.mainNarrative[1].id).toBe('msg_assistant');
    expect(document.rawLog.byKind.unknown_top_level).toHaveLength(2);
    expect(document.summary.kindCounts.unknown_top_level).toBe(2);
  });

  it('handles empty narrative state gracefully while preserving debug data', () => {
    const items = [
      { type: 'session', data: { id: 'ses_empty' } },
      { type: 'unknown_item', data: { id: 'future_type', note: 'Should not break empty state' } },
    ] satisfies RawShareItem[];

    const { viewModel } = buildViewModel(items);

    expect(viewModel.mainNarrative).toHaveLength(0);
    expect(viewModel.sections).toHaveLength(0);
    expect(viewModel.rawDebug.sideEventCount).toBe(0);
    expect(viewModel.meta.totalRawItems).toBe(2);
  });
});

describe('ReaderViewModel type boundary', () => {
  it('accepts OpenCodeDocument and OpenCodeReaderPlan explicitly', () => {
    const document: OpenCodeDocument = convertOpenCodeShare(realShareFixture);
    const reader: OpenCodeReaderPlan = buildOpenCodeReaderPlan(document);

    expect(createReaderViewModel(document, reader).mainNarrative).toHaveLength(reader.mainNarrative.length);
  });
});

describe('reader side/provenance component exports', () => {
  it('exports leaf views for injected messages, side events, and provenance', () => {
    const componentExports = readFileSync('src/apps/share/components/index.ts', 'utf8');

    expect(componentExports).toContain("export { default as InjectedMessagesPanel } from './InjectedMessagesPanel.svelte';");
    expect(componentExports).toContain("export { default as ProvenanceInspector } from './ProvenanceInspector.svelte';");
    expect(componentExports).toContain("export { default as ProvenanceView } from './ProvenanceView.svelte';");
    expect(componentExports).toContain("export { default as SideEventView } from './SideEventView.svelte';");
  });
});

describe('reader narrative component contracts', () => {
  it('exports reader-native narrative cards and section view', () => {
    const componentExports = readFileSync('src/apps/share/components/index.ts', 'utf8');

    expect(componentExports).toContain("export { default as AssistantMessageCard } from './AssistantMessageCard.svelte';");
    expect(componentExports).toContain("export { default as ReaderTurnSectionView } from './ReaderTurnSectionView.svelte';");
    expect(componentExports).toContain("export { default as UserMessageCard } from './UserMessageCard.svelte';");
  });

  it('keeps NarrativeList bounded to ReaderTurnSection input', () => {
    const narrativeList = readFileSync('src/apps/share/NarrativeList.svelte', 'utf8');

    expect(narrativeList).toContain('sections: ReaderTurnSection[];');
    expect(narrativeList).toContain('<ReaderTurnSectionView {section} {index} />');
    expect(narrativeList).not.toContain('injectedMessages');
    expect(narrativeList).not.toContain('sideItems');
    expect(narrativeList).not.toContain('ReaderSideEvent');
  });

  it('delegates assistant render items to PartRenderer without raw parts traversal', () => {
    const assistantCard = readFileSync('src/apps/share/components/AssistantMessageCard.svelte', 'utf8');

    expect(assistantCard).toContain("import PartRenderer from './PartRenderer.svelte';");
    expect(assistantCard).toContain('{#each item.renderItems as renderItem');
    expect(assistantCard).toContain("import type { ReaderNarrativeViewItem, ReaderRenderItem } from '../reader-view-model';");
    expect(assistantCard).toContain("<PartRenderer item={renderItem} patch={renderItem.type === 'single' ? renderItem.patch : undefined} />");
    expect(assistantCard).not.toContain('{#each item.parts');
  });
});

describe('Task 9 narrative list contract', () => {
  it('feeds NarrativeList with filtered reader sections and renderItems-backed assistant messages', () => {
    const reminder = '<system-reminder>Use background_output</system-reminder><!-- OMO_INTERNAL_INITIATOR -->';
    const { viewModel } = buildViewModel([
      { type: 'session', data: { id: 'ses_task_9' } },
      { type: 'message', data: { id: 'msg_task_9_user', sessionID: 'ses_task_9', role: 'user', content: '请实现阅读卡片' } },
      { type: 'message', data: { id: 'msg_task_9_assistant', sessionID: 'ses_task_9', role: 'assistant', parentID: 'msg_task_9_user' } },
      { type: 'part', data: { id: 'part_task_9_text', sessionID: 'ses_task_9', messageID: 'msg_task_9_assistant', type: 'text', text: '已通过 PartRenderer 渲染。' } },
      { type: 'message', data: { id: 'msg_task_9_injected', sessionID: 'ses_task_9', role: 'user' } },
      { type: 'part', data: { id: 'part_task_9_injected', sessionID: 'ses_task_9', messageID: 'msg_task_9_injected', type: 'text', text: reminder } },
      { type: 'message', data: { id: 'msg_task_9_after_injection', sessionID: 'ses_task_9', role: 'assistant', parentID: 'msg_task_9_injected' } },
      { type: 'part', data: { id: 'part_task_9_after', sessionID: 'ses_task_9', messageID: 'msg_task_9_after_injection', type: 'text', text: '不应进入主线' } },
    ]);

    const narrativeListInput = viewModel.sections;
    const firstAssistant = narrativeListInput[0].assistants[0];

    expect(narrativeListInput.map((section) => section.items.map((item) => item.id))).toEqual([['msg_task_9_user', 'msg_task_9_assistant']]);
    expect(JSON.stringify(narrativeListInput)).not.toContain('msg_task_9_injected');
    expect(JSON.stringify(narrativeListInput)).not.toContain('msg_task_9_after_injection');
    expect(firstAssistant.renderItems).toEqual([
      expect.objectContaining({
        type: 'single',
        part: expect.objectContaining({ id: 'part_task_9_text', type: 'text', text: '已通过 PartRenderer 渲染。' }),
      }),
    ]);
  });

  it('exports Task 9 message cards and keeps NarrativeList reader-native', () => {
    const componentExports = readFileSync('src/apps/share/components/index.ts', 'utf8');
    const narrativeList = readFileSync('src/apps/share/NarrativeList.svelte', 'utf8');
    const assistantCard = readFileSync('src/apps/share/components/AssistantMessageCard.svelte', 'utf8');

    expect(componentExports).toContain("export { default as AssistantMessageCard } from './AssistantMessageCard.svelte';");
    expect(componentExports).toContain("export { default as UserMessageCard } from './UserMessageCard.svelte';");
    expect(narrativeList).toContain('sections: ReaderTurnSection[];');
    expect(narrativeList).toContain('<ReaderTurnSectionView {section} {index} />');
    expect(assistantCard).toContain('{#each item.renderItems as renderItem');
    expect(assistantCard).toContain('<PartRenderer item={renderItem} patch={renderItem.type === \'single\' ? renderItem.patch : undefined} />');
  });
});

describe('Task 10 reader side panel contract', () => {
  it('derives reader semantic counts for sidebar fixtures with injected, side, tool, file, and raw data', () => {
    const reminder = '<system-reminder>Use background_output</system-reminder><!-- OMO_INTERNAL_INITIATOR -->';
    const { viewModel } = buildViewModel([
      { type: 'session', data: { id: 'ses_task_10', title: 'Reader sidebar task' } },
      { type: 'message', data: { id: 'msg_task_10_user', sessionID: 'ses_task_10', role: 'user', content: '请生成侧栏' } },
      { type: 'message', data: { id: 'msg_task_10_assistant', sessionID: 'ses_task_10', role: 'assistant', parentID: 'msg_task_10_user' } },
      { type: 'part', data: { id: 'part_task_10_text', sessionID: 'ses_task_10', messageID: 'msg_task_10_assistant', type: 'text', text: '侧栏完成。' } },
      {
        type: 'part',
        data: {
          id: 'part_task_10_tool',
          sessionID: 'ses_task_10',
          messageID: 'msg_task_10_assistant',
          type: 'tool',
          tool: 'bash',
          callID: 'call_task_10',
          state: { status: 'completed', output: 'ok' },
        },
      },
      { type: 'message', data: { id: 'msg_task_10_injected', sessionID: 'ses_task_10', role: 'user' } },
      { type: 'part', data: { id: 'part_task_10_injected', sessionID: 'ses_task_10', messageID: 'msg_task_10_injected', type: 'text', text: reminder } },
      { type: 'message', data: { id: 'msg_task_10_after_injection', sessionID: 'ses_task_10', role: 'assistant', parentID: 'msg_task_10_injected' } },
      { type: 'part', data: { id: 'part_task_10_after', sessionID: 'ses_task_10', messageID: 'msg_task_10_after_injection', type: 'text', text: 'side-only follow-up' } },
      { type: 'session_diff', data: [{ file: 'frontend/src/apps/share/ReaderSidePanel.svelte', patch: '@@ change', status: 'modified', additions: 12, deletions: 1 }] },
      { type: 'unknown_sidebar_item', data: { id: 'future_sidebar_debug' } },
    ]);

    const injectedCount = viewModel.sideItems.filter((item) => item.kind === 'injected_message').length;
    const sideEventCount = viewModel.sideItems.filter((item) => item.kind !== 'injected_message').length;

    expect(viewModel.meta.narrativeCount).toBe(2);
    expect(viewModel.meta.sectionCount).toBe(1);
    expect(viewModel.rawDebug.injectedUserMessageCount).toBe(injectedCount);
    expect(viewModel.rawDebug.sideEventCount).toBe(injectedCount + sideEventCount);
    expect(sideEventCount).toBe(1);
    expect(viewModel.toolRuns.map((tool) => tool.callID)).toEqual(['call_task_10']);
    expect(viewModel.fileSummaries.map((file) => file.file)).toEqual(['frontend/src/apps/share/ReaderSidePanel.svelte']);
    expect(viewModel.rawDebug.totalRawItems).toBe(11);
    expect(viewModel.mainNarrative.map((item) => item.id)).toEqual(['msg_task_10_user', 'msg_task_10_assistant']);
    expect(viewModel.sideItems.map((item) => item.id)).toEqual(['msg_task_10_injected', 'msg_task_10_after_injection']);
  });

  it('renders sidebar counts from ReaderViewModel fields without default raw JSON expansion', () => {
    const sidePanel = readFileSync('src/apps/share/ReaderSidePanel.svelte', 'utf8');

    expect(sidePanel).toContain("{ label: '主叙事', value: countLabel(reader.meta.narrativeCount, reader.mainNarrative.length) }");
    expect(sidePanel).toContain("{ label: '章节', value: countLabel(reader.meta.sectionCount, reader.sections.length) }");
    expect(sidePanel).toContain("reader.rawDebug.injectedUserMessageCount");
    expect(sidePanel).toContain("reader.rawDebug.sideEventCount");
    expect(sidePanel).toContain("reader.sideItems.length > 0 ? sideEvents.length : (reader.rawDebug.sideEventCount ?? 0)");
    expect(sidePanel).toContain("{ label: '工具运行', value: String(reader.toolRuns.length) }");
    expect(sidePanel).toContain("{ label: '文件', value: String(reader.fileSummaries.length) }");
    expect(sidePanel).toContain("reader.rawDebug.totalRawItems ?? reader.meta.totalRawItems");
    expect(sidePanel).toContain('<InjectedMessagesPanel messages={injectedMessages} />');
    expect(sidePanel).toContain('<SideEventView {event} />');
    expect(sidePanel).toContain('<ProvenanceInspector {reader} {rawSources} />');
    expect(sidePanel).toContain('<ProvenanceView sourceIndexes={provenanceSources} title="主叙事来源索引" compact />');
    expect(sidePanel).not.toContain('RawJsonDrawer');
    expect(sidePanel).not.toContain('open>');
  });

  it('keeps provenance inspector behind debug flag and explicit raw drawer interaction', () => {
    const shell = readFileSync('src/apps/share/ReaderShell.svelte', 'utf8');
    const shareApp = readFileSync('src/apps/share/ShareApp.svelte', 'utf8');
    const inspector = readFileSync('src/apps/share/components/ProvenanceInspector.svelte', 'utf8');

    expect(shareApp).toContain("new URLSearchParams(window.location.search).get('debug') === '1'");
    expect(shareApp).toContain('<RawJsonDrawer bind:open={debugOpen} title="调试数据" value={appState.view.normalized} />');
    expect(shell).toContain('rawSources={view.rawSources} {debugEnabled}');
    expect(inspector).toContain('resolveRawSources(debug, target.sourceIndexes)');
    expect(inspector).toContain('<RawJsonDrawer bind:open={drawerOpen} title={drawerTitle} value={drawerValue} />');
    expect(inspector).toContain('onclick={() => openRawSource(source)}');
    expect(inspector).not.toContain('open={true}');
  });

  it('preserves existing metadata facts and keeps ShareMetaSidebar compatible when only meta is passed', () => {
    const metaSidebar = readFileSync('src/apps/share/ShareMetaSidebar.svelte', 'utf8');
    const sidePanel = readFileSync('src/apps/share/ReaderSidePanel.svelte', 'utf8');

    for (const label of ['Model', 'Cost', 'Tokens', 'Duration']) {
      expect(metaSidebar).toContain(`<div><dt>${label}</dt><dd>{meta.${label.toLowerCase()}}</dd></div>`);
      expect(sidePanel).toContain(`<div><dt>${label}</dt><dd>{meta.${label.toLowerCase()}}</dd></div>`);
    }
    expect(metaSidebar).toContain('reader?: ReaderViewModel;');
    expect(metaSidebar).toContain('{#if reader !== undefined}');
    expect(metaSidebar).toContain('<ReaderSidePanel {meta} {reader} {warnings} {normalized} {rawSources} {debugEnabled} />');
    expect(metaSidebar).toContain('<aside class="meta-sidebar" aria-label="会话摘要">');
  });
});

describe('Task 14 accessibility smoke contracts', () => {
  it('keeps the password and debug drawer controls accessible by labels', () => {
    const shareApp = readFileSync('src/apps/share/ShareApp.svelte', 'utf8');
    const rawJsonDrawer = readFileSync('src/apps/share/components/RawJsonDrawer.svelte', 'utf8');
    const drawer = readFileSync('src/shared/components/Drawer.svelte', 'utf8');

    expect(shareApp).toContain('<section class="state-card" aria-labelledby="password-title">');
    expect(shareApp).toContain('<h1 id="password-title">需要访问密码</h1>');
    expect(shareApp).toContain('<label for="share-password">访问密码</label>');
    expect(shareApp).toContain('<input id="share-password" bind:value={password} type="password" autocomplete="current-password" />');
    expect(shareApp).toContain('<button type="submit">查看分享</button>');
    expect(shareApp).toContain("new URLSearchParams(window.location.search).get('debug') === '1'");
    expect(shareApp).toContain('<RawJsonDrawer bind:open={debugOpen} title="调试数据" value={appState.view.normalized} />');
    expect(rawJsonDrawer).toContain('<Drawer bind:open title={title} label={title} closeLabel="关闭原始数据" {onClose}>');
    expect(drawer).toContain('role="dialog" aria-modal="true" aria-label={label} tabindex="-1"');
    expect(drawer).toContain('<button type="button" class="oc-drawer__backdrop" aria-label="关闭遮罩" onclick={closeFromBackdrop}></button>');
    expect(drawer).toContain('<button type="button" class="oc-drawer__close" aria-label={closeLabel} onclick={requestClose}>×</button>');
  });

  it('keeps reader navigation, collapse, and provenance source controls labelled', () => {
    const shell = readFileSync('src/apps/share/ReaderShell.svelte', 'utf8');
    const collapse = readFileSync('src/shared/components/Collapse.svelte', 'utf8');
    const inspector = readFileSync('src/apps/share/components/ProvenanceInspector.svelte', 'utf8');

    expect(shell).toContain('<div class="top-actions" aria-label="页面操作">');
    expect(shell).toContain('<section class="reader-flow" aria-labelledby="share-title">');
    expect(shell).toContain('<h1 id="share-title">{view.meta.title}</h1>');
    expect(shell).toContain('<nav class="section-rail" aria-label="分节导航">');
    expect(shell).toContain('<a href={`#${section.id}`} aria-label={`跳转到 ${section.label}`}>');
    expect(shell).toContain('<span class="rail-dot" aria-hidden="true"><Icon name="chevron" size={12} /></span>');
    expect(collapse).toContain('<button type="button" class="oc-collapse__button" aria-expanded={open} aria-controls={id} onclick={toggle}>');
    expect(collapse).toContain('<div id={id} class="oc-collapse__panel">');
    expect(inspector).toContain('<section class="provenance-inspector" aria-label="Raw provenance inspector">');
    expect(inspector).toContain('<div class="summary-chips" aria-label="Raw 来源摘要">');
    expect(inspector).toContain('<ul class="source-list" aria-label={`${row.target.label} raw 来源列表`}>');
    expect(inspector).toContain('aria-label={`查看 raw #${source.sourceIndex.rawItemIndex} 原始数据`}');
    expect(inspector).toContain('<RawJsonDrawer bind:open={drawerOpen} title={drawerTitle} value={drawerValue} />');
  });
});

describe('F2 patch data flow', () => {
  it('passes patch text from render items into PartRenderer and PatchPart', () => {
    const assistantCard = readFileSync('src/apps/share/components/AssistantMessageCard.svelte', 'utf8');
    const partRenderer = readFileSync('src/apps/share/components/PartRenderer.svelte', 'utf8');

    expect(assistantCard).toContain("import type { ReaderNarrativeViewItem, ReaderRenderItem } from '../reader-view-model';");
    expect(assistantCard).toContain('{#each item.renderItems as renderItem');
    expect(assistantCard).toContain("<PartRenderer item={renderItem} patch={renderItem.type === 'single' ? renderItem.patch : undefined} />");
    expect(assistantCard).not.toContain('{#each item.parts');

    expect(partRenderer).toContain('patch?: string;');
    expect(partRenderer).toContain('let { item, patch }: PartRendererProps = $props();');
    expect(partRenderer).toContain('<PatchPart part={{ files: item.part.files }} {patch} />');
    expect(partRenderer).not.toContain('<PatchPart part={{ files: item.part.files }} />');
  });
});
