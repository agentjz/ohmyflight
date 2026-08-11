// 生成应用的内联样式

export const GeneratedAppStyles = {
    generate: () => `
        :root {
            color-scheme: light;
            --watchdog-page-bg: #f1f2f0;
            --watchdog-surface: #fbfbfa;
            --watchdog-surface-soft: #eef0f1;
            --watchdog-text: #1f2933;
            --watchdog-text-muted: #596675;
            --watchdog-border: #4b5563;
            --watchdog-border-strong: #27313d;
            --watchdog-focus: #37b8e9;
            --watchdog-accent-pink: #f472b6;
            --watchdog-accent-sky: #38bdf8;
            --watchdog-accent-mint: #a3e635;
            --watchdog-on-accent: #252a30;
            --watchdog-shadow-color: rgba(39, 49, 61, 0.28);
            --watchdog-shadow-sm: 3px 3px 0 var(--watchdog-shadow-color);
            --watchdog-shadow-focus: 4px 4px 0 color-mix(in srgb, var(--watchdog-focus) 58%, transparent);
            --watchdog-danger-bg: #f5dde1;
            --watchdog-danger-text: #8a3441;
            --watchdog-danger-border: #ad5966;
            --watchdog-success-bg: #dcefdc;
            --watchdog-success-text: #245c3f;
            --watchdog-success-border: #4c8064;
        }
        @media (prefers-color-scheme: dark) {
            :root {
                color-scheme: dark;
                --watchdog-page-bg: #22262b;
                --watchdog-surface: #2d3238;
                --watchdog-surface-soft: #343a41;
                --watchdog-text: #f1f2f4;
                --watchdog-text-muted: #c5cad0;
                --watchdog-border: #a6adb6;
                --watchdog-border-strong: #c1c6cc;
                --watchdog-focus: #43c6f3;
                --watchdog-accent-pink: #f06db5;
                --watchdog-accent-sky: #38b7e9;
                --watchdog-accent-mint: #a7df45;
                --watchdog-on-accent: #22272d;
                --watchdog-shadow-color: rgba(0, 0, 0, 0.48);
                --watchdog-danger-bg: #51333a;
                --watchdog-danger-text: #efb4bd;
                --watchdog-danger-border: #c27a85;
                --watchdog-success-bg: #294438;
                --watchdog-success-text: #a9ddbd;
                --watchdog-success-border: #7aad91;
            }
        }
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
        }
        body {
            background: var(--watchdog-page-bg);
            color: var(--watchdog-text);
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
            background: var(--watchdog-surface);
            border: 2px solid var(--watchdog-border);
            border-radius: 0;
            box-shadow: var(--watchdog-shadow-sm);
            position: relative;
        }
        .header h1 { color: var(--watchdog-text); font-size: 24px; font-weight: 750; }
        .header p { color: var(--watchdog-text-muted); font-size: 14px; margin-top: 8px; }
        .panel {
            background: var(--watchdog-surface);
            border: 2px solid var(--watchdog-border);
            border-radius: 0;
            box-shadow: var(--watchdog-shadow-sm);
            padding: 20px;
        }
        .form-group { margin-bottom: 16px; }
        .form-group label {
            display: block;
            font-size: 14px;
            font-weight: 500;
            color: var(--watchdog-text);
            margin-bottom: 6px;
        }
        .form-group input[type="text"],
        .form-group input[type="date"],
        .form-group textarea {
            width: 100%;
            padding: 10px 12px;
            border: 2px solid var(--watchdog-border);
            border-radius: 0;
            background: var(--watchdog-surface);
            color: var(--watchdog-text);
            font-size: 14px;
            font-family: inherit;
        }
        .form-group input:focus,
        .form-group textarea:focus {
            outline: none;
            border-color: var(--watchdog-focus);
            outline: 2px solid var(--watchdog-focus);
            outline-offset: 2px;
            box-shadow: var(--watchdog-shadow-focus);
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
            border: 1px solid var(--watchdog-border);
            padding: 8px;
            text-align: left;
        }
        .loop-table th { background: var(--watchdog-surface-soft); font-weight: 700; }
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
            background: color-mix(in srgb, var(--watchdog-accent-sky) 12%, var(--watchdog-surface));
        }
        .btn {
            padding: 8px 16px;
            border: 2px solid var(--watchdog-border);
            border-radius: 0;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            background: var(--watchdog-surface);
            color: var(--watchdog-text);
            box-shadow: var(--watchdog-shadow-sm);
            transition: all 0.2s;
        }
        .btn:hover { border-color: var(--watchdog-border-strong); background: var(--watchdog-accent-mint); color: var(--watchdog-on-accent); box-shadow: none; transform: translate(2px, 2px); }
        .btn-primary { background: var(--watchdog-accent-sky); border-color: var(--watchdog-border-strong); color: var(--watchdog-on-accent); }
        .btn-primary:hover { background: var(--watchdog-accent-mint); }
        .btn-sm { padding: 4px 10px; font-size: 13px; }
        .btn-danger { background: var(--watchdog-danger-bg); color: var(--watchdog-danger-text); border-color: var(--watchdog-danger-border); }
        .btn-danger:hover { background: var(--watchdog-danger-bg); }
        .button-group { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 24px; }
        .required { color: var(--watchdog-danger-text); margin-left: 2px; }
        .upload-hint {
            background: var(--watchdog-surface-soft);
            border: 2px solid var(--watchdog-border);
            border-radius: 0;
            padding: 12px;
            margin-bottom: 16px;
            font-size: 14px;
            color: var(--watchdog-text-muted);
        }
        .upload-hint label { color: var(--watchdog-link, #256f8f); cursor: pointer; text-decoration: underline; }
        .upload-hint .file-name { color: var(--watchdog-text); font-weight: 600; margin-left: 8px; }
        .batch-section {
            margin-top: 28px;
            padding-top: 20px;
            border-top: 1px solid var(--watchdog-border);
        }
        .batch-section h2 {
            color: var(--watchdog-text);
            font-size: 18px;
            margin-bottom: 8px;
        }
        .batch-section p {
            color: var(--watchdog-text-muted);
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
            border: 2px solid var(--watchdog-border);
            border-radius: 0;
            background: var(--watchdog-surface-soft);
            color: var(--watchdog-text-muted);
            font-size: 14px;
            padding: 10px 12px;
            margin-top: 12px;
        }
        .batch-status.error {
            border-color: var(--watchdog-danger-border);
            background: var(--watchdog-danger-bg);
            color: var(--watchdog-danger-text);
        }
        .batch-status.success {
            border-color: var(--watchdog-success-border);
            background: var(--watchdog-success-bg);
            color: var(--watchdog-success-text);
        }
        .batch-preview-toggle {
            display: inline-flex;
            align-items: center;
            border: 2px solid var(--watchdog-border);
            border-radius: 0;
            background: var(--watchdog-surface);
            color: var(--watchdog-link, #256f8f);
            box-shadow: var(--watchdog-shadow-sm);
            font-size: 13px;
            font-weight: 500;
            padding: 6px 10px;
            margin-top: 10px;
            cursor: pointer;
        }
        .batch-preview-toggle:hover {
            background: var(--watchdog-accent-mint);
            box-shadow: none;
            color: var(--watchdog-on-accent);
            transform: translate(2px, 2px);
        }
        .batch-preview {
            width: 100%;
            border-collapse: collapse;
            margin-top: 12px;
            font-size: 13px;
        }
        .batch-preview th, .batch-preview td {
            border: 1px solid var(--watchdog-border);
            padding: 8px;
            text-align: left;
            vertical-align: top;
        }
        .batch-preview th { background: var(--watchdog-surface-soft); font-weight: 700; }
        .batch-preview .error { color: var(--watchdog-danger-text); }
        .batch-preview .success { color: var(--watchdog-success-text); }
        @media (max-width: 768px) {
            .button-group { flex-direction: column; }
            .btn { width: 100%; }
        }
`
};
