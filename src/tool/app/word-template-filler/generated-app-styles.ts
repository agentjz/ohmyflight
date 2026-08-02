// 生成应用的内联样式

export const GeneratedAppStyles = {
    generate: () => `
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
        }
        body {
            background: #f6f8fa;
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
            background: #ffffff;
            border: 1px solid #d0d7de;
            border-radius: 6px;
            position: relative;
        }
        .header h1 { color: #1f2328; font-size: 24px; font-weight: 600; }
        .header p { color: #656d76; font-size: 14px; margin-top: 8px; }
        .panel {
            background: #ffffff;
            border: 1px solid #d0d7de;
            border-radius: 6px;
            padding: 20px;
        }
        .form-group { margin-bottom: 16px; }
        .form-group label {
            display: block;
            font-size: 14px;
            font-weight: 500;
            color: #1f2328;
            margin-bottom: 6px;
        }
        .form-group input[type="text"],
        .form-group input[type="date"],
        .form-group textarea {
            width: 100%;
            padding: 10px 12px;
            border: 1px solid #d0d7de;
            border-radius: 6px;
            font-size: 14px;
            font-family: inherit;
        }
        .form-group input:focus,
        .form-group textarea:focus {
            outline: none;
            border-color: #2563eb;
            box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
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
            border: 1px solid #d0d7de;
            padding: 8px;
            text-align: left;
        }
        .loop-table th { background: #f6f8fa; font-weight: 500; }
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
            background: #f0f6ff;
        }
        .btn {
            padding: 8px 16px;
            border: 1px solid #d0d7de;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            background: #f6f8fa;
            color: #1f2328;
            transition: all 0.2s;
        }
        .btn:hover { border-color: #2563eb; color: #2563eb; }
        .btn-primary { background: #2563eb; border-color: #2563eb; color: white; }
        .btn-primary:hover { background: #1d4ed8; }
        .btn-sm { padding: 4px 10px; font-size: 13px; }
        .btn-danger { background: #cf222e; color: #fff; border: none; }
        .btn-danger:hover { background: #a40e26; }
        .button-group { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 24px; }
        .required { color: #cf222e; margin-left: 2px; }
        .upload-hint {
            background: #f6f8fa;
            border: 1px solid #d0d7de;
            border-radius: 6px;
            padding: 12px;
            margin-bottom: 16px;
            font-size: 14px;
            color: #656d76;
        }
        .upload-hint label { color: #2563eb; cursor: pointer; text-decoration: underline; }
        .upload-hint .file-name { color: #1f2328; font-weight: 500; margin-left: 8px; }
        .batch-section {
            margin-top: 28px;
            padding-top: 20px;
            border-top: 1px solid #d0d7de;
        }
        .batch-section h2 {
            color: #1f2328;
            font-size: 18px;
            margin-bottom: 8px;
        }
        .batch-section p {
            color: #656d76;
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
            border: 1px solid #d0d7de;
            border-radius: 6px;
            background: #f6f8fa;
            color: #656d76;
            font-size: 14px;
            padding: 10px 12px;
            margin-top: 12px;
        }
        .batch-status.error {
            border-color: #f1aeb5;
            background: #fff5f5;
            color: #cf222e;
        }
        .batch-status.success {
            border-color: #a3cfbb;
            background: #f0fff4;
            color: #1a7f37;
        }
        .batch-preview-toggle {
            display: inline-flex;
            align-items: center;
            border: 1px solid #d0d7de;
            border-radius: 6px;
            background: #ffffff;
            color: #2563eb;
            font-size: 13px;
            font-weight: 500;
            padding: 6px 10px;
            margin-top: 10px;
            cursor: pointer;
        }
        .batch-preview-toggle:hover {
            background: #f6f8fa;
        }
        .batch-preview {
            width: 100%;
            border-collapse: collapse;
            margin-top: 12px;
            font-size: 13px;
        }
        .batch-preview th, .batch-preview td {
            border: 1px solid #d0d7de;
            padding: 8px;
            text-align: left;
            vertical-align: top;
        }
        .batch-preview th { background: #f6f8fa; font-weight: 600; }
        .batch-preview .error { color: #cf222e; }
        .batch-preview .success { color: #1a7f37; }
        @media (max-width: 768px) {
            .button-group { flex-direction: column; }
            .btn { width: 100%; }
        }
`
};
