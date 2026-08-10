// 生成应用的内联样式

export const GeneratedAppStyles = {
    generate: () => `
        :root {
            color-scheme: light;
            --omf-page-bg: #f1f2f0;
            --omf-surface: #fbfbfa;
            --omf-surface-soft: #eef0f1;
            --omf-text: #1f2933;
            --omf-text-muted: #596675;
            --omf-border: #4b5563;
            --omf-border-strong: #27313d;
            --omf-focus: #37b8e9;
            --omf-accent-pink: #f472b6;
            --omf-accent-sky: #38bdf8;
            --omf-accent-mint: #a3e635;
            --omf-on-accent: #252a30;
            --omf-shadow-color: rgba(39, 49, 61, 0.28);
            --omf-shadow-sm: 3px 3px 0 var(--omf-shadow-color);
            --omf-shadow-focus: 4px 4px 0 color-mix(in srgb, var(--omf-focus) 58%, transparent);
            --omf-danger-bg: #f5dde1;
            --omf-danger-text: #8a3441;
            --omf-danger-border: #ad5966;
            --omf-success-bg: #dcefdc;
            --omf-success-text: #245c3f;
            --omf-success-border: #4c8064;
        }
        @media (prefers-color-scheme: dark) {
            :root {
                color-scheme: dark;
                --omf-page-bg: #22262b;
                --omf-surface: #2d3238;
                --omf-surface-soft: #343a41;
                --omf-text: #f1f2f4;
                --omf-text-muted: #c5cad0;
                --omf-border: #a6adb6;
                --omf-border-strong: #c1c6cc;
                --omf-focus: #43c6f3;
                --omf-accent-pink: #f06db5;
                --omf-accent-sky: #38b7e9;
                --omf-accent-mint: #a7df45;
                --omf-on-accent: #22272d;
                --omf-shadow-color: rgba(0, 0, 0, 0.48);
                --omf-danger-bg: #51333a;
                --omf-danger-text: #efb4bd;
                --omf-danger-border: #c27a85;
                --omf-success-bg: #294438;
                --omf-success-text: #a9ddbd;
                --omf-success-border: #7aad91;
            }
        }
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
        }
        body {
            background: var(--omf-page-bg);
            color: var(--omf-text);
            min-height: 100vh;
            padding: 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        .container { max-width: 800px; width: 100%; margin: 0 auto; }
        .header {
            text-align: center;
            margin-bottom: 24px;
            padding: 16px;
            background: var(--omf-surface);
            border: 2px solid var(--omf-border);
            border-radius: 0;
            box-shadow: var(--omf-shadow-sm);
            position: relative;
        }
        .header h1 { color: var(--omf-text); font-size: 24px; font-weight: 750; }
        .header p { color: var(--omf-text-muted); font-size: 14px; margin-top: 8px; }
        .panel {
            background: var(--omf-surface);
            border: 2px solid var(--omf-border);
            border-radius: 0;
            box-shadow: var(--omf-shadow-sm);
            padding: 20px;
        }
        .form-group { margin-bottom: 16px; }
        .form-group label {
            display: block;
            font-size: 14px;
            font-weight: 500;
            color: var(--omf-text);
            margin-bottom: 6px;
        }
        .form-group input[type="text"],
        .form-group input[type="date"],
        .form-group textarea {
            width: 100%;
            padding: 10px 12px;
            border: 2px solid var(--omf-border);
            border-radius: 0;
            background: var(--omf-surface);
            color: var(--omf-text);
            font-size: 14px;
            font-family: inherit;
        }
        .form-group input:focus,
        .form-group textarea:focus {
            outline: none;
            border-color: var(--omf-focus);
            outline: 2px solid var(--omf-focus);
            outline-offset: 2px;
            box-shadow: var(--omf-shadow-focus);
        }
        .form-group textarea { min-height: 80px; resize: vertical; }
        .radio-group, .checkbox-group { display: flex; gap: 16px; flex-wrap: wrap; }
        .checkbox-group { flex-direction: column; gap: 8px; }
        .radio-group label, .checkbox-group label {
            display: flex;
            align-items: center;
            gap: 6px;
            font-weight: normal;
            cursor: pointer;
        }
        .loop-table {
            width: 100%;
            border-collapse: collapse;
            margin: 10px 0;
            font-size: 14px;
        }
        .loop-table th, .loop-table td {
            border: 1px solid var(--omf-border);
            padding: 8px;
            text-align: left;
        }
        .loop-table th { background: var(--omf-surface-soft); font-weight: 700; }
        .loop-table input, .loop-table textarea, .loop-table select {
            width: 100%;
            border: none;
            padding: 4px;
            font-size: 14px;
            font-family: inherit;
            background: transparent;
        }
        .loop-table input:focus, .loop-table textarea:focus, .loop-table select:focus {
            outline: none;
            background: color-mix(in srgb, var(--omf-accent-sky) 12%, var(--omf-surface));
        }
        .btn {
            padding: 8px 16px;
            border: 2px solid var(--omf-border);
            border-radius: 0;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            background: var(--omf-surface);
            color: var(--omf-text);
            box-shadow: var(--omf-shadow-sm);
            transition: all 0.2s;
        }
        .btn:hover { border-color: var(--omf-border-strong); background: var(--omf-accent-mint); color: var(--omf-on-accent); box-shadow: none; transform: translate(2px, 2px); }
        .btn-primary { background: var(--omf-accent-sky); border-color: var(--omf-border-strong); color: var(--omf-on-accent); }
        .btn-primary:hover { background: var(--omf-accent-mint); }
        .btn-sm { padding: 4px 10px; font-size: 13px; }
        .btn-danger { background: var(--omf-danger-bg); color: var(--omf-danger-text); border-color: var(--omf-danger-border); }
        .btn-danger:hover { background: var(--omf-danger-bg); }
        .button-group { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 24px; }
        .required { color: var(--omf-danger-text); margin-left: 2px; }
        .upload-hint {
            background: var(--omf-surface-soft);
            border: 2px solid var(--omf-border);
            border-radius: 0;
            padding: 12px;
            margin-bottom: 16px;
            font-size: 14px;
            color: var(--omf-text-muted);
        }
        .upload-hint label { color: var(--omf-link, #256f8f); cursor: pointer; text-decoration: underline; }
        .upload-hint .file-name { color: var(--omf-text); font-weight: 600; margin-left: 8px; }
        .batch-section {
            margin-top: 28px;
            padding-top: 20px;
            border-top: 1px solid var(--omf-border);
        }
        .batch-section h2 {
            color: var(--omf-text);
            font-size: 18px;
            margin-bottom: 8px;
        }
        .batch-section p {
            color: var(--omf-text-muted);
            font-size: 14px;
            line-height: 1.6;
            margin-bottom: 12px;
        }
        .batch-actions {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            margin: 12px 0;
        }
        .batch-actions input[type="file"] { display: none; }
        .batch-status {
            border: 2px solid var(--omf-border);
            border-radius: 0;
            background: var(--omf-surface-soft);
            color: var(--omf-text-muted);
            font-size: 14px;
            padding: 10px 12px;
            margin-top: 12px;
        }
        .batch-status.error {
            border-color: var(--omf-danger-border);
            background: var(--omf-danger-bg);
            color: var(--omf-danger-text);
        }
        .batch-status.success {
            border-color: var(--omf-success-border);
            background: var(--omf-success-bg);
            color: var(--omf-success-text);
        }
        .batch-preview-toggle {
            display: inline-flex;
            align-items: center;
            border: 2px solid var(--omf-border);
            border-radius: 0;
            background: var(--omf-surface);
            color: var(--omf-link, #256f8f);
            box-shadow: var(--omf-shadow-sm);
            font-size: 13px;
            font-weight: 500;
            padding: 6px 10px;
            margin-top: 10px;
            cursor: pointer;
        }
        .batch-preview-toggle:hover {
            background: var(--omf-accent-mint);
            box-shadow: none;
            color: var(--omf-on-accent);
            transform: translate(2px, 2px);
        }
        .batch-preview {
            width: 100%;
            border-collapse: collapse;
            margin-top: 12px;
            font-size: 13px;
        }
        .batch-preview th, .batch-preview td {
            border: 1px solid var(--omf-border);
            padding: 8px;
            text-align: left;
            vertical-align: top;
        }
        .batch-preview th { background: var(--omf-surface-soft); font-weight: 700; }
        .batch-preview .error { color: var(--omf-danger-text); }
        .batch-preview .success { color: var(--omf-success-text); }
        @media (max-width: 768px) {
            .button-group { flex-direction: column; }
            .btn { width: 100%; }
        }
`
};
