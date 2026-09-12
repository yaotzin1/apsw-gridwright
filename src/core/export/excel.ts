import type { ColumnValue } from '../types';
import { toText } from '../values';
import { escapeMarkup } from './escape';
import type { ExcelOptions, ExportTable } from './types';

/**
 * XML Spreadsheet 2003, which Excel and LibreOffice both open with no dependency at all.
 *
 * The cost is a dialog: Excel warns that the extension and the format do not match when the file
 * is served as `.xls`. That is why the comma-separated export is the default and this one is
 * offered rather than assumed. What it buys is typed cells, so a number sorts as a number and a
 * date is a date, which a comma-separated file cannot promise.
 */
export function formatExcelXml(table: ExportTable, options: ExcelOptions = {}): string {
    const sheet = escapeMarkup(options.sheetName ?? 'Sheet1');
    const columns = table.columns
        .map((column) =>
            column.width === undefined
                ? '   <Column ss:AutoFitWidth="1"/>'
                : `   <Column ss:AutoFitWidth="0" ss:Width="${column.width}"/>`,
        )
        .join('\n');

    const header = row(table.columns.map((column) => cell(column.header, column.header)));
    const body = table.rows
        .map((entry) => row(entry.text.map((text, index) => cell(text, entry.values[index]))))
        .join('\n');

    return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="${sheet}">
  <Table>
${columns}
${header}
${body}
  </Table>
 </Worksheet>
</Workbook>`;
}

const row = (cells: readonly string[]): string => `   <Row>${cells.join('')}</Row>`;

/**
 * One typed cell.
 *
 * A cell is typed only when the exported text is the plain rendering of the value. A column that
 * formatted it said what it wants the reader to see: a salary shown as `$120,000` and a boolean
 * shown as `Active` both travel as those words, in the spreadsheet exactly as in every other
 * format. Typing them anyway would make one export disagree with the others, silently.
 *
 * `exportValue` is the way to have both: `$120,000` on screen and `120000` in the file, where the
 * text then matches the number and this types it.
 */
function cell(text: string, value: ColumnValue): string {
    if (text !== toText(value)) {
        return `<Cell><Data ss:Type="String">${escapeMarkup(text)}</Data></Cell>`;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
        return `<Cell><Data ss:Type="Number">${value}</Data></Cell>`;
    }
    if (typeof value === 'boolean') {
        return `<Cell><Data ss:Type="Boolean">${value ? 1 : 0}</Data></Cell>`;
    }
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        // Excel's DateTime carries no zone, so the trailing Z is dropped rather than silently
        // shifting every timestamp by the reader's own offset.
        return `<Cell><Data ss:Type="DateTime">${value.toISOString().replace('Z', '')}</Data></Cell>`;
    }
    return `<Cell><Data ss:Type="String">${escapeMarkup(text)}</Data></Cell>`;
}
