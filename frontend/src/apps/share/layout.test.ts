import { describe, expect, it } from 'vitest';
import { realShareFixture } from '../../shared/domain/fixtures/realShareFixture';
import {
  buildNavSections,
  createShareViewModel,
  demoTurns,
  resolveShareID,
  sectionID,
  shareViewStateFromLoadState,
} from './layout';
import type { RawShareItem } from '../../shared/domain/types';

describe('share layout anchor mapping', () => {
  it('generates stable section ids from turn ids', () => {
    expect(sectionID('Turn: Alpha / Beta')).toBe('turn-turn-alpha-beta');
    expect(sectionID('   ')).toBe('turn-section');
  });

  it('creates one nav anchor for every demo timeline turn', () => {
    const sections = buildNavSections(demoTurns);

    expect(sections.map((section) => section.id)).toEqual(demoTurns.map((turn) => sectionID(turn.id)));
    expect(new Set(sections.map((section) => section.id)).size).toBe(demoTurns.length);
    expect(sections.every((section) => section.label.length > 0 && section.meta.length > 0)).toBe(true);
  });
});

describe('share app real-data view model', () => {
  it('normalizes fixture data, builds renderable turns, and avoids duplicate timeline messages', () => {
    const state = createShareViewModel(realShareFixture);

    expect(state.status).toBe('ready');
    if (state.status !== 'ready') {
      return;
    }

    const renderedMessageIDs = state.view.turns.reduce<string[]>((kinds, turn) => {
      kinds.push(...turn.blocks.map((block) => block.kind));
      return kinds;
    }, []).join('|');
    const turnMessageIDs = state.view.normalized.messages.map((message) => message.id);

    expect(state.view.turns).toHaveLength(1);
    expect(state.view.normalized.messages).toHaveLength(2);
    expect(new Set(turnMessageIDs).size).toBe(turnMessageIDs.length);
    expect(state.view.turns[0].blocks.map((block) => block.kind)).toEqual([
      'markdown',
      'reasoning',
      'tool',
      'patch',
      'unknown',
      'finish',
      'unknown',
    ]);
    expect(renderedMessageIDs.match(/markdown/g)).toHaveLength(1);
    expect(state.view.meta.counts).toContainEqual({ label: 'Messages', value: '2' });
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
    expect(shareViewStateFromLoadState({ status: 'password', message: '密码错误，请重试', isRetry: true })).toEqual({
      status: 'password',
      title: '密码错误，请重试',
      message: '密码错误，请重试',
      isRetry: true,
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
