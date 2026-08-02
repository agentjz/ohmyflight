import { renderPreviewOverlays, updateOverlay } from "./canvas-actions";
import type { PdfStampAppContext, PdfStampRule } from "./models";

    function escapeHtml(value: unknown): string {
        return String(value || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    }

    function round2(value: number): number {
        return Math.round(value * 100) / 100;
    }

    function createRule(context: PdfStampAppContext, overrides?: Partial<PdfStampRule>): PdfStampRule {
        return context.logic.createRule(context.state.nextRuleId++, context.state.imgAspect, overrides);
    }

export function addRule(context: PdfStampAppContext, overrides?: Partial<PdfStampRule>): void {
        const rule = createRule(context, overrides);
        context.state.rules.push(rule);
        context.state.activeRuleId = rule.id;
        renderRules(context);
        updateOverlay(context);
        context.updateExportBtn();
    }

    function removeRule(context: PdfStampAppContext, id: number): void {
        context.state.rules = context.state.rules.filter(rule => rule.id !== id);
        if (context.state.activeRuleId === id) {
            context.state.activeRuleId = context.state.rules.length > 0 ? context.state.rules[0].id : null;
        }
        renderRules(context);
        updateOverlay(context);
        context.updateExportBtn();
    }

    function duplicateRule(context: PdfStampAppContext, id: number): void {
        const source = context.state.rules.find(rule => rule.id === id);
        if (!source) return;
        const { id: _id, ...copy } = source;
        addRule(context, copy);
    }

    function setActiveRule(context: PdfStampAppContext, id: number): void {
        if (context.state.activeRuleId === id) return;
        context.state.activeRuleId = id;
        renderRules(context);
        updateOverlay(context);
    }

    function onRuleFieldChange(context: PdfStampAppContext, ruleId: number, field: keyof PdfStampRule, value: unknown): void {
        const rule = context.state.rules.find(item => item.id === ruleId);
        if (!rule) return;
        context.replaceRule(context.logic.updateRuleField(rule, field, value, context.state.imgAspect));
        if (field === 'mode' || field === 'rangeStr' || field === 'wMm' || field === 'hMm') {
            renderRules(context);
        }
        if (context.state.activeRuleId === ruleId) {
            updateOverlay(context);
        }
        if (context.state.previewMode) {
            renderPreviewOverlays(context);
        }
    }

export function renderRules(context: PdfStampAppContext): void {
        const list = context.getElement<HTMLElement>('ruleList');
        if (context.state.rules.length === 0) {
            list.innerHTML = '<div class="text-muted small text-center py-3">暂无规则，点击上方"添加规则"</div>';
            return;
        }

        list.innerHTML = context.state.rules.map((rule, index) => {
            const active = rule.id === context.state.activeRuleId;
            const modeLabels = { all: '全部页面', odd: '奇数页', even: '偶数页', range: '指定页码' };
            return '<div class="rule-card' + (active ? ' active' : '') + '" data-rule-id="' + rule.id + '">' +
                '<div class="rule-header">' +
                    '<span class="fw-bold small">规则 ' + (index + 1) + ' <span class="badge bg-secondary">' + modeLabels[rule.mode] + '</span></span>' +
                    '<div class="rule-actions">' +
                        '<button class="btn btn-outline-secondary btn-sm duplicate-rule" data-rule-id="' + rule.id + '" title="复制规则">复制</button> ' +
                        '<button class="btn btn-outline-danger btn-sm remove-rule" data-rule-id="' + rule.id + '" title="删除规则">删除</button>' +
                    '</div>' +
                '</div>' +
                '<div class="row g-2 align-items-end">' +
                    '<div class="col-auto">' +
                        '<label class="form-label small mb-0">页面</label>' +
                        '<select class="form-select form-select-sm rule-field" data-rule-id="' + rule.id + '" data-field="mode" style="width:auto">' +
                            '<option value="all"' + (rule.mode === 'all' ? ' selected' : '') + '>全部</option>' +
                            '<option value="odd"' + (rule.mode === 'odd' ? ' selected' : '') + '>奇数页</option>' +
                            '<option value="even"' + (rule.mode === 'even' ? ' selected' : '') + '>偶数页</option>' +
                            '<option value="range"' + (rule.mode === 'range' ? ' selected' : '') + '>指定</option>' +
                        '</select>' +
                    '</div>' +
                    (rule.mode === 'range' ? '<div class="col"><input type="text" class="form-control form-control-sm rule-field" data-rule-id="' + rule.id + '" data-field="rangeStr" placeholder="1,3,5-10" value="' + escapeHtml(rule.rangeStr) + '"></div>' : '') +
                '</div>' +
                '<div class="row g-2 align-items-end mt-1">' +
                    '<div class="col-auto"><label class="form-label small mb-0">X</label><input type="number" class="form-control form-control-sm pos-input rule-field rule-activate" data-rule-id="' + rule.id + '" data-field="xMm" step="0.5" value="' + round2(rule.xMm) + '"></div>' +
                    '<div class="col-auto"><label class="form-label small mb-0">Y</label><input type="number" class="form-control form-control-sm pos-input rule-field rule-activate" data-rule-id="' + rule.id + '" data-field="yMm" step="0.5" value="' + round2(rule.yMm) + '"></div>' +
                    '<div class="col-auto"><label class="form-label small mb-0">宽</label><input type="number" class="form-control form-control-sm pos-input rule-field rule-activate" data-rule-id="' + rule.id + '" data-field="wMm" step="0.5" value="' + round2(rule.wMm) + '"></div>' +
                    '<div class="col-auto"><label class="form-label small mb-0">高</label><input type="number" class="form-control form-control-sm pos-input rule-field rule-activate" data-rule-id="' + rule.id + '" data-field="hMm" step="0.5" value="' + round2(rule.hMm) + '"></div>' +
                '</div>' +
                '<div class="d-flex align-items-center gap-3 mt-2">' +
                    '<div class="form-check"><input class="form-check-input rule-field" data-rule-id="' + rule.id + '" data-field="lockRatio" type="checkbox"' + (rule.lockRatio ? ' checked' : '') + '><label class="form-check-label small">锁定比例</label></div>' +
                    '<label class="small text-muted mb-0">透明度</label>' +
                    '<input type="range" class="form-range rule-field live-rule-field" data-rule-id="' + rule.id + '" data-field="opacity" min="0.1" max="1" step="0.05" value="' + rule.opacity + '" style="width:80px">' +
                '</div>' +
            '</div>';
        }).join('');

    }

export function bindRuleActions(context: PdfStampAppContext): void {
        context.getElement<HTMLButtonElement>('addRuleBtn').addEventListener('click', () => addRule(context));
        const list = context.getElement<HTMLElement>('ruleList');
        list.addEventListener('click', event => {
            const target = event.target as HTMLElement | null;
            if (!target) return;
            const button = target.closest<HTMLButtonElement>('button[data-rule-id]');
            const id = Number.parseInt((button || target.closest<HTMLElement>('.rule-card'))?.dataset.ruleId || '', 10);
            if (Number.isNaN(id)) return;
            if (button?.classList.contains('duplicate-rule')) duplicateRule(context, id);
            else if (button?.classList.contains('remove-rule')) removeRule(context, id);
            else if (!target.closest('button, select, input')) setActiveRule(context, id);
        });
        list.addEventListener('focusin', event => {
            const target = event.target;
            if (!(target instanceof HTMLElement) || !target.classList.contains('rule-activate')) return;
            setActiveRule(context, Number.parseInt(target.dataset.ruleId || '', 10));
        });
        list.addEventListener('change', event => handleFieldEvent(context, event));
        list.addEventListener('input', event => {
            const target = event.target;
            if (target instanceof HTMLElement && target.classList.contains('live-rule-field')) {
                handleFieldEvent(context, event);
            }
        });
    }

function handleFieldEvent(context: PdfStampAppContext, event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement) || !target.classList.contains('rule-field')) return;
    const field = target.dataset.field as keyof PdfStampRule | undefined;
    const ruleId = Number.parseInt(target.dataset.ruleId || '', 10);
    if (!field || Number.isNaN(ruleId)) return;
    onRuleFieldChange(context, ruleId, field, target instanceof HTMLInputElement && target.type === 'checkbox' ? target.checked : target.value);
}
