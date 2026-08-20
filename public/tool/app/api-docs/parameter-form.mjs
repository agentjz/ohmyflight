import { escapeHtml } from "./catalog-view.mjs";

export function editableParameters(record) {
    return (record?.endpoint.parameters || []).filter((parameter) => (
        !parameter.fixed && !parameter.derived && !parameter.derivedFrom && !parameter.auto
    ));
}

function dynamicOptions(parameter, optionSources) {
    return parameter.optionSource
        ? optionSources.get(parameter.optionSource) || []
        : parameter.options || [];
}

function fieldHtml(parameter, optionSources) {
    const id = `parameter-${parameter.name}`;
    const condition = Object.entries(parameter.requiredWhen || {})[0] || [];
    const attributes = condition.length
        ? ` data-condition-name="${escapeHtml(condition[0])}" data-condition-value="${escapeHtml(condition[1])}"`
        : "";
    const required = parameter.required ? " required" : "";
    const label = `<label class="parameter-label" for="${escapeHtml(id)}">
        <span>${escapeHtml(parameter.label || parameter.name)}${parameter.required ? ` <span class="required">*</span>` : ""}</span>
        <span class="parameter-name">${escapeHtml(parameter.name)}</span>
    </label>`;
    let control;
    if (parameter.type === "select") {
        const options = dynamicOptions(parameter, optionSources);
        control = `<select id="${escapeHtml(id)}" data-parameter-name="${escapeHtml(parameter.name)}"${required}>
            <option value="">请选择</option>
            ${options.map((option) => `<option value="${escapeHtml(option.value)}"${String(parameter.default || "") === String(option.value) ? " selected" : ""}>${escapeHtml(option.displayLabel || option.label)}</option>`).join("")}
        </select>`;
    } else if (parameter.repeatable) {
        control = `<textarea id="${escapeHtml(id)}" data-parameter-name="${escapeHtml(parameter.name)}" placeholder="${escapeHtml(parameter.placeholder || "每行或逗号分隔")}"${required}>${escapeHtml(parameter.default || "")}</textarea>`;
    } else {
        const type = ["date", "month", "time", "datetime-local", "number"].includes(parameter.type) ? parameter.type : "text";
        control = `<input id="${escapeHtml(id)}" data-parameter-name="${escapeHtml(parameter.name)}" type="${type}" value="${escapeHtml(parameter.default || "")}" placeholder="${escapeHtml(parameter.placeholder || "")}"${parameter.maxlength ? ` maxlength="${escapeHtml(parameter.maxlength)}"` : ""}${required}>`;
    }
    return `<div class="parameter-field"${attributes}>${label}${control}<p class="parameter-description">${escapeHtml(parameter.description || "")}</p></div>`;
}

function updateConditionalFields(form) {
    const values = {};
    form.querySelectorAll("[data-parameter-name]").forEach((control) => {
        values[control.dataset.parameterName] = control.value;
    });
    form.querySelectorAll("[data-condition-name]").forEach((field) => {
        const active = String(values[field.dataset.conditionName] || "") === String(field.dataset.conditionValue || "");
        field.hidden = !active;
        const control = field.querySelector("input, textarea, select");
        if (control) control.required = active;
    });
}

export function renderParameterForm(form, record, optionSources, onChange) {
    const parameters = editableParameters(record);
    form.innerHTML = parameters.length
        ? parameters.map((parameter) => fieldHtml(parameter, optionSources)).join("")
        : `<p class="empty-parameters">无可编辑参数</p>`;
    form.querySelectorAll("input, textarea, select").forEach((control) => {
        const handleChange = () => {
            updateConditionalFields(form);
            onChange();
        };
        control.addEventListener("input", handleChange);
        control.addEventListener("change", handleChange);
    });
    updateConditionalFields(form);
}

export function collectParameters(form) {
    const values = {};
    form?.querySelectorAll("[data-parameter-name]").forEach((control) => {
        if (!control.closest(".parameter-field")?.hidden) values[control.dataset.parameterName] = control.value;
    });
    return values;
}

export function updateParameterAvailability(form, sessionReady) {
    form?.querySelectorAll("input, textarea, select").forEach((control) => {
        control.disabled = !sessionReady || Boolean(control.closest(".parameter-field")?.hidden);
    });
}
