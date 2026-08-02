// 生成应用运行时：日期和文本格式化

export const GeneratedAppRuntimeDate = {
    generate: () => `
// 日期格式化
function padDatePart(value) {
    return String(value).padStart(2, '0');
}

function makeLocalDate(year, month, day) {
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
    const d = new Date(year, month - 1, day, 12, 0, 0, 0);
    if (
        Number.isNaN(d.getTime()) ||
        d.getFullYear() !== year ||
        d.getMonth() !== month - 1 ||
        d.getDate() !== day
    ) {
        return null;
    }
    return d;
}

function datePartsFromDate(value) {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) return null;
    let rounded = new Date(value.getTime());
    if (
        rounded.getHours() === 23 &&
        rounded.getMinutes() === 59 &&
        rounded.getSeconds() === 59 &&
        rounded.getMilliseconds() >= 900
    ) {
        rounded = new Date(rounded.getTime() + 1000);
    }
    return {
        year: rounded.getFullYear(),
        month: rounded.getMonth() + 1,
        day: rounded.getDate()
    };
}

function dateFromParts(parts) {
    return parts ? makeLocalDate(parts.year, parts.month, parts.day) : null;
}

function parseExcelSerialDate(serial) {
    if (!Number.isFinite(serial) || serial <= 0) return null;
    const parsed = XLSX.SSF.parse_date_code(serial);
    if (!parsed) return null;
    return makeLocalDate(parsed.y, parsed.m, parsed.d);
}

function parseDateValue(value) {
    if (value === undefined || value === null || value === '') return null;
    if (value instanceof Date) return dateFromParts(datePartsFromDate(value));
    if (typeof value === 'number') {
        const compact = Number.isInteger(value) ? String(value) : '';
        if (/^\\d{8}$/.test(compact)) {
            const compactDate = makeLocalDate(Number(compact.slice(0, 4)), Number(compact.slice(4, 6)), Number(compact.slice(6, 8)));
            if (compactDate) return compactDate;
        }
        return parseExcelSerialDate(value);
    }

    const raw = String(value).trim();
    if (!raw) return null;

    let matched = raw.match(/^(\\d{4})(\\d{2})(\\d{2})$/);
    if (matched) {
        return makeLocalDate(Number(matched[1]), Number(matched[2]), Number(matched[3]));
    }

    matched = raw.replace(/\\./g, '-').replace(/\\//g, '-').match(/^(\\d{4})-(\\d{1,2})-(\\d{1,2})$/);
    if (matched) {
        return makeLocalDate(Number(matched[1]), Number(matched[2]), Number(matched[3]));
    }

    if (/^\\d+(?:\\.\\d+)?$/.test(raw)) {
        return parseExcelSerialDate(Number(raw));
    }

    return null;
}

function formatDate(dateStr, format) {
    const d = parseDateValue(dateStr);
    if (!d) return '';
    format = format || 'YYYY年MM月DD日';
    return format
        .replace('YYYY', d.getFullYear())
        .replace('MM', String(d.getMonth() + 1).padStart(2, '0'))
        .replace('DD', String(d.getDate()).padStart(2, '0'));
}

function formatLocalDateStamp(value) {
    const d = value instanceof Date && !Number.isNaN(value.getTime()) ? value : new Date();
    return d.getFullYear() + '-' + padDatePart(d.getMonth() + 1) + '-' + padDatePart(d.getDate());
}

function formatPlainValue(value) {
    if (value instanceof Date) {
        const parts = datePartsFromDate(value);
        return parts ? parts.year + '-' + padDatePart(parts.month) + '-' + padDatePart(parts.day) : '';
    }
    return normalizeText(value);
}
`
};
