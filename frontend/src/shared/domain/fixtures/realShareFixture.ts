import type { RawShareItem } from '../types';

export const realShareFixture = [
  {
    type: 'session',
    data: {
      id: 'ses_1acff78b2ffeecr9dduoDyoRXA',
      slug: 'real-api-trimmed',
      projectID: 'proj_ocshare',
      directory: '/root/proj/ocshare',
      path: '/root/proj/ocshare',
      title: 'Inspect shared session data',
      agent: 'build',
      model: {
        id: 'gpt-5.5',
        providerID: 'aio',
      },
      version: '0.11.0',
      summary: {
        additions: 18,
        deletions: 4,
        files: 2,
      },
      cost: 0.018,
      tokens: {
        input: 4212,
        output: 1380,
        total: 5592,
        cache: {
          read: 1024,
          write: 128,
        },
      },
      share: {
        url: 'https://example.invalid/share/fixture',
      },
      time: {
        created: 1763243320000,
        updated: 1763243380000,
      },
    },
  },
  {
    type: 'session',
    data: {
      id: 'ses_1acff78b2ffeecr9dduoDyoRXA',
      title: 'Inspect shared session data - richer duplicate',
      summary: {
        additions: 20,
        deletions: 4,
        files: 3,
      },
      time: {
        created: 1763243320000,
        updated: 1763243600000,
      },
    },
  },
  {
    type: 'message',
    data: {
      id: 'msg_user_001',
      sessionID: 'ses_1acff78b2ffeecr9dduoDyoRXA',
      role: 'user',
      agent: 'build',
      model: {
        providerID: 'aio',
        modelID: 'gpt-5.5',
      },
      summary: {
        diffs: [
          {
            file: 'frontend/src/shared/domain/types.ts',
            patch: '@@ -1 +1 @@',
          },
        ],
      },
      time: {
        created: 1763243330000,
      },
    },
  },
  {
    type: 'message',
    data: {
      id: 'msg_user_001',
      sessionID: 'ses_1acff78b2ffeecr9dduoDyoRXA',
      role: 'user',
      mode: 'plan',
      content: 'Add compact fixtures from the real share API.',
      time: {
        created: 1763243330000,
        updated: 1763243335000,
      },
    },
  },
  {
    type: 'message',
    data: {
      id: 'msg_assistant_001',
      sessionID: 'ses_1acff78b2ffeecr9dduoDyoRXA',
      role: 'assistant',
      finish: 'stop',
      parentID: 'msg_user_001',
      cost: 0.012,
      tokens: {
        input: 900,
        output: 300,
        total: 1200,
      },
      time: {
        created: 1763243340000,
        updated: 1763243375000,
      },
    },
  },
  {
    type: 'part',
    data: {
      id: 'prt_text_001',
      type: 'text',
      sessionID: 'ses_1acff78b2ffeecr9dduoDyoRXA',
      messageID: 'msg_user_001',
      text: 'Please add representative fixture tests.',
    },
  },
  {
    type: 'part',
    data: {
      id: 'prt_text_001',
      type: 'text',
      sessionID: 'ses_1acff78b2ffeecr9dduoDyoRXA',
      messageID: 'msg_user_001',
      text: 'Please add representative fixture tests and keep the payload compact.',
      time: {
        created: 1763243331000,
        updated: 1763243339000,
      },
      metadata: {
        duplicateIntent: 'later-richer-version',
      },
    },
  },
  {
    type: 'part',
    data: {
      id: 'prt_reasoning_001',
      type: 'reasoning',
      sessionID: 'ses_1acff78b2ffeecr9dduoDyoRXA',
      messageID: 'msg_assistant_001',
      text: 'Need a fixture that preserves duplicate merge inputs.',
      metadata: {
        redacted: true,
      },
      time: {
        created: 1763243341000,
      },
    },
  },
  {
    type: 'part',
    data: {
      id: 'prt_tool_001',
      type: 'tool',
      sessionID: 'ses_1acff78b2ffeecr9dduoDyoRXA',
      messageID: 'msg_assistant_001',
      tool: 'bash',
      callID: 'call_fixture_summary',
      state: {
        status: 'completed',
        title: 'Summarize payload shape',
        input: 'python3 summarize_payload.py',
        output: 'top_types: part, message, model, session, session_diff',
        time: {
          start: 1763243342000,
          end: 1763243344000,
        },
      },
      metadata: {
        safeOutput: true,
      },
    },
  },
  {
    type: 'part',
    data: {
      id: 'prt_patch_001',
      type: 'patch',
      sessionID: 'ses_1acff78b2ffeecr9dduoDyoRXA',
      messageID: 'msg_assistant_001',
      files: ['frontend/src/shared/domain/fixtures/realShareFixture.ts'],
      hash: 'sha256:trimmed-fixture-patch',
    },
  },
  {
    type: 'part',
    data: {
      id: 'prt_step_start_001',
      type: 'step-start',
      sessionID: 'ses_1acff78b2ffeecr9dduoDyoRXA',
      messageID: 'msg_assistant_001',
      snapshot: 'before-fixture-edit',
    },
  },
  {
    type: 'part',
    data: {
      id: 'prt_step_finish_001',
      type: 'step-finish',
      sessionID: 'ses_1acff78b2ffeecr9dduoDyoRXA',
      messageID: 'msg_assistant_001',
      snapshot: 'after-fixture-edit',
      reason: 'stop',
      tokens: {
        input: 120,
        output: 80,
        total: 200,
      },
      cost: 0.002,
    },
  },
  {
    type: 'part',
    data: {
      id: 'prt_unknown_001',
      type: 'image-preview',
      sessionID: 'ses_1acff78b2ffeecr9dduoDyoRXA',
      messageID: 'msg_assistant_001',
      url: 'https://example.com/trimmed-preview.png',
      text: 'Unknown part subtype retained for resilience tests.',
    },
  },
  {
    type: 'session_diff',
    data: [
      {
        file: 'frontend/src/shared/domain/fixtures/realShareFixture.ts',
        patch: '@@ -0,0 +1,20 @@\n+export const realShareFixture = [...]',
        status: 'added',
        additions: 20,
        deletions: 0,
      },
      {
        file: 'frontend/src/shared/domain/fixtures/README.md',
        patch: '@@ -0,0 +1,8 @@\n+# Real share fixture',
        status: 'added',
        additions: 8,
        deletions: 0,
      },
    ],
  },
  {
    type: 'model',
    data: [
      {
        id: 'gpt-5.5',
        name: 'GPT 5.5',
        providerID: 'aio',
        status: 'stable',
        family: 'gpt',
        release_date: '2026-05-01',
        api: {
          npm: '@ai-sdk/openai-compatible',
          url: 'https://example.com/v1',
        },
        capabilities: {
          reasoning: true,
          toolcall: true,
          attachment: false,
          input: {
            text: true,
          },
          output: {
            text: true,
          },
        },
        cost: {
          input: 0.000001,
          output: 0.000004,
          cache: {
            read: 0.0000001,
            write: 0.0000002,
          },
        },
        limit: {
          context: 128000,
          output: 8192,
        },
        headers: {
          'x-fixture': 'trimmed',
        },
        variants: {
          default: {
            reasoningEffort: 'medium',
            include: ['reasoning.summary'],
          },
        },
      },
    ],
  },
  {
    type: 'telemetry_event',
    data: {
      id: 'evt_unknown_001',
      note: 'Unknown top-level item retained for future resilience tests.',
    },
  },
] satisfies RawShareItem[];

export type RealShareFixture = typeof realShareFixture;
