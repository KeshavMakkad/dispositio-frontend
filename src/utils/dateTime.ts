const IST_TIME_ZONE = "Asia/Kolkata";
const IST_OFFSET = "+05:30";

const getDateTimePartsInIst = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return null;
    }

    const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: IST_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
    });

    const parts = formatter.formatToParts(parsed);

    const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const year = byType.year;
    const month = byType.month;
    const day = byType.day;
    const hour = byType.hour;
    const minute = byType.minute;
    const second = byType.second;

    if (!year || !month || !day || !hour || !minute || !second) {
        return null;
    }

    return { year, month, day, hour, minute, second };
};

export const toApiDateTimeIst = (dateTimeLocalValue: string) => {
    const trimmed = dateTimeLocalValue.trim();
    if (!trimmed) {
        return "";
    }

    const baseValue = trimmed.length === 16 ? `${trimmed}:00` : trimmed;
    const istDateTime = `${baseValue}${IST_OFFSET}`;

    const parsed = new Date(istDateTime);
    if (Number.isNaN(parsed.getTime())) {
        return "";
    }

    return istDateTime;
};

export const toDateTimeLocalValueFromApiIst = (value: string) => {
    const istParts = getDateTimePartsInIst(value);
    if (!istParts) {
        return "";
    }

    return `${istParts.year}-${istParts.month}-${istParts.day}T${istParts.hour}:${istParts.minute}`;
};

export const formatDateTimeIst = (value?: string) => {
    if (!value) {
        return "-";
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return value;
    }

    return parsed.toLocaleString("en-IN", {
        timeZone: IST_TIME_ZONE,
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        hourCycle: "h23",
    });
};

export const formatTimeIst = (value?: string) => {
    if (!value) {
        return "-";
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return value;
    }

    return parsed.toLocaleString("en-IN", {
        timeZone: IST_TIME_ZONE,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        hourCycle: "h23",
    });
};
