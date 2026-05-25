import { describe, expect, it } from 'vitest';
import { realShareFixture } from '../../shared/domain/fixtures/realShareFixture';
import type { RawShareItem } from '../../shared/domain/types';
import { createShareViewModel, resolveRawSources, resolveShareID, shareViewStateFromLoadState } from './layout';

describe('share app reader-native view model', () => {
  it('normalizes fixture data and aligns reader sections with nav anchors', () => {
    const state = createShareViewModel(realShareFixture);

    expect(state.status).toBe('ready');
    if (state.status !== 'ready') return;

    const view = state.view;
    const messageIDs = view.normalized.messages.map((message) => message.id);
    const sectionIDs = view.reader.sections.map((section) => section.id);

    expect(view.normalized.messages).toHaveLength(2);
    expect(new Set(messageIDs).size).toBe(messageIDs.length);
    expect(view.reader.sections).toHaveLength(1);
    expect(view.navSections).toEqual(view.reader.navSections);
    expect(view.navSections.map((section) => section.id)).toEqual(sectionIDs);
    expect(view.navSections.every((section) => section.label.length > 0 && section.meta.length > 0)).toBe(true);
    expect(view.reader.mainNarrative.map((item) => item.id)).toEqual(['msg_user_001', 'msg_assistant_001']);
    const renderItemTypes = view.reader.mainNarrative.reduce<string[]>((types, item) => types.concat(item.renderItems.map((renderItem) => renderItem.type)), []);
    expect(renderItemTypes).toEqual(['single', 'single', 'tool-group', 'single', 'single', 'single', 'single']);
    expect(view.meta.counts).toEqual(expect.arrayContaining([
      { label: 'Sections', value: String(view.reader.sections.length) },
      { label: 'Messages', value: '2' },
      { label: 'Narrative', value: String(view.reader.mainNarrative.length) },
      { label: 'Side events', value: String(view.reader.sideItems.length) },
      { label: 'Tool runs', value: String(view.reader.toolRuns.length) },
      { label: 'Files', value: String(view.reader.fileSummaries.length) },
    ]));
    expect(view.meta.toolCounts).toContainEqual({ label: 'bash', value: 1 });
    expect(view.meta.filesChanged).toContain('frontend/src/shared/domain/fixtures/realShareFixture.ts');
    expect(view.meta.activity).toContain(`构建 ${view.reader.sections.length} 个 Reader 章节`);
  });

  it('maps malformed records to the corrupted-data Chinese state', () => {
    const state = createShareViewModel([{ type: 'message', data: 'broken' } as RawShareItem]);

    expect(state).toEqual({
      status: 'error',
      title: '分享数据损坏',
      message: '这份分享包含无法识别的数据结构，暂时无法安全展示。',
    });
  });

  it('maps valid but empty records to the empty Chinese state', () => {
    const state = createShareViewModel([{ type: 'session', data: { id: 'ses_empty' } }]);

    expect(state).toEqual({
      status: 'empty',
      title: '暂无可展示内容',
      message: '分享已创建，但当前没有可渲染的会话消息。',
    });
  });

  it('resolves raw source debug records for narrative, injected, side-event, and tool data', () => {
    const reminder = '<system-reminder>Use background_output</system-reminder><!-- OMO_INTERNAL_INITIATOR -->';
    const items = [
      { type: 'session', data: { id: 'ses_raw_sources' } },
      { type: 'message', data: { id: 'msg_raw_user', sessionID: 'ses_raw_sources', role: 'user', content: 'run it' } },
      { type: 'message', data: { id: 'msg_raw_assistant', sessionID: 'ses_raw_sources', role: 'assistant', parentID: 'msg_raw_user' } },
      { type: 'part', data: { id: 'part_raw_text', sessionID: 'ses_raw_sources', messageID: 'msg_raw_assistant', type: 'text', text: 'working' } },
      { type: 'part', data: { id: 'part_raw_reasoning', sessionID: 'ses_raw_sources', messageID: 'msg_raw_assistant', type: 'reasoning', text: 'side thought' } },
      { type: 'part', data: { id: 'part_raw_tool', sessionID: 'ses_raw_sources', messageID: 'msg_raw_assistant', type: 'tool', tool: 'bash', callID: 'call_raw', state: { status: 'completed', output: 'ok' } } },
      { type: 'message', data: { id: 'msg_raw_injected', sessionID: 'ses_raw_sources', role: 'user' } },
      { type: 'part', data: { id: 'part_raw_injected', sessionID: 'ses_raw_sources', messageID: 'msg_raw_injected', type: 'text', text: reminder } },
    ] satisfies RawShareItem[];

    const state = createShareViewModel(items);

    expect(state.status).toBe('ready');
    if (state.status !== 'ready') return;

    const view = state.view;
    const narrativeSources = resolveRawSources(view.rawSources, view.reader.provenance.byNarrativeID.msg_raw_user);
    const injectedSources = resolveRawSources(view.rawSources, view.reader.provenance.byMessageID.msg_raw_injected);
    const sideSources = resolveRawSources(view.rawSources, view.reader.provenance.bySideEventID['msg_raw_assistant:part_raw_reasoning']);
    const toolSources = resolveRawSources(view.rawSources, view.reader.provenance.byToolCallID.call_raw);

    expect(view.rawSources.entries).toHaveLength(items.length);
    expect(view.rawSources.sourceItems).toBe(items);
    expect(narrativeSources[0]).toMatchObject({ rawEntry: { rawIndex: 1, kind: 'message', messageID: 'msg_raw_user' }, sourceItem: items[1] });
    expect(injectedSources[0]).toMatchObject({ rawEntry: { rawIndex: 6, kind: 'message', messageID: 'msg_raw_injected' }, sourceItem: items[6] });
    expect(sideSources[0]).toMatchObject({ rawEntry: { rawIndex: 4, kind: 'reasoning', messageID: 'msg_raw_assistant' }, sourceItem: items[4] });
    expect(toolSources[0]).toMatchObject({ rawEntry: { rawIndex: 5, kind: 'tool', messageID: 'msg_raw_assistant' }, sourceItem: items[5] });
  });

  it('keeps OC and OMO injected user reminders and assistant-after-injection out of main narrative', () => {
    const reminder = '<system-reminder>\n[ALL BACKGROUND TASKS COMPLETE]\n</system-reminder><!-- OMO_INTERNAL_INITIATOR -->';
    const state = createShareViewModel([
      { type: 'session', data: { id: 'ses_injected' } },
      { type: 'message', data: { id: 'msg_real', sessionID: 'ses_injected', role: 'user', content: '继续' } },
      { type: 'message', data: { id: 'msg_reply', sessionID: 'ses_injected', role: 'assistant', parentID: 'msg_real' } },
      { type: 'part', data: { id: 'part_reply', sessionID: 'ses_injected', messageID: 'msg_reply', type: 'text', text: '好的' } },
      { type: 'message', data: { id: 'msg_injected', sessionID: 'ses_injected', role: 'user' } },
      { type: 'part', data: { id: 'part_injected', sessionID: 'ses_injected', messageID: 'msg_injected', type: 'text', text: reminder } },
      { type: 'message', data: { id: 'msg_after_injection', sessionID: 'ses_injected', role: 'assistant', parentID: 'msg_injected' } },
      { type: 'part', data: { id: 'part_after', sessionID: 'ses_injected', messageID: 'msg_after_injection', type: 'text', text: 'background result' } },
    ] satisfies RawShareItem[]);

    expect(state.status).toBe('ready');
    if (state.status !== 'ready') return;

    const view = state.view;
    expect(view.reader.sections).toHaveLength(1);
    expect(view.reader.sections[0].items.map((item) => item.id)).toEqual(['msg_real', 'msg_reply']);
    expect(view.reader.mainNarrative.map((item) => item.text)).toEqual(['继续', '好的']);
    expect(JSON.stringify(view.reader.mainNarrative)).not.toContain('OMO_INTERNAL_INITIATOR');
    expect(JSON.stringify(view.reader.mainNarrative)).not.toContain('background result');
    expect(JSON.stringify(view.reader.sections)).not.toContain('OMO_INTERNAL_INITIATOR');
    expect(JSON.stringify(view.reader.sideItems)).toContain('OMO_INTERNAL_INITIATOR');
    expect(view.reader.sideItems.map((item) => item.id)).toEqual(['msg_injected', 'msg_after_injection']);
  });

  it('keeps assistant-only reader sections visible without compatibility turns', () => {
    const state = createShareViewModel([
      { type: 'session', data: { id: 'ses_assistant_only' } },
      { type: 'message', data: { id: 'msg_orphan_assistant', sessionID: 'ses_assistant_only', role: 'assistant' } },
      { type: 'part', data: { id: 'part_orphan', sessionID: 'ses_assistant_only', messageID: 'msg_orphan_assistant', type: 'text', text: 'Orphan assistant answer' } },
    ] satisfies RawShareItem[]);

    expect(state.status).toBe('ready');
    if (state.status !== 'ready') return;

    expect(state.view.reader.sections[0].user).toBeUndefined();
    expect(state.view.reader.sections[0].assistants.map((item) => item.text)).toEqual(['Orphan assistant answer']);
    expect(state.view.navSections[0].id).toBe(state.view.reader.sections[0].id);
    expect(state.view.navSections[0]).toMatchObject({ meta: '助手 × 1', tone: 'assistant_response' });
  });

  it('maps T6 non-ready load states to Chinese app states', () => {
    expect(shareViewStateFromLoadState({ status: 'loading' })).toEqual({
      status: 'loading',
      title: '正在加载分享',
      message: '正在从服务器读取会话数据…',
    });
    expect(shareViewStateFromLoadState({ status: 'password', message: '需要访问密码', isRetry: false })).toEqual({
      status: 'password',
      title: '需要访问密码',
      message: '需要访问密码',
      isRetry: false,
    });
    expect(shareViewStateFromLoadState({ status: 'error', kind: 'not_found', message: '分享不存在' })).toEqual({
      status: 'error',
      title: '分享不存在',
      message: '分享不存在',
    });
    expect(shareViewStateFromLoadState({ status: 'error', kind: 'load_failed', message: '加载分享数据失败' })).toEqual({
      status: 'error',
      title: '加载分享数据失败',
      message: '加载分享数据失败',
    });
  });

  it('resolves share id from window before falling back to /share/:id', () => {
    window.SHARE_ID = 'from-window';
    expect(resolveShareID({ pathname: '/share/from-path' })).toBe('from-window');

    window.SHARE_ID = undefined;
    expect(resolveShareID({ pathname: '/share/from-path' })).toBe('from-path');
  });
});
